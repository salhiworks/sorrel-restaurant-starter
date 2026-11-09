"use client"

import { withAdminData } from "@/components/admin/admin-shell"
import { useMemo, useState } from "react"
import { RefreshCw, Search } from "lucide-react"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useAdmin, useAdminData } from "@/components/admin/admin-provider"
import { OrderDetail, OrderRow } from "@/components/admin/order-parts"
import { useMediaQuery } from "@/hooks/use-media-query"
import type { Order, OrderStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

const FILTERS: { id: string; label: string; match: (s: OrderStatus) => boolean }[] = [
  { id: "active", label: "Active", match: (s) => s === "new" || s === "accepted" || s === "preparing" || s === "ready" },
  { id: "new", label: "New", match: (s) => s === "new" },
  { id: "kitchen", label: "In the kitchen", match: (s) => s === "accepted" || s === "preparing" },
  { id: "ready", label: "Ready", match: (s) => s === "ready" },
  { id: "completed", label: "Completed", match: (s) => s === "completed" },
  { id: "cancelled", label: "Cancelled", match: (s) => s === "cancelled" },
  { id: "all", label: "All", match: () => true },
]

function OrdersPage() {
  const { settings, orders } = useAdminData()
  const { refreshOrders, lastOrderCheck, mode } = useAdmin()
  const wide = useMediaQuery("(min-width: 1024px)")
  const [filter, setFilter] = useState("active")
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!
    const q = query.trim().toLowerCase()
    return orders
      .filter((o) => f.match(o.status))
      .filter((o) => !q || o.number.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.phone.includes(q))
      // Active work oldest-first (first in, first out); history newest-first.
      .sort((a, b) =>
        filter === "active" || filter === "new" || filter === "kitchen" || filter === "ready"
          ? a.createdAt.localeCompare(b.createdAt)
          : b.createdAt.localeCompare(a.createdAt),
      )
  }, [orders, filter, query])

  const selected: Order | null = orders.find((o) => o.id === selectedId) ?? (wide ? visible[0] ?? null : null)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Orders</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {mode === "live"
              ? `Checks for new orders every 20 seconds${lastOrderCheck ? ` · last ${lastOrderCheck.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`
              : "Demo orders placed on the website in this browser appear here instantly."}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            setRefreshing(true)
            await refreshOrders()
            setRefreshing(false)
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-ink/15 hover:bg-ink/5"
        >
          <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter orders">
          {FILTERS.map((f) => {
            const count = orders.filter((o) => f.match(o.status)).length
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition",
                  filter === f.id ? "bg-ink text-paper" : "bg-paper text-ink/75 ring-1 ring-ink/10 hover:text-ink",
                )}
              >
                {f.label}
                <span className={cn("tabular text-xs", filter === f.id ? "text-paper/70" : "text-ink-soft")}>{count}</span>
              </button>
            )
          })}
        </div>
        <label className="relative sm:ml-auto sm:w-64">
          <span className="sr-only">Search orders</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, phone or #"
            className="h-10 w-full rounded-full bg-paper pr-4 pl-10 text-sm ring-1 ring-ink/12 focus:ring-2 focus:ring-ink focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-6">
        <div className="space-y-2.5">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/15 px-6 py-14 text-center">
              <p className="font-display text-xl">{orders.length === 0 ? "No orders yet" : "Nothing here"}</p>
              <p className="mt-1 text-sm text-ink-soft">
                {orders.length === 0
                  ? mode === "demo"
                    ? "Place a demo order on the website and it will show up here."
                    : "New orders appear here automatically."
                  : query
                    ? "No orders match that search."
                    : "No orders with this status."}
              </p>
            </div>
          ) : (
            visible.map((o) => (
              <OrderRow key={o.id} order={o} settings={settings} selected={selected?.id === o.id} onSelect={() => setSelectedId(o.id)} />
            ))
          )}
        </div>

        {wide ? (
          <div className="sticky top-6 self-start rounded-3xl bg-paper p-6 ring-1 ring-ink/8">
            {selected ? (
              <OrderDetail order={selected} settings={settings} />
            ) : (
              <p className="py-16 text-center text-ink-soft">Select an order to see the details.</p>
            )}
          </div>
        ) : null}
      </div>

      {!wide ? (
        <Sheet open={!!selectedId} onOpenChange={(open) => !open && setSelectedId(null)}>
          <SheetContent side="bottom" className="max-h-[92svh] gap-0 overflow-y-auto rounded-t-3xl border-0 bg-paper px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetTitle className="sr-only">Order details</SheetTitle>
            {selectedId && orders.find((o) => o.id === selectedId) ? (
              <OrderDetail order={orders.find((o) => o.id === selectedId)!} settings={settings} />
            ) : null}
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}

export default withAdminData(OrdersPage)
