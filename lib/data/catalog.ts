import "server-only"
import { IS_LIVE } from "@/lib/env"
import { seedStorefront } from "@/lib/seed"
import type { StorefrontData } from "@/lib/types"
import { toCategory, toDish, toSettings, type CategoryRow, type DishRow } from "./mappers"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Read settings, categories and dishes with any Supabase client. */
export async function readCatalog(client: SupabaseClient): Promise<StorefrontData> {
  const [settings, categories, dishes] = await Promise.all([
    client.from("settings").select("data").eq("id", 1).maybeSingle(),
    client.from("categories").select("id,name,note,position").order("position"),
    client.from("dishes").select("*").order("position"),
  ])
  const error = settings.error ?? categories.error ?? dishes.error
  if (error) throw new Error(`Could not load the menu from Supabase: ${error.message}`)
  return {
    settings: toSettings(settings.data?.data),
    categories: (categories.data as CategoryRow[]).map(toCategory),
    dishes: (dishes.data as DishRow[]).map(toDish),
  }
}

/** Fresh, uncached read used by the order endpoint so prices are always current. */
export async function readCatalogFresh(): Promise<StorefrontData> {
  if (!IS_LIVE) return seedStorefront
  const { createServiceClient } = await import("@/lib/supabase/admin")
  return readCatalog(createServiceClient())
}
