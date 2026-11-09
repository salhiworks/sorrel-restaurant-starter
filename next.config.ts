import type { NextConfig } from "next"
import { PHASE_PRODUCTION_BUILD } from "next/constants"

/**
 * Catches set-up mistakes when building, instead of after launch:
 * a half-finished Supabase setup would silently build the Demo Mode site,
 * and a secret key in a NEXT_PUBLIC_ variable would be sent to every browser.
 */
/**
 * PUBLIC_DEMO_MODE=true marks a public showcase deployment (for example the
 * Vercel live demo). It must run in Demo Mode with no database at all, and it
 * may be framed by the Profit Studio showcase.
 */
const publicDemo = /^(1|true|yes|on)$/i.test(process.env.PUBLIC_DEMO_MODE ?? "")
const SHOWCASE_ORIGIN = "https://profitstudio.app"

function checkEnvironment() {
  const env = process.env
  if (publicDemo) {
    const supabaseVars = Object.keys(env).filter((k) => /SUPABASE/.test(k) && env[k])
    if (supabaseVars.length) {
      throw new Error(
        `PUBLIC_DEMO_MODE is on, but ${supabaseVars.join(", ")} ${supabaseVars.length === 1 ? "is" : "are"} set. A public demo must never be connected to a Supabase project: remove these variables from this deployment.`,
      )
    }
    return
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  const problems: string[] = []

  const leaked = Object.keys(env).filter(
    (k) => k.startsWith("NEXT_PUBLIC_") && (/SECRET|SERVICE_ROLE/.test(k) || (env[k] ?? "").startsWith("sb_secret_")),
  )
  if (leaked.length) problems.push(`${leaked.join(", ")} would expose your secret key to every visitor. Use SUPABASE_SECRET_KEY (no NEXT_PUBLIC_ prefix).`)
  if (Boolean(url) !== Boolean(publicKey)) {
    problems.push(
      url
        ? "NEXT_PUBLIC_SUPABASE_URL is set but NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Set both for Production Mode, or neither for Demo Mode."
        : "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is set but NEXT_PUBLIC_SUPABASE_URL is missing. Set both for Production Mode, or neither for Demo Mode.",
    )
  }
  if (problems.length) throw new Error(`Environment variables need fixing:\n- ${problems.join("\n- ")}`)

  const live = Boolean(url && publicKey) && env.NEXT_PUBLIC_FORCE_DEMO !== "true"
  if (live && !(env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.warn("⚠ Production Mode: SUPABASE_SECRET_KEY is not set here. Orders will fail until it is set on the server.")
  }
  if (live && !env.TRUSTED_PROXY) {
    console.warn("⚠ Production Mode: TRUSTED_PROXY is not set, so per-connection order limits are off. On Hostinger set TRUSTED_PROXY=hostinger.")
  }
}

// Allow next/image to optimise photos uploaded to your Supabase Storage bucket.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null
  } catch {
    return null
  }
})()

/*
 * Who may show these pages inside a frame.
 * - A real restaurant: only itself, and the dashboard never.
 * - The public demo: itself and the Profit Studio showcase (profitstudio.app/demo/<slug>).
 *   CSP frame-ancestors is used there because X-Frame-Options can't name another site.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
]
const framing = publicDemo
  ? [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${SHOWCASE_ORIGIN}` }]
  : [{ key: "X-Frame-Options", value: "SAMEORIGIN" }]
const adminHeaders = publicDemo
  ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] // the demo dashboard is part of the showcase
  : [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    ]

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: [...securityHeaders, ...framing] },
      { source: "/admin/:path*", headers: adminHeaders },
    ]
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  experimental: {
    // Dish photos are resized in the browser before upload, so 4 MB is generous.
    serverActions: { bodySizeLimit: "4mb" },
  },
  poweredByHeader: false,
}

export default function config(phase: string): NextConfig {
  // The config is loaded more than once per build; warn only the first time.
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.__SORREL_ENV_CHECKED) {
    checkEnvironment()
    process.env.__SORREL_ENV_CHECKED = "1"
  }
  return nextConfig
}
