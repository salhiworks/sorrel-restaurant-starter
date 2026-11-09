import { z } from "zod"

export const MAX_QUANTITY = 20
export const MAX_LINES = 30

const trimmed = (max: number) => z.string().trim().max(max)

export const cartLineSchema = z.object({
  dishId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
})

/**
 * What the browser is allowed to send. Note there are no prices or totals:
 * the server derives every amount from its own catalog.
 */
export const checkoutSchema = z
  .object({
    items: z.array(cartLineSchema).min(1, "Your order is empty").max(MAX_LINES),
    fulfillment: z.enum(["pickup", "delivery"]),
    customerName: trimmed(80).min(2, "Please enter your name"),
    phone: trimmed(32).regex(/^[+()\d\s-]{6,}$/, "Please enter a phone number we can call"),
    email: z.union([z.literal(""), z.string().trim().max(120).email("That email doesn't look right")]),
    address: trimmed(240),
    notes: trimmed(500),
    requestedTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
    /** Honeypot: real people never see or fill this field. */
    company: z.string().max(200).optional(),
    /** When the form was opened (ms since epoch), for a minimum fill time. */
    startedAt: z.number().int().nonnegative().optional(),
    /** One random id per checkout attempt, so a resubmitted form can't create a second order. */
    idempotencyKey: z.string().uuid().optional(),
    /**
     * The total the customer was shown. Never used for pricing — only compared
     * with the server's own total so a changed price is never charged silently.
     */
    expectedTotalCents: z.number().int().nonnegative().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment === "delivery" && v.address.length < 6) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "Please enter a delivery address" })
    }
  })

export type CheckoutInput = z.infer<typeof checkoutSchema>

/** Flatten zod issues into { field: message } for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!out[key]) out[key] = issue.message
  }
  return out
}
