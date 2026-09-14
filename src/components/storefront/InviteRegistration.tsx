'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { accessState, setPendingAccess, setApprovedAccess, clearAccess } from '@/store/access';
import { validateReferralCode, submitAccessRequest, checkAccess, normalizeHandle } from '@/lib/referrals';
import type { PublicReferralCode } from '@/lib/referrals';
import { useHydrated } from '@/lib/useHydrated';

export default function InviteRegistration({ initialCode = '' }: { initialCode?: string }) {
  const isHydrated = useHydrated();
  const rawAccess = useStore(accessState);
  const access = isHydrated ? rawAccess : { status: 'unknown', instagramHandle: null, phone: null, referralCode: null };
  const [code, setCode] = useState(initialCode);
  const [referralInfo, setReferralInfo] = useState<PublicReferralCode | null>(null);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Streamlined form: Instagram handle & Phone only
  const [formData, setFormData] = useState({
    instagramHandle: '',
    phone: '',
  });

  const [statusQuery, setStatusQuery] = useState('');
  const [statusPhone, setStatusPhone] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<string | null>(null);

  useEffect(() => {
    if (initialCode) {
      handleValidate(initialCode);
    }
  }, [initialCode]);

  const handleValidate = async (codeToTest: string) => {
    if (!codeToTest.trim()) return;
    setValidating(true);
    setError(null);
    try {
      const result = await validateReferralCode(codeToTest);
      if (result) {
        setReferralInfo(result);
      } else {
        setReferralInfo(null);
        setError('Invalid or inactive invitation code. Please check with the member who referred you.');
      }
    } catch {
      setError('Unable to validate code. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralInfo) {
      setError('Please provide a valid referral code.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cleanHandle = normalizeHandle(formData.instagramHandle);
      const res = await submitAccessRequest({
        instagramHandle: cleanHandle,
        phone: formData.phone,
        referralCode: referralInfo.code,
      });

      if (res.success) {
        setPendingAccess(cleanHandle, formData.phone);
        setSuccess(true);
      } else {
        setError(res.error || 'Failed to submit application.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusQuery.trim() || !statusPhone.trim()) return;
    setCheckingStatus(true);
    setStatusResult(null);
    try {
      const res = await checkAccess(statusQuery, statusPhone);
      if (res.status === 'approved') {
        const handle = res.instagramHandle || normalizeHandle(statusQuery);
        setApprovedAccess(handle, statusPhone, res.referralCode);
        setStatusResult(`Approved! Welcome back, ${handle}. Your store access is unlocked.`);
      } else if (res.status === 'pending') {
        const handle = res.instagramHandle || normalizeHandle(statusQuery);
        setPendingAccess(handle, statusPhone);
        setStatusResult(`Your application for ${handle} is currently under review by our store team.`);
      } else if (res.status === 'rejected') {
        setStatusResult('Your application was not approved. Please contact customer support for assistance.');
      } else {
        setStatusResult('No application found for this Instagram handle or phone number.');
      }
    } catch {
      setStatusResult('Error checking status. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyReferralLink = (codeStr: string) => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/invite/${codeStr}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 1. If currently an approved member
  if (access.status === 'approved') {
    const myCode = access.referralCode;
    const displayHandle = access.instagramHandle || '@member';
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-surface-container-low rounded-2xl p-8 border border-secondary/30 botanical-shadow">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-3 h-3 rounded-full bg-secondary"></span>
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
              Active Member Status
            </span>
          </div>

          <h1 className="font-headline-md text-headline-md text-primary mb-2">
            Welcome, {displayHandle}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mb-8">
            You have full verified access to the Botanica private apothecary and catalog.
          </p>

          <div className="bg-surface rounded-xl p-6 border border-outline-variant mb-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant block mb-1">
                  Your Personal Invitation Code
                </span>
                {myCode ? (
                  <span className="font-headline-sm text-headline-sm text-primary font-mono">{myCode}</span>
                ) : (
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Invitation code unavailable</span>
                )}
              </div>
              {myCode && <button
                onClick={() => copyReferralLink(myCode)}
                className="px-5 py-2.5 bg-primary text-on-primary rounded-full font-label-sm text-label-sm uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
              >
                {copied ? 'Copied Link!' : 'Copy Invite Link'}
              </button>}
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Share your invite link so friends can apply for membership.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
            <a
              href="/shop"
              className="px-6 py-3 bg-primary text-on-primary rounded-full font-label-sm text-label-sm uppercase tracking-widest hover:bg-primary/90 transition-colors"
            >
              Shop Collection &rarr;
            </a>
            <button
              onClick={() => clearAccess()}
              className="font-label-sm text-label-sm text-on-surface-variant hover:text-error transition-colors"
            >
              Sign Out of Membership
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. If application is currently pending
  if (success || access.status === 'pending') {
    const handle = access.instagramHandle || formData.instagramHandle;
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-surface-container-low rounded-2xl p-8 border border-secondary/30 botanical-shadow text-center">
          <div className="w-16 h-16 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>

          <h1 className="font-headline-md text-headline-md text-primary mb-3">
            Application Submitted
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mb-6 max-w-md mx-auto">
            Your application for <strong className="text-primary font-mono">{handle}</strong> is under review by our store team.
          </p>

          <div className="bg-surface rounded-xl p-5 border border-outline-variant text-left mb-8 max-w-md mx-auto font-body-sm text-body-sm text-on-surface-variant space-y-2">
            <p>• You can continue to browse products and learn about our botanical formulas.</p>
            <p>• Purchasing and checkout will unlock as soon as our team verifies your referral.</p>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="/"
              className="px-6 py-3 bg-primary text-on-primary rounded-full font-label-sm text-label-sm uppercase tracking-widest hover:scale-102 transition-transform"
            >
              Browse Products
            </a>
            <button
              onClick={() => clearAccess()}
              className="px-6 py-3 border border-outline text-primary rounded-full font-label-sm text-label-sm uppercase tracking-widest hover:bg-surface transition-colors"
            >
              Try Another Code
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Guest registration form (Instagram Handle & Phone only)
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-12">
      <div className="text-center space-y-3">
        <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-bold">
          Exclusive Access
        </span>
        <h1 className="font-display-sm md:font-display-md text-display-sm md:text-display-md text-primary">
          Join the Botanica Circle
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mx-auto">
          Botanica is an invite-only apothecary. Enter your invitation code or redeem an invite link to apply.
        </p>
      </div>

      <div className="bg-surface-container-low rounded-2xl p-8 border border-outline-variant botanical-shadow">
        {!referralInfo ? (
          <div className="space-y-6">
            <h2 className="font-headline-sm text-headline-sm text-primary">
              Have an Invitation Code?
            </h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="invitationCode"
                name="invitationCode"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. an active member code"
                aria-label="Invitation Code"
                className="flex-1 p-3.5 bg-surface border border-outline rounded-xl font-body-lg text-body-lg text-primary placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => handleValidate(code)}
                disabled={validating || !code.trim()}
                className="px-6 py-3.5 bg-primary text-on-primary rounded-xl font-label-sm text-label-sm uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {validating ? 'Verifying...' : 'Verify Code'}
              </button>
            </div>
            {error && (
              <p className="font-body-sm text-body-sm text-error bg-error/10 p-3 rounded-lg">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-secondary-container/40 border border-secondary/20 rounded-xl">
              <div>
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest block">
                  Invitation Verified
                </span>
                <span className="font-body-md text-body-md text-primary font-medium">
                  Referred by: {referralInfo.owner_handle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReferralInfo(null);
                  setCode('');
                }}
                className="text-xs text-on-surface-variant hover:text-primary underline"
              >
                Change Code
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="instagramHandle" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                  Instagram Handle *
                </label>
                <div className="relative">
                  <input
                    id="instagramHandle"
                    type="text"
                    required
                    value={formData.instagramHandle}
                    onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                    className="w-full p-3.5 bg-surface border border-outline rounded-lg text-primary font-body-lg font-mono placeholder:text-on-surface-variant/40"
                    placeholder="@your_instagram"
                  />
                </div>
                <span className="text-xs text-on-surface-variant mt-1 block">
                  Used to verify your identity and send your member updates.
                </span>
              </div>

              <div>
                <label htmlFor="phone" className="font-label-sm text-label-sm text-on-surface-variant block mb-1">
                  Phone Number *
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-3.5 bg-surface border border-outline rounded-lg text-primary font-body-lg font-mono placeholder:text-on-surface-variant/40"
                  placeholder="+234 800 000 0000"
                />
                <span className="text-xs text-on-surface-variant mt-1 block">
                  Used for order delivery verification and member support.
                </span>
              </div>
            </div>

            {error && (
              <p className="font-body-sm text-body-sm text-error bg-error/10 p-3 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-primary text-on-primary rounded-full font-label-sm text-label-sm uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-md"
            >
              {submitting ? 'Submitting Application...' : 'Request Membership Access'}
            </button>
          </form>
        )}
      </div>

      {/* Status Check via Instagram handle or phone */}
      <div className="bg-surface rounded-xl p-6 border border-outline-variant/40 space-y-4">
        <h3 className="font-headline-sm text-headline-sm text-primary">
          Already applied? Check status
        </h3>
        <form onSubmit={handleCheckStatus} className="space-y-3">
          <input
            id="statusQuery"
            name="statusQuery"
            type="text"
            required
            value={statusQuery}
            onChange={(e) => setStatusQuery(e.target.value)}
            placeholder="Enter your Instagram handle"
            aria-label="Instagram handle to check status"
            className="flex-1 p-3 bg-surface-container-low border border-outline rounded-lg font-body-md text-primary font-mono placeholder:font-sans placeholder:text-on-surface-variant/50"
          />
          <input
            id="statusPhone"
            name="statusPhone"
            type="tel"
            required
            value={statusPhone}
            onChange={(e) => setStatusPhone(e.target.value)}
            placeholder="Enter your phone number"
            aria-label="Phone number to check status"
            className="w-full p-3 bg-surface-container-low border border-outline rounded-lg font-body-md text-primary font-mono placeholder:font-sans placeholder:text-on-surface-variant/50"
          />
          <div className="flex justify-end">
          <button
            type="submit"
            disabled={checkingStatus}
            className="px-5 py-3 border border-outline text-primary rounded-lg font-label-sm text-label-sm uppercase tracking-widest hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            {checkingStatus ? 'Checking...' : 'Check Status'}
          </button>
          </div>
        </form>
        {statusResult && (
          <p className="font-body-sm text-body-sm text-secondary bg-secondary-container/20 p-3 rounded-lg">
            {statusResult}
          </p>
        )}
      </div>
    </div>
  );
}
