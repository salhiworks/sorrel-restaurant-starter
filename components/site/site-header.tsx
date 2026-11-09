"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Menu, ShoppingBag, X } from "lucide-react"
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useCart } from "@/components/providers/cart-provider"
import { useStore } from "@/components/providers/store-provider"
import { OpenStatus } from "./open-status"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/#plates", label: "Tonight" },
  { href: "/#menu", label: "Menu" },
  { href: "/#story", label: "Story" },
  { href: "/#visit", label: "Visit" },
]

export function Wordmark({ className }: { className?: string }) {
  const { settings } = useStore()
  if (settings.logoUrl) {
    return (
      <span className={cn("relative block h-9 w-32", className)}>
        <Image
          src={settings.logoUrl}
          alt={settings.name}
          fill
          sizes="128px"
          unoptimized={settings.logoUrl.startsWith("data:")}
          className="object-contain object-left"
        />
      </span>
    )
  }
  return (
    <span className={cn("font-display text-[1.65rem] leading-none font-[460] tracking-[-0.02em] italic", className)}>
      {settings.name}
    </span>
  )
}

export function SiteHeader() {
  const { count, setOpen, ready } = useCart()
  const { mode } = useStore()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-300",
        scrolled ? "bg-bone/85 shadow-[0_1px_0_var(--line)] backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-6 px-4 sm:px-8 lg:px-12">
        <Link href="/" className="-my-2 py-2 text-ink" aria-label="Home">
          <Wordmark />
        </Link>
        {mode === "demo" ? (
          <Link
            href="/admin"
            title="Demo site: orders are not sent to a restaurant. Open the demo dashboard."
            className="-ml-3 rounded-full bg-ink/8 px-2.5 py-1 text-[0.6875rem] font-semibold tracking-wider text-ink-soft uppercase transition hover:bg-ink hover:text-paper"
          >
            Demo
          </Link>
        ) : null}

        <nav aria-label="Main" className="ml-6 hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-[0.9375rem] font-medium text-ink/75 transition hover:text-ink pointer-coarse:after:absolute pointer-coarse:after:-inset-x-2 pointer-coarse:after:-inset-y-3"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <OpenStatus className="hidden lg:inline-flex" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative inline-flex h-11 items-center gap-2 rounded-full bg-ink pr-4 pl-3.5 text-[0.9375rem] font-medium text-paper transition hover:bg-ink/85"
            aria-label={`Your order, ${count} ${count === 1 ? "item" : "items"}`}
          >
            <ShoppingBag className="size-[1.1rem]" />
            <span className="hidden sm:inline">Order</span>
            <span
              className={cn(
                "tabular grid min-w-5 place-items-center rounded-full px-1.5 text-xs leading-5 font-semibold transition",
                ready && count > 0 ? "bg-brand text-white" : "bg-paper/15 text-paper/80",
              )}
            >
              {ready ? count : 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="grid size-11 place-items-center rounded-full text-ink ring-1 ring-ink/15 md:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="top" showCloseButton={false} className="border-0 bg-bone px-4 pt-3 pb-8">
          <div className="flex h-12 items-center justify-between">
            <SheetTitle className="text-ink">
              <Wordmark />
            </SheetTitle>
            <SheetClose
              render={<button type="button" className="grid size-11 place-items-center rounded-full ring-1 ring-ink/15" />}
            >
              <X className="size-5" />
              <span className="sr-only">Close navigation</span>
            </SheetClose>
          </div>
          <nav aria-label="Mobile" className="mt-6 flex flex-col">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="border-b border-line py-4 font-display text-3xl text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <OpenStatus className="mt-6" />
        </SheetContent>
      </Sheet>
    </header>
  )
}
