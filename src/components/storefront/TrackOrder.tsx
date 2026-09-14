"use client";
import { useEffect, useState } from "react";
import { getOrderStatus } from "@/lib/orders";
import type { CustomerOrderStatus, OrderStatus } from "@/lib/types";

const statuses: OrderStatus[] = [
  "Pending Verification",
  "Processing",
  "Shipped",
  "Fulfilled",
];

export default function TrackOrder() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<CustomerOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const prefilledCode = new URLSearchParams(window.location.search).get(
      "order",
    );
    if (prefilledCode) setCode(prefilledCode);
  }, []);

  const lookup = async () => {
    if (!code.trim() || !phone.trim()) {
      setError("Enter your tracking code and phone number.");
      return;
    }
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const result = await getOrderStatus(code, phone);
      if (result) setOrder(result);
      else setError("No order matched those details.");
    } catch {
      setError("Order status could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="max-w-2xl mx-auto px-margin-mobile md:px-margin-desktop pt-24 md:pt-32 pb-32">
      <h1 className="font-headline-md text-headline-md text-primary mb-3">
        Track Order
      </h1>
      <p className="text-on-surface-variant mb-8">
        Order-status tracking only. Enter the code and phone number used at
        checkout.
      </p>
      <div className="space-y-4 bg-surface-container-low rounded-xl p-6 border border-outline-variant/30">
        <label className="block text-sm text-on-surface-variant">
          Tracking code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="ORD-..."
            className="w-full mt-2 p-3 border border-outline rounded-lg text-primary"
          />
        </label>
        <label className="block text-sm text-on-surface-variant">
          Phone number
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="w-full mt-2 p-3 border border-outline rounded-lg text-primary"
          />
        </label>
        <button
          type="button"
          onClick={lookup}
          disabled={loading}
          className="w-full py-3 bg-primary text-on-primary rounded-full disabled:opacity-50"
        >
          {loading ? "Checking…" : "Check Status"}
        </button>
        {error && (
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
        )}
      </div>
      {order && (
        <section className="mt-8 bg-surface rounded-xl border border-outline-variant/30 p-6">
          <p className="font-mono font-bold text-primary text-lg">
            {order.public_code}
          </p>
          <p className="text-sm text-on-surface-variant mt-1">
            Placed {new Date(order.created_at).toLocaleDateString()}
          </p>
          <div className="flex flex-wrap gap-2 my-6">
            {order.status === "Cancelled" ? (
              <span className="px-3 py-2 rounded-full bg-error/10 text-error">
                Cancelled
              </span>
            ) : (
              statuses.map((status) => (
                <span
                  key={status}
                  className={`px-3 py-2 rounded-full text-xs ${statuses.indexOf(status) <= statuses.indexOf(order.status) ? "bg-secondary-container text-on-secondary-container" : "bg-surface-container-high text-on-surface-variant"}`}
                >
                  {status}
                </span>
              ))
            )}
          </div>
          {order.items.map((item) => (
            <div
              key={item.product_id}
              className="flex justify-between py-2 border-t border-outline-variant/30 text-sm"
            >
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>{formatAmount(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="border-t border-outline-variant mt-4 pt-4 space-y-2">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatAmount(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{formatAmount(order.shipping_fee)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatAmount(order.total)}</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
  }).format(value);
}
