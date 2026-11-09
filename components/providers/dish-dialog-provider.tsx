"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { DishDialog } from "@/components/site/dish-dialog"
import { useStore } from "./store-provider"

type Ctx = { openDish: (dishId: string) => void }
const DishDialogContext = createContext<Ctx | null>(null)

export function DishDialogProvider({ children }: { children: ReactNode }) {
  const { dishes } = useStore()
  const [dishId, setDishId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const openDish = useCallback((id: string) => {
    setDishId(id)
    setOpen(true)
  }, [])
  const dish = useMemo(() => dishes.find((d) => d.id === dishId) ?? null, [dishes, dishId])
  return (
    <DishDialogContext value={{ openDish }}>
      {children}
      <DishDialog dish={dish} open={open && !!dish} onOpenChange={setOpen} />
    </DishDialogContext>
  )
}

export function useDishDialog() {
  const ctx = useContext(DishDialogContext)
  if (!ctx) throw new Error("useDishDialog must be used inside <DishDialogProvider>")
  return ctx
}
