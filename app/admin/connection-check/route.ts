import { headers } from "next/headers"
import { clientAddress, rateLimitKey, trustedProxyHops } from "@/lib/client-ip"
import { IS_LIVE } from "@/lib/env"

/**
 * Admins only: shows which address order rate limiting sees for YOUR
 * connection, so you can confirm TRUSTED_PROXY after deploying.
 * Open /admin/connection-check and compare "address" with a "what is my IP"
 * website. See README → "Order rate limiting behind a proxy".
 */
export async function GET() {
  if (!IS_LIVE) return Response.json({ error: "Only available in Production Mode." }, { status: 404 })

  const { createSessionClient } = await import("@/lib/supabase/server")
  const db = await createSessionClient()
  const { data } = await db.auth.getUser()
  const admin = data.user
    ? (await db.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle()).data
    : null
  if (!admin) return Response.json({ error: "Admins only." }, { status: 403 })

  const setting = process.env.TRUSTED_PROXY ?? ""
  const hops = trustedProxyHops(setting)
  const address = clientAddress(await headers(), hops)
  return Response.json(
    {
      TRUSTED_PROXY: setting || "(not set)",
      address: address ?? "(could not be established — per-connection limit is off)",
      limitedAs: address ? rateLimitKey(address) : null,
      ok: Boolean(address),
    },
    { headers: { "Cache-Control": "no-store" } },
  )
}
