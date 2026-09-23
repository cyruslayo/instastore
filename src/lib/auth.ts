import { getSupabase } from './supabase';

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabase();
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = getSupabase();
  return await supabase.auth.signOut();
}

export async function getSession() {
  try {
    const supabase = getSupabase();
    return await supabase.auth.getSession();
  } catch {
    return { data: { session: null }, error: null } as any;
  }
}

export interface AdminProfile {
  id: string;
  email: string | null;
  role: 'admin';
  store_id: string;
  store_slug: string;
}

// Resolves the current authenticated merchant's profile plus their active
// store. Returns null when there is no valid merchant profile, the store is
// missing, or the store is suspended.
export async function getCurrentAdminProfile(): Promise<AdminProfile | null> {
  try {
    const supabase = getSupabase();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.user?.id) {
      return null;
    }

    const userId = sessionData.session.user.id;
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, role, store_id')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile || profile.role !== 'admin' || !profile.store_id) {
      return null;
    }

    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('status, slug')
      .eq('id', profile.store_id)
      .maybeSingle();

    if (storeError || !store || store.status !== 'active') {
      return null;
    }

    return {
      id: profile.id,
      email: profile.email ?? null,
      role: 'admin',
      store_id: profile.store_id,
      store_slug: store.slug,
    };
  } catch {
    return null;
  }
}

export async function isAdmin() {
  return (await getCurrentAdminProfile()) !== null;
}

// Keep merchant-facing sign-in errors useful without exposing Supabase
// implementation details; the operator follows docs/SUPABASE_SETUP.md.
export function describeAuthError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  switch (e?.code) {
    case 'email_not_confirmed':
      return 'This merchant account is not active yet. Contact the InstaStore operator for help.';
    case 'invalid_credentials':
      return 'Invalid email or password. Check your details and try again.';
    default:
      return 'Sign-in failed. Please try again or contact the InstaStore operator.';
  }
}
