'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { accessState } from '@/store/access';
import { formatNaira } from '@/lib/utils';
import { useHydrated } from '@/lib/useHydrated';
import type { MemberOrder } from '@/lib/types';

const ORDER_STEPS = ['Pending Verification', 'Processing', 'Shipped', 'Fulfilled'] as const;

const STATUS_COPY: Record<string, string> = {
  'Pending Verification': 'We received your order and receipt. Payment verification is pending.',
  Processing: 'Payment is verified. Your order is being prepared.',
  Shipped: 'Your order has left the store for delivery.',
  Fulfilled: 'Your order is complete.',
  Cancelled: 'This order was cancelled.',
};

function getStatusClass(status: string): string {
  if (status === 'Fulfilled') return 'bg-secondary-container text-on-secondary-container';
  if (status === 'Shipped') return 'bg-secondary/15 text-secondary';
  if (status === 'Processing') return 'bg-tertiary-container text-on-tertiary-container';
  if (status === 'Cancelled') return 'bg-error-container text-on-error-container';
  return 'bg-surface-container-highest text-on-surface-variant';
}

function formatOrderDate(value: string): string {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function OrderHistory() {
  const isHydrated = useHydrated();
  const access = useStore(accessState);
  const [orders, setOrders] = useState<MemberOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (
      !isHydrated ||
      access.status !== 'approved' ||
      !access.instagramHandle ||
      !access.phone
    ) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { getMemberOrders } = await import('@/lib/orders');
      const data = await getMemberOrders(access.instagramHandle, access.phone);
      setOrders(data);
    } catch (loadError) {
      console.error('Order history error:', loadError);
      setOrders([]);
      setError('Order history could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [access.instagramHandle, access.phone, access.status, isHydrated]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  if (!isHydrated || access.status !== 'approved') return null;

  return (
    <section id="order-history" className="mt-section-gap scroll-mt-28 border-t border-outline-variant pt-stack-lg">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-stack-md">
        <div>
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-secondary mb-1">Member Orders</p>
          <h2 className="font-headline-md text-headline-md text-on-surface">Order History</h2>
          <p className="font-body-md text-on-surface-variant mt-1">
            Track payment verification, preparation, and delivery status.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="w-fit px-4 py-2 rounded-full border border-outline-variant font-label-sm text-label-sm text-primary hover:bg-surface-container disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh status'}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-error/30 bg-error/5 p-4 font-body-sm text-error">
          {error}
        </div>
      ) : loading && orders.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6 font-body-md text-on-surface-variant">
          Loading your orders…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-6">
          <p className="font-body-md text-on-surface">No orders yet.</p>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Orders will appear here after checkout completes.
          </p>
        </div>
      ) : (
        <div className="space-y-stack-md">
          {orders.map((order) => {
            const currentStep = ORDER_STEPS.indexOf(order.status as (typeof ORDER_STEPS)[number]);
            const cancelled = order.status === 'Cancelled';

            return (
              <article key={order.id} className="rounded-xl border border-outline-variant bg-surface-container-low p-5 md:p-6 botanical-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-outline-variant/60">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">Order</p>
                    <h3 className="font-mono font-bold text-primary">#{order.id.slice(0, 8).toUpperCase()}</h3>
                    <p className="font-body-sm text-on-surface-variant mt-1">{formatOrderDate(order.created_at)}</p>
                  </div>
                  <div className="sm:text-right">
                    <span className={`inline-flex rounded-full px-3 py-1 font-label-sm text-xs font-semibold ${getStatusClass(order.status)}`}>
                      {order.status}
                    </span>
                    <p className="font-headline-sm text-primary mt-2">{formatNaira(order.total)}</p>
                  </div>
                </div>

                <div className="py-4">
                  <p className="font-body-sm text-on-surface-variant">
                    {STATUS_COPY[order.status] || 'Your order status was updated by the store.'}
                  </p>

                  {cancelled ? (
                    <div className="mt-4 rounded-lg bg-error/5 border border-error/20 p-3 font-body-sm text-error">
                      This order will not move to fulfillment.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 mt-5" aria-label={`Order status: ${order.status}`}>
                      {ORDER_STEPS.map((step, index) => {
                        const complete = currentStep >= index;
                        return (
                          <div key={step} className="min-w-0">
                            <div className={`h-1.5 rounded-full ${complete ? 'bg-primary' : 'bg-outline-variant'}`} />
                            <p className={`mt-2 text-[10px] sm:text-xs font-label-sm leading-tight ${complete ? 'text-primary' : 'text-on-surface-variant'}`}>
                              {step === 'Pending Verification' ? 'Verification' : step}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-4 border-t border-outline-variant/60">
                  {order.items.map((item, index) => (
                    <div key={`${order.id}-${item.id}-${index}`} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-body-md text-on-surface truncate">{item.name}</p>
                        <p className="font-body-sm text-on-surface-variant">
                          Qty {item.quantity}
                          {item.batch_code ? ` · Batch ${item.batch_code}` : ''}
                        </p>
                      </div>
                      <p className="font-label-sm text-primary shrink-0">{formatNaira(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
