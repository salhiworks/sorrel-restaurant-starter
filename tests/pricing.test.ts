import { describe, expect, it } from "vitest"
import { priceOrder } from "@/lib/pricing"
import { seedSettings } from "@/lib/seed"

const catalog = [
  { id: "a", name: "Ribeye", priceCents: 3600, available: true },
  { id: "b", name: "Cake", priceCents: 900, available: true },
  { id: "c", name: "Figs", priceCents: 1000, available: false },
]
const settings = { ...seedSettings, deliveryFeeCents: 350, deliveryMinimumCents: 2500 }

describe("priceOrder", () => {
  it("prices from the catalog, not the client", () => {
    const r = priceOrder(catalog, settings, [{ dishId: "a", quantity: 2 }, { dishId: "b", quantity: 1 }], "pickup")
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.subtotalCents).toBe(8100)
    expect(r.deliveryFeeCents).toBe(0)
    expect(r.totalCents).toBe(8100)
    expect(r.items[0]).toMatchObject({ unitPriceCents: 3600, quantity: 2, lineTotalCents: 7200 })
  })

  it("adds the delivery fee and enforces the minimum", () => {
    const ok = priceOrder(catalog, settings, [{ dishId: "a", quantity: 1 }], "delivery")
    expect(ok.ok && ok.totalCents).toBe(3950)
    const low = priceOrder(catalog, settings, [{ dishId: "b", quantity: 1 }], "delivery")
    expect(low).toMatchObject({ ok: false, code: "minimum" })
  })

  it("merges duplicate lines before checking limits", () => {
    const r = priceOrder(catalog, settings, [{ dishId: "b", quantity: 15 }, { dishId: "b", quantity: 10 }], "pickup")
    expect(r).toMatchObject({ ok: false, code: "quantity" })
    const merged = priceOrder(catalog, settings, [{ dishId: "b", quantity: 2 }, { dishId: "b", quantity: 3 }], "pickup")
    expect(merged.ok && merged.items).toHaveLength(1)
    expect(merged.ok && merged.items[0].quantity).toBe(5)
  })

  it("rejects unknown, unavailable and zero-quantity items", () => {
    expect(priceOrder(catalog, settings, [{ dishId: "zzz", quantity: 1 }], "pickup")).toMatchObject({ ok: false, code: "unknown_dish" })
    expect(priceOrder(catalog, settings, [{ dishId: "c", quantity: 1 }], "pickup")).toMatchObject({ ok: false, code: "unavailable", dishIds: ["c"] })
    expect(priceOrder(catalog, settings, [{ dishId: "a", quantity: 0 }], "pickup")).toMatchObject({ ok: false, code: "quantity" })
    expect(priceOrder(catalog, settings, [], "pickup")).toMatchObject({ ok: false, code: "empty" })
  })

  it("respects ordering and fulfillment switches", () => {
    expect(priceOrder(catalog, { ...settings, orderingEnabled: false }, [{ dishId: "a", quantity: 1 }], "pickup")).toMatchObject({ ok: false, code: "ordering_off" })
    expect(priceOrder(catalog, { ...settings, deliveryEnabled: false }, [{ dishId: "a", quantity: 1 }], "delivery")).toMatchObject({ ok: false, code: "fulfillment" })
  })
})
