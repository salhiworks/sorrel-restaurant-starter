"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { AdminBackend, AdminSnapshot, Result } from "@/lib/admin/backend"
import { demoBackend } from "@/lib/admin/demo-backend"
import { liveBackend } from "@/lib/admin/live-backend"
import { clearDemoDb, subscribeDemoDb } from "@/lib/demo-db"
import type { CategoryInput, DishInput } from "@/lib/admin-schemas"
import type { Category, Dish, Order, OrderStatus, Settings } from "@/lib/types"

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AdminSnapshot }

type Admin = {
  mode: "demo" | "live"
  backend: AdminBackend
  state: State
  data: AdminSnapshot | null
  reload: () => Promise<void>
  refreshOrders: () => Promise<void>
  lastOrderCheck: Date | null
  saveDish: (input: DishInput) => Promise<Result<Dish>>
  deleteDish: (id: string) => Promise<Result>
  moveDish: (id: string, dir: -1 | 1) => Promise<void>
  patchDish: (dish: Dish, patch: Partial<Dish>) => Promise<Result<Dish>>
  saveCategory: (input: CategoryInput) => Promise<Result<Category>>
  deleteCategory: (id: string) => Promise<Result>
  moveCategory: (id: string, dir: -1 | 1) => Promise<void>
  setOrderStatus: (order: Order, status: OrderStatus) => Promise<Result<Order>>
  saveSettings: (settings: Settings) => Promise<Result<Settings>>
  resetDemo: () => Promise<void>
}

const AdminContext = createContext<Admin | null>(null)
const POLL_MS = 20_000

