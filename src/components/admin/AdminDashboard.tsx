'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { getCurrentAdminProfile } from '@/lib/auth';
import { formatNaira } from '@/lib/utils';

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
  orderValue: number;
  totalOrders: number;
  activeProducts: number;
  recentOrders: DashboardOrder[];
}

const EMPTY_METRICS: DashboardMetrics = {
  orderValue: 0,
  totalOrders: 0,
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
        supabase.from('products').select('id').eq('store_id', profile.store_id).eq('is_active', true),
      ]);

      if (ordersResult.error) throw ordersResult.error;
      if (productsResult.error) throw productsResult.error;
      const orders = (ordersResult.data || []) as DashboardOrder[];
      const liveOrders = orders.filter((order) => order.status.toLowerCase() !== 'cancelled');
      setMetrics({
        orderValue: liveOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
        totalOrders: orders.length,
        activeProducts: productsResult.data?.length || 0,
        recentOrders: liveOrders.slice(0, 5),
      });
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
    { label: 'Order Value', value: formatNaira(metrics.orderValue), icon: '💵' },
    { label: 'Total Orders', value: metrics.totalOrders.toString(), icon: '🛒' },
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
        {metricCards.map((card) => (
          <div key={card.label} className="bg-surface p-5 sm:p-6 rounded-2xl border border-outline-variant botanical-shadow">
            <div className="p-2.5 sm:p-3 bg-secondary-container rounded-xl text-base sm:text-lg w-fit mb-5">{card.icon}</div>
            <h3 className="font-body-sm text-xs sm:text-sm text-on-surface-variant font-medium">{card.label}</h3>
            <p className="font-headline-md text-lg sm:text-2xl text-on-surface mt-0.5 font-bold tracking-tight">
              {loading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-2xl border border-outline-variant botanical-shadow p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">Recent Orders</h3>
            <p className="font-body-sm text-xs text-on-surface-variant">Latest non-cancelled transactions from Supabase.</p>
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
                    <td className="py-3.5 text-right"><span className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant rounded-full text-xs font-medium">{order.status}</span></td>
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
