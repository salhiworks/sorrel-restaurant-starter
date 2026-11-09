import { getStorefrontData } from "@/lib/data/storefront"
import { DATA_MODE } from "@/lib/env"
import { StoreProvider } from "@/components/providers/store-provider"
import { CartProvider } from "@/components/providers/cart-provider"
import { DishDialogProvider } from "@/components/providers/dish-dialog-provider"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { CartSheet } from "@/components/site/cart-sheet"
import { BrandStyle } from "@/components/site/site-chrome"

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const data = await getStorefrontData()
  return (
    <StoreProvider initial={data} mode={DATA_MODE}>
      <CartProvider>
        <DishDialogProvider>
          <BrandStyle />
          <a
            href="#main"
            className="sr-only z-50 rounded-full bg-ink px-4 py-2 text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
          <CartSheet />
        </DishDialogProvider>
      </CartProvider>
    </StoreProvider>
  )
}
