import "server-only"
import { createClient } from "@supabase/supabase-js"
import { SUPABASE_URL } from "@/lib/env"

/**
 * Privileged client that bypasses Row Level Security. Server-only: the
 * "server-only" import makes the build fail if a client component imports it.
 * Only call this after validating input (orders) or verifying an admin.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Add it to your server environment variables (never prefix it with NEXT_PUBLIC_).",
    )
  }
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
