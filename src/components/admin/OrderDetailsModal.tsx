'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { formatNaira } from '@/lib/utils';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onSaved: () => void;
}

export default function OrderDetailsModal({ isOpen, onClose, order, onSaved }: OrderDetailsModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState(order?.status || 'Processing');
  const [error, setError] = useState<string | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setReceiptUrl(null);
    setReceiptError(null);

    const receiptPath = order?.receipt_url;
    if (!receiptPath) return () => { cancelled = true; };

    if (!/^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(receiptPath)) {
      setReceiptError('Receipt could not be loaded.');
      return () => { cancelled = true; };
    }

    setReceiptLoading(true);
    import('@/lib/supabase')
      .then(({ getSupabase }) => getSupabase().storage.from('receipts').createSignedUrl(receiptPath, 300))
      .then(({ data, error: signedUrlError }) => {
        if (cancelled) return;
        if (signedUrlError || !data?.signedUrl) {
          setReceiptError('Receipt could not be loaded.');
        } else {
          setReceiptUrl(data.signedUrl);
        }
      })
      .catch((signedUrlError) => {
        console.error('Error creating receipt signed URL:', signedUrlError);
        if (!cancelled) setReceiptError('Receipt could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setReceiptLoading(false);
      });

    return () => { cancelled = true; };
  }, [order?.id, order?.receipt_url]);

  if (!isOpen || !order) return null;

  const shippingFee = Number(order.shipping_fee ?? 0);
  const itemSubtotal = Array.isArray(order.items)
    ? order.items.reduce(
        (sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      )
    : Math.max(Number(order.total || 0) - shippingFee, 0);

  const handleUpdateStatus = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const { setOrderStatus } = await import('@/lib/orders');
      await setOrderStatus(order.id, status);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error("Error updating order: ", err);
      setError(err.message || "Failed to update order.");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date instanceof Date) return date.toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-surface rounded-t-3xl sm:rounded-2xl border border-outline-variant botanical-shadow max-w-xl w-full flex flex-col max-h-[92dvh] animate-in fade-in sm:zoom-in duration-200">
        <div className="flex justify-between items-center px-5 py-4 sm:p-6 border-b border-outline-variant shrink-0">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-secondary font-bold block">
              Order Fulfillment
            </span>
            <h3 className="font-headline-sm text-base sm:text-headline-sm text-on-surface font-bold">
              Order #{order.id}
            </h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="touch-target flex items-center justify-center p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
          {error && (
            <div className="p-3.5 bg-error/10 text-error rounded-xl font-body-sm text-xs sm:text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/50">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Order ID</p>
              <p className="font-mono font-bold text-primary text-sm sm:text-base">#{order.id}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant font-bold">Placed On</p>
              <p className="font-mono text-xs sm:text-sm text-on-surface">{formatDate(order.created_at)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider text-secondary font-bold">Customer ID / Email</p>
              <p className="font-body-md text-primary font-medium text-sm break-all">{order.user_id}</p>
            </div>

            {order.shipping_address && (
              <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/60 space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-secondary font-bold">Delivery Destination</p>
                <div className="text-xs sm:text-sm text-on-surface space-y-0.5">
                  {order.shipping_address.instagramHandle && (
                    <p className="font-bold text-primary font-mono">{order.shipping_address.instagramHandle}</p>
                  )}
                  {order.shipping_address.phone && (
                    <p className="text-on-surface-variant font-mono">{order.shipping_address.phone}</p>
                  )}
                  {order.shipping_address.region && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] bg-secondary/15 text-secondary font-bold font-mono">
                      {order.shipping_address.region}, Abuja
                    </span>
                  )}
                  {order.shipping_address.address && (
                    <p className="mt-1 text-xs text-on-surface-variant">{order.shipping_address.address}</p>
                  )}
                  {!order.shipping_address.region && !order.shipping_address.address && (
                    <>
                      {order.shipping_address.fullName && <p>{order.shipping_address.fullName}</p>}
                      {order.shipping_address.address1 && <p>{order.shipping_address.address1}</p>}
                      <p>{order.shipping_address.city || 'Abuja'}, {order.shipping_address.state || 'FCT'}</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {order.items && order.items.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-outline-variant/50">
              <p className="font-mono text-xs uppercase tracking-wider text-primary font-bold">Ordered Formulations</p>
              <div className="space-y-2.5">
                {order.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-surface-container-low p-3 sm:p-4 rounded-xl border border-outline-variant/60">
                    <div className="flex gap-3 items-center min-w-0">
                      <div className="w-11 h-11 bg-surface-container rounded-lg flex items-center justify-center text-[10px] font-mono text-on-surface-variant overflow-hidden shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : 'Img'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-body-md text-primary font-bold text-xs sm:text-sm truncate">{item.name}</p>
                        <p className="text-[11px] font-mono text-on-surface-variant">Qty: {item.quantity}</p>
                        {(item.strength_mg != null || item.bottle_size_ml != null || item.strain_name || item.batch_code) && (
                          <div className="text-[11px] font-mono text-on-surface-variant space-y-0.5">
                            {(item.strength_mg != null || item.bottle_size_ml != null) && <p>{item.strength_mg != null ? `${item.strength_mg} mg` : null}{item.strength_mg != null && item.bottle_size_ml != null ? ' / ' : null}{item.bottle_size_ml != null ? `${item.bottle_size_ml} ml` : null}</p>}
                            {item.strain_name && <p>Strain: {item.strain_name}</p>}
                            {item.batch_code && <p>Batch: {item.batch_code}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="font-mono font-bold text-xs sm:text-sm text-primary shrink-0 ml-2">
                      {formatNaira(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 pt-3 border-t border-outline-variant/40">
                <div className="flex justify-between gap-4 font-mono text-xs text-on-surface-variant">
                  <span className="uppercase font-bold">Subtotal</span>
                  <span>{formatNaira(itemSubtotal)}</span>
                </div>
                <div className="flex justify-between gap-4 font-mono text-xs text-on-surface-variant">
                  <span className="uppercase font-bold">Delivery</span>
                  <span>{formatNaira(shippingFee)}</span>
                </div>
                <div className="flex justify-between items-center gap-4 pt-1">
                  <span className="font-mono text-xs uppercase text-on-surface-variant font-bold">Grand Total</span>
                  <span className="font-mono font-bold text-lg text-primary">{formatNaira(order.total)}</span>
                </div>
              </div>
            </div>
          )}

          {order.receipt_url && (
            <div className="space-y-3 pt-4 border-t border-outline-variant/50">
              <p className="font-mono text-xs uppercase tracking-wider text-primary font-bold">Bank Payment Receipt</p>
              <div className="bg-surface-container-low border border-outline-variant/60 rounded-xl p-3 flex flex-col items-center">
                {receiptLoading ? (
                  <p className="py-8 text-sm text-on-surface-variant">Loading receipt…</p>
                ) : receiptUrl ? (
                  <>
                    <img src={receiptUrl} alt="Bank Transfer Receipt" className="max-w-full max-h-56 object-contain rounded-lg mb-2" />
                    <a href={receiptUrl} target="_blank" rel="noreferrer" className="text-secondary font-mono text-xs font-bold hover:underline">
                      View Full Resolution Receipt ↗
                    </a>
                  </>
                ) : (
                  <p className="py-8 text-sm text-error">{receiptError || 'Receipt could not be loaded.'}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4 border-t border-outline-variant/50">
            <p className="font-mono text-xs uppercase tracking-wider text-primary font-bold">Update Order Status</p>
            <div className="flex flex-wrap gap-2">
              {['Pending Verification', 'Processing', 'Shipped', 'Fulfilled', 'Cancelled'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-colors cursor-pointer ${
                    status === s
                      ? 'bg-primary text-on-primary border-primary shadow-xs'
                      : 'bg-surface border-outline-variant/70 text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 sm:p-6 border-t border-outline-variant flex justify-end gap-3 bg-surface-container-low rounded-b-3xl sm:rounded-b-2xl shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateStatus}
            disabled={isSaving || status === order.status}
            className="px-6 py-2.5 rounded-xl font-label-sm text-xs uppercase tracking-wider font-bold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {isSaving ? 'Updating...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
