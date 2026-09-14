export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  inventory: number;
  category: string;
  image?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  strength_mg?: number | null;
  bottle_size_ml?: number | null;
  strain_name?: string | null;
  batch_code?: string | null;
}

export interface OrderItem {
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

export interface ShippingAddress {
  instagramHandle: string;
  phone: string;
  region: string; // e.g. 'Asokoro' | 'Wuse' | 'Maitama' | 'Garki' | 'Jabi' | 'Guzape'
  address: string; // Full delivery address & landmarks
  city?: string; // e.g. 'Abuja'
  state?: string; // e.g. 'FCT'
  // Legacy optional fields for backward compatibility
  fullName?: string;
  email?: string;
  address1?: string;
  address2?: string;
  zip?: string;
  country?: string;
}

export interface Order {
  id: string;
  user_id: string;
  items: OrderItem[];
  total: number;
  shipping_fee?: number;
  status: string;
  shipping_address: ShippingAddress;
  receipt_url: string;
  created_at: string;
}

export interface MemberOrder {
  id: string;
  items: OrderItem[];
  total: number;
  status: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  role: 'admin' | 'customer';
}

export interface ReferralCode {
  id: string;
  code: string;
  owner_handle: string; // e.g. "@member_handle"
  owner_email?: string;
  owner_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface AccessRequest {
  id: string;
  instagram_handle: string; // e.g. "@elena_walker"
  phone: string;
  referral_code: string;
  referred_by: string; // Referring Instagram handle or code owner
  status: 'pending' | 'approved' | 'rejected';
  email?: string;
  full_name?: string;
  user_id?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
}
