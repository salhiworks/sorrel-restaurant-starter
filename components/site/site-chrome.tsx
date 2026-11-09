"use client"

import { useStore } from "@/components/providers/store-provider"

/** Applies the owner's brand colour everywhere, including portalled dialogs. */
export function BrandStyle() {
  const { settings } = useStore()
  const color = /^#[0-9a-f]{6}$/i.test(settings.brandAccent) ? settings.brandAccent : "#c4532d"
  return <style>{`:root{--brand:${color}}`}</style>
}
