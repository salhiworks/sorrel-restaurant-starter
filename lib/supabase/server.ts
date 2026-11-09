import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/env"

/** Session-aware client for Server Actions and Route Handlers (reads the auth cookie). */
export async function createSessionClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a context where cookies are read-only; the proxy refreshes them.
        }
      },
    },
  })
}
