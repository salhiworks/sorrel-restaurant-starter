import type { CategoryInput, DishInput } from "@/lib/admin-schemas"
import type { Category, Dish, Order, OrderStatus, Settings } from "@/lib/types"

export type AdminSnapshot = {
  settings: Settings
  categories: Category[]
  dishes: Dish[]
  orders: Order[]
}

export type Result<T = void> = { ok: true; data: T } | { ok: false; message: string; fields?: Record<string, string> }

/**
 * Everything the dashboard can do. Two implementations:
 *  - demo: this browser's localStorage, nothing leaves the device
 *  - live: authenticated Server Actions backed by Supabase
 */
export interface AdminBackend {
  mode: "demo" | "live"
  load(): Promise<Result<AdminSnapshot>>
  loadOrders(): Promise<Result<Order[]>>
  saveDish(input: DishInput): Promise<Result<Dish>>
  deleteDish(id: string): Promise<Result>
  reorderDishes(ids: string[]): Promise<Result>
  saveCategory(input: CategoryInput): Promise<Result<Category>>
  deleteCategory(id: string): Promise<Result>
  reorderCategories(ids: string[]): Promise<Result>
  updateOrderStatus(id: string, status: OrderStatus): Promise<Result<Order>>
  saveSettings(settings: Settings): Promise<Result<Settings>>
  /** Takes an already-resized image and returns a URL the site can display. */
  uploadImage(file: Blob, kind: "dish" | "logo"): Promise<Result<string>>
  importSampleMenu(): Promise<Result>
}
