"use client"

import { withAdminData } from "@/components/admin/admin-shell"
import Image from "next/image"
import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ImageOff, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { useAdmin, useAdminData } from "@/components/admin/admin-provider"
import { DishEditor, Text } from "@/components/admin/dish-editor"
import { formatPrice } from "@/lib/money"
import type { Category, Dish } from "@/lib/types"
import { cn } from "@/lib/utils"

function MenuPage() {
  const [tab, setTab] = useState<"dishes" | "categories">("dishes")
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Menu</h1>
          <p className="mt-1 text-sm text-ink-soft">Dishes, prices, photos and what appears in the homepage showcase.</p>
        </div>
        <div className="flex rounded-full bg-paper p-1 ring-1 ring-ink/10" role="tablist">
          {(["dishes", "categories"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("h-9 rounded-full px-4 text-sm font-medium capitalize", tab === t ? "bg-ink text-paper" : "text-ink-soft")}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {tab === "dishes" ? <Dishes /> : <Categories />}
    </div>
  )
}

function Dishes() {
  const { dishes, categories, settings } = useAdminData()
  const { patchDish, moveDish } = useAdmin()
  const [editing, setEditing] = useState<Dish | null>(null)
  const [open, setOpen] = useState(false)
  const [newIn, setNewIn] = useState<string | null>(null)

  const groups = useMemo(() => {
    const sorted = [...dishes].sort((a, b) => a.position - b.position)
    const cats = [...categories].sort((a, b) => a.position - b.position)
    const out: { id: string | null; name: string; dishes: Dish[] }[] = cats.map((c) => ({
      id: c.id,
      name: c.name,
      dishes: sorted.filter((d) => d.categoryId === c.id),
    }))
    const known = new Set(cats.map((c) => c.id))
    const loose = sorted.filter((d) => !d.categoryId || !known.has(d.categoryId))
    if (loose.length) out.push({ id: null, name: "No category", dishes: loose })
    return out
  }, [dishes, categories])

  const openEditor = (dish: Dish | null, categoryId: string | null = null) => {
    setEditing(dish)
    setNewIn(categoryId)
    setOpen(true)
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          {dishes.filter((d) => d.inShowcase).length} in the showcase · {dishes.filter((d) => !d.available).length} sold out
        </p>
        <button
          type="button"
          onClick={() => openEditor(null, categories[0]?.id ?? null)}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper"
        >
          <Plus className="size-4" />
          Add dish
        </button>
      </div>

      {dishes.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-ink/15 px-6 py-16 text-center">
          <p className="font-display text-2xl">No dishes yet</p>
          <p className="mt-1 text-sm text-ink-soft">Add your first dish, or import the sample menu from the overview page.</p>
        </div>
      ) : null}

      <div className="mt-6 space-y-8">
        {groups.map((g) => (
          <section key={g.id ?? "none"}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl">{g.name}</h2>
              <button
                type="button"
                onClick={() => openEditor(null, g.id)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink-soft hover:bg-ink/5 hover:text-ink"
              >
                <Plus className="size-4" />
                Add here
              </button>
            </div>
            {g.dishes.length === 0 ? (
              <p className="rounded-2xl bg-paper px-5 py-6 text-sm text-ink-soft ring-1 ring-ink/8">No dishes in this category.</p>
            ) : (
              <ul className="overflow-hidden rounded-3xl bg-paper ring-1 ring-ink/8">
                {g.dishes.map((d, i) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line p-3 last:border-b-0 sm:flex-nowrap sm:p-4">
                    <button type="button" onClick={() => openEditor(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left sm:gap-4">
                      <span className={cn("relative size-14 shrink-0 overflow-hidden rounded-full bg-bone", !d.available && "opacity-50 grayscale")}>
                        {d.imageUrl ? (
                          <Image src={d.imageUrl} alt="" fill sizes="56px" unoptimized={d.imageUrl.startsWith("data:")} className="scale-[1.03] object-cover" />
                        ) : (
                          <ImageOff className="absolute inset-0 m-auto size-5 text-ink-soft" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{d.name}</span>
                        <span className="tabular block text-sm text-ink-soft">
                          {formatPrice(d.priceCents, settings.currency, settings.locale)}
                          {!d.available ? <span className="ml-2 font-semibold text-brand">Sold out</span> : null}
                          {d.featured ? <span className="ml-2">· Featured</span> : null}
                        </span>
                      </span>
                    </button>

                    <div className="flex w-full items-center gap-4 sm:w-auto">
                      <label className="relative flex items-center gap-2 text-xs font-medium text-ink-soft pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3">
                        <Switch checked={d.available} onCheckedChange={(v) => void patchDish(d, { available: v })} aria-label={`${d.name} available`} />
                        Available
                      </label>
                      <label className="relative flex items-center gap-2 text-xs font-medium text-ink-soft pointer-coarse:after:absolute pointer-coarse:after:-inset-x-1 pointer-coarse:after:-inset-y-3">
                        <Switch checked={d.inShowcase} onCheckedChange={(v) => void patchDish(d, { inShowcase: v })} aria-label={`${d.name} in showcase`} />
                        Showcase
                      </label>
                      <div className="ml-auto flex items-center">
                        <IconButton label={`Move ${d.name} up`} disabled={i === 0} onClick={() => void moveDish(d.id, -1)}>
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton label={`Move ${d.name} down`} disabled={i === g.dishes.length - 1} onClick={() => void moveDish(d.id, 1)}>
                          <ArrowDown className="size-4" />
                        </IconButton>
                        <IconButton label={`Edit ${d.name}`} onClick={() => openEditor(d)}>
                          <Pencil className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <DishEditor dish={editing} open={open} onOpenChange={setOpen} defaultCategoryId={newIn} />
    </>
  )
}

function Categories() {
  const { categories, dishes } = useAdminData()
  const { saveCategory, deleteCategory, moveCategory } = useAdmin()
  const sorted = [...categories].sort((a, b) => a.position - b.position)
  const [adding, setAdding] = useState({ name: "", note: "" })
  const [busy, setBusy] = useState(false)

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ul className="space-y-3">
        {sorted.length === 0 ? (
          <li className="rounded-3xl border border-dashed border-ink/15 px-6 py-12 text-center text-sm text-ink-soft">No categories yet.</li>
        ) : null}
        {sorted.map((c, i) => (
          <CategoryRow
            key={c.id}
            category={c}
            count={dishes.filter((d) => d.categoryId === c.id).length}
            first={i === 0}
            last={i === sorted.length - 1}
            onSave={(name, note) => saveCategory({ id: c.id, name, note, position: c.position })}
            onDelete={() => deleteCategory(c.id)}
            onMove={(dir) => moveCategory(c.id, dir)}
          />
        ))}
      </ul>

      <form
        className="self-start rounded-3xl bg-paper p-5 ring-1 ring-ink/8"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!adding.name.trim()) return
          setBusy(true)
          const res = await saveCategory({ ...adding, position: sorted.length ? sorted[sorted.length - 1].position + 1 : 0 })
          setBusy(false)
          if (res.ok) setAdding({ name: "", note: "" })
        }}
      >
        <h2 className="font-display text-xl">New category</h2>
        <div className="mt-4 space-y-4">
          <Text label="Name" value={adding.name} onChange={(name) => setAdding((a) => ({ ...a, name }))} placeholder="e.g. Drinks" />
          <Text label="Note" hint="Optional, e.g. “Until noon”" value={adding.note} onChange={(note) => setAdding((a) => ({ ...a, note }))} />
        </div>
        <button type="submit" disabled={busy || !adding.name.trim()} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-paper disabled:opacity-40">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add category
        </button>
      </form>
    </div>
  )
}

function CategoryRow({
  category,
  count,
  first,
  last,
  onSave,
  onDelete,
  onMove,
}: {
  category: Category
  count: number
  first: boolean
  last: boolean
  onSave: (name: string, note: string) => Promise<unknown>
  onDelete: () => Promise<unknown>
  onMove: (dir: -1 | 1) => Promise<unknown>
}) {
  const [name, setName] = useState(category.name)
  const [note, setNote] = useState(category.note)
  const dirty = name !== category.name || note !== category.note
  return (
    <li className="rounded-3xl bg-paper p-4 ring-1 ring-ink/8 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Text label="Name" value={name} onChange={setName} />
        <Text label="Note" value={note} onChange={setNote} />
        <div className="flex items-center gap-1">
          <IconButton label="Move up" disabled={first} onClick={() => void onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" disabled={last} onClick={() => void onMove(1)}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton
            label={`Delete ${category.name}`}
            onClick={() => {
              if (confirm(`Delete “${category.name}”? Its ${count} ${count === 1 ? "dish" : "dishes"} will move to “No category”.`)) void onDelete()
            }}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-ink-soft">{count} {count === 1 ? "dish" : "dishes"}</span>
        {dirty ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setName(category.name); setNote(category.note) }} className="h-9 rounded-full px-3 text-sm">
              Undo
            </button>
            <button type="button" onClick={() => void onSave(name, note)} className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper">
              Save
            </button>
          </div>
        ) : null}
      </div>
    </li>
  )
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink disabled:opacity-25"
    >
      {children}
    </button>
  )
}

export default withAdminData(MenuPage)
