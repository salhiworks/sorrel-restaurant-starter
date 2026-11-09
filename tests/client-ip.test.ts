import { describe, expect, it } from "vitest"
import { clientAddress, normalizeIp, rateLimitKey, trustedProxyHops } from "@/lib/client-ip"

const req = (xff?: string, extra: Record<string, string> = {}) =>
  new Headers({ ...(xff === undefined ? {} : { "x-forwarded-for": xff }), ...extra })

describe("trusted proxy setting", () => {
  it("trusts nothing unless configured", () => {
    for (const v of [undefined, "", "true", "yes", "0", "-1", "10", "cloudflare"]) expect(trustedProxyHops(v)).toBe(0)
  })
  it("understands hostinger and small hop counts", () => {
    expect(trustedProxyHops("hostinger")).toBe(1)
    expect(trustedProxyHops(" Hostinger ")).toBe(1)
    expect(trustedProxyHops("2")).toBe(2)
  })
})

describe("client address", () => {
  it("ignores every header when no proxy is trusted", () => {
    const h = req("203.0.113.9", { "x-real-ip": "203.0.113.9", "cf-connecting-ip": "203.0.113.9" })
    expect(clientAddress(h, 0)).toBeNull()
  })

  it("uses the entry appended by the trusted proxy, not one the browser sent", () => {
    // Visitor 198.51.100.7 sends a forged header; Hostinger CDN appends the real address.
    expect(clientAddress(req("1.1.1.1, 198.51.100.7"), 1)).toBe("198.51.100.7")
    expect(clientAddress(req("1.1.1.1,2.2.2.2,  198.51.100.7"), 1)).toBe("198.51.100.7")
  })

  it("gives a forger the same identity whatever they put in the header", () => {
    const real = "198.51.100.7"
    const forged = ["", "10.0.0.1", "1.1.1.1, 2.2.2.2", "unknown", "<script>", "8.8.8.8, 9.9.9.9, 4.4.4.4"]
    const seen = forged.map((f) => clientAddress(req(f ? `${f}, ${real}` : real), 1))
    expect(new Set(seen)).toEqual(new Set([real]))
  })

  it("never falls back to X-Real-IP or other client-settable headers", () => {
    expect(clientAddress(req(undefined, { "x-real-ip": "203.0.113.9", "true-client-ip": "203.0.113.9" }), 1)).toBeNull()
  })

  it("counts hops from the end with several proxies", () => {
    expect(clientAddress(req("6.6.6.6, 198.51.100.7, 10.0.0.2"), 2)).toBe("198.51.100.7")
  })

  it("fails safe when the trusted proxy was skipped or the value is junk", () => {
    expect(clientAddress(req(), 1)).toBeNull()
    expect(clientAddress(req(""), 1)).toBeNull()
    expect(clientAddress(req("198.51.100.7"), 2)).toBeNull()
    expect(clientAddress(req("1.1.1.1, not-an-ip"), 1)).toBeNull()
    expect(clientAddress(req("1.1.1.1, 999.1.1.1"), 1)).toBeNull()
  })
})

describe("address normalisation", () => {
  it("strips ports, brackets and IPv4-mapped prefixes", () => {
    expect(normalizeIp("198.51.100.7:52311")).toBe("198.51.100.7")
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8::1")
    expect(normalizeIp("::ffff:198.51.100.7")).toBe("198.51.100.7")
    expect(normalizeIp("2001:DB8::1")).toBe("2001:db8::1")
  })
})

describe("rate-limit buckets", () => {
  it("keeps IPv4 addresses separate, so neighbours aren't blocked together", () => {
    expect(rateLimitKey("198.51.100.7")).not.toBe(rateLimitKey("198.51.100.8"))
  })

  it("groups an IPv6 /64, so rotating addresses doesn't escape the limit", () => {
    const a = rateLimitKey("2001:db8:1:2::1")
    expect(a).toBe("2001:db8:1:2::/64")
    expect(rateLimitKey("2001:db8:1:2:ffff:eeee:dddd:cccc")).toBe(a)
    expect(rateLimitKey("2001:0db8:0001:0002:0:0:0:9")).toBe(a)
    expect(rateLimitKey("2001:db8:1:3::1")).not.toBe(a)
    expect(rateLimitKey("::1")).toBe("0:0:0:0::/64")
  })
})
