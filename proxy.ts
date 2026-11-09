import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { IS_LIVE, SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "@/lib/env"

/**
 * Production Mode only: refreshes the Supabase session cookie and sends
 * signed-out visitors from /admin to the login page. This is a fast first
 * gate; the real check (is this user an admin?) runs in every Server Action
 * and again in the database through Row Level Security.
 */
export async function proxy(request: NextRequest) {
  if (!IS_LIVE) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data } = await supabase.auth.getUser()
  const isLogin = request.nextUrl.pathname.startsWith("/admin/login")

  if (!data.user && !isLogin) {
    const url = request.nextUrl.clone()
    url.pathname = "/admin/login"
    url.search = ""
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ["/admin/:path*"],
}
