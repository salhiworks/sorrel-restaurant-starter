"use client"

import { withAdminData } from "@/components/admin/admin-shell"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { useAdmin, useAdminData } from "@/components/admin/admin-provider"
import { Text, Toggle } from "@/components/admin/dish-editor"
import { ImageField } from "@/components/admin/image-field"
import { DAY_LABELS } from "@/lib/hours"
import { parsePriceToCents } from "@/lib/money"
import { DAY_KEYS, type Settings } from "@/lib/types"
import { cn } from "@/lib/utils"

type Money = { deliveryFee: string; deliveryMinimum: string }

function SettingsPage() {
  const { settings } = useAdminData()
  const { saveSettings } = useAdmin()
  const [s, setS] = useState<Settings>(settings)
  const [money, setMoney] = useState<Money>({
    deliveryFee: (settings.deliveryFeeCents / 100).toFixed(2),
    deliveryMinimum: (settings.deliveryMinimumCents / 100).toFixed(2),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const dirty =
    JSON.stringify(s) !== JSON.stringify(settings) ||
    money.deliveryFee !== (settings.deliveryFeeCents / 100).toFixed(2) ||
    money.deliveryMinimum !== (settings.deliveryMinimumCents / 100).toFixed(2)

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setS((x) => ({ ...x, [key]: value }))
    setErrors((e) => ({ ...e, [key]: "" }))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const fee = parsePriceToCents(money.deliveryFee)
    const min = parsePriceToCents(money.deliveryMinimum)
    if (fee === null || min === null) {
      setErrors({ deliveryFeeCents: fee === null ? "Enter an amount" : "", deliveryMinimumCents: min === null ? "Enter an amount" : "" })
      return
    }
    setSaving(true)
    const res = await saveSettings({ ...s, deliveryFeeCents: fee, deliveryMinimumCents: min })
    setSaving(false)
    if (!res.ok) {
      setErrors(res.fields ?? {})
      const first = Object.keys(res.fields ?? {})[0]
      if (first) document.getElementById(`sec-${sectionOf(first)}`)?.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <form onSubmit={save} noValidate>
      <h1 className="font-display text-4xl">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">Everything here updates the website when you save — no code needed.</p>

      <div className="mt-8 space-y-6 pb-24">
        <Section id="restaurant" title="Restaurant">
          <ImageField label="Logo (optional)" kind="logo" round={false} value={s.logoUrl} onChange={(v) => set("logoUrl", v)} />
          <p className="-mt-2 text-xs text-ink-soft">Without a logo, the name is set in the site&apos;s italic serif.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Name" value={s.name} onChange={(v) => set("name", v)} error={errors.name} />
            <Text label="Tagline" value={s.tagline} onChange={(v) => set("tagline", v)} error={errors.tagline} />
          </div>
          <Text label="Short description" hint="Used in the footer and for search engines." value={s.description} onChange={(v) => set("description", v)} error={errors.description} multiline />
        </Section>

        <Section id="contact" title="Contact & location">
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Phone" value={s.phone} onChange={(v) => set("phone", v)} error={errors.phone} inputMode="tel" />
            <Text label="Email" value={s.email} onChange={(v) => set("email", v)} error={errors.email} inputMode="email" />
            <Text label="Street address" value={s.addressLine} onChange={(v) => set("addressLine", v)} error={errors.addressLine} />
            <div className="grid grid-cols-2 gap-4">
              <Text label="City" value={s.city} onChange={(v) => set("city", v)} error={errors.city} />
              <Text label="Postcode" value={s.postcode} onChange={(v) => set("postcode", v)} error={errors.postcode} />
            </div>
          </div>
          <Text label="Map link" hint="Paste a Google Maps or Apple Maps share link." value={s.mapUrl} onChange={(v) => set("mapUrl", v)} error={errors.mapUrl} />
          <Text label="Instagram link" value={s.instagramUrl} onChange={(v) => set("instagramUrl", v)} error={errors.instagramUrl} />
        </Section>

        <Section id="hours" title="Opening hours" description="Orders are only accepted while you're open. Times are in your restaurant's timezone.">
          <div className="divide-y divide-line rounded-2xl bg-bone px-4">
            {DAY_KEYS.map((day) => {
              const h = s.hours[day]
              const setDay = (patch: Partial<typeof h>) => set("hours", { ...s.hours, [day]: { ...h, ...patch } })
              return (
                <div key={day} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="w-24 font-medium">{DAY_LABELS[day]}</span>
                  <label className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={!h.closed} onChange={(e) => setDay({ closed: !e.target.checked })} className="size-4 accent-ink" />
                    Open
                  </label>
                  <div className={cn("ml-auto flex items-center gap-2", h.closed && "pointer-events-none opacity-35")}>
                    <input type="time" value={h.open} onChange={(e) => setDay({ open: e.target.value })} aria-label={`${DAY_LABELS[day]} opens`} className="h-10 rounded-lg bg-paper px-2 text-sm ring-1 ring-ink/12" />
                    <span className="text-ink-soft">–</span>
                    <input type="time" value={h.close} onChange={(e) => setDay({ close: e.target.value })} aria-label={`${DAY_LABELS[day]} closes`} className="h-10 rounded-lg bg-paper px-2 text-sm ring-1 ring-ink/12" />
                  </div>
                </div>
              )
            })}
          </div>
          {errors.hours ? <p className="text-sm text-destructive">Check the opening hours: {errors.hours}</p> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="Timezone" hint="e.g. Europe/Dublin, Europe/London, America/New_York" value={s.timezone} onChange={(v) => set("timezone", v)} error={errors.timezone} />
            <div className="grid grid-cols-2 gap-4">
              <Text label="Currency" hint="EUR, GBP, USD…" value={s.currency} onChange={(v) => set("currency", v.toUpperCase())} error={errors.currency} maxLength={3} />
              <Text label="Locale" hint="en-IE, en-GB, en-US…" value={s.locale} onChange={(v) => set("locale", v)} error={errors.locale} />
            </div>
          </div>
        </Section>

        <Section id="ordering" title="Ordering" description="Customers pay when they collect or on delivery. No payment is taken online.">
          <div className="divide-y divide-line rounded-2xl bg-bone px-4">
            <Toggle label="Accept online orders" checked={s.orderingEnabled} onChange={(v) => set("orderingEnabled", v)} />
            <Toggle label="Pickup" checked={s.pickupEnabled} onChange={(v) => set("pickupEnabled", v)} />
            <Toggle label="Delivery" checked={s.deliveryEnabled} onChange={(v) => set("deliveryEnabled", v)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Text label="Delivery fee" value={money.deliveryFee} onChange={(v) => setMoney((m) => ({ ...m, deliveryFee: v }))} error={errors.deliveryFeeCents} inputMode="decimal" />
            <Text label="Delivery minimum" value={money.deliveryMinimum} onChange={(v) => setMoney((m) => ({ ...m, deliveryMinimum: v }))} error={errors.deliveryMinimumCents} inputMode="decimal" />
            <Text
              label="Prep time (minutes)"
              value={String(s.prepMinutes)}
              onChange={(v) => set("prepMinutes", Number(v.replace(/\D/g, "")) || 0)}
              error={errors.prepMinutes}
              inputMode="numeric"
            />
          </div>
          <Text label="Delivery note" hint="Shown at checkout, e.g. your delivery area." value={s.deliveryNote} onChange={(v) => set("deliveryNote", v)} error={errors.deliveryNote} />
        </Section>

        <Section id="website" title="Website">
          <Text label="Homepage headline" value={s.heroTitle} onChange={(v) => set("heroTitle", v)} error={errors.heroTitle} />
          <Text label="Homepage introduction" value={s.heroIntro} onChange={(v) => set("heroIntro", v)} error={errors.heroIntro} multiline />
          <Text label="Story headline" value={s.storyTitle} onChange={(v) => set("storyTitle", v)} error={errors.storyTitle} />
          <Text label="Story" hint="Leave a blank line between paragraphs." value={s.storyBody} onChange={(v) => set("storyBody", v)} error={errors.storyBody} multiline />
          <div>
            <label className="text-sm font-medium" htmlFor="brand">Accent colour</label>
            <p className="text-xs text-ink-soft">Used for small highlights like the cart count and sold-out labels.</p>
            <div className="mt-2 flex items-center gap-3">
              <input id="brand" type="color" value={s.brandAccent} onChange={(e) => set("brandAccent", e.target.value)} className="h-11 w-16 cursor-pointer rounded-lg bg-transparent" />
              <span className="tabular text-sm text-ink-soft">{s.brandAccent}</span>
            </div>
          </div>
        </Section>
      </div>

      {/* Save bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-16 z-30 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur transition lg:bottom-0 lg:left-[15.5rem]",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-end gap-3 sm:px-4">
          <span className="mr-auto hidden text-sm text-ink-soft sm:inline">Unsaved changes</span>
          <button
            type="button"
            onClick={() => {
              setS(settings)
              setMoney({ deliveryFee: (settings.deliveryFeeCents / 100).toFixed(2), deliveryMinimum: (settings.deliveryMinimumCents / 100).toFixed(2) })
              setErrors({})
            }}
            className="h-11 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap"
          >
            Discard
          </button>
          <button type="submit" disabled={saving} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium whitespace-nowrap text-paper disabled:opacity-60">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </button>
        </div>
      </div>
    </form>
  )
}

function sectionOf(field: string) {
  if (["name", "tagline", "description", "logoUrl"].includes(field)) return "restaurant"
  if (["hours", "timezone", "currency", "locale"].includes(field)) return "hours"
  if (["orderingEnabled", "pickupEnabled", "deliveryEnabled", "deliveryFeeCents", "deliveryMinimumCents", "prepMinutes", "deliveryNote"].includes(field)) return "ordering"
  if (["heroTitle", "heroIntro", "storyTitle", "storyBody", "brandAccent"].includes(field)) return "website"
  return "contact"
}

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={`sec-${id}`} className="scroll-mt-6 rounded-3xl bg-paper p-5 ring-1 ring-ink/8 sm:p-7">
      <h2 className="font-display text-2xl">{title}</h2>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

export default withAdminData(SettingsPage)
