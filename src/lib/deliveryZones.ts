import { getSupabase } from './supabase';
import { getCurrentAdminProfile } from './auth';
import { getPublicStoreBySlug } from './stores';
import type { DeliveryCity, DeliveryZone } from './types';

export interface DeliveryZoneInput {
  city: DeliveryCity;
  name: string;
  provider: string;
  fee: number;
  estimate?: string | null;
  note?: string | null;
  is_active?: boolean;
}

function normalizeZoneValues(input: Partial<DeliveryZoneInput>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.city !== undefined) payload.city = input.city;
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.provider !== undefined) payload.provider = input.provider.trim();
  if (input.fee !== undefined) payload.fee = input.fee;
  if (input.estimate !== undefined) payload.estimate = input.estimate?.trim() || null;
  if (input.note !== undefined) payload.note = input.note?.trim() || null;
  if (input.is_active !== undefined) payload.is_active = input.is_active;
  return payload;
}

export async function getActiveDeliveryZones(storeSlug: string): Promise<DeliveryZone[]> {
  const store = await getPublicStoreBySlug(storeSlug);
  if (!store) return [];
  try {
    const { data, error } = await getSupabase()
      .from('delivery_zones')
      .select('*')
      .eq('store_id', store.id)
      .eq('is_active', true)
      .order('city')
      .order('name');
    if (error) return [];
    return (data ?? []) as DeliveryZone[];
  } catch {
    return [];
  }
}

export async function listMerchantDeliveryZones(): Promise<DeliveryZone[]> {
  const profile = await getCurrentAdminProfile();
  if (!profile) return [];
  const { data, error } = await getSupabase()
    .from('delivery_zones')
    .select('*')
    .eq('store_id', profile.store_id)
    .order('city')
    .order('name');
  if (error) throw error;
  return (data ?? []) as DeliveryZone[];
}

export async function createDeliveryZone(input: DeliveryZoneInput): Promise<DeliveryZone> {
  const profile = await getCurrentAdminProfile();
  if (!profile) throw new Error('No active merchant store is associated with this account.');
  const { data, error } = await getSupabase()
    .from('delivery_zones')
    .insert({ store_id: profile.store_id, ...normalizeZoneValues(input) })
    .select()
    .single();
  if (error) throw error;
  return data as DeliveryZone;
}

export async function updateDeliveryZone(
  id: string,
  input: Partial<DeliveryZoneInput>,
): Promise<DeliveryZone> {
  const { data, error } = await getSupabase()
    .from('delivery_zones')
    .update(normalizeZoneValues(input))
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as DeliveryZone;
}

export async function deleteDeliveryZone(id: string): Promise<void> {
  const { error } = await getSupabase().from('delivery_zones').delete().eq('id', id);
  if (error) throw error;
}
