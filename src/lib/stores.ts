import { getSupabase } from './supabase';
import type { Store } from './types';

const STORE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidStoreSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && STORE_SLUG_PATTERN.test(slug.trim().toLowerCase());
}

export function normalizeStoreSlug(slug: string): string {
  return String(slug ?? '').trim().toLowerCase();
}

export async function getPublicStoreBySlug(storeSlug: string): Promise<Store | null> {
  const slug = normalizeStoreSlug(storeSlug);
  if (!isValidStoreSlug(slug)) return null;
  try {
    const { data, error } = await getSupabase()
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    if (error || !data) return null;
    return data as Store;
  } catch {
    return null;
  }
}
