import Link from "next/link"

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-bone px-6 text-center">
      <div>
        <p className="eyebrow text-ink-soft">404</p>
        <h1 className="mt-3 font-display text-5xl">That page isn&apos;t on the menu.</h1>
        <Link href="/" className="mt-8 inline-flex h-12 items-center rounded-full bg-ink px-6 font-medium text-paper">
          Back to the homepage
        </Link>
      </div>
    </main>
  )
}
