import type { Metadata, Viewport } from "next"
import { Fraunces, Instrument_Sans } from "next/font/google"
import { Toaster } from "sonner"
import { getStorefrontData } from "@/lib/data/storefront"
import "./globals.css"

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
})

const instrument = Instrument_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
})

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getStorefrontData()
  const title = `${settings.name} — ${settings.tagline}`
  return {
    metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
    title: { default: title, template: `%s · ${settings.name}` },
    description: settings.description,
    openGraph: {
      title,
      description: settings.description,
      images: [{ url: "/images/dishes/ember-ribeye.webp", width: 1000, height: 1000 }],
      type: "website",
    },
  }
}

export const viewport: Viewport = {
  themeColor: "#f1ebe0",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} antialiased`}>
      <body className="min-h-svh">
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !bg-ink !text-paper !border-0 !shadow-xl",
              actionButton: "!bg-paper !text-ink !rounded-full !font-medium",
            },
          }}
        />
      </body>
    </html>
  )
}
