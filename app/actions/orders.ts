"use server"

import { createHash } from "node:crypto"
import { headers } from "next/headers"
import { checkoutSchema, fieldErrors } from "@/lib/checkout-schema"
import { clientAddress, rateLimitKey, trustedProxyHops } from "@/lib/client-ip"
import { IS_LIVE } from "@/lib/env"
import { checkOrderTime } from "@/lib/hours"
import { priceOrder } from "@/lib/pricing"
import { rateLimit } from "@/lib/rate-limit"
import { readCatalogFresh } from "@/lib/data/catalog"
import type { OrderItem, StorefrontData } from "@/lib/types"

export type PlaceOrderResult =
  | {
      ok: true
      orderId: string
      orderNumber: string
      items: OrderItem[]
      subtotalCents: number
      deliveryFeeCents: number
      totalCents: number
    }
  | {
      ok: false
      message: string
      fields?: Record<string, string>
      dishIds?: string[]
      /** The menu or settings changed: the current public menu, for the page to show. */
      latest?: StorefrontData
    }

const MIN_FILL_MS = 2500
/**
 * Orders one connection may place per window (enforced in the database).
 * Generous enough for an office or family sharing one internet connection.
 */
const MAX_ORDERS_PER_CLIENT = 8
/** Orders the whole site accepts per window: a backstop against floods from many addresses. */
const MAX_ORDERS_TOTAL = 60
const WINDOW_MINUTES = 10
/** Cheap per-process guard against hammering the endpoint (attempts, not orders). */
const MAX_ATTEMPTS_PER_PROCESS = 20
/** See lib/client-ip.ts. Read at runtime, so it can be changed without a rebuild. */
const PROXY_HOPS = trustedProxyHops(process.env.TRUSTED_PROXY)
let warnedNoClientIp = false

const TOO_MANY = "Too many orders from this connection. Please call us instead."
const BUSY = "We're receiving a lot of orders right now. Please try again in a few minutes or call us."

/**
 * Places a real order. The browser sends dish ids, quantities and contact
 * details only; every price, fee and total is recalculated here from the
 * current menu in the database.
 */
