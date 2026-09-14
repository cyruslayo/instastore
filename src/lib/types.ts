export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  inventory: number;
  category: string;
  image?: string;
  sku?: string | null;
  featured: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  sku?: string | null;
  category: string;
  price: number;
  quantity: number;
  image?: string | null;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  instagramHandle?: string;
  email?: string;
  address2?: string;
  landmark?: string;
}

export type OrderStatus = 'Pending Verification' | 'Processing' | 'Shipped' | 'Fulfilled' | 'Cancelled';

export interface Order {
  id: string;
  public_code: string;
  customer_name: string;
  customer_phone: string;
  customer_instagram?: string | null;
  items: OrderItem[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  status: OrderStatus;
  shipping_address: ShippingAddress;
  receipt_path: string;
  inventory_restocked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderStatus {
  public_code: string;
  items: OrderItem[];
  subtotal: number;
  shipping_fee: number;
  total: number;
  status: OrderStatus;
  shipping_address: ShippingAddress;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email?: string | null;
  role: 'admin';
  created_at?: string;
  updated_at?: string;
}
