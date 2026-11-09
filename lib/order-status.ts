import type { OrderStatus } from "./types"

/** Which statuses an order may move to next. Completed and cancelled are final. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return NEXT_STATUSES[from].includes(to)
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
}

/** The single most likely next step, used for the primary button on an order. */
export function primaryNext(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUSES[status].find((s) => s !== "cancelled") ?? null
}

export const ACTIVE_STATUSES: OrderStatus[] = ["new", "accepted", "preparing", "ready"]
