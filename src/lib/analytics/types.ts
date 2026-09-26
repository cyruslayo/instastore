import type { ConsentRecord } from "@/lib/analytics/consent";

export const EVENT_SCHEMA_VERSION = 1;

/** Internal event names. Destination adapters map these to their own names. */
export type StoreEventName =
  | "page view" | "product view" | "search submit" | "product add"
  | "cart view" | "checkout start" | "order submit";

export type StorePageType = "home" | "shop" | "product" | "cart" | "checkout" | "track";

export interface StoreIdentity { store_id: string; store_slug: string; }

/** Allowlisted event fields. Never add customer identity, address, receipt, or tracking code. */
export interface StoreEventData {
  page_type?: StorePageType;
  path?: string;
  product_id?: string;
  category?: string;
  price?: number;
  quantity?: number;
  in_stock?: boolean;
  query?: string;
  result_count?: number;
  item_count?: number;
  subtotal?: number;
}

export const STORE_EVENT_DATA_KEYS = [
  "page_type", "path", "product_id", "category", "price", "quantity",
  "in_stock", "query", "result_count", "item_count", "subtotal",
] as const satisfies ReadonlyArray<keyof StoreEventData>;

export interface StoreEventEnvelope extends StoreIdentity {
  schema_version: typeof EVENT_SCHEMA_VERSION;
  /** One random ID per browser action; destinations reuse it for deduplication. */
  event_id: string;
  event_name: StoreEventName;
  occurred_at: string;
  source: "browser";
  consent: ConsentRecord;
  data: StoreEventData;
}

export type ConsentPurpose = "analytics" | "marketing";

export interface EventDestination {
  name: string;
  purpose: ConsentPurpose;
  push: (event: StoreEventEnvelope) => void | Promise<void>;
}
