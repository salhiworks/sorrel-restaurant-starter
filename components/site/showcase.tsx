"use client"

import { useMemo } from "react"
import { Plus } from "lucide-react"
import { DishOrbitCarousel, type OrbitDish } from "@/components/ui/dish-orbit-carousel"
import { useStore } from "@/components/providers/store-provider"
import { useCart } from "@/components/providers/cart-provider"
import { useDishDialog } from "@/components/providers/dish-dialog-provider"
import { formatPrice } from "@/lib/money"
import { ALLERGEN_LABELS, DIETARY_LABELS } from "@/lib/labels"

/** Connects the presentational carousel to the menu, cart and dish details. */
export function Showcase() {
  const { dishes, settings } = useStore()
  const { add } = useCart()
  const { openDish } = useDishDialog()

  const picked = useMemo(() => {
    const chosen = dishes.filter((d) => d.inShowcase)
    // If the owner hasn't chosen any, fall back to dishes that have photos.
    return chosen.length ? chosen : dishes.filter((d) => d.available && d.imageUrl).slice(0, 6)
  }, [dishes])

  const items: OrbitDish[] = useMemo(
    () =>
      picked.map((d) => ({
        id: d.id,
        title: d.name,
        tagline: d.tagline,
        image: d.imageUrl,
        imageAlt: d.imageAlt,
        accent: d.accent,
        ring: d.ingredients,
      })),
    [picked],
  )

  if (!items.length) return null
  // Remount when the line-up changes (dashboard edits) so the stage starts clean.
  const key = picked.map((d) => d.id).join("|")

  return (
    <div id="plates">
      <h2 className="sr-only">Tonight&apos;s plates</h2>
      <DishOrbitCarousel
        key={key}
        dishes={items}
        skipTo="#menu"
        renderDetails={(item) => {
          const d = picked.find((x) => x.id === item.id)!
          return (
            <div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="tabular font-display text-3xl text-ink lg:text-4xl">
                  {formatPrice(d.priceCents, settings.currency, settings.locale)}
                </span>
                {d.dietary.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Dietary">
                    {d.dietary.map((t) => (
                      <li
                        key={t}
                        className="rounded-full bg-paper/80 px-2.5 py-1 text-xs font-medium text-ink ring-1 ring-ink/10"
                      >
                        {DIETARY_LABELS[t].label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                {d.allergens.length
                  ? `Contains ${d.allergens.map((a) => ALLERGEN_LABELS[a].toLowerCase()).join(", ")}`
                  : "No major allergens"}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {d.available && settings.orderingEnabled ? (
                  <button
                    type="button"
                    onClick={() => add(d)}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-paper transition hover:bg-ink/85"
                  >
                    <Plus className="size-4" />
                    Add to order
                  </button>
                ) : (
                  <span className="inline-flex h-12 items-center rounded-full bg-paper/70 px-5 text-[0.9375rem] font-medium text-ink-soft ring-1 ring-ink/10">
                    {d.available ? "Online ordering paused" : "Sold out tonight"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => openDish(d.id)}
                  className="inline-flex h-12 items-center rounded-full px-5 text-[0.9375rem] font-medium text-ink ring-1 ring-ink/20 transition hover:bg-ink/5"
                >
                  Ingredients & allergens
                </button>
              </div>
            </div>
          )
        }}
      />
    </div>
  )
}
