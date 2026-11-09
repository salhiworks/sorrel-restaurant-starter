import { MAX_QUANTITY } from "./checkout-schema"
import type { Dish, Fulfillment, OrderItem, Settings } from "./types"

export type PricedOrder = {
  ok: true
  items: OrderItem[]
  subtotalCents: number
  deliveryFeeCents: number
  totalCents: number
}

export type PricingError = {
  ok: false
  code: "empty" | "unknown_dish" | "unavailable" | "quantity" | "fulfillment" | "minimum" | "ordering_off"
  message: string
  dishIds?: string[]
}

/**
 * The single source of truth for what an order costs. Used by the server for
 * real orders and by the browser for the demo, so both behave identically.
 */
export function priceOrder(
  catalog: Pick<Dish, "id" | "name" | "priceCents" | "available">[],
  settings: Pick<
    Settings,
    "orderingEnabled" | "pickupEnabled" | "deliveryEnabled" | "deliveryFeeCents" | "deliveryMinimumCents"
  >,
  lines: { dishId: string; quantity: number }[],
  fulfillment: Fulfillment,
): PricedOrder | PricingError {
  if (!settings.orderingEnabled) {
    return { ok: false, code: "ordering_off", message: "Online ordering is paused right now." }
  }
  if (fulfillment === "pickup" && !settings.pickupEnabled) {
    return { ok: false, code: "fulfillment", message: "Pickup isn't available at the moment." }
  }
  if (fulfillment === "delivery" && !settings.deliveryEnabled) {
    return { ok: false, code: "fulfillment", message: "Delivery isn't available at the moment." }
  }

  // Merge duplicate lines so a client can't sneak past per-line quantity limits.
  const merged = new Map<string, number>()
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      return { ok: false, code: "quantity", message: "Each item needs a quantity of at least one." }
    }
    merged.set(line.dishId, (merged.get(line.dishId) ?? 0) + line.quantity)
  }
  if (merged.size === 0) return { ok: false, code: "empty", message: "Your order is empty." }

  const byId = new Map(catalog.map((d) => [d.id, d]))
  const unknown: string[] = []
  const unavailable: string[] = []
  const items: OrderItem[] = []

  for (const [dishId, quantity] of merged) {
    const dish = byId.get(dishId)
    if (!dish) {
      unknown.push(dishId)
      continue
    }
    if (!dish.available) {
      unavailable.push(dishId)
      continue
    }
    if (quantity > MAX_QUANTITY) {
      return {
        ok: false,
        code: "quantity",
        message: `You can order up to ${MAX_QUANTITY} of ${dish.name} online. Call us for larger orders.`,
        dishIds: [dishId],
      }
    }
    items.push({
      dishId,
      name: dish.name,
      unitPriceCents: dish.priceCents,
      quantity,
      lineTotalCents: dish.priceCents * quantity,
    })
  }

  if (unknown.length) {
    return {
      ok: false,
      code: "unknown_dish",
      message: "Part of your order is no longer on the menu. Please review your cart.",
      dishIds: unknown,
    }
  }
  if (unavailable.length) {
    return {
      ok: false,
      code: "unavailable",
      message: "Something in your order has just sold out. Please review your cart.",
      dishIds: unavailable,
    }
  }

  const subtotalCents = items.reduce((sum, i) => sum + i.lineTotalCents, 0)
  if (fulfillment === "delivery" && subtotalCents < settings.deliveryMinimumCents) {
    return {
      ok: false,
      code: "minimum",
      message: "Your order is below the minimum for delivery.",
    }
  }
  const deliveryFeeCents = fulfillment === "delivery" ? settings.deliveryFeeCents : 0
  return { ok: true, items, subtotalCents, deliveryFeeCents, totalCents: subtotalCents + deliveryFeeCents }
}
