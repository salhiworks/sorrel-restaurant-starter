"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useStore } from "@/components/providers/store-provider"

export function SiteFooter() {
  const { settings, mode } = useStore()
  const [year, setYear] = useState<number | null>(null)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the current year must not be rendered on the server
  useEffect(() => setYear(new Date().getFullYear()), [])

  return (
    <footer className="bg-ink text-paper">
      <div className="mx-auto max-w-[1440px] px-4 pt-16 pb-10 sm:px-8 lg:px-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="font-display text-[clamp(3.5rem,12vw,8rem)] leading-[0.85] font-[420] tracking-[-0.03em] italic">
              {settings.name}
            </p>
            <p className="mt-4 max-w-sm text-paper/60">{settings.description}</p>
          </div>
          <div className="text-[0.9375rem]">
            <p className="eyebrow text-paper/45">Find us</p>
            <p className="mt-3 text-paper/85">
              {settings.addressLine}
              <br />
              {[settings.city, settings.postcode].filter(Boolean).join(" ")}
            </p>
            {settings.phone ? <p className="mt-3 text-paper/85">{settings.phone}</p> : null}
            {settings.email ? (
              <a href={`mailto:${settings.email}`} className="mt-1 block text-paper/85 hover:text-paper">
                {settings.email}
              </a>
            ) : null}
          </div>
          <nav aria-label="Footer" className="flex flex-col gap-2 text-[0.9375rem]">
            <p className="eyebrow text-paper/45">Around here</p>
            <Link href="/#menu" className="mt-1 text-paper/85 hover:text-paper">Menu</Link>
            <Link href="/#story" className="text-paper/85 hover:text-paper">Story</Link>
            <Link href="/#visit" className="text-paper/85 hover:text-paper">Hours & location</Link>
            {settings.instagramUrl ? (
              <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className="text-paper/85 hover:text-paper">
                Instagram
              </a>
            ) : null}
          </nav>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-paper/10 pt-6 text-sm text-paper/45 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year ?? ""} {settings.name}
          </p>
          <Link href="/admin" className="hover:text-paper/80">
            {mode === "demo" ? "Restaurant dashboard (demo)" : "Staff login"}
          </Link>
        </div>
      </div>
    </footer>
  )
}
