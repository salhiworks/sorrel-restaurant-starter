import { describe, expect, it } from "vitest"
import { checkOrderTime, localClock, openStatus, orderingWindow, todaySlots } from "@/lib/hours"
import { seedSettings } from "@/lib/seed"

const hours = seedSettings.hours
// 2026-11-10 is a Tuesday. Dublin is UTC+0 in November.
const at = (iso: string) => new Date(iso)

describe("opening hours", () => {
  it("reads the clock in the restaurant's timezone", () => {
    expect(localClock(at("2026-11-10T12:30:00Z"), "Europe/Dublin")).toEqual({ day: "tue", minutes: 750 })
    expect(localClock(at("2026-11-10T23:30:00Z"), "Asia/Tokyo").day).toBe("wed")
  })
  it("is open during the day and closed after hours", () => {
    expect(openStatus(hours, at("2026-11-10T12:00:00Z"), "Europe/Dublin")).toEqual({ open: true, closesAt: "22:00" })
    expect(openStatus(hours, at("2026-11-10T22:30:00Z"), "Europe/Dublin")).toMatchObject({ open: false, opensDay: "wed", opensAt: "08:00" })
  })
  it("skips closed days", () => {
    // Sunday 17:00 -> Monday is closed -> Tuesday 08:00
    expect(openStatus(hours, at("2026-11-15T17:00:00Z"), "Europe/Dublin")).toMatchObject({ open: false, opensDay: "tue" })
  })
  it("handles windows that run past midnight", () => {
    const late = { ...hours, fri: { closed: false, open: "18:00", close: "02:00" } }
    // Saturday 01:00 is still Friday night service
    expect(openStatus(late, at("2026-11-14T01:00:00Z"), "Europe/Dublin")).toEqual({ open: true, closesAt: "02:00" })
  })
})

describe("when orders can be placed", () => {
  // Tuesday: open 08:00–22:00. Monday: closed all day.
  const tz = "Europe/Dublin"

  it("takes as-soon-as-possible orders only while open", () => {
    expect(checkOrderTime(hours, at("2026-11-10T12:00:00Z"), tz, "", 10)).toBe("ok")
    expect(checkOrderTime(hours, at("2026-11-10T22:30:00Z"), tz, "", 10)).toBe("closed")
  })

  it("offers pre-orders, not ASAP, before opening on the same day", () => {
    const early = at("2026-11-10T06:30:00Z") // Tuesday 06:30, opens 08:00
    const w = orderingWindow(hours, early, tz, 20)
    expect(w.kind).toBe("preorder")
    expect(w.kind !== "closed" && w.slots[0]).toBe("08:00")
    expect(checkOrderTime(hours, early, tz, "", 10)).toBe("time_required")
    expect(checkOrderTime(hours, early, tz, "08:30", 10)).toBe("ok")
  })

  it("is closed all day on a closed day, even for a time", () => {
    const monday = at("2026-11-09T12:00:00Z")
    expect(orderingWindow(hours, monday, tz, 20).kind).toBe("closed")
    expect(checkOrderTime(hours, monday, tz, "", 10)).toBe("closed")
    expect(checkOrderTime(hours, monday, tz, "18:00", 10)).toBe("closed")
  })

  it("rejects times in the past, too soon, or too close to closing", () => {
    const noon = at("2026-11-10T12:00:00Z")
    expect(checkOrderTime(hours, noon, tz, "11:00", 10)).toBe("time_invalid")
    expect(checkOrderTime(hours, noon, tz, "12:05", 10)).toBe("time_invalid")
    expect(checkOrderTime(hours, noon, tz, "21:50", 10)).toBe("time_invalid")
    expect(checkOrderTime(hours, noon, tz, "21:45", 10)).toBe("ok")
  })

  it("lists the same last slot the server accepts", () => {
    const slots = todaySlots(hours, at("2026-11-10T20:00:00Z"), tz, 20)
    expect(slots.at(-1)).toBe("21:45")
  })
})
