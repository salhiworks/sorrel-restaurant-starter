import { seedSettings } from "@/lib/seed"
import { settingsSchema } from "@/lib/admin-schemas"
import type { Allergen, Category, DietaryTag, Dish, Order, OrderItem, Settings } from "@/lib/types"

/* Database rows use snake_case; the app uses camelCase. */

export type CategoryRow = { id: string; name: string; note: string; position: number }
export type DishRow = {
  id: string
  category_id: string | null
  name: string
  tagline: string
  description: string
  price_cents: number
  image_url: string | null
  image_alt: string
  ingredients: string[]
  allergens: string[]
  dietary: string[]
  accent: string
  available: boolean
  featured: boolean
  in_showcase: boolean
  position: number
}

export const toCategory = (r: CategoryRow): Category => ({ id: r.id, name: r.name, note: r.note, position: r.position })

export const toDish = (r: DishRow): Dish => ({
  id: r.id,
  categoryId: r.category_id,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  priceCents: r.price_cents,
  imageUrl: r.image_url,
  imageAlt: r.image_alt,
  ingredients: r.ingredients ?? [],
  allergens: (r.allergens ?? []) as Allergen[],
  dietary: (r.dietary ?? []) as DietaryTag[],
  accent: r.accent,
  available: r.available,
  featured: r.featured,
  inShowcase: r.in_showcase,
  position: r.position,
})

export const fromDish = (d: Omit<Dish, "id">) => ({
  category_id: d.categoryId,
  name: d.name,
  tagline: d.tagline,
  description: d.description,
  price_cents: d.priceCents,
  image_url: d.imageUrl,
  image_alt: d.imageAlt,
  ingredients: d.ingredients,
  allergens: d.allergens,
  dietary: d.dietary,
  accent: d.accent,
  available: d.available,
  featured: d.featured,
  in_showcase: d.inShowcase,
  position: d.position,
})

/** Merge stored settings over defaults, dropping anything that fails validation. */
export function toSettings(data: unknown): Settings {
  const merged = { ...seedSettings, ...(typeof data === "object" && data ? data : {}) }
  const parsed = settingsSchema.safeParse(merged)
  if (parsed.success) return parsed.data
  // Keep valid keys only, fall back to defaults for the rest.
  const safe: Record<string, unknown> = { ...seedSettings }
  for (const key of Object.keys(seedSettings) as (keyof Settings)[]) {
    const single = settingsSchema.shape[key].safeParse((merged as Record<string, unknown>)[key])
    if (single.success) safe[key] = single.data
  }
  return safe as Settings
}

export type OrderRow = {
  id: string
  number: number
  status: Order["status"]
  fulfillment: Order["fulfillment"]
  customer_name: string
  phone: string
  email: string
  address: string
  notes: string
  requested_time: string | null
  subtotal_cents: number
  delivery_fee_cents: number
  total_cents: number
  created_at: string
  updated_at: string
  order_items?: {
    dish_id: string | null
    name: string
    unit_price_cents: number
    quantity: number
    line_total_cents: number
  }[]
}

export const toOrder = (r: OrderRow): Order => ({
  id: r.id,
  number: String(r.number),
  status: r.status,
  fulfillment: r.fulfillment,
  customerName: r.customer_name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  notes: r.notes,
  requestedTime: r.requested_time,
  items: (r.order_items ?? []).map(
    (i): OrderItem => ({
      dishId: i.dish_id ?? "",
      name: i.name,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
      lineTotalCents: i.line_total_cents,
    }),
  ),
  subtotalCents: r.subtotal_cents,
  deliveryFeeCents: r.delivery_fee_cents,
  totalCents: r.total_cents,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
