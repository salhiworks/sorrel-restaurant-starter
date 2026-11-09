"use client"

import { useEffect, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useAdmin, useAdminData } from "./admin-provider"
import { ImageField } from "./image-field"
import { ALLERGEN_LABELS, DIETARY_LABELS } from "@/lib/labels"
import { parsePriceToCents } from "@/lib/money"
import { ALLERGENS, DIETARY_TAGS, type Dish } from "@/lib/types"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"

const SWATCHES = ["#e8967a", "#eba9b9", "#f1cf74", "#bcd38f", "#a9c2d3", "#d3b493", "#ecc074", "#c7b8e0"]

type Draft = Omit<Dish, "id" | "priceCents"> & { id?: string; price: string; ingredientsText: string }

function toDraft(d: Dish | null, nextPosition: number, categoryId: string | null): Draft {
  if (!d) {
    return {
      categoryId,
      name: "",
      tagline: "",
      description: "",
      price: "",
      imageUrl: null,
      imageAlt: "",
      ingredients: [],
      ingredientsText: "",
      allergens: [],
      dietary: [],
      accent: SWATCHES[nextPosition % SWATCHES.length],
      available: true,
      featured: false,
      inShowcase: false,
      position: nextPosition,
    }
  }
  return { ...d, price: (d.priceCents / 100).toFixed(2), ingredientsText: d.ingredients.join(", ") }
}

/** Average colour of a photo, lifted towards white so it works as a pastel placemat. */
async function accentFromImage(src: string): Promise<string | null> {
  try {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = src
    await img.decode()
    const c = document.createElement("canvas")
    c.width = c.height = 24
    const ctx = c.getContext("2d")!
    ctx.drawImage(img, 0, 0, 24, 24)
    const px = ctx.getImageData(0, 0, 24, 24).data
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < px.length; i += 4) {
      const max = Math.max(px[i], px[i + 1], px[i + 2])
      const min = Math.min(px[i], px[i + 1], px[i + 2])
      if (max - min < 30) continue // skip greys: plates, tables
      r += px[i]; g += px[i + 1]; b += px[i + 2]; n++
    }
    if (!n) return null
    const mix = (v: number) => Math.round(v / n + (255 - v / n) * 0.45)
    return "#" + [mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")
  } catch {
    return null
  }
}

