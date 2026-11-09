"use client"

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-svh place-items-center bg-bone px-6 text-center">
      <div>
        <h1 className="font-display text-4xl">Something went wrong in the kitchen.</h1>
        <p className="mt-3 text-ink-soft">Please try again. If it keeps happening, give us a call.</p>
        <button type="button" onClick={reset} className="mt-8 h-12 rounded-full bg-ink px-6 font-medium text-paper">
          Try again
        </button>
      </div>
    </main>
  )
}
