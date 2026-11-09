"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useStore } from "@/components/providers/store-provider"
import { useCart } from "@/components/providers/cart-provider"
import { formatPrice } from "@/lib/money"
import { ALLERGEN_LABELS, DIETARY_LABELS } from "@/lib/labels"
import { MAX_QUANTITY } from "@/lib/checkout-schema"
import type { Dish } from "@/lib/types"
import { DishImage } from "./dish-image"

export function DishDialog({
  dish,
  open,
  onOpenChange,
}: {
  dish: Dish | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!dish) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The body mounts fresh on every open, so the quantity always starts at one. */}
      <DishDialogBody key={dish.id} dish={dish} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function DishDialogBody({ dish, onDone }: { dish: Dish; onDone: () => void }) {
  const { settings, categories } = useStore()
  const { add } = useCart()
  const [qty, setQty] = useState(1)
  const category = categories.find((c) => c.id === dish.categoryId)
  const canOrder = dish.available && settings.orderingEnabled
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)

  return (
      <DialogContent className="max-h-[calc(100svh-1.5rem)] max-w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-3xl bg-paper p-0 sm:max-w-[min(56rem,calc(100%-3rem))] md:grid md:grid-cols-2 md:overflow-hidden">
        <div
          className="relative grid place-items-center px-10 pt-10 pb-8 md:px-12 md:py-14"
          style={{ backgroundColor: `color-mix(in oklab, ${dish.accent} 55%, var(--bone))` }}
        >
          <DishImage src={dish.imageUrl} alt={dish.imageAlt} sizes="(min-width: 768px) 28rem, 70vw" className="w-[min(68vw,22rem)] md:w-full" />
        </div>
        <div className="flex flex-col p-6 sm:p-8 md:max-h-[min(44rem,calc(100svh-3rem))] md:overflow-y-auto">
          {category ? <p className="eyebrow text-ink-soft">{category.name}</p> : null}
          <DialogTitle className="mt-2 font-display text-[2.1rem] leading-[1.02] font-[420] tracking-[-0.015em] text-ink">
            {dish.name}
          </DialogTitle>
          <p className="tabular mt-2 text-lg font-medium text-ink">{fmt(dish.priceCents)}</p>
          <DialogDescription className="mt-4 text-[0.9875rem] leading-relaxed text-ink-soft">
            {dish.description || dish.tagline}
          </DialogDescription>

          {dish.dietary.length ? (
            <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Dietary">
              {dish.dietary.map((t) => (
                <li key={t} className="rounded-full bg-moss/8 px-2.5 py-1 text-xs font-semibold text-moss ring-1 ring-moss/20">
                  {DIETARY_LABELS[t].label}
                </li>
              ))}
            </ul>
          ) : null}

          {dish.ingredients.length ? (
            <div className="mt-6">
              <h3 className="eyebrow text-ink-soft">On the plate</h3>
              <p className="mt-2 text-[0.9375rem] text-ink">{dish.ingredients.join(" · ")}</p>
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="eyebrow text-ink-soft">Allergens</h3>
            <p className="mt-2 text-[0.9375rem] text-ink">
              {dish.allergens.length
                ? dish.allergens.map((a) => ALLERGEN_LABELS[a]).join(", ")
                : "None of the 14 major allergens"}
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3 border-t border-line pt-6 md:mt-auto">
            {canOrder ? (
              <>
                <div className="flex h-12 items-center rounded-full ring-1 ring-ink/20">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="grid size-12 place-items-center rounded-full disabled:opacity-30"
                    disabled={qty <= 1}
                    aria-label="One fewer"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="tabular w-6 text-center font-medium" aria-live="polite">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(MAX_QUANTITY, q + 1))}
                    className="grid size-12 place-items-center rounded-full disabled:opacity-30"
                    disabled={qty >= MAX_QUANTITY}
                    aria-label="One more"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    add(dish, qty)
                    onDone()
                  }}
                  className="tabular inline-flex h-12 flex-1 items-center justify-between gap-3 rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-paper transition hover:bg-ink/85"
                >
                  <span>Add to order</span>
                  <span>{fmt(dish.priceCents * qty)}</span>
                </button>
              </>
            ) : (
              <p className="rounded-full bg-bone px-5 py-3 text-sm font-medium text-ink-soft">
                {dish.available ? "Online ordering is paused right now." : "Sold out tonight — back soon."}
              </p>
            )}
          </div>
        </div>
      </DialogContent>
  )
}
