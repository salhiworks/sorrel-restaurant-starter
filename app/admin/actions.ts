"use server"

import { randomUUID } from "node:crypto"
import { redirect } from "next/navigation"
import { updateTag } from "next/cache"
import { z } from "zod"
import { categoryInputSchema, dishInputSchema, settingsSchema, type CategoryInput, type DishInput } from "@/lib/admin-schemas"
import { fieldErrors } from "@/lib/checkout-schema"
import { IS_LIVE, STORAGE_BUCKET } from "@/lib/env"
import { canTransition, STATUS_LABELS } from "@/lib/order-status"
import { seedCategories, seedDishes, seedSettings } from "@/lib/seed"
import { STOREFRONT_TAG } from "@/lib/data/storefront"
import { readCatalog } from "@/lib/data/catalog"
import { fromDish, toCategory, toDish, toOrder, toSettings, type DishRow, type OrderRow } from "@/lib/data/mappers"
import { ORDER_STATUSES, type Category, type Dish, type Order, type OrderStatus, type Settings } from "@/lib/types"
import type { AdminSnapshot, Result } from "@/lib/admin/backend"

/*
 * Every action here re-checks that the caller is a signed-in admin. The
 * session client also runs under Row Level Security, so even a bug here can't
 * let a non-admin write: the database refuses.
 */

const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
const fail = (message: string, fields?: Record<string, string>) => ({ ok: false as const, message, fields })
const NOT_ADMIN = "Your session has expired, or this account isn't an admin. Please sign in again."

async function requireAdmin() {
  if (!IS_LIVE) return null
  const { createSessionClient } = await import("@/lib/supabase/server")
  const db = await createSessionClient()
  const { data: userData } = await db.auth.getUser()
  const user = userData.user
  if (!user) return null
  const { data: admin } = await db.from("admins").select("user_id").eq("user_id", user.id).maybeSingle()
  if (!admin) return null
  return { db, user }
}

const storefrontChanged = () => updateTag(STOREFRONT_TAG)

type AdminDb = NonNullable<Awaited<ReturnType<typeof requireAdmin>>>["db"]

/** The storage path of an image uploaded to our bucket, or null for anything else. */
function bucketPath(url: string | null | undefined) {
  if (!url) return null
  const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0])
}

/**
 * Deletes a photo that was replaced or whose dish was deleted, unless another
 * dish or the logo still uses it. Best effort: a leftover file is harmless.
 */
async function removeUnusedImage(db: AdminDb, url: string | null | undefined) {
  const path = bucketPath(url)
  if (!path || !url) return
  const [{ count }, { data: settings }] = await Promise.all([
    db.from("dishes").select("id", { count: "exact", head: true }).eq("image_url", url),
    db.from("settings").select("data").eq("id", 1).maybeSingle(),
  ])
  if ((count ?? 0) > 0 || (settings?.data as { logoUrl?: string } | null)?.logoUrl === url) return
  const { error } = await db.storage.from(STORAGE_BUCKET).remove([path])
  if (error) console.error("[images] could not remove", path, error.message)
}

/* ----------------------------------------------------------------- auth */

export async function signIn(_prev: unknown, formData: FormData): Promise<{ message: string } | undefined> {
  if (!IS_LIVE) redirect("/admin")
  const creds = z
    .object({ email: z.string().trim().email(), password: z.string().min(6).max(200) })
    .safeParse({ email: formData.get("email"), password: formData.get("password") })
  if (!creds.success) return { message: "Enter your email and password." }

  const { createSessionClient } = await import("@/lib/supabase/server")
  const db = await createSessionClient()
  const { error } = await db.auth.signInWithPassword(creds.data)
  if (error) return { message: "That email and password don't match an account." }
  const session = await requireAdmin()
  if (!session) {
    await db.auth.signOut()
    return { message: "This account isn't an admin yet. Add it to the admins table (see the setup guide)." }
  }
  redirect("/admin")
}

export async function signOut() {
  if (IS_LIVE) {
    const { createSessionClient } = await import("@/lib/supabase/server")
    const db = await createSessionClient()
    await db.auth.signOut()
  }
  redirect("/admin/login")
}

/* ----------------------------------------------------------------- reads */

