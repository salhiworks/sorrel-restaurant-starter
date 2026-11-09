import { describe, expect, it } from "vitest"
import { checkoutSchema, fieldErrors } from "@/lib/checkout-schema"

const base = {
  items: [{ dishId: "a", quantity: 1 }],
  fulfillment: "pickup" as const,
  customerName: "Aoife",
  phone: "+353 91 555 0100",
  email: "",
  address: "",
  notes: "",
  requestedTime: "",
}

describe("checkout schema", () => {
  it("accepts a minimal pickup order", () => {
    expect(checkoutSchema.safeParse(base).success).toBe(true)
  })
  it("requires an address for delivery", () => {
    const r = checkoutSchema.safeParse({ ...base, fulfillment: "delivery" })
    expect(r.success).toBe(false)
    if (!r.success) expect(fieldErrors(r.error).address).toBeDefined()
  })
  it("ignores any price fields a client tries to send", () => {
    const r = checkoutSchema.safeParse({ ...base, totalCents: 1, items: [{ dishId: "a", quantity: 1, priceCents: 1 }] })
    expect(r.success).toBe(true)
    if (r.success) {
      expect("totalCents" in r.data).toBe(false)
      expect("priceCents" in r.data.items[0]).toBe(false)
    }
  })
  it("rejects silly quantities and bad phone numbers", () => {
    expect(checkoutSchema.safeParse({ ...base, items: [{ dishId: "a", quantity: 500 }] }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false)
  })
})
