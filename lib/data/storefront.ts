import "server-only"
import { cacheLife, cacheTag } from "next/cache"
import { IS_LIVE } from "@/lib/env"
import { seedStorefront } from "@/lib/seed"
import type { StorefrontData } from "@/lib/types"
import { readCatalog } from "./catalog"

export const STOREFRONT_TAG = "storefront"

/**
 * Everything the public site renders. Cached and shared between visitors;
 * dashboard edits call updateTag(STOREFRONT_TAG) so changes appear at once.
 */
export async function getStorefrontData(): Promise<StorefrontData> {
  "use cache"
  cacheTag(STOREFRONT_TAG)
  cacheLife("minutes")
  if (!IS_LIVE) return seedStorefront
  // Production Mode never falls back to sample data: if Supabase can't be
  // read, the error page is shown instead (and nothing wrong gets cached).
  // Usual causes: the migration hasn't been run, or the keys are wrong.
  const { createPublicClient } = await import("@/lib/supabase/public")
  return readCatalog(createPublicClient())
}
