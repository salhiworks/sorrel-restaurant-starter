"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { AlertTriangle, ArrowLeft, Bike, Check, Info, Loader2, Store } from "lucide-react"
import { useStore } from "@/components/providers/store-provider"
import { useCart } from "@/components/providers/cart-provider"
import { placeOrder } from "@/app/actions/orders"
import { checkoutSchema, fieldErrors } from "@/lib/checkout-schema"
import { describeStatus, localClock, openStatus, orderingWindow } from "@/lib/hours"
import { formatPrice } from "@/lib/money"
import { priceOrder } from "@/lib/pricing"
import { demoId, updateDemoDb } from "@/lib/demo-db"
import type { Fulfillment, Order, OrderItem } from "@/lib/types"
import { DishImage } from "./dish-image"
import { cn } from "@/lib/utils"

type Confirmation = {
  number: string
  demo: boolean
  fulfillment: Fulfillment
  items: OrderItem[]
  subtotalCents: number
  deliveryFeeCents: number
  totalCents: number
  requestedTime: string
  name: string
  address: string
}

const CONFIRM_KEY = "sorrel:last-order"

/** A random v4 UUID, also on plain-http origins where crypto.randomUUID is unavailable. */
function newCheckoutKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function CheckoutView() {
  const { settings, mode, applyLatest } = useStore()
  const cart = useCart()
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)

  const [fulfillment, setFulfillment] = useState<Fulfillment>(settings.pickupEnabled ? "pickup" : "delivery")
  const [form, setForm] = useState({ customerName: "", phone: "", email: "", address: "", notes: "", requestedTime: "", company: "" })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  // The last confirmation, kept so a refresh doesn't lose it. Only shown while
  // the cart is empty: once the customer starts a new order, checkout wins.
  const [restored, setRestored] = useState<Confirmation | null>(null)
  const [pending, startTransition] = useTransition()
  const [now, setNow] = useState<Date | null>(null)
  const startedAt = useRef(0)
  // One key for this checkout: resubmitting (double tap, retry after a lost
  // connection) returns the same order instead of creating a second one.
  const checkoutKey = useRef("")

  useEffect(() => {
    startedAt.current = Date.now()
    checkoutKey.current = newCheckoutKey()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock and sessionStorage are only readable after hydration
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    try {
      const saved = sessionStorage.getItem(CONFIRM_KEY)
      if (saved) setRestored(JSON.parse(saved))
    } catch {}
    return () => clearInterval(t)
  }, [])

  const status = now ? openStatus(settings.hours, now, settings.timezone) : null
  const orderWindow = useMemo(
    () => (now ? orderingWindow(settings.hours, now, settings.timezone, settings.prepMinutes) : null),
    [now, settings.hours, settings.timezone, settings.prepMinutes],
  )
  const slots = orderWindow && orderWindow.kind !== "closed" ? orderWindow.slots : []
  const preorder = orderWindow?.kind === "preorder"
  // Closed for the rest of today. A live site takes no orders; the demo lets
  // people try the checkout anyway and says so.
  const closedToday = orderWindow?.kind === "closed"
  const closedLive = mode === "live" && closedToday
  const statusText = status && now ? describeStatus(status, localClock(now, settings.timezone).day).toLowerCase() : ""

  // If the clock moves past the chosen slot (or into pre-order hours), make the customer choose again.
  const requestedTime = form.requestedTime && !slots.includes(form.requestedTime) ? "" : form.requestedTime

  const validLines = cart.lines.filter((l) => !l.problem)
  const deliveryFee = fulfillment === "delivery" ? settings.deliveryFeeCents : 0
  const belowMinimum = fulfillment === "delivery" && cart.subtotalCents < settings.deliveryMinimumCents
  const total = cart.subtotalCents + deliveryFee

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    if (errors[key]) setErrors((x) => ({ ...x, [key]: "" }))
  }

  function finish(c: Confirmation) {
    setConfirmation(c)
    try {
      sessionStorage.setItem(CONFIRM_KEY, JSON.stringify(c))
    } catch {}
    cart.clear()
    window.scrollTo({ top: 0 })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (preorder && !requestedTime) {
      setErrors({ requestedTime: "Choose a time later today" })
      setFormError("We're closed right now, so please choose a pre-order time.")
      document.querySelector<HTMLElement>('[name="requestedTime"]')?.focus()
      return
    }
    const payload = {
      ...form,
      requestedTime,
      fulfillment,
      items: validLines.map((l) => ({ dishId: l.dishId, quantity: l.quantity })),
      startedAt: startedAt.current,
      idempotencyKey: checkoutKey.current || undefined,
      expectedTotalCents: total,
    }
    const parsed = checkoutSchema.safeParse(payload)
    if (!parsed.success) {
      const fe = fieldErrors(parsed.error)
      setErrors(fe)
      setFormError(fe.items ?? "Please check the highlighted fields.")
      document.querySelector<HTMLElement>(`[name="${Object.keys(fe)[0]}"]`)?.focus()
      return
    }

    startTransition(async () => {
      if (mode === "demo") {
        // Demo: same pricing rules, stored only in this browser.
        const { dishes } = { dishes: validLines.map((l) => l.dish!) }
        const priced = priceOrder(dishes, settings, parsed.data.items, fulfillment)
        if (!priced.ok) {
          setFormError(priced.message)
          return
        }
        await new Promise((r) => setTimeout(r, 650))
        const stamp = new Date().toISOString()
        const number = `D-${Math.floor(1000 + Math.random() * 9000)}`
        const order: Order = {
          id: demoId("order"),
          number,
          status: "new",
          fulfillment,
          customerName: parsed.data.customerName,
          phone: parsed.data.phone,
          email: parsed.data.email,
          address: fulfillment === "delivery" ? parsed.data.address : "",
          notes: parsed.data.notes,
          requestedTime: parsed.data.requestedTime || null,
          items: priced.items,
          subtotalCents: priced.subtotalCents,
          deliveryFeeCents: priced.deliveryFeeCents,
          totalCents: priced.totalCents,
          createdAt: stamp,
          updatedAt: stamp,
          demo: true,
        }
        updateDemoDb((db) => ({ ...db, orders: [order, ...db.orders].slice(0, 100) }))
        finish({
          number,
          demo: true,
          fulfillment,
          items: priced.items,
          subtotalCents: priced.subtotalCents,
          deliveryFeeCents: priced.deliveryFeeCents,
          totalCents: priced.totalCents,
          requestedTime: parsed.data.requestedTime,
          name: parsed.data.customerName,
          address: order.address,
        })
        return
      }

      try {
        const res = await placeOrder(parsed.data)
        if (!res.ok) {
          setErrors(res.fields ?? {})
          setFormError(res.message)
          // Something changed on the restaurant's side (price, sold out, hours,
          // ordering paused): show the latest menu so the cart reflects it.
          // (Not router.refresh(): it can return a cached page from before the change.)
          if (res.latest) applyLatest(res.latest)
          return
        }
        finish({
          number: res.orderNumber,
          demo: false,
          fulfillment,
          items: res.items,
          subtotalCents: res.subtotalCents,
          deliveryFeeCents: res.deliveryFeeCents,
          totalCents: res.totalCents,
          requestedTime: parsed.data.requestedTime,
          name: parsed.data.customerName,
          address: parsed.data.address,
        })
      } catch {
        setFormError("We couldn't reach the restaurant. Check your connection and try again — you haven't been charged.")
      }
    })
  }

  /* --------------------------------------------------------- confirmation */
  const shown = confirmation ?? (cart.ready && cart.lines.length === 0 ? restored : null)
  if (shown) {
    const c = shown
    return (
      <div className="mx-auto max-w-2xl px-4 pt-28 pb-24 sm:px-8">
        <div className="rounded-[2rem] bg-paper p-6 ring-1 ring-ink/5 sm:p-10">
          <div className={cn("grid size-14 place-items-center rounded-full", c.demo ? "bg-ink/8 text-ink" : "bg-[#3f8f4e] text-white")}>
            {c.demo ? <Info className="size-6" /> : <Check className="size-6" />}
          </div>
          <p className="eyebrow mt-6 text-ink-soft">{c.demo ? "Demo order" : "Order received"} · #{c.number}</p>
          <h1 className="mt-2 font-display text-[clamp(2rem,6vw,3rem)] leading-[1.02] tracking-[-0.015em]">
            {c.demo ? "This was a demo — nothing was sent." : `Thank you, ${c.name.split(" ")[0]}.`}
          </h1>
          <p className="mt-4 text-ink-soft">
            {c.demo
              ? "Your order was saved in this browser only, so you can see how it appears in the demo dashboard. No restaurant has received it and nobody is cooking it."
              : c.fulfillment === "pickup"
                ? `The kitchen has your order. ${c.requestedTime ? `It will be ready at ${c.requestedTime}.` : `It will be ready in about ${settings.prepMinutes} minutes.`} Pay at the counter when you collect.`
                : `The kitchen has your order. ${c.requestedTime ? `We'll aim to deliver around ${c.requestedTime}` : "We'll deliver as soon as it's ready"} to ${c.address}. Pay the rider by card or cash.`}
          </p>
          {!c.demo ? (
            <p className="mt-3 text-sm text-ink-soft">
              Need to change something? Call us on{" "}
              <a className="font-medium text-ink underline underline-offset-4" href={`tel:${settings.phone.replace(/[^\d+]/g, "")}`}>
                {settings.phone}
              </a>{" "}
              and quote #{c.number}.
            </p>
          ) : null}

          <ul className="mt-8 border-t border-line">
            {c.items.map((i) => (
              <li key={i.dishId} className="flex justify-between gap-4 border-b border-line py-3 text-[0.9375rem]">
                <span>
                  <span className="tabular text-ink-soft">{i.quantity}×</span> {i.name}
                </span>
                <span className="tabular">{fmt(i.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 text-[0.9375rem]">
            {c.deliveryFeeCents ? (
              <div className="flex justify-between text-ink-soft">
                <dt>Delivery</dt>
                <dd className="tabular">{fmt(c.deliveryFeeCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between font-display text-xl">
              <dt>{c.demo ? "Total" : "To pay on " + (c.fulfillment === "pickup" ? "pickup" : "delivery")}</dt>
              <dd className="tabular">{fmt(c.totalCents)}</dd>
            </div>
          </dl>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/"
              onClick={() => sessionStorage.removeItem(CONFIRM_KEY)}
              className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[0.9375rem] font-medium text-paper"
            >
              Back to the menu
            </Link>
            {c.demo ? (
              <Link href="/admin/orders" className="inline-flex h-12 items-center rounded-full px-6 text-[0.9375rem] font-medium ring-1 ring-ink/20">
                See it in the demo dashboard
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------- empty */
  if (cart.ready && validLines.length === 0 && !cart.hasProblems) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-36 pb-32 text-center">
        <p className="font-display text-4xl">Your order is empty</p>
        <p className="mt-3 text-ink-soft">Pick a few plates and come back here to check out.</p>
        <Link href="/#menu" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper">
          Browse the menu
        </Link>
      </div>
    )
  }

  const blocked = pending || cart.hasProblems || belowMinimum || !settings.orderingEnabled || Boolean(closedLive)

  /* ----------------------------------------------------------------- form */
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-24 pb-36 sm:px-8 lg:pb-24">
      <Link href="/#menu" className="inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" />
        Keep browsing
      </Link>
      <h1 className="mt-4 font-display text-[clamp(2.4rem,7vw,4rem)] leading-none tracking-[-0.02em]">Checkout</h1>

      {mode === "demo" ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-ink px-5 py-4 text-sm text-paper">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong className="font-semibold">Demo mode.</strong> You can go through the whole checkout, but the order is only
            saved in this browser. It is not sent to a restaurant and nobody will prepare it.
          </p>
        </div>
      ) : null}
      {!settings.orderingEnabled ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-brand/10 px-5 py-4 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" />
          <p>Online ordering is paused right now. Your cart is saved — please call us or check back soon.</p>
        </div>
      ) : null}
      {settings.orderingEnabled && closedToday && statusText ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-brand/10 px-5 py-4 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-brand" />
          {mode === "live" ? (
            <p>
              We&apos;re not taking orders right now ({statusText}). Your cart is saved — come back when we&apos;re open.
            </p>
          ) : (
            <p>
              The restaurant is closed right now ({statusText}). A live site only takes orders during opening hours; in this
              demo you can still try the checkout.
            </p>
          )}
        </div>
      ) : null}
      {settings.orderingEnabled && preorder && statusText ? (
        <div className="mt-6 flex gap-3 rounded-2xl bg-brand/10 px-5 py-4 text-sm text-ink">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          <p>
            We&apos;re closed right now ({statusText}). You can pre-order for a time later today.
          </p>
        </div>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-14">
        <div className="space-y-10">
          {/* Method */}
          <fieldset>
            <legend className="font-display text-2xl">1. How would you like it?</legend>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  { value: "pickup", label: "Pickup", note: `Ready in ~${settings.prepMinutes} min · pay at the counter`, icon: Store, enabled: settings.pickupEnabled },
                  {
                    value: "delivery",
                    label: "Delivery",
                    note: `${fmt(settings.deliveryFeeCents)} · ${fmt(settings.deliveryMinimumCents)} minimum · pay the rider`,
                    icon: Bike,
                    enabled: settings.deliveryEnabled,
                  },
                ] as const
              ).map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer gap-4 rounded-2xl bg-paper p-4 ring-1 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                    fulfillment === o.value ? "ring-2 ring-ink" : "ring-ink/10 hover:ring-ink/25",
                    !o.enabled && "cursor-not-allowed opacity-45",
                  )}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value={o.value}
                    checked={fulfillment === o.value}
                    disabled={!o.enabled}
                    onChange={() => setFulfillment(o.value)}
                    className="sr-only"
                  />
                  <o.icon className="mt-0.5 size-5 shrink-0" />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{o.enabled ? o.note : "Not available right now"}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Time */}
          <fieldset>
            <legend className="font-display text-2xl">2. When?</legend>
            <div className="mt-4 max-w-sm">
              <label htmlFor="requestedTime" className="text-sm font-medium">
                {preorder ? "Pre-order for" : fulfillment === "pickup" ? "Pickup time" : "Delivery time"}
              </label>
              <select
                id="requestedTime"
                name="requestedTime"
                value={requestedTime}
                onChange={set("requestedTime")}
                aria-invalid={!!errors.requestedTime}
                className={cn(
                  "mt-1.5 h-12 w-full rounded-xl bg-paper px-3.5 text-[0.9375rem] ring-1 ring-ink/15 focus:ring-2 focus:ring-ink focus:outline-none",
                  errors.requestedTime && "ring-2 ring-destructive",
                )}
              >
                {preorder ? (
                  <option value="" disabled>
                    Choose a time
                  </option>
                ) : (
                  <option value="">{closedToday && mode === "demo" ? "As soon as possible (demo only)" : "As soon as possible"}</option>
                )}
                {slots.map((s) => (
                  <option key={s} value={s}>
                    Today at {s}
                  </option>
                ))}
              </select>
              {errors.requestedTime ? <p className="mt-1.5 text-sm text-destructive">{errors.requestedTime}</p> : null}
            </div>
          </fieldset>

          {/* Details */}
          <fieldset>
            <legend className="font-display text-2xl">3. Your details</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" name="customerName" autoComplete="name" value={form.customerName} onChange={set("customerName")} error={errors.customerName} />
              <Field label="Phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set("phone")} error={errors.phone} hint="Only used about this order" />
              <Field
                label="Email (optional)"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set("email")}
                error={errors.email}
                className="sm:col-span-2"
              />
              {fulfillment === "delivery" ? (
                <Field
                  label="Delivery address"
                  name="address"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={set("address")}
                  error={errors.address}
                  hint={settings.deliveryNote}
                  className="sm:col-span-2"
                  multiline
                />
              ) : null}
              <Field
                label="Notes for the kitchen (optional)"
                name="notes"
                value={form.notes}
                onChange={set("notes")}
                error={errors.notes}
                hint="Allergies, doorbell, cutlery…"
                className="sm:col-span-2"
                multiline
              />
            </div>
            {/* Honeypot: hidden from people and screen readers. */}
            <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label>
                Company
                <input tabIndex={-1} autoComplete="off" name="company" value={form.company} onChange={set("company")} />
              </label>
            </div>
          </fieldset>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.75rem] bg-paper p-5 ring-1 ring-ink/5 sm:p-6">
            <h2 className="font-display text-2xl">Your order</h2>
            <ul className="mt-4">
              {cart.lines.map((l) => (
                <li key={l.dishId} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                  <DishImage src={l.dish?.imageUrl ?? null} alt="" sizes="44px" className="w-11 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium">{l.dish?.name ?? "Removed dish"}</p>
                    {l.problem ? (
                      <p className="text-xs font-medium text-brand">{l.problem === "removed" ? "No longer on the menu" : "Sold out"}</p>
                    ) : (
                      <p className="tabular text-sm text-ink-soft">× {l.quantity}</p>
                    )}
                  </div>
                  {!l.problem && l.dish ? <span className="tabular text-sm">{fmt(l.dish.priceCents * l.quantity)}</span> : null}
                </li>
              ))}
            </ul>
            {cart.hasProblems ? (
              <button type="button" onClick={cart.removeProblems} className="mt-2 text-sm font-medium text-brand underline underline-offset-4">
                Remove unavailable items
              </button>
            ) : null}
            <button type="button" onClick={() => cart.setOpen(true)} className="mt-2 block text-sm font-medium underline underline-offset-4">
              Edit quantities
            </button>
            <dl className="mt-5 space-y-2 border-t border-line pt-4 text-[0.9375rem]">
              <div className="flex justify-between">
                <dt className="text-ink-soft">Subtotal</dt>
                <dd className="tabular">{fmt(cart.subtotalCents)}</dd>
              </div>
              {fulfillment === "delivery" ? (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Delivery</dt>
                  <dd className="tabular">{fmt(deliveryFee)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 font-display text-2xl">
                <dt>Total</dt>
                <dd className="tabular">{fmt(total)}</dd>
              </div>
            </dl>
            {belowMinimum ? (
              <p className="mt-3 text-sm text-brand">
                Add {fmt(settings.deliveryMinimumCents - cart.subtotalCents)} more for delivery, or choose pickup.
              </p>
            ) : null}
            <p className="mt-3 text-xs text-ink-soft">
              {mode === "live"
                ? "Final prices are confirmed by the restaurant when you place the order. No payment is taken online."
                : "No payment is taken online."}
            </p>

            {formError ? (
              <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {formError}
              </p>
            ) : null}

            {/* Desktop submit */}
            <button
              type="submit"
              disabled={blocked}
              className="mt-5 hidden h-13 w-full items-center justify-center gap-2 rounded-full bg-ink text-[0.9375rem] font-medium text-paper transition hover:bg-ink/85 disabled:opacity-40 lg:flex"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "demo" ? "Place demo order" : "Place order"} · {fmt(total)}
            </button>
          </div>
        </aside>

        {/* Mobile submit bar */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bone/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
          <button
            type="submit"
            disabled={blocked}
            className="flex h-13 w-full items-center justify-center gap-2 rounded-full bg-ink text-[0.9375rem] font-medium text-paper disabled:opacity-40"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "demo" ? "Place demo order" : "Place order"} · {fmt(total)}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  name,
  error,
  hint,
  className,
  multiline,
  ...props
}: {
  label: string
  name: string
  error?: string
  hint?: string
  className?: string
  multiline?: boolean
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = `f-${name}`
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  const cls = cn(
    "mt-1.5 w-full rounded-xl bg-paper px-3.5 text-[0.9375rem] ring-1 ring-ink/15 placeholder:text-ink-soft/60 focus:ring-2 focus:ring-ink focus:outline-none",
    error && "ring-2 ring-destructive",
  )
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {multiline ? (
        <textarea id={id} name={name} rows={3} aria-invalid={!!error} aria-describedby={describedBy} className={cn(cls, "py-3")} {...props} />
      ) : (
        <input id={id} name={name} aria-invalid={!!error} aria-describedby={describedBy} className={cn(cls, "h-12")} {...props} />
      )}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
