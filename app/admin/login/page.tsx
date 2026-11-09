import Link from "next/link"
import { redirect } from "next/navigation"
import { IS_LIVE } from "@/lib/env"
import { LoginForm } from "./login-form"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
  // Demo Mode has no accounts: the demo dashboard is open and stores nothing on a server.
  if (!IS_LIVE) redirect("/admin")
  return (
    <div className="grid min-h-svh place-items-center bg-bone px-4 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm font-medium text-ink-soft hover:text-ink">
          ← Back to the website
        </Link>
        <div className="mt-8 rounded-[2rem] bg-paper p-7 ring-1 ring-ink/8">
          <h1 className="font-display text-3xl">Staff sign in</h1>
          <p className="mt-1 text-sm text-ink-soft">Use the email and password your Supabase admin account was created with.</p>
          <LoginForm />
        </div>
      </div>
    </div>
  )
}
