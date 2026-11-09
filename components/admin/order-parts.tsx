"use client"

import { useEffect, useState } from "react"
import { Bike, Clock, Loader2, Mail, MessageSquareText, Phone, Store } from "lucide-react"
import { formatPrice } from "@/lib/money"
import { NEXT_STATUSES, primaryNext, STATUS_LABELS } from "@/lib/order-status"
import type { Order, OrderStatus, Settings } from "@/lib/types"
import { useAdmin } from "./admin-provider"
import { cn } from "@/lib/utils"

export const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-brand text-white",
  accepted: "bg-[#dfe7f3] text-[#2c4a78]",
  preparing: "bg-[#f6e6c4] text-[#7a5410]",
  ready: "bg-[#d8ecd9] text-[#24602f]",
  completed: "bg-ink/8 text-ink-soft",
  cancelled: "bg-ink/5 text-ink-soft line-through",
}

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: "Accept order",
  preparing: "Start preparing",
  ready: "Mark ready",
  completed: "Complete",
}

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  )
}

/** "4 min ago", refreshed every 30s. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function timeAgo(iso: string, now: number) {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return `${days} d ago`
}

export function clockTime(iso: string, settings: Settings) {
  try {
    return new Intl.DateTimeFormat(settings.locale, {
      timeZone: settings.timezone,
      hour: "2-digit",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export function OrderRow({
  order,
  settings,
  selected,
  onSelect,
}: {
  order: Order
  settings: Settings
  selected?: boolean
  onSelect: () => void
}) {
  const now = useNow()
  const items = order.items.reduce((n, i) => n + i.quantity, 0)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "w-full rounded-2xl bg-paper p-4 text-left ring-1 transition",
        selected ? "ring-2 ring-ink" : "ring-ink/8 hover:ring-ink/20",
        order.status === "new" && !selected && "ring-brand/40",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="tabular font-semibold">#{order.number}</span>
        <StatusBadge status={order.status} />
        <span className="ml-auto text-xs text-ink-soft">{timeAgo(order.createdAt, now)}</span>
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[0.9375rem]">
        {order.fulfillment === "delivery" ? <Bike className="size-4 text-ink-soft" /> : <Store className="size-4 text-ink-soft" />}
        <span className="truncate font-medium">{order.customerName}</span>
        <span className="tabular ml-auto shrink-0 font-medium">{formatPrice(order.totalCents, settings.currency, settings.locale)}</span>
      </div>
      <p className="mt-1 truncate text-sm text-ink-soft">
        {items} {items === 1 ? "item" : "items"} · {order.items.map((i) => i.name).join(", ")}
      </p>
      {order.requestedTime ? (
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-ink">
          <Clock className="size-3.5" />
          For {order.requestedTime}
        </p>
      ) : null}
    </button>
  )
}

export function OrderDetail({ order, settings }: { order: Order; settings: Settings }) {
  const { setOrderStatus } = useAdmin()
  const [busy, setBusy] = useState<OrderStatus | null>(null)
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)
  const primary = primaryNext(order.status)
  const others = NEXT_STATUSES[order.status].filter((s) => s !== primary && s !== "cancelled")
  const canCancel = NEXT_STATUSES[order.status].includes("cancelled")

  async function go(status: OrderStatus) {
    if (status === "cancelled" && !confirm(`Cancel order #${order.number}? Let ${order.customerName} know by phone.`)) return
    setBusy(status)
    await setOrderStatus(order, status)
    setBusy(null)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="tabular font-display text-3xl">#{order.number}</h2>
        <StatusBadge status={order.status} />
        {order.demo ? <span className="rounded-full bg-ink/8 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wider text-ink-soft uppercase">Demo</span> : null}
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        Placed {clockTime(order.createdAt, settings)}
        {order.updatedAt !== order.createdAt ? ` · updated ${clockTime(order.updatedAt, settings)}` : ""}
      </p>

      {/* Actions */}
      {primary || canCancel ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {primary ? (
            <button
              type="button"
              onClick={() => go(primary)}
              disabled={!!busy}
              className="inline-flex h-12 min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 text-[0.9375rem] font-medium text-paper disabled:opacity-60 sm:flex-none"
            >
              {busy === primary ? <Loader2 className="size-4 animate-spin" /> : null}
              {ACTION_LABELS[primary] ?? STATUS_LABELS[primary]}
            </button>
          ) : null}
          {others.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => go(s)}
              disabled={!!busy}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] font-medium ring-1 ring-ink/20 disabled:opacity-60"
            >
              {busy === s ? <Loader2 className="size-4 animate-spin" /> : null}
              {ACTION_LABELS[s] ?? STATUS_LABELS[s]}
            </button>
          ))}
          {canCancel ? (
            <button
              type="button"
              onClick={() => go("cancelled")}
              disabled={!!busy}
              className="inline-flex h-12 items-center justify-center rounded-full px-4 text-[0.9375rem] font-medium text-destructive hover:bg-destructive/8 disabled:opacity-60"
            >
              Cancel order
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-sm text-ink-soft">This order is {STATUS_LABELS[order.status].toLowerCase()}. No further steps.</p>
      )}

      {/* Fulfillment */}
      <section className="mt-7 grid gap-4 rounded-2xl bg-bone p-4 sm:grid-cols-2">
        <div>
          <h3 className="eyebrow text-ink-soft">{order.fulfillment === "delivery" ? "Delivery" : "Pickup"}</h3>
          <p className="mt-1.5 font-medium">{order.requestedTime ? `Requested for ${order.requestedTime}` : "As soon as possible"}</p>
          {order.fulfillment === "delivery" ? <p className="mt-1 text-sm whitespace-pre-line">{order.address}</p> : null}
          <p className="mt-1 text-sm text-ink-soft">Pay on {order.fulfillment === "delivery" ? "delivery" : "pickup"}</p>
        </div>
        <div>
          <h3 className="eyebrow text-ink-soft">Customer</h3>
          <p className="mt-1.5 font-medium">{order.customerName}</p>
          <a href={`tel:${order.phone.replace(/[^\d+]/g, "")}`} className="mt-1 flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline">
            <Phone className="size-3.5" />
            {order.phone}
          </a>
          {order.email ? (
            <a href={`mailto:${order.email}`} className="mt-1 flex items-center gap-2 text-sm underline-offset-4 hover:underline">
              <Mail className="size-3.5" />
              {order.email}
            </a>
          ) : null}
        </div>
      </section>

      {order.notes ? (
        <div className="mt-4 flex gap-3 rounded-2xl bg-[#f6e6c4] p-4 text-sm text-[#5c3f0c]">
          <MessageSquareText className="mt-0.5 size-4 shrink-0" />
          <p className="whitespace-pre-line">{order.notes}</p>
        </div>
      ) : null}

      {/* Items */}
      <section className="mt-6">
        <h3 className="eyebrow text-ink-soft">Items</h3>
        <ul className="mt-2">
          {order.items.map((i, idx) => (
            <li key={`${i.dishId}-${idx}`} className="flex items-baseline gap-3 border-b border-line py-3 text-[0.9375rem]">
              <span className="tabular grid min-w-8 place-items-center rounded-lg bg-ink px-1.5 py-0.5 text-sm font-semibold text-paper">
                {i.quantity}
              </span>
              <span className="flex-1 font-medium">{i.name}</span>
              <span className="tabular text-ink-soft">{fmt(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-[0.9375rem]">
          <div className="flex justify-between text-ink-soft">
            <dt>Subtotal</dt>
            <dd className="tabular">{fmt(order.subtotalCents)}</dd>
          </div>
          {order.deliveryFeeCents ? (
            <div className="flex justify-between text-ink-soft">
              <dt>Delivery</dt>
              <dd className="tabular">{fmt(order.deliveryFeeCents)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between pt-1 text-lg font-semibold">
            <dt>To collect</dt>
            <dd className="tabular">{fmt(order.totalCents)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
