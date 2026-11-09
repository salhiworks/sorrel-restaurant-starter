const cache = new Map<string, Intl.NumberFormat>()

/** Format integer cents as a localized price, e.g. 2950 -> "€29.50". */
export function formatPrice(cents: number, currency = "EUR", locale = "en-IE"): string {
  const key = `${locale}|${currency}`
  let fmt = cache.get(key)
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(locale, { style: "currency", currency })
    } catch {
      fmt = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" })
    }
    cache.set(key, fmt)
  }
  const value = cents / 100
  // Drop ".00" for whole amounts: €36 reads better on a menu than €36.00.
  const out = fmt.format(value)
  return Number.isInteger(value) ? out.replace(/[.,]00(?=\D*$)/, "") : out
}

/** Parse a price typed by the owner ("12", "12.5", "12,50") into cents. */
export function parsePriceToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[^\d.,]/g, "").replace(",", ".")
  if (!cleaned) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0 || value > 100000) return null
  return Math.round(value * 100)
}
