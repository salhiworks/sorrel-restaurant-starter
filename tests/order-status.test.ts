import { describe, expect, it } from "vitest"
import { canTransition, primaryNext } from "@/lib/order-status"

describe("order status transitions", () => {
  it("allows the normal kitchen flow", () => {
    expect(canTransition("new", "accepted")).toBe(true)
    expect(canTransition("accepted", "preparing")).toBe(true)
    expect(canTransition("preparing", "ready")).toBe(true)
    expect(canTransition("ready", "completed")).toBe(true)
  })
  it("blocks skipping backwards or reopening finished orders", () => {
    expect(canTransition("ready", "new")).toBe(false)
    expect(canTransition("new", "completed")).toBe(false)
    expect(canTransition("completed", "cancelled")).toBe(false)
    expect(canTransition("cancelled", "new")).toBe(false)
  })
  it("suggests the next step", () => {
    expect(primaryNext("new")).toBe("accepted")
    expect(primaryNext("ready")).toBe("completed")
    expect(primaryNext("completed")).toBeNull()
  })
})
