"use client"

import { useCallback, useSyncExternalStore } from "react"

/** Subscribes to a CSS media query. Returns `false` during server rendering. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const SCROLL_STAGE_QUERY =
  "(min-width: 1024px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)"
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
