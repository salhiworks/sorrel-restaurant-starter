"use client"

import { withAdminData } from "@/components/admin/admin-shell"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, ImageOff, Loader2, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { useAdmin, useAdminData } from "@/components/admin/admin-provider"
import { StatusBadge, timeAgo, useNow } from "@/components/admin/order-parts"
import { describeStatus, localClock, openStatus } from "@/lib/hours"
import { formatPrice } from "@/lib/money"
import { ACTIVE_STATUSES } from "@/lib/order-status"

function dayKey(iso: string | Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso))
  } catch {
    return new Date(iso).toISOString().slice(0, 10)
  }
}

function OverviewPage() {
  const { settings, orders, dishes } = useAdminData()
  const { saveSettings, patchDish, mode, backend, reload } = useAdmin()
  const now = useNow()
  const [greeting, setGreeting] = useState("Hello")
  const [importing, setImporting] = useState(false)
  useEffect(() => {
    const h = new Date().getHours()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- greeting depends on the visitor clock, known only after hydration
    setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening")
  }, [])

  const date = new Date(now)
  const status = openStatus(settings.hours, date, settings.timezone)
  const today = dayKey(date, settings.timezone)
  const todays = orders.filter((o) => dayKey(o.createdAt, settings.timezone) === today && o.status !== "cancelled")
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)

  const active = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const counts = {
    new: orders.filter((o) => o.status === "new").length,
    kitchen: orders.filter((o) => o.status === "accepted" || o.status === "preparing").length,
    ready: orders.filter((o) => o.status === "ready").length,
  }
  const soldOut = dishes.filter((d) => !d.available)
  const noPhoto = dishes.filter((d) => !d.imageUrl)
  const showcase = dishes.filter((d) => d.inShowcase)

  return (
    <div>
      <p className="eyebrow text-ink-soft">{describeStatus(status, localClock(date, settings.timezone).day)}</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">{greeting}.</h1>

      {mode === "live" && dishes.length === 0 ? (
        <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-ink p-6 text-paper sm:flex-row sm:items-center">
          <Sparkles className="size-6 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Your menu is empty.</p>
            <p className="text-sm text-paper/70">Start from the sample restaurant and edit it, or add your own dishes from scratch.</p>
          </div>
          <button
            type="button"
            disabled={importing}
            onClick={async () => {
              setImporting(true)
              const res = await backend.importSampleMenu()
              if (res.ok) {
                toast.success("Sample menu imported")
                await reload()
              } else toast.error(res.message)
              setImporting(false)
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-paper px-5 text-sm font-medium text-ink"
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : null}
            Import sample menu
          </button>
        </div>
      ) : null}

      {/* Ordering switch */}
      <div className="mt-6 flex items-center gap-4 rounded-3xl bg-paper p-5 ring-1 ring-ink/8">
        <div className="flex-1">
          <p className="font-medium">Online ordering</p>
          <p className="text-sm text-ink-soft">
            {settings.orderingEnabled
              ? "Customers can order from the website during opening hours."
              : "Paused. The menu is still visible, but nobody can check out."}
          </p>
        </div>
        <Switch
          checked={settings.orderingEnabled}
          onCheckedChange={(v) => void saveSettings({ ...settings, orderingEnabled: v })}
          aria-label="Online ordering"
        />
      </div>

      {/* Numbers */}
      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Needs accepting", value: counts.new, href: "/admin/orders", strong: counts.new > 0 },
          { label: "In the kitchen", value: counts.kitchen, href: "/admin/orders" },
          { label: "Ready to hand over", value: counts.ready, href: "/admin/orders" },
          { label: "Today's orders", value: `${todays.length} · ${fmt(todays.reduce((n, o) => n + o.totalCents, 0))}` },
        ].map((s) => (
          <div key={s.label} className={s.strong ? "rounded-3xl bg-brand p-5 text-white" : "rounded-3xl bg-paper p-5 ring-1 ring-ink/8"}>
            <dt className={s.strong ? "text-sm text-white/85" : "text-sm text-ink-soft"}>{s.label}</dt>
            <dd className="tabular mt-2 font-display text-3xl">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Active orders */}
        <section className="rounded-3xl bg-paper p-5 ring-1 ring-ink/8 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Active orders</h2>
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-medium">
              All orders <ArrowRight className="size-4" />
            </Link>
          </div>
          {active.length === 0 ? (
            <p className="mt-6 rounded-2xl bg-bone px-5 py-8 text-center text-sm text-ink-soft">
              Nothing on the pass. {mode === "demo" ? "Place a demo order on the website to try the flow." : "New orders will appear here."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {active.slice(0, 6).map((o) => (
                <li key={o.id}>
                  <Link href="/admin/orders" className="flex items-center gap-3 py-3">
                    <span className="tabular w-16 shrink-0 font-semibold">#{o.number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{o.customerName}</span>
                      <span className="block truncate text-xs text-ink-soft">
                        {o.fulfillment === "delivery" ? "Delivery" : "Pickup"} · {o.requestedTime ? `for ${o.requestedTime}` : timeAgo(o.createdAt, now)}
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Menu health */}
        <section className="rounded-3xl bg-paper p-5 ring-1 ring-ink/8 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl">Menu</h2>
            <Link href="/admin/menu" className="inline-flex items-center gap-1 text-sm font-medium">
              Edit menu <ArrowRight className="size-4" />
            </Link>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {dishes.length} dishes · {showcase.length} in the homepage showcase
          </p>
          <h3 className="eyebrow mt-6 text-ink-soft">Sold out</h3>
          {soldOut.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Everything is available.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {soldOut.map((d) => (
                <li key={d.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 truncate font-medium">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => void patchDish(d, { available: true }).then((r) => r.ok && toast.success(`${d.name} is back on`))}
                    className="h-8 rounded-full px-3 text-xs font-medium ring-1 ring-ink/15 hover:bg-ink hover:text-paper"
                  >
                    Back on
                  </button>
                </li>
              ))}
            </ul>
          )}
          {noPhoto.length ? (
            <p className="mt-6 flex items-center gap-2 rounded-2xl bg-bone px-4 py-3 text-sm">
              <ImageOff className="size-4 text-ink-soft" />
              {noPhoto.length} {noPhoto.length === 1 ? "dish has" : "dishes have"} no photo yet.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}

export default withAdminData(OverviewPage)
