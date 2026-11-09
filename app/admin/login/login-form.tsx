"use client"

import { useActionState } from "react"
import { Loader2 } from "lucide-react"
import { signIn } from "../actions"

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined)
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="mt-1.5 h-12 w-full rounded-xl bg-bone px-3.5 ring-1 ring-ink/12 focus:ring-2 focus:ring-ink focus:outline-none" />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required minLength={6} className="mt-1.5 h-12 w-full rounded-xl bg-bone px-3.5 ring-1 ring-ink/12 focus:ring-2 focus:ring-ink focus:outline-none" />
      </div>
      {state?.message ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {state.message}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink font-medium text-paper disabled:opacity-60">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Sign in
      </button>
    </form>
  )
}
