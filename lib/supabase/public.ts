import { createClient } from "@supabase/supabase-js"
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/env"

/**
 * Cookie-less client for public reads (menu, settings). Safe inside "use cache"
 * because it never touches request data. Row Level Security limits it to
 * publicly readable rows.
 */
export function createPublicClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
