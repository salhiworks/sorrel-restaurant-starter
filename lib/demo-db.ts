"use client"

import { seedStorefront } from "./seed"
import type { Category, Dish, Order, Settings } from "./types"

/**
 * Demo Mode "database": lives in this browser's localStorage only.
 * Nothing here is sent anywhere. Clearing it restores the sample restaurant.
 */

export type DemoDb = {
  version: 1
  settings: Settings
  categories: Category[]
  dishes: Dish[]
  orders: Order[]
  /** true once the visitor has edited anything in the demo dashboard */
  edited: boolean
}

const KEY = "sorrel:demo-db:v1"
const EVENT = "sorrel:demo-db"

export function defaultDemoDb(): DemoDb {
  return {
    version: 1,
    settings: structuredClone(seedStorefront.settings),
    categories: structuredClone(seedStorefront.categories),
    dishes: structuredClone(seedStorefront.dishes),
    orders: [],
    edited: false,
  }
}

export function readDemoDb(): DemoDb | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DemoDb
    if (parsed?.version !== 1 || !Array.isArray(parsed.dishes)) return null
    // New settings keys added in later versions fall back to defaults.
    parsed.settings = { ...seedStorefront.settings, ...parsed.settings }
    return parsed
  } catch {
    return null
  }
}

export function writeDemoDb(db: DemoDb): { ok: true } | { ok: false; message: string } {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
    window.dispatchEvent(new Event(EVENT))
    return { ok: true }
  } catch {
    return {
      ok: false,
      message: "This browser's demo storage is full. Try a smaller photo, or reset the demo data.",
    }
  }
}

export function updateDemoDb(fn: (db: DemoDb) => DemoDb) {
  return writeDemoDb(fn(readDemoDb() ?? defaultDemoDb()))
}

export function clearDemoDb() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

/** Re-run `cb` when demo data changes in this tab or another tab. */
export function subscribeDemoDb(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb()
  }
  window.addEventListener(EVENT, cb)
  window.addEventListener("storage", onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener("storage", onStorage)
  }
}

export function demoId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}
