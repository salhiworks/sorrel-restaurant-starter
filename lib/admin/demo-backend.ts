"use client"

import { categoryInputSchema, dishInputSchema, settingsSchema } from "@/lib/admin-schemas"
import { fieldErrors } from "@/lib/checkout-schema"
import { defaultDemoDb, demoId, readDemoDb, writeDemoDb, type DemoDb } from "@/lib/demo-db"
import { canTransition, STATUS_LABELS } from "@/lib/order-status"
import type { AdminBackend, Result } from "./backend"

const ok = <T,>(data: T): Result<T> => ({ ok: true, data })
const fail = (message: string, fields?: Record<string, string>) => ({ ok: false as const, message, fields })

function current(): DemoDb {
  return readDemoDb() ?? defaultDemoDb()
}

function commit(db: DemoDb): Result {
  const res = writeDemoDb({ ...db, edited: true })
  return res.ok ? ok(undefined) : fail(res.message)
}

/** Demo dashboard: real validation, but everything stays in this browser. */
export const demoBackend: AdminBackend = {
  mode: "demo",

  async load() {
    const db = current()
    return ok({ settings: db.settings, categories: db.categories, dishes: db.dishes, orders: db.orders })
  },

  async loadOrders() {
    return ok(current().orders)
  },

  async saveDish(input) {
    const parsed = dishInputSchema.safeParse(input)
    if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrors(parsed.error))
    const db = current()
    const dish = { ...parsed.data, id: parsed.data.id ?? demoId("dish") }
    const exists = db.dishes.some((d) => d.id === dish.id)
    const dishes = exists ? db.dishes.map((d) => (d.id === dish.id ? dish : d)) : [...db.dishes, dish]
    const res = commit({ ...db, dishes })
    return res.ok ? ok(dish) : res
  },

  async deleteDish(id) {
    const db = current()
    return commit({ ...db, dishes: db.dishes.filter((d) => d.id !== id) })
  },

  async reorderDishes(ids) {
    const db = current()
    const pos = new Map(ids.map((id, i) => [id, i]))
    return commit({ ...db, dishes: db.dishes.map((d) => ({ ...d, position: pos.get(d.id) ?? d.position })) })
  },

  async saveCategory(input) {
    const parsed = categoryInputSchema.safeParse(input)
    if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrors(parsed.error))
    const db = current()
    const cat = { ...parsed.data, id: parsed.data.id ?? demoId("cat") }
    const exists = db.categories.some((c) => c.id === cat.id)
    const categories = exists ? db.categories.map((c) => (c.id === cat.id ? cat : c)) : [...db.categories, cat]
    const res = commit({ ...db, categories })
    return res.ok ? ok(cat) : res
  },

  async deleteCategory(id) {
    const db = current()
    return commit({
      ...db,
      categories: db.categories.filter((c) => c.id !== id),
      dishes: db.dishes.map((d) => (d.categoryId === id ? { ...d, categoryId: null } : d)),
    })
  },

  async reorderCategories(ids) {
    const db = current()
    const pos = new Map(ids.map((id, i) => [id, i]))
    return commit({ ...db, categories: db.categories.map((c) => ({ ...c, position: pos.get(c.id) ?? c.position })) })
  },

  async updateOrderStatus(id, status) {
    const db = current()
    const order = db.orders.find((o) => o.id === id)
    if (!order) return fail("That order no longer exists.")
    if (!canTransition(order.status, status)) {
      return fail(`An order that is ${STATUS_LABELS[order.status].toLowerCase()} can't be marked ${STATUS_LABELS[status].toLowerCase()}.`)
    }
    const next = { ...order, status, updatedAt: new Date().toISOString() }
    // Orders are not "edits" to the menu, so don't flip the edited flag.
    const res = writeDemoDb({ ...db, orders: db.orders.map((o) => (o.id === id ? next : o)) })
    return res.ok ? ok(next) : fail(res.message)
  },

  async saveSettings(settings) {
    const parsed = settingsSchema.safeParse(settings)
    if (!parsed.success) return fail("Please check the highlighted fields.", fieldErrors(parsed.error))
    const res = commit({ ...current(), settings: parsed.data })
    return res.ok ? ok(parsed.data) : res
  },

  async uploadImage(file) {
    if (file.size > 1_500_000) return fail("That image is too large for demo storage.")
    const url = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    return ok(url)
  },

  async importSampleMenu() {
    return ok(undefined)
  },
}
