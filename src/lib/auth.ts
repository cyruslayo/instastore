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

// Maps a Supabase AuthApiError to a human-readable message with an
// actionable hint. Sign-in failures return a generic "Invalid login
// credentials" message, so the error code is needed to tell the real
// cause apart (unconfirmed email vs wrong password).
export function describeAuthError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  switch (e?.code) {
    case 'email_not_confirmed':
      return 'This email has not been confirmed. Confirm the user in Supabase (Authentication → Users → Confirm user), or click the confirmation link sent by email.';
    case 'invalid_credentials':
      return 'Invalid email or password. Check the credentials under Supabase Authentication → Users.';
    default:
      return e?.message ? `Sign-in failed: ${e.message}` : 'Sign-in failed.';
  }
}
