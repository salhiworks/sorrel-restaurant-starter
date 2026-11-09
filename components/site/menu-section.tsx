"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { useStore } from "@/components/providers/store-provider"
import { useCart } from "@/components/providers/cart-provider"
import { useDishDialog } from "@/components/providers/dish-dialog-provider"
import { formatPrice } from "@/lib/money"
import { DIETARY_LABELS } from "@/lib/labels"
import { DIETARY_TAGS, type DietaryTag, type Dish } from "@/lib/types"
import { DishImage } from "./dish-image"
import { cn } from "@/lib/utils"

export function MenuSection() {
  const { categories, dishes, settings } = useStore()
  const [filter, setFilter] = useState<DietaryTag | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const visible = filter ? dishes.filter((d) => d.dietary.includes(filter)) : dishes
    const out = categories
      .map((c) => ({ id: c.id, name: c.name, note: c.note, dishes: visible.filter((d) => d.categoryId === c.id) }))
      .filter((g) => g.dishes.length)
    const known = new Set(categories.map((c) => c.id))
    const loose = visible.filter((d) => !d.categoryId || !known.has(d.categoryId))
    if (loose.length) out.push({ id: "other", name: "More", note: "", dishes: loose })
    return out
  }, [categories, dishes, filter])

  const usedTags = useMemo(() => DIETARY_TAGS.filter((t) => dishes.some((d) => d.dietary.includes(t))), [dishes])

  // Highlight the category currently on screen: the last section whose top has
  // reached the spot where a tapped tab lands it (the page's scroll-padding plus
  // the section's scroll-margin, read from the CSS so the two never disagree).
  useEffect(() => {
    const els = groups.map((g) => document.getElementById(`cat-${g.id}`)).filter(Boolean) as HTMLElement[]
    if (!els.length) return
    let frame = 0
    const update = () => {
      frame = 0
      const line =
        (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) +
        (parseFloat(getComputedStyle(els[0]).scrollMarginTop) || 0) +
        8
      let current = els[0]
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el
      setActive(current.id.replace("cat-", ""))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [groups])

  useEffect(() => {
    const tab = tabsRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`)
    if (tab && tabsRef.current) {
      tabsRef.current.scrollTo({ left: tab.offsetLeft - 16, behavior: "smooth" })
    }
  }, [active])

  return (
    <section id="menu" className="relative scroll-mt-16 bg-paper pt-20 pb-24 md:pt-28">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-ink-soft">The full menu</p>
            <h2 className="mt-3 font-display text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.95] tracking-[-0.02em]">
              One page, cooked to order
            </h2>
          </div>
          <p className="max-w-sm text-ink-soft">
            {settings.orderingEnabled
              ? `Order for ${[settings.pickupEnabled && "pickup", settings.deliveryEnabled && "delivery"].filter(Boolean).join(" or ")}. Pay when you collect${settings.deliveryEnabled ? " or on delivery" : ""}.`
              : "Online ordering is paused right now — the menu is here so you can plan your visit."}
          </p>
        </div>
      </div>

      {/* Sticky category + filter bar */}
      <div className="sticky top-16 z-30 mt-10 border-y border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-4 sm:px-8 lg:px-12">
          <div ref={tabsRef} className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 py-2.5">
            {groups.map((g) => (
              <a
                key={g.id}
                href={`#cat-${g.id}`}
                data-tab={g.id}
                aria-current={active === g.id ? "true" : undefined}
                className={cn(
                  "relative shrink-0 rounded-full px-4 py-2 text-sm font-medium transition pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1",
                  active === g.id ? "bg-ink text-paper" : "text-ink/75 hover:bg-ink/5 hover:text-ink",
                )}
              >
                {g.name}
              </a>
            ))}
          </div>
          {usedTags.length ? (
            <div className="hidden shrink-0 items-center gap-1 md:flex" role="group" aria-label="Filter by diet">
              {usedTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={filter === t}
                  onClick={() => setFilter((f) => (f === t ? null : t))}
                  className={cn(
                    "relative rounded-full px-3 py-1.5 text-[0.8125rem] font-medium ring-1 transition pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5",
                    filter === t ? "bg-moss text-moss-ink ring-moss" : "text-ink-soft ring-ink/15 hover:text-ink",
                  )}
                >
                  {DIETARY_LABELS[t].label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {usedTags.length ? (
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-t border-line px-4 py-2 md:hidden" role="group" aria-label="Filter by diet">
            {usedTags.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={filter === t}
                onClick={() => setFilter((f) => (f === t ? null : t))}
                className={cn(
                  "relative shrink-0 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium ring-1 transition pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:-inset-y-1.5",
                  filter === t ? "bg-moss text-moss-ink ring-moss" : "text-ink-soft ring-ink/15",
                )}
              >
                {DIETARY_LABELS[t].label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12">
        {groups.length === 0 ? (
          <div className="py-24 text-center">
            <p className="font-display text-2xl">Nothing matches that filter today.</p>
            <button type="button" onClick={() => setFilter(null)} className="mt-4 text-sm font-medium underline underline-offset-4">
              Show the whole menu
            </button>
          </div>
        ) : null}
        {groups.map((g) => (
          <div
            key={g.id}
            id={`cat-${g.id}`}
            className="grid scroll-mt-[4.5rem] gap-x-12 md:scroll-mt-12 border-b border-line py-12 last:border-b-0 md:py-16 lg:grid-cols-[15rem_minmax(0,1fr)]"
          >
            <div className="mb-6 lg:mb-0">
              <h3 className="font-display text-3xl tracking-[-0.01em] lg:sticky lg:top-40">{g.name}</h3>
              {g.note ? <p className="mt-1 text-sm text-ink-soft lg:sticky lg:top-[12.75rem]">{g.note}</p> : null}
            </div>
            <ul className="grid gap-x-10 xl:grid-cols-2">
              {g.dishes.map((d) => (
                <MenuRow key={d.id} dish={d} />
              ))}
            </ul>
          </div>
        ))}
        <p className="pt-8 text-sm text-ink-soft">
          Allergen information is listed on every dish. Tell us about allergies when you order — our kitchen handles
          all 14 major allergens, so we can&apos;t guarantee any dish is completely free of traces.
        </p>
      </div>
    </section>
  )
}

function MenuRow({ dish }: { dish: Dish }) {
  const { settings } = useStore()
  const { add, lines } = useCart()
  const { openDish } = useDishDialog()
  const inCart = lines.find((l) => l.dishId === dish.id)?.quantity ?? 0
  const canOrder = dish.available && settings.orderingEnabled

  return (
    <li className="relative flex gap-4 border-b border-line py-5 last:border-b-0 sm:gap-5 xl:[&:nth-last-child(2):nth-child(odd)]:border-b-0">
      <button
        type="button"
        onClick={() => openDish(dish.id)}
        className="flex min-w-0 flex-1 gap-4 text-left sm:gap-5"
        aria-label={`${dish.name}. View details`}
      >
        <DishImage
          src={dish.imageUrl}
          alt=""
          sizes="96px"
          className={cn("w-[4.75rem] shrink-0 sm:w-24", !dish.available && "opacity-50 grayscale")}
        />
        <span className="min-w-0 flex-1 pt-1">
          <span className="flex items-baseline gap-3">
            <span className="font-display text-xl leading-tight text-ink">{dish.name}</span>
            <span className="tabular ml-auto shrink-0 text-[0.9375rem] font-medium text-ink">
              {formatPrice(dish.priceCents, settings.currency, settings.locale)}
            </span>
          </span>
          <span className="mt-1 line-clamp-2 block text-[0.9375rem] leading-snug text-ink-soft">{dish.tagline || dish.description}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {!dish.available ? (
              <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">Sold out</span>
            ) : null}
            {dish.dietary.map((t) => (
              <abbr
                key={t}
                title={DIETARY_LABELS[t].label}
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-moss no-underline ring-1 ring-moss/25"
              >
                {DIETARY_LABELS[t].short}
              </abbr>
            ))}
          </span>
        </span>
      </button>
      {canOrder ? (
        <button
          type="button"
          onClick={() => add(dish)}
          aria-label={`Add ${dish.name} to order`}
          className={cn(
            "relative mt-1 grid size-11 shrink-0 place-items-center self-start rounded-full transition",
            inCart ? "bg-ink text-paper" : "text-ink ring-1 ring-ink/20 hover:bg-ink hover:text-paper",
          )}
        >
          <Plus className="size-5" />
          {inCart ? (
            <span className="tabular absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.6875rem] leading-5 font-semibold text-white">
              {inCart}
            </span>
          ) : null}
        </button>
      ) : null}
    </li>
  )
}