export function AdminProvider({ mode, children }: { mode: "demo" | "live"; children: ReactNode }) {
  const backend = mode === "live" ? liveBackend : demoBackend
  const router = useRouter()
  const [state, setState] = useState<State>({ status: "loading" })
  const [lastOrderCheck, setLastOrderCheck] = useState<Date | null>(null)
  const knownOrders = useRef<Set<string> | null>(null)

  const data = state.status === "ready" ? state.data : null
  const update = useCallback((fn: (d: AdminSnapshot) => AdminSnapshot) => {
    setState((s) => (s.status === "ready" ? { status: "ready", data: fn(s.data) } : s))
  }, [])

  const handleAuth = useCallback(
    (message: string) => {
      if (mode === "live" && /session|admin/i.test(message)) router.replace("/admin/login")
    },
    [mode, router],
  )

  const reload = useCallback(async () => {
    const res = await backend.load()
    if (res.ok) {
      knownOrders.current = new Set(res.data.orders.map((o) => o.id))
      setLastOrderCheck(new Date())
      setState({ status: "ready", data: res.data })
    } else {
      handleAuth(res.message)
      setState({ status: "error", message: res.message })
    }
  }, [backend, handleAuth])

  const refreshOrders = useCallback(async () => {
    const res = await backend.loadOrders()
    if (!res.ok) {
      handleAuth(res.message)
      return
    }
    setLastOrderCheck(new Date())
    const known = knownOrders.current
    if (known) {
      const fresh = res.data.filter((o) => !known.has(o.id))
      if (fresh.length) {
        toast(fresh.length === 1 ? `New order #${fresh[0].number} from ${fresh[0].customerName}` : `${fresh.length} new orders`, {
          id: "new-orders",
          action: { label: "Open", onClick: () => router.push("/admin/orders") },
        })
      }
    }
    knownOrders.current = new Set(res.data.map((o) => o.id))
    update((d) => ({ ...d, orders: res.data }))
  }, [backend, handleAuth, update, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load; state is set after the request resolves
    void reload()
  }, [reload])

  // New orders: poll in live mode; in demo mode, listen for orders placed in another tab.
  useEffect(() => {
    if (mode === "demo") return subscribeDemoDb(() => void refreshOrders())
    const tick = () => {
      if (document.visibilityState === "visible") void refreshOrders()
    }
    const t = setInterval(tick, POLL_MS)
    document.addEventListener("visibilitychange", tick)
    return () => {
      clearInterval(t)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [mode, refreshOrders])

  const report = useCallback(
    <T,>(res: Result<T>, success?: string) => {
      if (res.ok) {
        if (success) toast.success(success)
      } else {
        toast.error(res.message)
        handleAuth(res.message)
      }
      return res
    },
    [handleAuth],
  )

  const saveDish = useCallback(
    async (input: DishInput) => {
      const res = await backend.saveDish(input)
      if (res.ok) {
        update((d) => ({
          ...d,
          dishes: d.dishes.some((x) => x.id === res.data.id)
            ? d.dishes.map((x) => (x.id === res.data.id ? res.data : x))
            : [...d.dishes, res.data],
        }))
      }
      return report(res, input.id ? "Dish saved" : "Dish added")
    },
    [backend, update, report],
  )

  const patchDish = useCallback(
    async (dish: Dish, patch: Partial<Dish>) => {
      const next = { ...dish, ...patch }
      update((d) => ({ ...d, dishes: d.dishes.map((x) => (x.id === dish.id ? next : x)) })) // optimistic
      const res = await backend.saveDish(next)
      if (!res.ok) update((d) => ({ ...d, dishes: d.dishes.map((x) => (x.id === dish.id ? dish : x)) }))
      return report(res)
    },
    [backend, update, report],
  )

  const deleteDish = useCallback(
    async (id: string) => {
      const res = await backend.deleteDish(id)
      if (res.ok) update((d) => ({ ...d, dishes: d.dishes.filter((x) => x.id !== id) }))
      return report(res, "Dish deleted")
    },
    [backend, update, report],
  )

  const moveDish = useCallback(
    async (id: string, dir: -1 | 1) => {
      if (!data) return
      const sorted = [...data.dishes].sort((a, b) => a.position - b.position)
      const target = sorted.find((d) => d.id === id)
      if (!target) return
      // Move within the dish's own category, skipping dishes in other categories.
      const peers = sorted.filter((d) => d.categoryId === target.categoryId)
      const i = peers.findIndex((d) => d.id === id)
      const swap = peers[i + dir]
      if (!swap) return
      const ia = sorted.indexOf(target)
      const ib = sorted.indexOf(swap)
      ;[sorted[ia], sorted[ib]] = [sorted[ib], sorted[ia]]
      const ids = sorted.map((d) => d.id)
      const before = data.dishes
      update((d) => ({ ...d, dishes: sorted.map((x, position) => ({ ...x, position })) }))
      const res = await backend.reorderDishes(ids)
      if (!res.ok) update((d) => ({ ...d, dishes: before }))
      report(res)
    },
    [data, backend, update, report],
  )

  const saveCategory = useCallback(
    async (input: CategoryInput) => {
      const res = await backend.saveCategory(input)
      if (res.ok) {
        update((d) => ({
          ...d,
          categories: d.categories.some((x) => x.id === res.data.id)
            ? d.categories.map((x) => (x.id === res.data.id ? res.data : x))
            : [...d.categories, res.data],
        }))
      }
      return report(res, input.id ? "Category saved" : "Category added")
    },
    [backend, update, report],
  )

  const deleteCategory = useCallback(
    async (id: string) => {
      const res = await backend.deleteCategory(id)
      if (res.ok) {
        update((d) => ({
          ...d,
          categories: d.categories.filter((c) => c.id !== id),
          dishes: d.dishes.map((x) => (x.categoryId === id ? { ...x, categoryId: null } : x)),
        }))
      }
      return report(res, "Category deleted")
    },
    [backend, update, report],
  )

  const moveCategory = useCallback(
    async (id: string, dir: -1 | 1) => {
      if (!data) return
      const sorted = [...data.categories].sort((a, b) => a.position - b.position)
      const i = sorted.findIndex((c) => c.id === id)
      if (!sorted[i + dir]) return
      ;[sorted[i], sorted[i + dir]] = [sorted[i + dir], sorted[i]]
      const before = data.categories
      update((d) => ({ ...d, categories: sorted.map((c, position) => ({ ...c, position })) }))
      const res = await backend.reorderCategories(sorted.map((c) => c.id))
      if (!res.ok) update((d) => ({ ...d, categories: before }))
      report(res)
    },
    [data, backend, update, report],
  )

  const setOrderStatus = useCallback(
    async (order: Order, status: OrderStatus) => {
      const res = await backend.updateOrderStatus(order.id, status)
      if (res.ok) update((d) => ({ ...d, orders: d.orders.map((o) => (o.id === order.id ? res.data : o)) }))
      else void refreshOrders()
      return report(res)
    },
    [backend, update, report, refreshOrders],
  )

  const saveSettings = useCallback(
    async (settings: Settings) => {
      const res = await backend.saveSettings(settings)
      if (res.ok) update((d) => ({ ...d, settings: res.data }))
      return report(res, "Settings saved")
    },
    [backend, update, report],
  )

  const resetDemo = useCallback(async () => {
    clearDemoDb()
    await reload()
    toast.success("Demo data reset to the sample restaurant")
  }, [reload])

  const value = useMemo<Admin>(
    () => ({
      mode,
      backend,
      state,
      data,
      reload,
      refreshOrders,
      lastOrderCheck,
      saveDish,
      deleteDish,
      moveDish,
      patchDish,
      saveCategory,
      deleteCategory,
      moveCategory,
      setOrderStatus,
      saveSettings,
      resetDemo,
    }),
    [mode, backend, state, data, reload, refreshOrders, lastOrderCheck, saveDish, deleteDish, moveDish, patchDish, saveCategory, deleteCategory, moveCategory, setOrderStatus, saveSettings, resetDemo],
  )

  return <AdminContext value={value}>{children}</AdminContext>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>")
  return ctx
}

/** For pages: the loaded snapshot. Only call inside <AdminReady>. */
export function useAdminData() {
  const { data } = useAdmin()
  if (!data) throw new Error("Admin data not loaded")
  return data
}
