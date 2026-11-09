"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { ImagePlus, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useAdmin } from "./admin-provider"
import { resizeImage } from "@/lib/admin/resize-image"
import { cn } from "@/lib/utils"

/** Upload/replace/remove a photo. Resizes in the browser first. */
export function ImageField({
  value,
  onChange,
  kind,
  round = true,
  label,
}: {
  value: string | null
  onChange: (url: string | null) => void
  kind: "dish" | "logo"
  round?: boolean
  label: string
}) {
  const { backend, mode } = useAdmin()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      // Demo photos live in localStorage, so keep them small.
      const blob = await resizeImage(file, {
        max: mode === "demo" ? 720 : kind === "logo" ? 600 : 1600,
        square: kind === "dish",
        quality: mode === "demo" ? 0.78 : 0.84,
      })
      const res = await backend.uploadImage(blob, kind)
      if (res.ok) onChange(res.data)
      else toast.error(res.message)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={cn(
          "relative grid size-28 shrink-0 place-items-center overflow-hidden bg-bone ring-1 ring-ink/10",
          round ? "rounded-full" : "rounded-2xl",
        )}
        aria-label={value ? `Replace ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
      >
        {value ? (
          <Image src={value} alt="" fill sizes="112px" unoptimized={value.startsWith("data:")} className={round ? "object-cover" : "object-contain p-2"} />
        ) : (
          <ImagePlus className="size-6 text-ink-soft" />
        )}
        {busy ? (
          <span className="absolute inset-0 grid place-items-center bg-paper/70">
            <Loader2 className="size-5 animate-spin" />
          </span>
        ) : null}
      </button>
      <div className="space-y-2">
        <p className="text-sm font-medium">{label}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="h-9 rounded-full px-4 text-sm font-medium ring-1 ring-ink/15 hover:bg-ink/5"
          >
            {value ? "Replace" : "Upload"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-soft hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          ) : null}
        </div>
        <p className="text-xs text-ink-soft">
          {kind === "dish" ? "A top-down photo works best. It's cropped square and shown as a round plate." : "PNG with a transparent background works best."}
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void pick(e.target.files?.[0])}
      />
    </div>
  )
}