export function DishEditor({
  dish,
  open,
  onOpenChange,
  defaultCategoryId,
}: {
  dish: Dish | null
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultCategoryId: string | null
}) {
  const { categories, dishes } = useAdminData()
  const { saveDish, deleteDish } = useAdmin()
  const wide = useMediaQuery("(min-width: 640px)")
  const [draft, setDraft] = useState<Draft>(() => toDraft(dish, dishes.length, defaultCategoryId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form each time the sheet opens for a different dish
      setDraft(toDraft(dish, Math.max(0, ...dishes.map((d) => d.position + 1)), defaultCategoryId))
      setErrors({})
    }
    // Only reset when the sheet opens or switches dish.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dish?.id])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: "" }))
  }
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const priceCents = parsePriceToCents(draft.price)
    if (priceCents === null) {
      setErrors({ price: "Enter a price, e.g. 14.50" })
      return
    }
    setSaving(true)
    const { price: _p, ingredientsText, ...rest } = draft
    const res = await saveDish({
      ...rest,
      priceCents,
      ingredients: ingredientsText.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      imageAlt: rest.imageAlt || rest.name,
    })
    setSaving(false)
    if (res.ok) onOpenChange(false)
    else setErrors(res.fields ?? {})
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={cn("gap-0 border-0 bg-paper p-0", wide ? "w-full sm:max-w-xl" : "max-h-[94svh] rounded-t-3xl")}
      >
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="border-b border-line px-5 py-5 sm:px-7">
            <SheetTitle className="font-display text-2xl font-normal">{dish ? `Edit ${dish.name}` : "New dish"}</SheetTitle>
            <SheetDescription>Changes appear on the website as soon as you save.</SheetDescription>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 sm:px-7">
            <ImageField label="Photo" kind="dish" value={draft.imageUrl} onChange={(v) => set("imageUrl", v)} />

            <Text label="Name" value={draft.name} onChange={(v) => set("name", v)} error={errors.name} required />
            <Text label="Short line" hint="Shown under the name, e.g. “Beluga lentils, soft egg”" value={draft.tagline} onChange={(v) => set("tagline", v)} error={errors.tagline} />
            <Text label="Description" value={draft.description} onChange={(v) => set("description", v)} error={errors.description} multiline />

            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Price" value={draft.price} onChange={(v) => set("price", v)} error={errors.price} inputMode="decimal" placeholder="0.00" />
              <div>
                <label className="text-sm font-medium" htmlFor="dish-category">Category</label>
                <select
                  id="dish-category"
                  value={draft.categoryId ?? ""}
                  onChange={(e) => set("categoryId", e.target.value || null)}
                  className="mt-1.5 h-11 w-full rounded-xl bg-bone px-3 text-[0.9375rem] ring-1 ring-ink/12 focus:ring-2 focus:ring-ink focus:outline-none"
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <Text
              label="Ingredients"
              hint="Separate with commas. Shown in the dish details and around the plate in the showcase."
              value={draft.ingredientsText}
              onChange={(v) => set("ingredientsText", v)}
              error={errors.ingredients}
            />

            <fieldset>
              <legend className="text-sm font-medium">Allergens</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALLERGENS.map((a) => (
                  <Chip key={a} on={draft.allergens.includes(a)} onClick={() => set("allergens", toggle(draft.allergens, a))}>
                    {ALLERGEN_LABELS[a]}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Dietary</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIETARY_TAGS.map((t) => (
                  <Chip key={t} on={draft.dietary.includes(t)} onClick={() => set("dietary", toggle(draft.dietary, t))}>
                    {DIETARY_LABELS[t].label}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">Showcase colour</legend>
              <p className="text-xs text-ink-soft">The placemat behind the plate on the homepage.</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {SWATCHES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set("accent", s)}
                    aria-label={`Use colour ${s}`}
                    aria-pressed={draft.accent === s}
                    className={cn("size-8 rounded-full ring-1 ring-ink/10", draft.accent === s && "ring-2 ring-ink ring-offset-2 ring-offset-paper")}
                    style={{ backgroundColor: s }}
                  />
                ))}
                <label className="relative size-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-ink/15" title="Custom colour">
                  <input type="color" value={draft.accent} onChange={(e) => set("accent", e.target.value)} className="absolute -inset-2 size-12 cursor-pointer" />
                </label>
                {draft.imageUrl ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const c = await accentFromImage(draft.imageUrl!)
                      if (c) set("accent", c)
                    }}
                    className="h-8 rounded-full px-3 text-xs font-medium ring-1 ring-ink/15 hover:bg-ink/5"
                  >
                    Match photo
                  </button>
                ) : null}
              </div>
            </fieldset>

            <div className="divide-y divide-line rounded-2xl bg-bone px-4">
              <Toggle label="Available" hint="Turn off when it sells out. It stays on the menu, marked sold out." checked={draft.available} onChange={(v) => set("available", v)} />
              <Toggle label="Show in the homepage showcase" hint="The large animated plates near the top of the site." checked={draft.inShowcase} onChange={(v) => set("inShowcase", v)} />
              <Toggle label="Featured" hint="Can appear as the chef's pick in the hero." checked={draft.featured} onChange={(v) => set("featured", v)} />
            </div>

            <Text label="Photo description" hint="For screen readers, e.g. “Sea bass on black lentils with a soft egg”" value={draft.imageAlt} onChange={(v) => set("imageAlt", v)} />
          </div>

          <div className="flex items-center gap-2 border-t border-line px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
            {dish ? (
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Delete ${dish.name}? This can't be undone. To hide it for tonight, mark it unavailable instead.`)) return
                  const res = await deleteDish(dish.id)
                  if (res.ok) onOpenChange(false)
                }}
                className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-destructive hover:bg-destructive/8"
              >
                <Trash2 className="size-4" />
                Delete
              </button>
            ) : null}
            <button type="button" onClick={() => onOpenChange(false)} className="ml-auto h-11 rounded-full px-4 text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-medium text-paper disabled:opacity-60">
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {dish ? "Save dish" : "Add dish"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function Text({
  label,
  hint,
  error,
  value,
  onChange,
  multiline,
  required,
  ...rest
}: {
  label: string
  hint?: string
  error?: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  required?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = `t-${label.replace(/\W+/g, "-").toLowerCase()}`
  const cls = cn(
    "mt-1.5 w-full rounded-xl bg-bone px-3.5 text-[0.9375rem] ring-1 ring-ink/12 focus:ring-2 focus:ring-ink focus:outline-none",
    error && "ring-2 ring-destructive",
  )
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span className="text-ink-soft"> *</span> : null}
      </label>
      {multiline ? (
        <textarea id={id} rows={4} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={cn(cls, "py-2.5")} />
      ) : (
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} className={cn(cls, "h-11")} {...rest} />
      )}
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn("h-8 rounded-full px-3 text-[0.8125rem] font-medium ring-1 transition", on ? "bg-ink text-paper ring-ink" : "ring-ink/15 hover:ring-ink/30")}
    >
      {children}
    </button>
  )
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 py-3.5">
      <span className="flex-1">
        <span className="block text-[0.9375rem] font-medium">{label}</span>
        {hint ? <span className="block text-xs text-ink-soft">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={(v) => onChange(v)} />
    </label>
  )
}
