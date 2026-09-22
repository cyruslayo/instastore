import { getSupabase } from './supabase';
import { getPublicStoreBySlug } from './stores';
import type { Product } from './types';

export async function getActiveProducts(storeSlug: string): Promise<Product[]> {
  const store = await getPublicStoreBySlug(storeSlug);
  if (!store) return [];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (!error) return (data ?? []) as Product[];
  } catch {
    // An unavailable catalog is treated as empty.
  }

  return [];
}

export async function getProductsByCategory(
  storeSlug: string,
  category: string,
): Promise<Product[]> {
  const store = await getPublicStoreBySlug(storeSlug);
  if (!store) return [];
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (!error) return (data ?? []) as Product[];
  } catch {
    // An unavailable catalog is treated as empty.
  }

  return [];
}

export async function getProductBySlug(
  storeSlug: string,
  productSlug: string,
): Promise<Product | null> {
  const store = await getPublicStoreBySlug(storeSlug);
  if (!store) return null;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .eq('slug', productSlug)
      .maybeSingle();

    if (!error) return data ? (data as Product) : null;
  } catch {
    // An unavailable product is treated as missing.
  }

  return null;
}
