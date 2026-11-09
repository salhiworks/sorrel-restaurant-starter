import { z } from "zod"
import { ALLERGENS, DIETARY_TAGS } from "./types"

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #e8967a")
const text = (max: number) => z.string().trim().max(max)
const imageUrl = z
  .string()
  .trim()
  .max(2_000_000) // demo images are stored as data URLs in the browser
  .refine((v) => v.startsWith("/") || v.startsWith("https://") || v.startsWith("data:image/"), "Invalid image URL")

const day = z.object({ closed: z.boolean(), open: hhmm, close: hhmm })

export const settingsSchema = z.object({
  name: text(60).min(1, "Give the restaurant a name"),
  tagline: text(80),
  description: text(400),
  logoUrl: imageUrl.nullable(),
  phone: text(32),
  email: z.union([z.literal(""), z.string().trim().email("That email doesn't look right").max(120)]),
  addressLine: text(120),
  city: text(60),
  postcode: text(20),
  mapUrl: z.union([z.literal(""), z.string().trim().url("Use a full link starting with https://").max(500)]),
  timezone: text(60).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz })
      return true
    } catch {
      return false
    }
  }, "Unknown timezone, e.g. Europe/Dublin"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code, e.g. EUR"),
  locale: text(20).min(2),
  hours: z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }),
  orderingEnabled: z.boolean(),
  pickupEnabled: z.boolean(),
  deliveryEnabled: z.boolean(),
  deliveryFeeCents: z.number().int().min(0).max(100000),
  deliveryMinimumCents: z.number().int().min(0).max(1000000),
  prepMinutes: z.number().int().min(5).max(240),
  deliveryNote: text(240),
  heroTitle: text(120).min(1),
  heroIntro: text(300),
  storyTitle: text(120),
  storyBody: text(2000),
  instagramUrl: z.union([z.literal(""), z.string().trim().url().max(300)]),
  brandAccent: hex,
})

export const dishInputSchema = z.object({
  id: z.string().max(64).optional(),
  categoryId: z.string().max(64).nullable(),
  name: text(80).min(1, "Every dish needs a name"),
  tagline: text(120),
  description: text(1000),
  priceCents: z.number().int().min(0, "Price can't be negative").max(10000000),
  imageUrl: imageUrl.nullable(),
  imageAlt: text(200),
  ingredients: z.array(text(60).min(1)).max(20),
  allergens: z.array(z.enum(ALLERGENS)).max(14),
  dietary: z.array(z.enum(DIETARY_TAGS)).max(5),
  accent: hex,
  available: z.boolean(),
  featured: z.boolean(),
  inShowcase: z.boolean(),
  position: z.number().int().min(0).max(100000),
})
export type DishInput = z.infer<typeof dishInputSchema>

export const categoryInputSchema = z.object({
  id: z.string().max(64).optional(),
  name: text(60).min(1, "Name the category"),
  note: text(120),
  position: z.number().int().min(0).max(100000),
})
export type CategoryInput = z.infer<typeof categoryInputSchema>
