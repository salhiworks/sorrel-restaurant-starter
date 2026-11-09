"use client"

import Link from "next/link"
import { AlertTriangle, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { useCart } from "@/components/providers/cart-provider"
import { useStore } from "@/components/providers/store-provider"
import { useMediaQuery } from "@/hooks/use-media-query"
import { formatPrice } from "@/lib/money"
import { DishImage } from "./dish-image"
import { cn } from "@/lib/utils"

export function CartSheet() {
  const cart = useCart()
  const { settings } = useStore()
  const wide = useMediaQuery("(min-width: 640px)")
  const fmt = (c: number) => formatPrice(c, settings.currency, settings.locale)

  return (
    <Sheet open={cart.open} onOpenChange={cart.setOpen}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={cn(
          "gap-0 border-0 bg-paper p-0",
          wide ? "w-full sm:max-w-md" : "max-h-[88svh] rounded-t-3xl",
        )}
      >
        {!wide ? <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink/15" /> : null}
        <div className="border-b border-line px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
          <SheetTitle className="font-display text-2xl font-[420] text-ink">Your order</SheetTitle>
          <SheetDescription className="text-ink-soft">
            {cart.count ? `${cart.count} ${cart.count === 1 ? "item" : "items"} · pay on ${settings.deliveryEnabled ? "pickup or delivery" : "pickup"}` : "Nothing here yet."}
          </SheetDescription>
        </div>

        {cart.lines.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 py-16 text-center">
            <div>
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-bone">
                <ShoppingBag className="size-6 text-ink-soft" />
              </div>
              <p className="mt-4 font-display text-xl">Your order is empty</p>
              <p className="mt-1 text-sm text-ink-soft">Add a few plates from the menu to get started.</p>
              <Link
                href="/#menu"
                onClick={() => cart.setOpen(false)}
                className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper"
              >
                Browse the menu
              </Link>
            </div>
          </div>
        ) : (
          <>
            <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6">
              {cart.lines.map((line) => (
                <li key={line.dishId} className="flex gap-4 border-b border-line py-4 last:border-b-0">
                  <DishImage
                    src={line.dish?.imageUrl ?? null}
                    alt=""
                    sizes="64px"
                    className={cn("w-16 shrink-0", line.problem && "opacity-50 grayscale")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <p className="truncate font-medium text-ink">{line.dish?.name ?? "Removed dish"}</p>
                      {!line.problem && line.dish ? (
                        <p className="tabular ml-auto shrink-0 text-sm font-medium">
                          {fmt(line.dish.priceCents * line.quantity)}
                        </p>
                      ) : null}
                    </div>
                    {line.problem ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-brand">
                        <AlertTriangle className="size-3.5" />
                        {line.problem === "removed" ? "No longer on the menu" : "Sold out — remove to continue"}
                      </p>
                    ) : (
                      <p className="tabular text-sm text-ink-soft">{fmt(line.dish!.priceCents)} each</p>
                    )}
                    <div className="mt-2.5 flex items-center gap-2">
                      {!line.problem ? (
                        <div className="flex h-10 items-center rounded-full ring-1 ring-ink/15">
                          <button
                            type="button"
                            onClick={() => cart.setQuantity(line.dishId, line.quantity - 1)}
                            className="grid size-10 place-items-center rounded-full"
                            aria-label={`One fewer ${line.dish?.name}`}
                          >
                            <Minus className="size-3.5" />
                          </button>
                          <span className="tabular w-6 text-center text-sm font-medium">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => cart.setQuantity(line.dishId, line.quantity + 1)}
                            disabled={line.quantity >= 20}
                            className="grid size-10 place-items-center rounded-full disabled:opacity-30"
                            aria-label={`One more ${line.dish?.name}`}
                          >
                            <Plus className="size-3.5" />
                          </button>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => cart.remove(line.dishId)}
                        className="ml-auto grid size-10 place-items-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
                        aria-label={`Remove ${line.dish?.name ?? "item"}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-line bg-paper px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">
              {cart.hasProblems ? (
                <button
                  type="button"
                  onClick={cart.removeProblems}
                  className="mb-3 w-full rounded-xl bg-brand/10 px-4 py-2.5 text-left text-sm font-medium text-brand"
                >
                  Remove unavailable items
                </button>
              ) : null}
              <div className="flex items-baseline justify-between">
                <span className="text-ink-soft">Subtotal</span>
                <span className="tabular font-display text-2xl">{fmt(cart.subtotalCents)}</span>
              </div>
              {!settings.orderingEnabled ? (
                <p className="mt-3 text-sm text-brand">Online ordering is paused right now.</p>
              ) : null}
              <Link
                href="/checkout"
                onClick={() => cart.setOpen(false)}
                aria-disabled={cart.hasProblems || cart.count === 0 || !settings.orderingEnabled}
                className={cn(
                  "mt-4 flex h-13 w-full items-center justify-center rounded-full bg-ink text-[0.9375rem] font-medium text-paper transition hover:bg-ink/85",
                  (cart.hasProblems || cart.count === 0 || !settings.orderingEnabled) && "pointer-events-none opacity-40",
                )}
              >
                Review & checkout
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
