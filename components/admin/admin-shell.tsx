"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentType, ReactNode } from "react"
import { ExternalLink, LayoutGrid, Loader2, LogOut, ReceiptText, RotateCcw, Settings2, UtensilsCrossed } from "lucide-react"
import { signOut } from "@/app/admin/actions"
import { useAdmin } from "./admin-provider"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutGrid },
  { href: "/admin/orders", label: "Orders", icon: ReceiptText },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
]

export function AdminShell({ children }: { children: ReactNode }) {
  const { mode, data, resetDemo } = useAdmin()
  const pathname = usePathname()
  const newCount = data?.orders.filter((o) => o.status === "new").length ?? 0
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href))

  return (
    <div className="min-h-svh bg-bone lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-svh flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Link href="/admin" className="px-2">
          <span className="font-display text-2xl italic">{data?.settings.name ?? "Restaurant"}</span>
          <span className="eyebrow mt-1 block text-ink-soft">Kitchen dashboard</span>
        </Link>
        <nav aria-label="Dashboard" className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-[0.9375rem] font-medium transition",
                isActive(n.href) ? "bg-ink text-paper" : "text-ink/75 hover:bg-ink/5 hover:text-ink",
              )}
            >
              <n.icon className="size-[1.1rem]" />
              {n.label}
              {n.href === "/admin/orders" && newCount ? (
                <span className="tabular ml-auto grid min-w-6 place-items-center rounded-full bg-brand px-1.5 text-xs leading-6 font-semibold text-white">
                  {newCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-line pt-4">
          <a href="/" target="_blank" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">
            <ExternalLink className="size-4" />
            View website
          </a>
          {mode === "live" ? (
            <form action={signOut}>
              <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink">
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset the demo? Your demo edits and demo orders in this browser will be removed.")) void resetDemo()
              }}
              className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink-soft hover:bg-ink/5 hover:text-ink"
            >
              <RotateCcw className="size-4" />
              Reset demo data
            </button>
          )}
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        {mode === "demo" ? (
          <div className="border-b border-ink/10 bg-ink px-4 py-2.5 text-center text-[0.8125rem] text-paper sm:px-8">
            <strong className="font-semibold">Demo dashboard.</strong> Changes and orders are saved in this browser only — they
            update the demo website here, but nothing reaches a real restaurant.
            <button
              type="button"
              onClick={() => {
                if (confirm("Reset the demo? Your demo edits and demo orders in this browser will be removed.")) void resetDemo()
              }}
              className="ml-2 font-medium underline underline-offset-2 lg:hidden"
            >
              Reset
            </button>
          </div>
        ) : null}

        {/* Mobile top bar */}
        <div className="flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
          <span className="font-display text-xl italic">{data?.settings.name ?? "Dashboard"}</span>
          <div className="flex items-center gap-1">
            <a href="/" target="_blank" className="grid size-10 place-items-center rounded-full text-ink-soft" aria-label="View website">
              <ExternalLink className="size-4" />
            </a>
            {mode === "live" ? (
              <form action={signOut}>
                <button type="submit" className="grid size-10 place-items-center rounded-full text-ink-soft" aria-label="Sign out">
                  <LogOut className="size-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">
          <AdminReady>{children}</AdminReady>
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav
        aria-label="Dashboard"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={cn(
              "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium",
              isActive(n.href) ? "text-ink" : "text-ink-soft",
            )}
          >
            <n.icon className="size-5" />
            {n.label}
            {n.href === "/admin/orders" && newCount ? (
              <span className="tabular absolute top-2 left-[calc(50%+0.4rem)] grid min-w-5 place-items-center rounded-full bg-brand px-1 text-[0.625rem] leading-5 font-semibold text-white">
                {newCount}
              </span>
            ) : null}
            {isActive(n.href) ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-ink" /> : null}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function AdminLoading() {
  return (
    <div className="grid min-h-[50svh] place-items-center text-ink-soft" role="status">
      <Loader2 className="size-6 animate-spin" />
      <span className="sr-only">Loading dashboard</span>
    </div>
  )
}

/** Pages render their own loading state, so each route segment always renders. */
export function withAdminData<P extends object>(View: ComponentType<P>) {
  function WithAdminData(props: P) {
    const { data } = useAdmin()
    return data ? <View {...props} /> : <AdminLoading />
  }
  WithAdminData.displayName = `withAdminData(${View.displayName ?? View.name})`
  return WithAdminData
}

function AdminReady({ children }: { children: ReactNode }) {
  const { state, reload } = useAdmin()
  if (state.status === "error") {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-display text-2xl">The dashboard couldn&apos;t load</p>
        <p className="mt-2 text-sm text-ink-soft">{state.message}</p>
        <button type="button" onClick={() => void reload()} className="mt-6 h-11 rounded-full bg-ink px-5 text-sm font-medium text-paper">
          Try again
        </button>
      </div>
    )
  }
  return <>{children}</>
}
