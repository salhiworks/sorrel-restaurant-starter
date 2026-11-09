import { isIP } from "node:net"

/*
 * Who is placing this order? Used only to rate-limit orders per connection.
 *
 * Browsers can send any X-Forwarded-For header they like, so it is never
 * trusted on its own. Each proxy you control *appends* the address that
 * connected to it, so only the entries at the END of the header are reliable:
 * with one trusted proxy (Hostinger CDN) the last entry is the visitor.
 *
 * TRUSTED_PROXY (server environment variable):
 *   unset / empty  trust nothing. The per-connection limit is skipped; the
 *                  site-wide limit and duplicate protection still apply.
 *   hostinger      Hostinger CDN in front of the app (one proxy hop).
 *   1, 2, 3 …      that many proxies you control, each appending one entry.
 */

const MAX_HOPS = 5

/** How many trusted proxies append to X-Forwarded-For. 0 means trust none. */
export function trustedProxyHops(value: string | undefined): number {
  const v = (value ?? "").trim().toLowerCase()
  if (v === "hostinger") return 1
  if (/^[1-9]$/.test(v) && Number(v) <= MAX_HOPS) return Number(v)
  return 0
}

/**
 * The visitor's address as established by the trusted proxies, or null when
 * it can't be established (no trusted proxy, header missing, too few entries,
 * or not an IP address).
 */
export function clientAddress(headers: Pick<Headers, "get">, hops: number): string | null {
  if (hops < 1) return null
  const raw = headers.get("x-forwarded-for")
  if (!raw) return null
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean)
  // Fewer entries than trusted proxies means the request skipped one of them.
  if (entries.length < hops) return null
  return normalizeIp(entries[entries.length - hops])
}

/** Strips ports and brackets, unwraps IPv4-mapped IPv6, and rejects anything that isn't an IP. */
export function normalizeIp(value: string): string | null {
  let v = value.trim()
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(v)
  if (bracketed) v = bracketed[1]
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(v)) v = v.slice(0, v.lastIndexOf(":"))
  v = v.replace(/%.*$/, "") // IPv6 zone id
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(v)
  if (mapped) v = mapped[1]
  return isIP(v) ? v.toLowerCase() : null
}

/**
 * The bucket an address is rate-limited in. IPv4 addresses are used as they
 * are. One IPv6 customer usually controls a whole /64 network (billions of
 * addresses), so IPv6 is limited per /64 or anyone could rotate addresses.
 */
export function rateLimitKey(ip: string): string {
  if (isIP(ip) !== 6) return ip
  return `${expandIpv6(ip).slice(0, 4).join(":")}::/64`
}

function expandIpv6(ip: string): string[] {
  let v = ip
  // Embedded IPv4 tail (e.g. 64:ff9b::1.2.3.4) → two hextets.
  const tail = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(v)
  if (tail) {
    const [a, b, c, d] = tail.slice(1).map(Number)
    v = v.slice(0, tail.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`
  }
  const [head, rest] = v.split("::")
  const left = head ? head.split(":") : []
  const right = rest !== undefined && rest !== "" ? rest.split(":") : []
  const zeros = rest === undefined ? [] : Array(8 - left.length - right.length).fill("0")
  return [...left, ...zeros, ...right].map((h) => (parseInt(h, 16) || 0).toString(16))
}
