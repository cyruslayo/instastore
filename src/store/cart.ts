import { atom, computed, type ReadableAtom } from 'nanostores';

export type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  category: string;
  sku?: string | null;
  inventory?: number;
};

export type StoreCarts = Record<string, CartItem[]>;

export function getCartLineKey(item: CartItem): string {
  return item.product_id;
}

const CART_STORAGE_KEY = 'instastore_carts';
const LEGACY_CART_STORAGE_KEY = 'instastore_cart_items';
export const DEFAULT_STORE_SLUG = 'default-store';

function readStoredJson(key: string): unknown {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function mergeItems(base: CartItem[], extra: CartItem[]): CartItem[] {
  const merged = [...base];
  for (const item of extra) {
    const existing = merged.find((candidate) => candidate.product_id === item.product_id);
    if (existing) {
      merged[merged.indexOf(existing)] = {
        ...existing,
        quantity: Math.max(existing.quantity, item.quantity),
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function loadCarts(): StoreCarts {
  if (typeof window === 'undefined') return {};
  const stored = readStoredJson(CART_STORAGE_KEY);
  const carts: StoreCarts =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? { ...(stored as StoreCarts) }
      : {};

  // One-time migration of the pre-multi-store cart into default-store.
  const legacy = readStoredJson(LEGACY_CART_STORAGE_KEY);
  if (Array.isArray(legacy)) {
    const legacyItems = legacy as CartItem[];
    if (legacyItems.length > 0) {
      carts[DEFAULT_STORE_SLUG] = mergeItems(carts[DEFAULT_STORE_SLUG] ?? [], legacyItems);
    }
    try {
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
    } catch {
      /* Storage availability must not break cart behavior. */
    }
  }

  return carts;
}

export const carts = atom<StoreCarts>(loadCarts());

if (typeof window !== 'undefined') {
  carts.subscribe((value) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Storage availability must not break cart behavior.
    }
  });
}

function updateStoreCart(
  storeSlug: string,
  updater: (items: CartItem[]) => CartItem[],
): void {
  const current = carts.get();
  carts.set({ ...current, [storeSlug]: updater(current[storeSlug] ?? []) });
}

export const addItem = (storeSlug: string, item: CartItem): void => {
  updateStoreCart(storeSlug, (items) => {
    const existing = items.find((candidate) => candidate.product_id === item.product_id);
    if (existing) {
      return items.map((candidate) =>
        candidate.product_id === item.product_id
          ? {
              ...candidate,
              quantity: Math.min(
                candidate.quantity + item.quantity,
                candidate.inventory ?? Infinity,
              ),
            }
          : candidate,
      );
    }
    return [...items, item];
  });
};

export const removeItem = (storeSlug: string, productId: string): void => {
  updateStoreCart(storeSlug, (items) =>
    items.filter((item) => item.product_id !== productId),
  );
};

export const updateQuantity = (
  storeSlug: string,
  productId: string,
  delta: number,
): void => {
  updateStoreCart(storeSlug, (items) =>
    items.map((item) => {
      if (item.product_id !== productId) return item;
      const maximum = item.inventory ?? Infinity;
      return { ...item, quantity: Math.min(maximum, Math.max(1, item.quantity + delta)) };
    }),
  );
};

export const clearCart = (storeSlug: string): void => {
  updateStoreCart(storeSlug, () => []);
};

const itemStores = new Map<string, ReadableAtom<CartItem[]>>();
const countStores = new Map<string, ReadableAtom<number>>();
const totalStores = new Map<string, ReadableAtom<number>>();

export function cartItemsFor(storeSlug: string): ReadableAtom<CartItem[]> {
  let store = itemStores.get(storeSlug);
  if (!store) {
    store = computed(carts, (all) => all[storeSlug] ?? []);
    itemStores.set(storeSlug, store);
  }
  return store;
}

export function cartCountFor(storeSlug: string): ReadableAtom<number> {
  let store = countStores.get(storeSlug);
  if (!store) {
    store = computed(carts, (all) =>
      (all[storeSlug] ?? []).reduce((total, item) => total + item.quantity, 0),
    );
    countStores.set(storeSlug, store);
  }
  return store;
}

export function cartTotalFor(storeSlug: string): ReadableAtom<number> {
  let store = totalStores.get(storeSlug);
  if (!store) {
    store = computed(carts, (all) =>
      (all[storeSlug] ?? []).reduce(
        (total, item) => total + item.price * item.quantity,
        0,
      ),
    );
    totalStores.set(storeSlug, store);
  }
  return store;
}
