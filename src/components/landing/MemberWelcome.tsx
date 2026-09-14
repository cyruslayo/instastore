'use client';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { isApproved, accessState } from '@/store/access';

/**
 * Member edition banner on the publication landing page.
 * Unobtrusively welcomes verified members with quick shortcuts to their
 * apothecary drop and referral privileges, leaving the entire publication intact.
 */
export default function MemberWelcome() {
  const approved = useStore(isApproved);
  const access = useStore(accessState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated || !approved) return null;

  const handle = access.instagramHandle || '@member';

  return (
    <div className="w-full bg-surface-container-low border-b border-outline-variant/40 py-3.5 px-margin-mobile md:px-margin-desktop">
      <div className="max-w-container-max mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-center sm:text-left">
          <span className="w-2 h-2 rounded-full bg-secondary shrink-0" aria-hidden="true" />
          <p className="font-body-sm text-body-sm text-primary">
            <span className="font-bold">Member Edition:</span> Welcome back, <span className="font-mono font-bold text-secondary">{handle}</span>. 
            <span className="hidden md:inline text-on-surface-variant ml-1.5">You have active private apothecary privileges.</span>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/portal"
            className="font-label-sm text-xs uppercase tracking-widest text-secondary hover:text-primary font-bold underline underline-offset-4 transition-colors"
          >
            Member Dashboard &rarr;
          </a>
          <span className="text-outline-variant" aria-hidden="true">|</span>
          <a
            href="/shop"
            className="px-4 py-1.5 bg-primary text-on-primary font-label-sm text-xs uppercase tracking-widest font-bold rounded-full hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Shop Available Products
          </a>
        </div>
      </div>
    </div>
  );
}