const ORDER_SELECT = "*, order_items(dish_id,name,unit_price_cents,quantity,line_total_cents)"

async function readOrders(db: AdminDb) {
  const { data, error } = await db.from("orders").select(ORDER_SELECT).order("created_at", { ascending: false }).limit(300)
  if (error) throw new Error(error.message)
  return (data as OrderRow[]).map(toOrder)
}

export async function adminLoad(): Promise<Result<AdminSnapshot>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  try {
    const [catalog, orders] = await Promise.all([readCatalog(s.db), readOrders(s.db)])
    return ok({ ...catalog, orders })
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load data.")
  }
}

export async function adminLoadOrders(): Promise<Result<Order[]>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  try {
    return ok(await readOrders(s.db))
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not load orders.")
  }
}

/* ----------------------------------------------------------------- menu */

export async function adminSaveDish(input: DishInput): Promise<Result<Dish>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const parsed = dishInputSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrors(parsed.error))
  if (parsed.data.imageUrl?.startsWith("data:")) return fail("Please upload the photo again.")
  const { id, ...rest } = parsed.data
  const row = fromDish(rest)
  const previous = id ? (await s.db.from("dishes").select("image_url").eq("id", id).maybeSingle()).data : null
  const q = id ? s.db.from("dishes").update(row).eq("id", id) : s.db.from("dishes").insert(row)
  const { data, error } = await q.select("*").single()
  if (error) return fail(`Couldn't save the dish: ${error.message}`)
  if (previous?.image_url && previous.image_url !== row.image_url) await removeUnusedImage(s.db, previous.image_url)
  storefrontChanged()
  return ok(toDish(data as DishRow))
}

export async function adminDeleteDish(id: string): Promise<Result> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const { data: deleted, error } = await s.db.from("dishes").delete().eq("id", id).select("image_url").maybeSingle()
  if (error) return fail(`Couldn't delete the dish: ${error.message}`)
  await removeUnusedImage(s.db, deleted?.image_url)
  storefrontChanged()
  return ok(undefined)
}

const idList = z.array(z.string().uuid()).max(500)

export async function adminReorderDishes(ids: string[]): Promise<Result> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const parsed = idList.safeParse(ids)
  if (!parsed.success) return fail("Invalid order.")
  const results = await Promise.all(parsed.data.map((id, position) => s.db.from("dishes").update({ position }).eq("id", id)))
  const error = results.find((r) => r.error)?.error
  if (error) return fail(`Couldn't reorder: ${error.message}`)
  storefrontChanged()
  return ok(undefined)
}

export async function adminSaveCategory(input: CategoryInput): Promise<Result<Category>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const parsed = categoryInputSchema.safeParse(input)
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrors(parsed.error))
  const { id, ...row } = parsed.data
  const q = id ? s.db.from("categories").update(row).eq("id", id) : s.db.from("categories").insert(row)
  const { data, error } = await q.select("id,name,note,position").single()
  if (error) return fail(`Couldn't save the category: ${error.message}`)
  storefrontChanged()
  return ok(toCategory(data))
}

export async function adminDeleteCategory(id: string): Promise<Result> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const { error } = await s.db.from("categories").delete().eq("id", id)
  if (error) return fail(`Couldn't delete the category: ${error.message}`)
  storefrontChanged()
  return ok(undefined)
}

export async function adminReorderCategories(ids: string[]): Promise<Result> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const parsed = idList.safeParse(ids)
  if (!parsed.success) return fail("Invalid order.")
  const results = await Promise.all(parsed.data.map((id, position) => s.db.from("categories").update({ position }).eq("id", id)))
  const error = results.find((r) => r.error)?.error
  if (error) return fail(`Couldn't reorder: ${error.message}`)
  storefrontChanged()
  return ok(undefined)
}

/* ----------------------------------------------------------------- orders */

