/**
 * Demo Mode vs Production Mode.
 *
 * The site runs in Demo Mode until both public Supabase variables are set.
 * NEXT_PUBLIC_* values are inlined at build time, so rebuild after changing them.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

const forceDemo = process.env.NEXT_PUBLIC_FORCE_DEMO === "true"

export const IS_LIVE = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY) && !forceDemo
export const DATA_MODE: "demo" | "live" = IS_LIVE ? "live" : "demo"

export const STORAGE_BUCKET = "dish-images"
