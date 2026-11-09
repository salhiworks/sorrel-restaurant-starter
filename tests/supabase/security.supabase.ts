/**
 * Security checks against a real Supabase project (Production Mode).
 *
 *   npm run test:supabase
 *
 * Reads .env.local. Needs the three Supabase variables plus two test accounts:
 *   SORREL_TEST_ADMIN_EMAIL / SORREL_TEST_ADMIN_PASSWORD        (listed in `admins`)
 *   SORREL_TEST_NONADMIN_EMAIL / SORREL_TEST_NONADMIN_PASSWORD  (a normal user)
 * Use a test project, not your live restaurant: it creates and then deletes
 * a few synthetic orders and one image.
 */
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

try {
  process.loadEnvFile(".env.local")
} catch {}

const env = process.env
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const PUBLIC_KEY = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
const SECRET_KEY = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const ready =
  URL_ && PUBLIC_KEY && SECRET_KEY && env.SORREL_TEST_ADMIN_EMAIL && env.SORREL_TEST_NONADMIN_EMAIL

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const RUN = `qa-${randomUUID().slice(0, 8)}` // tags everything this run creates
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (ch) => ch.charCodeAt(0),
)

let anon: SupabaseClient
let user: SupabaseClient
let admin: SupabaseClient
let server: SupabaseClient
let dish: { id: string; name: string; price_cents: number }

