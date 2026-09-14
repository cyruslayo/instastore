'use client';
import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import {
  isPending,
  isApproved,
  accessState,
  clearAccess,
  setApprovedAccess,
  setRejectedAccess,
  hasApprovalCelebration,
  dismissApprovalCelebration,
} from '@/store/access';
import { checkAccess, normalizeHandle } from '@/lib/referrals';
import { getSupabase } from '@/lib/supabase';
import { useHydrated } from '@/lib/useHydrated';

export default function AccessStatusBanner() {
  const isHydrated = useHydrated();
  const pending = useStore(isPending);
  const approved = useStore(isApproved);
  const access = useStore(accessState);
  const celebration = useStore(hasApprovalCelebration);
  const [dismissed, setDismissed] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(false);
  }, [access.status]);

  // Sync / check status with server/storage
  const revalidateStatus = useCallback(async () => {
    const handle = access.instagramHandle;
    const phone = access.phone;
    if (!handle || !phone) return;

    try {
      const res = await checkAccess(handle, phone);
      setVerificationError(null);
      if (res.status === 'approved' && access.status !== 'approved') {
        const approvedHandle = res.instagramHandle || normalizeHandle(handle);
        setApprovedAccess(approvedHandle, phone, res.referralCode, true);
      } else if (res.status === 'rejected') {
        setRejectedAccess(res.instagramHandle || normalizeHandle(handle), phone);
      }
    } catch (error) {
      console.error('Error checking membership status:', error);
      setVerificationError('Membership status is temporarily unavailable. We will keep checking.');
    }
  }, [access.instagramHandle, access.phone, access.status]);

  // 1. Auto-polling every 5 seconds while in 'pending' status
  useEffect(() => {
    if (!pending) return;

    // Check immediately on mount
    revalidateStatus();

    const interval = setInterval(() => {
      revalidateStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [pending, revalidateStatus]);

  // 2. Window focus & Visibility change listeners (instant check when user returns to tab)
  useEffect(() => {
    if (!pending) return;

    const handleFocus = () => {
      revalidateStatus();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pending, revalidateStatus]);

  // 3. Supabase Realtime Channel Subscription (for production live push)
  useEffect(() => {
    if (!pending || !access.instagramHandle) return;

    try {
      const supabase = getSupabase();
      const cleanHandle = normalizeHandle(access.instagramHandle);

      const channel = supabase
        .channel(`access-sync-${cleanHandle}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'access_requests',
            filter: `instagram_handle=eq.${cleanHandle}`,
          },
          (payload) => {
            if (payload.new && payload.new.status === 'approved') {
              revalidateStatus();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Membership realtime is optional; polling remains the fallback.
    }
  }, [pending, access.instagramHandle, revalidateStatus]);

  if (!isHydrated || dismissed) return null;

  // View A: Celebratory In-App Approval Notification
  if (celebration && approved) {
    return (
      <aside
        aria-label="Membership Approved"
        className="bg-primary text-on-primary px-4 py-3.5 text-center relative z-50 border-b border-secondary/40 shadow-lg animate-in slide-in-from-top duration-300"
      >
        <div className="max-w-container-max mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-left">
            <span className="w-8 h-8 rounded-full bg-secondary text-primary flex items-center justify-center font-bold text-sm shrink-0">
              ✓
            </span>
            <div>
              <div className="font-label-sm text-label-sm font-bold uppercase tracking-widest text-secondary">
                🎉 Membership Approved!
              </div>
              <div className="font-body-sm text-body-sm opacity-90">
                Welcome to Botanica, <strong className="font-mono">{access.instagramHandle}</strong>. Your full store and apothecary access is unlocked.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/shop"
              onClick={() => dismissApprovalCelebration()}
              className="px-4 py-1.5 bg-secondary text-primary rounded-full font-label-sm text-label-sm uppercase tracking-wider font-bold hover:scale-105 transition-transform"
            >
              Shop Collection &rarr;
            </a>
            <button
              onClick={() => dismissApprovalCelebration()}
              aria-label="Dismiss approval notification"
              className="touch-target p-1 opacity-70 hover:opacity-100 transition-opacity text-xl font-bold"
            >
              &times;
            </button>
          </div>
        </div>
      </aside>
    );
  }

  if (dismissed) return null;

  // View B: Pending Review Banner
  if (pending) {
    const handle = access.instagramHandle || 'your account';
    return (
      <aside
        aria-label="Membership Status"
        className="bg-secondary-container text-on-secondary-container px-4 py-2.5 text-center font-body-sm text-body-sm relative z-40 border-b border-outline-variant/20"
      >
        <div className="max-w-container-max mx-auto flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>
              Membership application for <strong className="font-mono">{handle}</strong> is under review. You will be notified the second it is approved.
            </span>
            <a href="/invite" className="font-bold underline underline-offset-2 ml-1 hover:opacity-80">
              Details &rarr;
            </a>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss notice"
            className="touch-target p-1 opacity-70 hover:opacity-100 transition-opacity"
          >
            &times;
          </button>
        </div>
        {verificationError && (
          <p className="mt-1 text-xs text-on-secondary-container/80">{verificationError}</p>
        )}
      </aside>
    );
  }

  // View C: Verified Member Top Status Bar
  if (approved && access.instagramHandle) {
    return (
      <aside
        aria-label="Member status"
        className="bg-surface-container-high text-primary px-4 py-1.5 text-center font-label-sm text-label-sm relative z-40 border-b border-outline-variant/20 hidden md:block"
      >
        <div className="max-w-container-max mx-auto flex items-center justify-between">
          <span className="text-secondary tracking-widest uppercase text-[11px] font-bold font-mono">
            Verified Member: {access.instagramHandle}
          </span>
          <div className="flex items-center gap-4">
            <a
              href="/invite"
              className="text-on-surface-variant hover:text-primary transition-colors underline underline-offset-2"
            >
              My Referral Code
            </a>
            <button
              onClick={() => clearAccess()}
              className="text-on-surface-variant hover:text-error transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
