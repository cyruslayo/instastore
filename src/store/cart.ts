import { atom, computed } from 'nanostores';

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

export function getCartLineKey(item: CartItem): string {
  return item.product_id;
}

const CART_STORAGE_KEY = 'instastore_cart_items';

function getInitialCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export const cartItems = atom<CartItem[]>(getInitialCart());

if (typeof window !== 'undefined') {
  cartItems.subscribe((items) => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Storage availability must not break cart behavior.
    }
  });
}

export const addItem = (item: CartItem): void => {
  const current = cartItems.get();
  const existing = current.find((candidate) => candidate.product_id === item.product_id);
  if (existing) {
    cartItems.set(current.map((candidate) =>
      candidate.product_id === item.product_id
        ? { ...candidate, quantity: Math.min(candidate.quantity + item.quantity, candidate.inventory ?? Infinity) }
        : candidate,
    ));
    return;
  }
  cartItems.set([...current, item]);
};

export const removeItem = (productId: string) => {
  cartItems.set(cartItems.get().filter((item) => item.product_id !== productId));
};

export const updateQuantity = (productId: string, delta: number) => {
  cartItems.set(cartItems.get().map((item) => {
    if (item.product_id !== productId) return item;
    const maximum = item.inventory ?? Infinity;
    return { ...item, quantity: Math.min(maximum, Math.max(1, item.quantity + delta)) };
  }));
};

export const clearCart = () => cartItems.set([]);
export const cartCount = computed(cartItems, (items) => items.reduce((total, item) => total + item.quantity, 0));
export const cartTotal = computed(cartItems, (items) => items.reduce((total, item) => total + item.price * item.quantity, 0));
