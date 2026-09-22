import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUSES: OrderStatus[] = [
  "Pending Verification",
  "Processing",
  "Shipped",
  "Fulfilled",
  "Cancelled",
];

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  "Pending Verification": ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Fulfilled"],
  Fulfilled: [],
  Cancelled: [],
};

export const ORDER_ACTION_LABELS: Record<OrderStatus, string> = {
  "Pending Verification": "Awaiting payment verification",
  Processing: "Verify Payment",
  Shipped: "Mark as Shipped",
  Fulfilled: "Mark as Fulfilled",
  Cancelled: "Cancel Order",
};

export function nextOrderStatuses(status: string): OrderStatus[] {
  return ORDER_STATUSES.includes(status as OrderStatus) ? NEXT_STATUSES[status as OrderStatus] : [];
}

export function validatedStatusFilter(status: string | null): "All" | OrderStatus {
  return ORDER_STATUSES.includes(status as OrderStatus) ? status as OrderStatus : "All";
}
