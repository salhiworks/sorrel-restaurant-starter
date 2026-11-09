"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { MAX_QUANTITY } from "@/lib/checkout-schema"
import type { Dish } from "@/lib/types"
import { useStore } from "./store-provider"

type Line = { dishId: string; quantity: number }
export type CartLine = Line & { dish: Dish | null; problem: "removed" | "unavailable" | null }

type Cart = {
  lines: CartLine[]
  count: number
  subtotalCents: number
  hasProblems: boolean
  add: (dish: Dish, quantity?: number) => void
  setQuantity: (dishId: string, quantity: number) => void
  remove: (dishId: string) => void
  clear: () => void
  removeProblems: () => void
  open: boolean
  setOpen: (open: boolean) => void
  ready: boolean
}

const CartContext = createContext<Cart | null>(null)
const KEY = "sorrel:cart:v1"

/**
 * The cart only stores dish ids and quantities. Names and prices always come
 * from the current menu, so a stale cart can never show an old price.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const { dishes } = useStore()
  const [raw, setRaw] = useState<Line[]>([])
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
      if (Array.isArray(parsed)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after hydration
        setRaw(
          parsed
            .filter((l) => typeof l?.dishId === "string" && Number.isInteger(l?.quantity))
            .map((l) => ({ dishId: l.dishId, quantity: Math.min(MAX_QUANTITY, Math.max(1, l.quantity)) })),
        )
      }
    } catch {}
    loaded.current = true
    setReady(true)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return
      try {
        setRaw(JSON.parse(e.newValue ?? "[]"))
      } catch {}
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    if (!loaded.current) return
    try {
      localStorage.setItem(KEY, JSON.stringify(raw))
    } catch {}
  }, [raw])

  const byId = useMemo(() => new Map(dishes.map((d) => [d.id, d])), [dishes])

  const lines = useMemo<CartLine[]>(
    () =>
      raw.map((l) => {
        const dish = byId.get(l.dishId) ?? null
        return { ...l, dish, problem: !dish ? "removed" : !dish.available ? "unavailable" : null }
      }),
    [raw, byId],
  )

  const add = useCallback((dish: Dish, quantity = 1) => {
    if (!dish.available) return
    let capped = false
    setRaw((prev) => {
      const existing = prev.find((l) => l.dishId === dish.id)
      if (existing) {
        const next = Math.min(MAX_QUANTITY, existing.quantity + quantity)
        capped = next === MAX_QUANTITY
        return prev.map((l) => (l.dishId === dish.id ? { ...l, quantity: next } : l))
      }
      return [...prev, { dishId: dish.id, quantity: Math.min(MAX_QUANTITY, quantity) }]
    })
    toast(capped ? `${dish.name} — that's the online maximum` : `${dish.name} added to your order`, {
      id: "cart-add",
      action: { label: "View order", onClick: () => setOpen(true) },
    })
  }, [])

  const setQuantity = useCallback((dishId: string, quantity: number) => {
    setRaw((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.dishId !== dishId)
        : prev.map((l) => (l.dishId === dishId ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l)),
    )
  }, [])

  const remove = useCallback((dishId: string) => setRaw((p) => p.filter((l) => l.dishId !== dishId)), [])
  const clear = useCallback(() => setRaw([]), [])
  const removeProblems = useCallback(
    () => setRaw((p) => p.filter((l) => byId.get(l.dishId)?.available)),
    [byId],
  )

  const value = useMemo<Cart>(() => {
    const valid = lines.filter((l) => !l.problem)
    return {
      lines,
      count: valid.reduce((n, l) => n + l.quantity, 0),
      subtotalCents: valid.reduce((n, l) => n + l.quantity * (l.dish?.priceCents ?? 0), 0),
      hasProblems: lines.some((l) => l.problem),
      add,
      setQuantity,
      remove,
      clear,
      removeProblems,
      open,
      setOpen,
      ready,
    }
  }, [lines, add, setQuantity, remove, clear, removeProblems, open, ready])

  return <CartContext value={value}>{children}</CartContext>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>")
  return ctx
}
