"use client"

import { ArrowDown, ArrowUpRight } from "lucide-react"
import { useStore } from "@/components/providers/store-provider"
import { useDishDialog } from "@/components/providers/dish-dialog-provider"
import { formatPrice } from "@/lib/money"
import { DishImage } from "./dish-image"
import { OpenStatus } from "./open-status"

export function Hero() {
  const { settings, dishes } = useStore()
  const { openDish } = useDishDialog()
  const visible = dishes.filter((d) => d.available)
  const lead = visible.find((d) => d.featured && d.imageUrl) ?? visible.find((d) => d.imageUrl) ?? null
  const side = visible.filter((d) => d.imageUrl && d.id !== lead?.id).slice(0, 2)
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)

  const fulfillment = [settings.pickupEnabled && "pickup", settings.deliveryEnabled && "delivery"].filter(Boolean)

  return (
    <section className="grain relative overflow-hidden pt-16">
      <div className="mx-auto grid max-w-[1440px] items-center gap-10 px-4 pt-10 pb-6 sm:px-8 md:pt-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:px-12 lg:pt-6 lg:pb-16">
        <div className="relative z-10 max-w-2xl">
          <p className="eyebrow text-ink-soft">
            {settings.tagline}
            {settings.city ? ` · ${settings.city}` : ""}
          </p>
          <h1 className="mt-5 font-display text-[clamp(2.75rem,11vw,4.25rem)] leading-[0.94] font-[400] tracking-[-0.025em] text-balance text-ink md:text-[clamp(3.5rem,6.6vw,6.5rem)]">
            {settings.heroTitle}
          </h1>
          <p className="mt-6 max-w-lg text-[1.0625rem] leading-relaxed text-ink-soft md:text-lg">
            {settings.heroIntro}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#menu"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-paper transition hover:bg-ink/85"
            >
              {settings.orderingEnabled ? "Start an order" : "See the menu"}
              <ArrowUpRight className="size-4" />
            </a>
            <a
              href="#plates"
              className="inline-flex h-12 items-center gap-2 rounded-full px-5 text-[0.9375rem] font-medium text-ink ring-1 ring-ink/20 transition hover:bg-ink/5"
            >
              Tonight&apos;s plates
              <ArrowDown className="size-4" />
            </a>
          </div>

          <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-line pt-6 text-sm sm:grid-cols-3">
            <div>
              <dt className="eyebrow text-ink-soft">Today</dt>
              <dd className="mt-1.5">
                <OpenStatus />
              </dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-soft">Find us</dt>
              <dd className="mt-1.5 font-medium">{settings.addressLine}</dd>
            </div>
            <div>
              <dt className="eyebrow text-ink-soft">Order</dt>
              <dd className="mt-1.5 font-medium capitalize">
                {settings.orderingEnabled && fulfillment.length ? fulfillment.join(" & ") : "Paused online"}
              </dd>
            </div>
          </dl>
        </div>

        {lead ? (
          <div className="relative mx-auto w-full max-w-[34rem] lg:max-w-none">
            <div className="relative ml-[8%] aspect-square w-[100%] sm:ml-[12%] lg:ml-[6%] lg:w-[min(100%,46rem)]">
              <div aria-hidden className="absolute inset-[-5%] translate-x-[5%] rounded-full" style={{ backgroundColor: lead.accent }} />
              <button
                type="button"
                onClick={() => openDish(lead.id)}
                aria-label={`${lead.name}, ${fmt(lead.priceCents)}. View dish`}
                className="relative block size-full rounded-full"
              >
                <DishImage
                  src={lead.imageUrl}
                  alt={lead.imageAlt}
                  sizes="(min-width: 1024px) 46rem, 90vw"
                  priority
                  className="size-full motion-safe:animate-plate-spin"
                />
              </button>
              {side[0] ? (
                <button
                  type="button"
                  onClick={() => openDish(side[0].id)}
                  aria-label={`${side[0].name}. View dish`}
                  className="absolute bottom-[-4%] left-[-10%] w-[34%] rounded-full sm:left-[-14%]"
                >
                  <DishImage src={side[0].imageUrl} alt={side[0].imageAlt} sizes="240px" />
                </button>
              ) : null}
              {side[1] ? (
                <button
                  type="button"
                  onClick={() => openDish(side[1].id)}
                  aria-label={`${side[1].name}. View dish`}
                  className="absolute top-[-2%] left-[-6%] hidden w-[22%] rounded-full sm:block"
                >
                  <DishImage src={side[1].imageUrl} alt={side[1].imageAlt} sizes="160px" />
                </button>
              ) : null}
              <div className="absolute right-[4%] bottom-[6%] rounded-2xl bg-paper/95 px-4 py-3 shadow-lg ring-1 ring-ink/5 backdrop-blur sm:right-[8%]">
                <p className="eyebrow text-ink-soft">Chef&apos;s pick</p>
                <p className="mt-1 font-display text-lg leading-tight">{lead.name}</p>
                <p className="tabular text-sm text-ink-soft">{fmt(lead.priceCents)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
