export interface Store {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  compare_at_price?: number | null;
  gallery_images: string[];
  inventory: number;
  category: string;
  image?: string;
  sku?: string | null;
  featured: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type DeliveryCity = 'Abuja' | 'Lagos';

export interface DeliveryZone {
  id: string;
  store_id: string;
  city: DeliveryCity;
  name: string;
  provider: string;
  fee: number;
  estimate?: string | null;
  note?: string | null;
  is_active: boolean;
  sort_order: number;
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
  store_id: string;
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
  delivery_zone_id?: string | null;
  delivery_city?: string | null;
  delivery_zone_name?: string | null;
  delivery_provider?: string | null;
  delivery_estimate?: string | null;
  /** First trusted payment verification time (database clock); null before verification. */
  payment_verified_at?: string | null;
  /** Stable ID for the verified-payment event; reused for any later destination delivery. */
  payment_event_id?: string | null;
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
  delivery_city?: string | null;
  delivery_zone_name?: string | null;
  delivery_provider?: string | null;
  delivery_estimate?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  store_id: string;
  email?: string | null;
  role: 'admin';
  created_at?: string;
  updated_at?: string;
}
