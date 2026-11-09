/**
 * Domain types shared by the storefront, the dashboard and the server.
 * Prices are always integer cents to avoid floating point rounding.
 */

export const DIETARY_TAGS = ["vegetarian", "vegan", "gluten-free", "dairy-free", "spicy"] as const
export type DietaryTag = (typeof DIETARY_TAGS)[number]

/** The 14 allergens restaurants in the EU/UK must declare. */
export const ALLERGENS = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const
export type Allergen = (typeof ALLERGENS)[number]

export type Category = {
  id: string
  name: string
  /** Short line shown under the category heading, e.g. "Until noon". */
  note: string
  position: number
}

export type Dish = {
  id: string
  categoryId: string | null
  name: string
  /** Short, evocative line for the showcase, e.g. "Beluga lentils, soft egg". */
  tagline: string
  description: string
  priceCents: number
  /** Public URL or site-relative path. Square, top-down photos work best. */
  imageUrl: string | null
  imageAlt: string
  ingredients: string[]
  allergens: Allergen[]
  dietary: DietaryTag[]
  /** Hex colour used for the showcase placemat and accents. */
  accent: string
  available: boolean
  featured: boolean
  inShowcase: boolean
  position: number
}

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export type DayHours = {
  closed: boolean
  /** "HH:MM", 24h, restaurant local time */
  open: string
  /** "HH:MM"; may be past midnight only if lower than open (e.g. 01:00) */
  close: string
}

export type OpeningHours = Record<DayKey, DayHours>

export type Settings = {
  name: string
  tagline: string
  description: string
  logoUrl: string | null
  phone: string
  email: string
  addressLine: string
  city: string
  postcode: string
  mapUrl: string
  timezone: string
  currency: string
  locale: string
  hours: OpeningHours
  orderingEnabled: boolean
  pickupEnabled: boolean
  deliveryEnabled: boolean
  deliveryFeeCents: number
  deliveryMinimumCents: number
  /** Minutes, shown to customers as an estimate. */
  prepMinutes: number
  deliveryNote: string
  heroTitle: string
  heroIntro: string
  storyTitle: string
  storyBody: string
  instagramUrl: string
  /** Default accent for the site chrome (buttons, highlights). */
  brandAccent: string
}

export const ORDER_STATUSES = ["new", "accepted", "preparing", "ready", "completed", "cancelled"] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type Fulfillment = "pickup" | "delivery"

export type OrderItem = {
  dishId: string
  name: string
  unitPriceCents: number
  quantity: number
  lineTotalCents: number
}

export type Order = {
  id: string
  number: string
  status: OrderStatus
  fulfillment: Fulfillment
  customerName: string
  phone: string
  email: string
  address: string
  notes: string
  requestedTime: string | null
  items: OrderItem[]
  subtotalCents: number
  deliveryFeeCents: number
  totalCents: number
  createdAt: string
  updatedAt: string
  /** true for orders that only exist in this browser's demo data */
  demo?: boolean
}

export type StorefrontData = {
  settings: Settings
  categories: Category[]
  dishes: Dish[]
}
