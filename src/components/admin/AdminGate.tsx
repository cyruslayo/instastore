'use client';
import { useState, useEffect, type ReactNode } from 'react';
import { signInWithPassword, signOut, isAdmin, describeAuthError } from '@/lib/auth';

export default function AdminGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAdmin().then(setAdmin).finally(() => setLoading(false));
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    try {
      const { error: signInError } = await signInWithPassword(email, password);
      if (signInError) {
        setError(describeAuthError(signInError));
        return;
      }
      const ok = await isAdmin();
      if (!ok) {
        setError(
          'This account does not have admin access. Check the browser console for details, then add a profiles row with role = \'admin\' for this user (see supabase/schema.sql).'
        );
        await signOut();
      }
      setAdmin(ok);
    } catch (err: any) {
      setError(describeAuthError(err));
    }
  };

  if (loading) {
    return <div className="p-8 text-center font-body-md text-on-surface-variant">Checking access...</div>;
  }

  if (!admin) {
    return (
      <div className="max-w-md mx-auto my-8 sm:my-16 bg-surface p-5 sm:p-8 rounded-2xl border border-outline-variant botanical-shadow">
        <div className="mb-6">
          <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-bold block">Security Gate</span>
          <h2 className="font-headline-sm text-lg sm:text-headline-sm text-on-surface font-bold mt-0.5">Admin Authentication</h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-1">Sign in with authorized administrator credentials to manage InstaStore.</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="font-label-sm text-xs uppercase tracking-wider text-on-surface-variant font-bold">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-primary text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1.5">
            <label className="font-label-sm text-xs uppercase tracking-wider text-on-surface-variant font-bold">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-surface-container-low border border-outline-variant rounded-xl text-primary text-sm focus:outline-none focus:border-primary"
            />
          </div>
          {error && <p role="alert" className="text-error font-body-sm text-xs p-3 bg-error/10 rounded-xl">{error}</p>}
          <button type="submit" className="w-full bg-primary text-on-primary py-3 px-4 rounded-xl font-mono text-xs uppercase tracking-wider font-bold hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer shadow-xs">
            Sign In to Store Admin
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
