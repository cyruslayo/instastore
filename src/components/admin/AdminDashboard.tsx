'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { getCurrentAdminProfile } from '@/lib/auth';
import { formatNaira } from '@/lib/utils';
import { deriveAdminMetrics, LOW_STOCK_THRESHOLD, type AdminProductMetric } from '@/lib/adminMetrics';

interface DashboardOrder {
  id: string;
  total: number;
  status: string;
  public_code: string;
  customer_name: string;
  customer_instagram?: string | null;
  created_at: string;
}

interface DashboardMetrics {
  verifiedRevenue: number;
  pendingVerificationCount: number;
  pendingVerification: DashboardOrder[];
  lowStockCount: number;
  lowStockProducts: AdminProductMetric[];
  activeProducts: number;
  recentOrders: DashboardOrder[];
}

const EMPTY_METRICS: DashboardMetrics = {
  verifiedRevenue: 0,
  pendingVerificationCount: 0,
  pendingVerification: [],
  lowStockCount: 0,
  lowStockProducts: [],
  activeProducts: 0,
  recentOrders: [],
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const profile = await getCurrentAdminProfile();
      if (!profile) throw new Error('No active merchant store.');
      const [ordersResult, productsResult] = await Promise.all([
        supabase.from('orders').select('id,public_code,total,status,customer_name,customer_instagram,created_at').eq('store_id', profile.store_id).order('created_at', { ascending: false }),
        supabase.from('products').select('id,name,inventory,is_active').eq('store_id', profile.store_id).eq('is_active', true),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;
      const orders = (ordersResult.data || []) as DashboardOrder[];
      const products = (productsResult.data || []) as AdminProductMetric[];
      setMetrics(deriveAdminMetrics(orders, products));
    } catch (loadError) {
      console.error('Error loading admin dashboard:', loadError);
      setMetrics(EMPTY_METRICS);
      setError('Dashboard data could not be loaded from Supabase.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const metricCards = [
    { label: 'Verified Revenue', value: formatNaira(metrics.verifiedRevenue), icon: '💵' },
    { label: 'Pending Verification', value: metrics.pendingVerificationCount.toString(), icon: '🧾', href: '/admin/orders?status=Pending%20Verification' },
    { label: 'Low Stock', value: metrics.lowStockCount.toString(), icon: '⚠️', href: '/admin/products?stock=low' },
    { label: 'Active Products', value: metrics.activeProducts.toString(), icon: '📦' },
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="font-headline-md text-xl sm:text-headline-md text-on-surface">Dashboard Overview</h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">Live store performance and recent activity.</p>
        </div>
        <button type="button" onClick={loadDashboard} className="text-xs font-mono text-primary underline underline-offset-4 w-fit">
          Refresh data
        </button>
      </div>

      {error && <div role="alert" className="p-4 rounded-xl border border-error/30 bg-error/10 text-error text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {metricCards.map((card) => {
          const content = <><div className="p-2.5 sm:p-3 bg-secondary-container rounded-xl text-base sm:text-lg w-fit mb-5">{card.icon}</div><h3 className="font-body-sm text-xs sm:text-sm text-on-surface-variant font-medium">{card.label}</h3><p className="font-headline-md text-lg sm:text-2xl text-on-surface mt-0.5 font-bold tracking-tight">{loading ? '—' : card.value}</p></>;
          const className = "bg-surface p-5 sm:p-6 rounded-2xl border border-outline-variant botanical-shadow";
          return 'href' in card ? <a key={card.label} href={card.href} className={className}>{content}</a> : <div key={card.label} className={className}>{content}</div>;
        })}
      </div>

      <section className="grid gap-4 lg:grid-cols-2" aria-labelledby="attention-heading">
        <h3 id="attention-heading" className="sr-only">Needs attention</h3>
        <div className="bg-surface rounded-2xl border border-outline-variant botanical-shadow p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="font-headline-sm text-on-surface font-bold">Payments to verify</h3><p className="text-xs text-on-surface-variant">Submitted bank-transfer receipts awaiting your review.</p></div><a href="/admin/orders?status=Pending%20Verification" className="text-xs font-bold text-primary">View queue ↗</a></div>
          {loading ? <p className="text-sm text-on-surface-variant">Loading…</p> : metrics.pendingVerification.length === 0 ? <p className="text-sm text-on-surface-variant">No payments need verification.</p> : <ul className="divide-y divide-outline-variant/40">{metrics.pendingVerification.map((order) => <li key={order.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><a className="font-mono text-sm font-bold text-primary" href="/admin/orders?status=Pending%20Verification">{order.public_code}</a><p className="truncate text-xs text-on-surface-variant">{order.customer_name || 'Guest customer'} · {new Date(order.created_at).toLocaleString()}</p></div><span className="shrink-0 font-mono text-xs">{formatNaira(order.total)}</span></li>)}</ul>}
        </div>
        <div className="bg-surface rounded-2xl border border-outline-variant botanical-shadow p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between"><div><h3 className="font-headline-sm text-on-surface font-bold">Low-stock products</h3><p className="text-xs text-on-surface-variant">Active products with {LOW_STOCK_THRESHOLD} or fewer units.</p></div><a href="/admin/products?stock=low" className="text-xs font-bold text-primary">View products ↗</a></div>
          {loading ? <p className="text-sm text-on-surface-variant">Loading…</p> : metrics.lowStockProducts.length === 0 ? <p className="text-sm text-on-surface-variant">No active products are low on stock.</p> : <ul className="divide-y divide-outline-variant/40">{metrics.lowStockProducts.map((product) => <li key={product.id} className="flex items-center justify-between gap-3 py-3"><span className="truncate text-sm text-on-surface">{product.name}</span><span className="shrink-0 font-mono text-xs text-error">{product.inventory} in stock · Active</span></li>)}</ul>}
        </div>
      </section>

      <div className="bg-surface rounded-2xl border border-outline-variant botanical-shadow p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">Recent Orders</h3>
            <p className="font-body-sm text-xs text-on-surface-variant">Latest orders. Revenue includes only verified payments.</p>
          </div>
          <a href="/admin/orders" className="text-xs font-mono font-bold text-primary hover:text-secondary">View All Orders ↗</a>
        </div>

        {loading ? (
          <p className="p-6 text-center text-sm text-on-surface-variant">Loading recent orders…</p>
        ) : metrics.recentOrders.length === 0 ? (
          <p className="p-6 text-center text-sm text-on-surface-variant">No recent orders.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/60">
                  <th className="pb-3 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Order ID</th>
                  <th className="pb-3 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Customer</th>
                  <th className="pb-3 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Date</th>
                  <th className="pb-3 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Amount</th>
                  <th className="pb-3 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody className="font-body-md text-sm text-on-surface divide-y divide-outline-variant/40">
                {metrics.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3.5 font-mono font-semibold text-primary">{order.public_code}</td>
                    <td className="py-3.5 font-mono text-xs">{order.customer_name || order.customer_instagram || 'Guest customer'}</td>
                    <td className="py-3.5 text-on-surface-variant text-xs font-mono">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className="py-3.5 font-mono font-medium">{formatNaira(order.total)}</td>
                    <td className="py-3.5 text-right"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${order.status === 'Cancelled' ? 'bg-error/10 text-error' : order.status === 'Pending Verification' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>{order.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