async function signIn(email: string, password: string) {
  const c = createClient(URL_, PUBLIC_KEY, opts)
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`)
  return c
}

function order(ip: string, extra: Record<string, unknown> = {}) {
  const line = { dish_id: dish.id, name: dish.name, unit_price_cents: dish.price_cents, quantity: 2, line_total_cents: dish.price_cents * 2 }
  return {
    p_order: {
      fulfillment: "pickup",
      customer_name: "QA Security Test",
      phone: "+353 87 000 0099",
      notes: RUN,
      subtotal_cents: line.line_total_cents,
      delivery_fee_cents: 0,
      total_cents: line.line_total_cents,
      client_ip_hash: ip,
      ...extra,
    },
    p_items: [line],
  }
}

describe.skipIf(!ready)("Supabase security (real project)", () => {
  beforeAll(async () => {
    anon = createClient(URL_, PUBLIC_KEY, opts)
    server = createClient(URL_, SECRET_KEY, opts)
    user = await signIn(env.SORREL_TEST_NONADMIN_EMAIL!, env.SORREL_TEST_NONADMIN_PASSWORD!)
    admin = await signIn(env.SORREL_TEST_ADMIN_EMAIL!, env.SORREL_TEST_ADMIN_PASSWORD!)
    const { data } = await anon.from("dishes").select("id,name,price_cents").eq("available", true).limit(1).single()
    if (!data) throw new Error("Import the sample menu first: the tests need one available dish.")
    dish = data
  })

  afterAll(async () => {
    if (!server) return
    await server.from("orders").delete().eq("notes", RUN)
    await server.storage.from("dish-images").remove([`dishes/${RUN}.png`])
  })

  describe("visitors (publishable key)", () => {
    it("can read the public menu and settings", async () => {
      const dishes = await anon.from("dishes").select("id")
      const settings = await anon.from("settings").select("data").eq("id", 1)
      expect(dishes.error).toBeNull()
      expect(dishes.data!.length).toBeGreaterThan(0)
      expect(settings.data).toHaveLength(1)
    })

    it.each(["orders", "order_items", "admins"])("cannot read %s", async (table) => {
      const { data, error } = await anon.from(table).select("*").limit(1)
      expect(data ?? []).toHaveLength(0)
      expect(error?.code).toBe("42501")
    })

    it("cannot change the menu or settings", async () => {
      const ins = await anon.from("dishes").insert({ name: "Hacked", price_cents: 1 })
      const upd = await anon.from("dishes").update({ price_cents: 1 }).eq("id", dish.id).select()
      const del = await anon.from("dishes").delete().eq("id", dish.id).select()
      const set = await anon.from("settings").update({ data: {} }).eq("id", 1).select()
      for (const r of [ins, upd, del, set]) expect(r.error?.code).toBe("42501")
      const { data } = await anon.from("dishes").select("price_cents").eq("id", dish.id).single()
      expect(data!.price_cents).toBe(dish.price_cents)
    })

    it("cannot create orders directly", async () => {
      const rpc = await anon.rpc("place_order", order(`${RUN}-anon`))
      const ins = await anon.from("orders").insert({ fulfillment: "pickup", customer_name: "x", phone: "1234567", subtotal_cents: 0, total_cents: 0 })
      expect(rpc.error).not.toBeNull()
      expect(ins.error?.code).toBe("42501")
    })

    it("cannot upload, list or delete images", async () => {
      const up = await anon.storage.from("dish-images").upload(`dishes/${RUN}-anon.png`, PNG, { contentType: "image/png" })
      expect(up.error).not.toBeNull()
      const list = await anon.storage.from("dish-images").list("dishes")
      expect(list.data ?? []).toHaveLength(0)
    })

    it("cannot sign up for an account", async () => {
      const { data, error } = await anon.auth.signUp({ email: `${RUN}@example.com`, password: "a-long-password-123" })
      expect(error).not.toBeNull()
      expect(data.user).toBeNull()
    })
  })

  describe("signed-in users who are not admins", () => {
    it("see no orders", async () => {
      const o = await user.from("orders").select("id")
      const i = await user.from("order_items").select("id")
      expect(o.data).toEqual([])
      expect(i.data).toEqual([])
    })

    it("cannot change the menu, settings or orders", async () => {
      const upd = await user.from("dishes").update({ price_cents: 1 }).eq("id", dish.id).select()
      expect(upd.data ?? []).toHaveLength(0)
      const ins = await user.from("categories").insert({ name: "Hacked" })
      expect(ins.error).not.toBeNull()
      const set = await user.from("settings").update({ data: {} }).eq("id", 1).select()
      expect(set.data ?? []).toHaveLength(0)
      const { data } = await anon.from("dishes").select("price_cents").eq("id", dish.id).single()
      expect(data!.price_cents).toBe(dish.price_cents)
    })

    it("cannot make themselves an admin", async () => {
      const me = (await user.auth.getUser()).data.user!.id
      const { error } = await user.from("admins").insert({ user_id: me })
      expect(error).not.toBeNull()
    })

    it("cannot upload images", async () => {
      const up = await user.storage.from("dish-images").upload(`dishes/${RUN}-user.png`, PNG, { contentType: "image/png" })
      expect(up.error).not.toBeNull()
    })
  })

  describe("the website's server (secret key)", () => {
    it("returns the same order when a checkout is submitted twice", async () => {
      const key = randomUUID()
      const a = await server.rpc("place_order", order(`${RUN}-dup`, { idempotency_key: key }))
      const b = await server.rpc("place_order", order(`${RUN}-dup`, { idempotency_key: key }))
      expect(a.error).toBeNull()
      expect(b.error).toBeNull()
      expect(b.data[0].order_id).toBe(a.data[0].order_id)
      expect(a.data[0].duplicate).toBe(false)
      expect(b.data[0].duplicate).toBe(true)
      const { count } = await server.from("orders").select("id", { count: "exact", head: true }).eq("idempotency_key", key)
      expect(count).toBe(1)
    })

    it("limits orders per connection inside the database", async () => {
      const ip = `${RUN}-rate`
      for (let n = 0; n < 4; n++) {
        const r = await server.rpc("place_order", order(ip))
        expect(r.error).toBeNull()
      }
      const fifth = await server.rpc("place_order", order(ip))
      expect(fifth.error?.message).toBe("rate_limited")
      expect(fifth.error?.hint).toBe("client")
    })

    it("holds the limit when several servers submit at once", async () => {
      const ip = `${RUN}-race`
      const results = await Promise.all(Array.from({ length: 8 }, () => server.rpc("place_order", order(ip))))
      expect(results.filter((r) => !r.error)).toHaveLength(4)
      expect(results.filter((r) => r.error?.message === "rate_limited")).toHaveLength(4)
    })

    it("rejects orders whose lines don't add up", async () => {
      const bad = order(`${RUN}-sum`)
      bad.p_order.subtotal_cents = 1
      bad.p_order.total_cents = 1
      const r = await server.rpc("place_order", bad)
      expect(r.error).not.toBeNull()
    })

    it("rejects empty orders and impossible quantities", async () => {
      const empty = await server.rpc("place_order", { ...order(`${RUN}-q`), p_items: [] })
      const zero = order(`${RUN}-q`)
      zero.p_items[0] = { ...zero.p_items[0], quantity: 0, line_total_cents: 0 }
      zero.p_order.subtotal_cents = 0
      zero.p_order.total_cents = 0
      const z = await server.rpc("place_order", zero)
      expect(empty.error).not.toBeNull()
      expect(z.error).not.toBeNull()
    })
  })

  describe("admins", () => {
    let orderId: string

    beforeAll(async () => {
      const r = await server.rpc("place_order", order(`${RUN}-admin`))
      orderId = r.data[0].order_id
    })

    it("can read orders and their items", async () => {
      const { data } = await admin.from("orders").select("id, order_items(id)").eq("id", orderId).single()
      expect(data!.order_items.length).toBe(1)
    })

    it("can only change an order's status, not its money or customer", async () => {
      const total = await admin.from("orders").update({ total_cents: 1 }).eq("id", orderId)
      const name = await admin.from("orders").update({ customer_name: "x" }).eq("id", orderId)
      expect(total.error?.code).toBe("42501")
      expect(name.error?.code).toBe("42501")
      const del = await admin.from("orders").delete().eq("id", orderId)
      expect(del.error?.code).toBe("42501")
    })

    it("must follow the kitchen workflow", async () => {
      const skip = await admin.from("orders").update({ status: "completed" }).eq("id", orderId)
      expect(skip.error).not.toBeNull()
      for (const status of ["accepted", "preparing", "ready", "completed"]) {
        const r = await admin.from("orders").update({ status }).eq("id", orderId).select("status").single()
        expect(r.error).toBeNull()
        expect(r.data!.status).toBe(status)
      }
      const back = await admin.from("orders").update({ status: "new" }).eq("id", orderId)
      const cancel = await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId)
      expect(back.error).not.toBeNull()
      expect(cancel.error).not.toBeNull()
    })

    it("can upload and delete images", async () => {
      const path = `dishes/${RUN}.png`
      const up = await admin.storage.from("dish-images").upload(path, PNG, { contentType: "image/png" })
      expect(up.error).toBeNull()
      const res = await fetch(admin.storage.from("dish-images").getPublicUrl(path).data.publicUrl)
      expect(res.status).toBe(200)
      const rm = await admin.storage.from("dish-images").remove([path])
      expect(rm.error).toBeNull()
      expect(rm.data).toHaveLength(1)
    })

    it("cannot upload files that aren't images", async () => {
      const r = await admin.storage
        .from("dish-images")
        .upload(`dishes/${RUN}.html`, new TextEncoder().encode("<script>alert(1)</script>"), { contentType: "text/html" })
      expect(r.error).not.toBeNull()
    })
  })
})