export async function placeOrder(input: unknown): Promise<PlaceOrderResult> {
  if (!IS_LIVE) {
    return { ok: false, message: "This site is in demo mode, so orders can't be sent to the restaurant." }
  }

  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fields: fieldErrors(parsed.error) }
  }
  const data = parsed.data

  // Bots: a hidden field humans never fill, and a minimum time on the form.
  // Answer like a failure without saying why.
  if (data.company || !data.startedAt || Date.now() - data.startedAt < MIN_FILL_MS) {
    return { ok: false, message: "We couldn't place that order. Please try again in a moment." }
  }

  // Only an address appended by a proxy we were told to trust counts. If none
  // can be established, the per-connection limit is skipped rather than
  // lumping every customer into one bucket; the site-wide limit still applies.
  const ip = clientAddress(await headers(), PROXY_HOPS)
  let ipHash: string | null = null
  if (ip) {
    const salt = process.env.ORDER_IP_SALT || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    ipHash = createHash("sha256").update(`${salt}:${rateLimitKey(ip)}`).digest("hex").slice(0, 32)
    if (!rateLimit(`order:${ipHash}`, MAX_ATTEMPTS_PER_PROCESS, WINDOW_MINUTES * 60_000)) {
      return { ok: false, message: TOO_MANY }
    }
  } else if (!warnedNoClientIp) {
    warnedNoClientIp = true
    console.warn(
      PROXY_HOPS
        ? "[sorrel] An order arrived without the X-Forwarded-For entry from your trusted proxy (TRUSTED_PROXY). Per-connection order limits are off for such requests."
        : "[sorrel] TRUSTED_PROXY is not set, so per-connection order limits are off. On Hostinger set TRUSTED_PROXY=hostinger (see README).",
    )
  }

  const { createServiceClient } = await import("@/lib/supabase/admin")
  const db = createServiceClient()

  // Always price from a fresh, uncached read of the menu.
  const catalog = await readCatalogFresh()
  const { settings, dishes } = catalog
  const timing = checkOrderTime(settings.hours, new Date(), settings.timezone, data.requestedTime, 10)
  if (timing === "closed") {
    return { ok: false, latest: catalog, message: "We're closed right now, so we can't take orders. Please check our opening hours." }
  }
  if (timing === "time_required") {
    return {
      ok: false,
      latest: catalog,
      message: "We're closed right now. Choose a time later today to pre-order.",
      fields: { requestedTime: "Choose a time later today" },
    }
  }
  if (timing === "time_invalid") {
    return {
      ok: false,
      latest: catalog,
      message: "That time isn't available any more.",
      fields: { requestedTime: "Please choose another time" },
    }
  }

  const priced = priceOrder(dishes, settings, data.items, data.fulfillment)
  if (!priced.ok) return { ok: false, latest: catalog, message: priced.message, dishIds: priced.dishIds }
  if (data.expectedTotalCents !== undefined && data.expectedTotalCents !== priced.totalCents) {
    return {
      ok: false,
      latest: catalog,
      message: "Prices have changed since you opened this page. Please check the updated total and place your order again.",
    }
  }

  const { data: created, error } = await db.rpc("place_order", {
    p_order: {
      fulfillment: data.fulfillment,
      customer_name: data.customerName,
      phone: data.phone,
      email: data.email,
      address: data.fulfillment === "delivery" ? data.address : "",
      notes: data.notes,
      requested_time: data.requestedTime || null,
      subtotal_cents: priced.subtotalCents,
      delivery_fee_cents: priced.deliveryFeeCents,
      total_cents: priced.totalCents,
      client_ip_hash: ipHash,
      idempotency_key: data.idempotencyKey ?? null,
    },
    p_items: priced.items.map((i) => ({
      dish_id: i.dishId,
      name: i.name,
      unit_price_cents: i.unitPriceCents,
      quantity: i.quantity,
      line_total_cents: i.lineTotalCents,
    })),
    p_max_per_client: MAX_ORDERS_PER_CLIENT,
    p_max_total: MAX_ORDERS_TOTAL,
    p_window_minutes: WINDOW_MINUTES,
  })

  if (error?.message === "rate_limited") {
    return { ok: false, message: error.hint === "total" ? BUSY : TOO_MANY }
  }
  const row = (Array.isArray(created) ? created[0] : created) as
    | { order_id: string; order_number: number; duplicate: boolean }
    | undefined
  if (error || !row) {
    console.error("place_order failed", error?.code, error?.message)
    return { ok: false, message: "Something went wrong on our side. Your order was not placed — please try again or call us." }
  }

  if (row.duplicate) {
    // The same checkout was submitted twice (double tap, retry after a lost
    // connection). Confirm the order that already exists, with its stored totals.
    const { data: existing } = await db
      .from("orders")
      .select("subtotal_cents,delivery_fee_cents,total_cents,order_items(dish_id,name,unit_price_cents,quantity,line_total_cents)")
      .eq("id", row.order_id)
      .single()
    if (existing) {
      return {
        ok: true,
        orderId: row.order_id,
        orderNumber: String(row.order_number),
        items: existing.order_items.map((i) => ({
          dishId: i.dish_id ?? "",
          name: i.name,
          unitPriceCents: i.unit_price_cents,
          quantity: i.quantity,
          lineTotalCents: i.line_total_cents,
        })),
        subtotalCents: existing.subtotal_cents,
        deliveryFeeCents: existing.delivery_fee_cents,
        totalCents: existing.total_cents,
      }
    }
  }

  return {
    ok: true,
    orderId: row.order_id,
    orderNumber: String(row.order_number),
    items: priced.items,
    subtotalCents: priced.subtotalCents,
    deliveryFeeCents: priced.deliveryFeeCents,
    totalCents: priced.totalCents,
  }
}
