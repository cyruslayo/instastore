import { getSupabase } from "./supabase";
import type {
  CustomerOrderStatus,
  LegacyOrderItem,
  MemberOrder,
  ShippingAddress,
} from "./types";

const RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);
const TRANSIENT_NETWORK_ERROR =
  /load failed|failed to fetch|network request failed|network connection was lost/i;

function isTransientNetworkError(error: unknown): boolean {
  let message = String(error ?? "");
  if (error instanceof Error) {
    message = error.message;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    message = String((error as { message?: unknown }).message ?? "");
  }
  return TRANSIENT_NETWORK_ERROR.test(message);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function secureRandomId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function")
    return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === "function") {
    const randomBytes = new Uint8Array(16);
    cryptoApi.getRandomValues(randomBytes);
    return Array.from(randomBytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
  }
  throw new Error("Secure receipt upload is unavailable in this browser.");
}

export async function createStoreOrder(payload: {
  customerName: string;
  customerPhone: string;
  customerInstagram?: string;
  items: Array<{ product_id: string; quantity: number }>;
  total: number;
  shippingAddress: ShippingAddress;
  receiptPath: string;
}): Promise<string> {
  const { data, error } = await getSupabase().rpc("create_store_order", {
    p_customer_name: payload.customerName,
    p_customer_phone: payload.customerPhone,
    p_customer_instagram: payload.customerInstagram ?? null,
    p_items: payload.items,
    p_total: payload.total,
    p_shipping_address: payload.shippingAddress,
    p_receipt_path: payload.receiptPath,
  });
  if (error) throw error;
  if (!data) throw new Error("Order creation returned no tracking code.");
  return data as string;
}

export async function getOrderStatus(
  publicCode: string,
  phone: string,
): Promise<CustomerOrderStatus | null> {
  const { data, error } = await getSupabase().rpc("get_order_status", {
    p_public_code: publicCode,
    p_phone: phone,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as CustomerOrderStatus | null;
}

export async function setOrderStatus(
  orderId: string,
  status: string,
): Promise<unknown> {
  const { data, error } = await getSupabase().rpc("set_order_status", {
    p_order_id: orderId,
    p_status: status,
  });
  if (error) throw error;
  return data;
}

// LEGACY - REMOVE IN MEMBERSHIP DECOUPLING PHASE. Adapts the Phase-1 checkout
// shape to the clean RPC without trusting its client-side prices or snapshots.
export async function createOrder(payload: {
  items: LegacyOrderItem[];
  total: number;
  shippingAddress: {
    instagramHandle?: string;
    phone: string;
    address: string;
    city?: string;
    state?: string;
  };
  receiptUrl: string;
}): Promise<string> {
  return createStoreOrder({
    customerName: payload.shippingAddress.instagramHandle || "Guest customer",
    customerPhone: payload.shippingAddress.phone,
    customerInstagram: payload.shippingAddress.instagramHandle,
    items: payload.items.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
    })),
    total: payload.total,
    shippingAddress: {
      fullName: payload.shippingAddress.instagramHandle || "Guest customer",
      phone: payload.shippingAddress.phone,
      address: payload.shippingAddress.address,
      city: payload.shippingAddress.city || "",
      state: payload.shippingAddress.state || "",
      instagramHandle: payload.shippingAddress.instagramHandle,
    },
    receiptPath: payload.receiptUrl,
  });
}

// LEGACY - REMOVE IN MEMBERSHIP DECOUPLING PHASE. The clean schema intentionally
// has no member order-history RPC; this remains only for the old UI boundary.
export async function getMemberOrders(
  _instagramHandle: string,
  _phone: string,
): Promise<MemberOrder[]> {
  return [];
}

export async function uploadReceipt(file: File): Promise<string> {
  if (!RECEIPT_MIME_TYPES.has(file.type))
    throw new Error("Receipt must be a JPEG, PNG, or PDF file.");
  const extensionMatch = file.name.match(/\.([a-z0-9]{1,5})$/i);
  let extension = ".jpg";
  if (
    extensionMatch &&
    ["jpg", "jpeg", "png", "pdf"].includes(extensionMatch[1].toLowerCase())
  ) {
    extension = `.${extensionMatch[1].toLowerCase()}`;
  } else if (file.type === "application/pdf") {
    extension = ".pdf";
  } else if (file.type === "image/png") {
    extension = ".png";
  }
  const supabase = getSupabase();
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const path = `receipts/${secureRandomId()}${extension}`;
    try {
      const { error } = await supabase.storage
        .from("receipts")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (!error) return path;
      lastError = error;
    } catch (error) {
      lastError = error;
    }
    if (!isTransientNetworkError(lastError) || attempt === 3) throw lastError;
    await wait(350 * attempt);
  }
  throw lastError ?? new Error("Receipt upload failed.");
}