export async function adminUpdateOrderStatus(id: string, status: OrderStatus): Promise<Result<Order>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  if (!z.string().uuid().safeParse(id).success || !ORDER_STATUSES.includes(status)) return fail("Invalid request.")

  const { data: current, error: readError } = await s.db.from("orders").select("status").eq("id", id).maybeSingle()
  if (readError || !current) return fail("That order no longer exists.")
  const from = current.status as OrderStatus
  if (!canTransition(from, status)) {
    return fail(`This order is already ${STATUS_LABELS[from].toLowerCase()} — refresh to see the latest.`)
  }
  // Only update if nobody else changed it in the meantime.
  const { data, error } = await s.db
    .from("orders")
    .update({ status })
    .eq("id", id)
    .eq("status", from)
    .select(ORDER_SELECT)
    .maybeSingle()
  if (error) return fail(`Couldn't update the order: ${error.message}`)
  if (!data) return fail("Someone else just updated this order. Refresh to see the latest.")
  return ok(toOrder(data as OrderRow))
}

/* ----------------------------------------------------------------- settings */

export async function adminSaveSettings(settings: Settings): Promise<Result<Settings>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const parsed = settingsSchema.safeParse(settings)
  if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrors(parsed.error))
  if (parsed.data.logoUrl?.startsWith("data:")) return fail("Please upload the logo again.")
  const { data: before } = await s.db.from("settings").select("data").eq("id", 1).maybeSingle()
  const { error } = await s.db.from("settings").upsert({ id: 1, data: parsed.data })
  if (error) return fail(`Couldn't save settings: ${error.message}`)
  const oldLogo = (before?.data as { logoUrl?: string } | null)?.logoUrl
  if (oldLogo && oldLogo !== parsed.data.logoUrl) await removeUnusedImage(s.db, oldLogo)
  storefrontChanged()
  return ok(toSettings(parsed.data))
}

/* ----------------------------------------------------------------- images */

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
}

function matchesImageSignature(b: Uint8Array, type: string) {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to))
  switch (type) {
    case "image/jpeg":
      return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
    case "image/png":
      return b[0] === 0x89 && ascii(1, 4) === "PNG"
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP"
    case "image/avif":
      return ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))
    default:
      return false
  }
}

export async function adminUploadImage(formData: FormData): Promise<Result<string>> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const file = formData.get("file")
  const kind = formData.get("kind") === "logo" ? "logos" : "dishes"
  if (!(file instanceof File)) return fail("No file received.")
  const ext = IMAGE_TYPES[file.type]
  if (!ext) return fail("Please upload a JPG, PNG, WebP or AVIF image.")
  if (file.size > 4 * 1024 * 1024) return fail("Images must be under 4 MB.")
  // Don't trust the declared type alone: check the file really starts like that image format.
  if (!matchesImageSignature(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.type)) {
    return fail("That file isn't a valid image. Please upload a JPG, PNG, WebP or AVIF photo.")
  }

  const path = `${kind}/${randomUUID()}.${ext}`
  const { error } = await s.db.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  })
  if (error) return fail(`Upload failed: ${error.message}`)
  const { data } = s.db.storage.from(STORAGE_BUCKET).getPublicUrl(path)
  return ok(data.publicUrl)
}

/* ----------------------------------------------------------------- setup */

/** Copies the sample restaurant into an empty database, so there's something to edit. */
export async function adminImportSampleMenu(): Promise<Result> {
  const s = await requireAdmin()
  if (!s) return fail(NOT_ADMIN)
  const { count } = await s.db.from("dishes").select("id", { count: "exact", head: true })
  if ((count ?? 0) > 0) return fail("Your menu already has dishes, so the sample wasn't imported.")

  const { data: cats, error: catError } = await s.db
    .from("categories")
    .insert(seedCategories.map(({ name, note, position }) => ({ name, note, position })))
    .select("id,position")
  if (catError) return fail(`Import failed: ${catError.message}`)
  const idFor = new Map(seedCategories.map((c) => [c.id, cats.find((x) => x.position === c.position)?.id ?? null]))

  const { error: dishError } = await s.db.from("dishes").insert(
    seedDishes.map(({ id: _id, ...d }) => fromDish({ ...d, categoryId: d.categoryId ? (idFor.get(d.categoryId) ?? null) : null })),
  )
  if (dishError) return fail(`Import failed: ${dishError.message}`)

  const { data: existing } = await s.db.from("settings").select("data").eq("id", 1).maybeSingle()
  if (!existing || !existing.data || Object.keys(existing.data).length === 0) {
    await s.db.from("settings").upsert({ id: 1, data: seedSettings })
  }
  storefrontChanged()
  return ok(undefined)
}
