"use client"

import {
  adminDeleteCategory,
  adminDeleteDish,
  adminImportSampleMenu,
  adminLoad,
  adminLoadOrders,
  adminReorderCategories,
  adminReorderDishes,
  adminSaveCategory,
  adminSaveDish,
  adminSaveSettings,
  adminUpdateOrderStatus,
  adminUploadImage,
} from "@/app/admin/actions"
import type { AdminBackend, Result } from "./backend"

/** Network failures become friendly results instead of thrown errors. */
async function safe<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn()
  } catch {
    return { ok: false, message: "Couldn't reach the server. Check your connection and try again." }
  }
}

export const liveBackend: AdminBackend = {
  mode: "live",
  load: () => safe(() => adminLoad()),
  loadOrders: () => safe(() => adminLoadOrders()),
  saveDish: (input) => safe(() => adminSaveDish(input)),
  deleteDish: (id) => safe(() => adminDeleteDish(id)),
  reorderDishes: (ids) => safe(() => adminReorderDishes(ids)),
  saveCategory: (input) => safe(() => adminSaveCategory(input)),
  deleteCategory: (id) => safe(() => adminDeleteCategory(id)),
  reorderCategories: (ids) => safe(() => adminReorderCategories(ids)),
  updateOrderStatus: (id, status) => safe(() => adminUpdateOrderStatus(id, status)),
  saveSettings: (settings) => safe(() => adminSaveSettings(settings)),
  uploadImage: (file, kind) =>
    safe(() => {
      const fd = new FormData()
      fd.append("file", file, `upload.${file.type.split("/")[1] ?? "jpg"}`)
      fd.append("kind", kind)
      return adminUploadImage(fd)
    }),
  importSampleMenu: () => safe(() => adminImportSampleMenu()),
}
