"use client"

import { ArrowUpRight, Mail, Phone } from "lucide-react"
import { useStore } from "@/components/providers/store-provider"
import { DAY_LABELS } from "@/lib/hours"
import { formatPrice } from "@/lib/money"
import { DAY_KEYS } from "@/lib/types"
import { useOpenStatus } from "./open-status"
import { cn } from "@/lib/utils"

export function Visit() {
  const { settings } = useStore()
  const status = useOpenStatus()
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)

  return (
    <section id="visit" className="scroll-mt-16 bg-bone">
      <div className="mx-auto max-w-[1440px] px-4 py-20 sm:px-8 md:py-28 lg:px-12">
        <p className="eyebrow text-ink-soft">Visit & contact</p>
        <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.4rem,6vw,4.25rem)] leading-[0.98] tracking-[-0.02em]">
          Come to the counter, or let us come to you.
        </h2>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl bg-paper p-7 ring-1 ring-ink/5">
            <h3 className="eyebrow text-ink-soft">Address</h3>
            <address className="mt-4 font-display text-2xl leading-snug not-italic">
              {settings.addressLine}
              <br />
              {[settings.city, settings.postcode].filter(Boolean).join(" ")}
            </address>
            {settings.mapUrl ? (
              <a
                href={settings.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper"
              >
                Open in Maps
                <ArrowUpRight className="size-4" />
              </a>
            ) : null}
            <div className="mt-8 space-y-3 border-t border-line pt-6 text-[0.9375rem]">
              {settings.phone ? (
                <a href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 font-medium">
                  <Phone className="size-4 text-ink-soft" />
                  {settings.phone}
                </a>
              ) : null}
              {settings.email ? (
                <a href={`mailto:${settings.email}`} className="flex items-center gap-3 font-medium">
                  <Mail className="size-4 text-ink-soft" />
                  {settings.email}
                </a>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-paper p-7 ring-1 ring-ink/5">
            <div className="flex items-center justify-between gap-4">
              <h3 className="eyebrow text-ink-soft">Opening hours</h3>
              {status ? (
                <span className={cn("text-xs font-semibold", status.status.open ? "text-[#2f7a3d]" : "text-brand")}>
                  {status.status.open ? "Open now" : "Closed now"}
                </span>
              ) : null}
            </div>
            <dl className="mt-4">
              {DAY_KEYS.map((day) => {
                const h = settings.hours[day]
                const isToday = status?.today === day
                return (
                  <div
                    key={day}
                    className={cn(
                      "flex items-center justify-between border-b border-line py-2.5 text-[0.9375rem] last:border-b-0",
                      isToday && "font-semibold",
                    )}
                  >
                    <dt className="flex items-center gap-2">
                      {DAY_LABELS[day]}
                      {isToday ? <span className="rounded-full bg-ink px-2 py-0.5 text-[0.625rem] tracking-wider text-paper uppercase">Today</span> : null}
                    </dt>
                    <dd className="tabular text-ink-soft">{h.closed ? "Closed" : `${h.open} – ${h.close}`}</dd>
                  </div>
                )
              })}
            </dl>
          </div>

          <div className="rounded-3xl bg-paper p-7 ring-1 ring-ink/5 md:col-span-2 lg:col-span-1">
            <h3 className="eyebrow text-ink-soft">Ordering</h3>
            <ul className="mt-4 space-y-5 text-[0.9375rem]">
              <li>
                <p className="font-display text-xl">Pickup</p>
                <p className="mt-1 text-ink-soft">
                  {settings.pickupEnabled
                    ? `Ready in about ${settings.prepMinutes} minutes. Pay at the counter by card or cash.`
                    : "Not available online at the moment."}
                </p>
              </li>
              <li className="border-t border-line pt-5">
                <p className="font-display text-xl">Delivery</p>
                <p className="mt-1 text-ink-soft">
                  {settings.deliveryEnabled
                    ? `${fmt(settings.deliveryFeeCents)} delivery, ${fmt(settings.deliveryMinimumCents)} minimum. ${settings.deliveryNote}`
                    : "Not available online at the moment."}
                </p>
              </li>
              <li className="border-t border-line pt-5">
                <p className="font-display text-xl">Allergies & large groups</p>
                <p className="mt-1 text-ink-soft">Call us before you order and we&apos;ll talk you through it.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
