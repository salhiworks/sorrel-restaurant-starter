import { DAY_KEYS, type DayKey, type OpeningHours } from "./types"

const JS_DAY_TO_KEY: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number)
  return h * 60 + m
}

/** The weekday and minute-of-day in the restaurant's own timezone. */
export function localClock(date: Date, timeZone: string): { day: DayKey; minutes: number } {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)
  } catch {
    parts = new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const weekday = get("weekday").toLowerCase().slice(0, 3) as DayKey
  const day = DAY_KEYS.includes(weekday) ? weekday : JS_DAY_TO_KEY[date.getDay()]
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) }
}

/** Opening window for a day in minutes; close may exceed 1440 when it runs past midnight. */
function windowFor(hours: OpeningHours, day: DayKey): [number, number] | null {
  const d = hours[day]
  if (!d || d.closed) return null
  const open = toMinutes(d.open)
  let close = toMinutes(d.close)
  if (close <= open) close += 24 * 60
  return [open, close]
}

const prevDay = (day: DayKey): DayKey => DAY_KEYS[(DAY_KEYS.indexOf(day) + 6) % 7]
const nextDay = (day: DayKey, n = 1): DayKey => DAY_KEYS[(DAY_KEYS.indexOf(day) + n) % 7]

export type OpenStatus =
  | { open: true; closesAt: string }
  | { open: false; opensAt: string | null; opensDay: DayKey | null }

export function openStatus(hours: OpeningHours, date: Date, timeZone: string): OpenStatus {
  const { day, minutes } = localClock(date, timeZone)
  const today = windowFor(hours, day)
  if (today && minutes >= today[0] && minutes < today[1]) {
    return { open: true, closesAt: hours[day].close }
  }
  // Still inside yesterday's window that ran past midnight?
  const y = windowFor(hours, prevDay(day))
  if (y && y[1] > 1440 && minutes < y[1] - 1440) {
    return { open: true, closesAt: hours[prevDay(day)].close }
  }
  if (today && minutes < today[0]) return { open: false, opensAt: hours[day].open, opensDay: day }
  for (let i = 1; i <= 7; i++) {
    const d = nextDay(day, i)
    if (windowFor(hours, d)) return { open: false, opensAt: hours[d].open, opensDay: d }
  }
  return { open: false, opensAt: null, opensDay: null }
}

export function describeStatus(status: OpenStatus, today: DayKey): string {
  if (status.open) return `Open now · until ${status.closesAt}`
  if (!status.opensAt || !status.opensDay) return "Closed"
  if (status.opensDay === today) return `Closed · opens at ${status.opensAt}`
  if (status.opensDay === nextDay(today)) return `Closed · opens tomorrow ${status.opensAt}`
  return `Closed · opens ${DAY_LABELS[status.opensDay]} ${status.opensAt}`
}

/** Last bookable time is this many minutes before closing (matches the slot list). */
const LAST_SLOT_BEFORE_CLOSE = 15

/**
 * Whether a requested "HH:MM" later today falls inside today's opening window,
 * no later than 15 minutes before closing, and at least `leadMinutes` from now.
 */
export function isValidRequestedTime(
  hours: OpeningHours,
  date: Date,
  timeZone: string,
  requested: string,
  leadMinutes: number,
): boolean {
  if (!isValidHHMM(requested)) return false
  const { day, minutes } = localClock(date, timeZone)
  const w = windowFor(hours, day)
  if (!w) return false
  let t = toMinutes(requested)
  if (t < w[0] && w[1] > 1440) t += 1440 // e.g. 00:30 when closing at 02:00
  return t >= w[0] && t <= w[1] - LAST_SLOT_BEFORE_CLOSE && t >= minutes + leadMinutes
}

/** Pickup/delivery slots for the rest of today, every 15 minutes. */
export function todaySlots(hours: OpeningHours, date: Date, timeZone: string, leadMinutes: number): string[] {
  const { day, minutes } = localClock(date, timeZone)
  const w = windowFor(hours, day)
  if (!w) return []
  const start = Math.max(w[0], Math.ceil((minutes + leadMinutes) / 15) * 15)
  const out: string[] = []
  for (let t = start; t <= w[1] - LAST_SLOT_BEFORE_CLOSE; t += 15) {
    const m = t % 1440
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`)
  }
  return out
}

export function isValidHHMM(v: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
}

/**
 * What kind of order the restaurant can take right now:
 *  - "open":     as soon as possible, or a time later today;
 *  - "preorder": closed now but opening later today, so only a time later today;
 *  - "closed":   nothing more today.
 */
export type OrderingWindow =
  | { kind: "open"; slots: string[] }
  | { kind: "preorder"; slots: string[] }
  | { kind: "closed" }

export function orderingWindow(hours: OpeningHours, date: Date, timeZone: string, leadMinutes: number): OrderingWindow {
  const slots = todaySlots(hours, date, timeZone, leadMinutes)
  if (openStatus(hours, date, timeZone).open) return { kind: "open", slots }
  return slots.length ? { kind: "preorder", slots } : { kind: "closed" }
}

/**
 * The server's rule for accepting an order at `date` for `requested` ("" means
 * as soon as possible). Uses a shorter lead than the slot list to allow for
 * the customer's time on the form.
 */
export function checkOrderTime(
  hours: OpeningHours,
  date: Date,
  timeZone: string,
  requested: string,
  leadMinutes: number,
): "ok" | "closed" | "time_required" | "time_invalid" {
  const window = orderingWindow(hours, date, timeZone, leadMinutes)
  if (requested) {
    if (isValidRequestedTime(hours, date, timeZone, requested, leadMinutes)) return "ok"
    return window.kind === "closed" ? "closed" : "time_invalid"
  }
  if (window.kind === "open") return "ok"
  return window.kind === "preorder" ? "time_required" : "closed"
}
