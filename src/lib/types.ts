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

export type OrderStatus =
  | 'Pending Verification'
  | 'Processing'
  | 'Shipped'
  | 'Fulfilled'
  | 'Cancelled';

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

// LEGACY - REMOVE IN MEMBERSHIP DECOUPLING PHASE.
// Kept because the Phase-1 membership order-history UI still consumes it.
export interface LegacyOrderItem {
  id: string;
  name: string;
  variant: string;
  price: number;
  quantity: number;
  image: string;
  strength_mg?: number | null;
  bottle_size_ml?: number | null;
  strain_name?: string | null;
  batch_code?: string | null;
}

// LEGACY - REMOVE IN MEMBERSHIP DECOUPLING PHASE.
export interface MemberOrder {
  id: string;
  items: LegacyOrderItem[];
  total: number;
  status: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email?: string | null;
  role: 'admin';
  created_at?: string;
  updated_at?: string;
}

// LEGACY - REMOVE IN MEMBERSHIP DECOUPLING PHASE.
export interface ReferralCode {
  id: string;
  code: string;
  owner_handle: string;
  owner_email?: string;
  owner_id?: string;
  is_active: boolean;
  created_at: string;
}

// LEGACY - REMOVE IN MEMBERSHIP DECOUPLING PHASE.
export interface AccessRequest {
  id: string;
  instagram_handle: string;
  phone: string;
  referral_code: string;
  referred_by: string;
  status: 'pending' | 'approved' | 'rejected';
  email?: string;
  full_name?: string;
  user_id?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
}
