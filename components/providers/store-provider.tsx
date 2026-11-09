"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { readDemoDb, subscribeDemoDb } from "@/lib/demo-db"
import type { StorefrontData } from "@/lib/types"

type Store = StorefrontData & {
  mode: "demo" | "live"
  demoEdited: boolean
  /** Apply menu data the server just returned (e.g. after an order was refused because something changed). */
  applyLatest: (data: StorefrontData) => void
}

const StoreContext = createContext<Store | null>(null)

/**
 * Holds the menu and settings for client components. In Demo Mode, edits made
 * in the demo dashboard (stored in this browser) replace the sample data.
 */
export function StoreProvider({
  initial,
  mode,
  children,
}: {
  initial: StorefrontData
  mode: "demo" | "live"
  children: ReactNode
}) {
  const [demo, setDemo] = useState<StorefrontData | null>(null)
  // Newer data from the server, used until the page itself receives newer props.
  const [latest, setLatest] = useState<{ base: StorefrontData; data: StorefrontData } | null>(null)
  const applyLatest = useCallback((data: StorefrontData) => setLatest({ base: initial, data }), [initial])

  useEffect(() => {
    if (mode !== "demo") return
    const sync = () => {
      const db = readDemoDb()
      setDemo(db?.edited ? { settings: db.settings, categories: db.categories, dishes: db.dishes } : null)
    }
    sync()
    return subscribeDemoDb(sync)
  }, [mode])

  const value = useMemo<Store>(() => {
    const data = demo ?? (latest && latest.base === initial ? latest.data : initial)
    return {
      settings: data.settings,
      categories: [...data.categories].sort((a, b) => a.position - b.position),
      dishes: [...data.dishes].sort((a, b) => a.position - b.position),
      mode,
      demoEdited: Boolean(demo),
      applyLatest,
    }
  }, [demo, latest, initial, mode, applyLatest])

  return <StoreContext value={value}>{children}</StoreContext>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>")
  return ctx
}
