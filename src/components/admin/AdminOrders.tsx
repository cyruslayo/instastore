'use client';
import { useState, useEffect, useCallback } from 'react';
import OrderDetailsModal from '@/components/admin/OrderDetailsModal';
import { formatNaira } from '@/lib/utils';
import { ORDER_STATUSES, validatedStatusFilter } from '@/lib/orderWorkflow';
import type { OrderStatus } from '@/lib/types';
type OrderStatusFilter = 'All' | OrderStatus;

function initialStatusFilter(): OrderStatusFilter {
  if (typeof window === 'undefined') return 'All';
  return validatedStatusFilter(new URLSearchParams(window.location.search).get('status'));
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { getSupabase } = await import('@/lib/supabase');
      const { getCurrentAdminProfile } = await import('@/lib/auth');
      const supabase = getSupabase();
      const profile = await getCurrentAdminProfile();
      if (!profile) throw new Error('No active merchant store.');
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', profile.store_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data ?? []);
    } catch (error) {
      console.error('Error fetching orders: ', error);
      setOrders([]);
      setError('Orders could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(initialStatusFilter);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
    const matchesSearch =
      (order.public_code || order.id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.customer_phone && order.customer_phone.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.customer_instagram && order.customer_instagram.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });
  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-md text-xl sm:text-headline-md text-on-surface">Orders</h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
            Track, verify payment receipts, and manage customer shipments.
          </p>
        </div>
        <div className="text-xs font-mono text-on-surface-variant bg-surface px-3 py-1.5 rounded-xl border border-outline-variant/60 w-fit">
          Total: <span className="font-bold text-primary">{orders.length}</span>
        </div>
      </div>

      {error && !loading && (
        <div className="p-8 text-center text-on-surface-variant bg-surface rounded-2xl border border-error/30">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-outline-variant/60 botanical-shadow space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <label htmlFor="admin-orders-search" className="sr-only">
            Search orders
          </label>
          <input
            id="admin-orders-search"
            name="search"
            type="search"
            placeholder="Search by Order ID (#ORD...) or Instagram handle..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-h-12 flex-1 text-base sm:text-sm px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 focus:outline-none focus:border-primary text-primary"
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(['All', ...ORDER_STATUSES] as OrderStatusFilter[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`min-h-12 px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === s
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              {s}{s === 'All' ? ` (${orders.length})` : ` (${statusCounts[s] || 0})`}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card List (< md screens) */}
      <div className="@min-[900px]:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-on-surface-variant text-sm bg-surface rounded-2xl border border-outline-variant">
            Loading orders...
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm bg-surface rounded-2xl border border-outline-variant">
            No orders found matching your filter.
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-surface rounded-2xl border border-outline-variant/70 p-4 botanical-shadow space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-primary text-sm">{order.public_code || `#${order.id}`}</span>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    order.status === 'Fulfilled'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : order.status === 'Processing'
                      ? 'bg-tertiary-container text-on-tertiary-container'
                      : order.status === 'Pending Verification'
                      ? 'bg-error/15 text-error'
                      : 'bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Customer:</span>
                  <span className="font-mono font-semibold text-primary truncate max-w-[180px]">
                    {order.customer_name || order.customer_instagram || "Guest customer"}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Date:</span>
                  <span className="font-mono">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Items:</span>
                  <span>{order.items?.length || 1} product(s)</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/40">
                <div>
                  <span className="text-[10px] text-on-surface-variant uppercase font-mono block">Total</span>
                  <span className="font-mono font-bold text-base text-primary">
                    {formatNaira(order.total)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="min-h-12 min-w-12 px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold font-label-sm uppercase tracking-wider hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (>= md screens) */}
      <div className="hidden @min-[900px]:block bg-surface rounded-2xl border border-outline-variant overflow-hidden botanical-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-container-low">
              <tr className="border-b border-outline-variant">
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Order ID</th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Date</th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Customer</th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Total</th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider">Status</th>
                <th className="p-4 font-label-sm text-xs text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-sm text-on-surface divide-y divide-outline-variant/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">Loading orders...</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-on-surface-variant">No orders found.</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="p-4 font-mono font-bold text-primary">{order.public_code || `#${order.id}`}</td>
                    <td className="p-4 text-on-surface-variant font-mono text-xs">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-4 text-primary font-mono text-xs truncate max-w-[160px]">
                      {order.customer_name || order.customer_instagram || "Guest customer"}
                    </td>
                    <td className="p-4 font-mono font-medium">{formatNaira(order.total)}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'Fulfilled' ? 'bg-secondary-container text-on-secondary-container' :
                        order.status === 'Processing' ? 'bg-tertiary-container text-on-tertiary-container' :
                        order.status === 'Pending Verification' ? 'bg-error-container text-on-error-container font-bold' :
                        'bg-surface-variant text-on-surface-variant'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button type="button" onClick={() => setSelectedOrder(order)} aria-label={`View order ${order.id}`} className="min-h-12 min-w-12 p-2 text-on-surface-variant hover:text-primary transition-colors rounded-lg hover:bg-surface-container cursor-pointer inline-flex items-center justify-center gap-1 text-xs font-bold">
                        <EyeIcon />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OrderDetailsModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
        onSaved={fetchOrders}
      />
    </div>
  );
}

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
