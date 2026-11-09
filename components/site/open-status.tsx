"use client"

import { useEffect, useState } from "react"
import { describeStatus, localClock, openStatus } from "@/lib/hours"
import { useStore } from "@/components/providers/store-provider"
import { cn } from "@/lib/utils"

/** Live opening status, computed in the browser and refreshed every minute. */
export function useOpenStatus() {
  const { settings } = useStore()
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the current time must not be rendered on the server
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  if (!now) return null
  const status = openStatus(settings.hours, now, settings.timezone)
  const today = localClock(now, settings.timezone).day
  return { status, today, label: describeStatus(status, today) }
}

export function OpenStatus({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const s = useOpenStatus()
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center gap-2 text-[0.8125rem] font-medium",
        tone === "dark" ? "text-moss-ink" : "text-ink",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-2 shrink-0 rounded-full",
          !s ? "bg-ink/20" : s.status.open ? "bg-[#3f8f4e] shadow-[0_0_0_3px_rgb(63_143_78/0.18)]" : "bg-brand",
        )}
      />
      <span className="tabular">{s ? s.label : " "}</span>
    </span>
  )
}
