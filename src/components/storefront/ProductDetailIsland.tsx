"use client";
import { useState } from "react";
import { useStore } from "@nanostores/react";
import { addItem } from "@/store/cart";
import { isApproved, isPending } from "@/store/access";
import { formatNaira } from "@/lib/utils";
import type { Product } from "@/lib/types";
import ProductDescription from "@/components/storefront/ProductDescription";

export default function ProductDetailIsland({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [addedNotice, setAddedNotice] = useState(false);
  const approved = useStore(isApproved);
  const pending = useStore(isPending);
  const variant = product.category || "Standard";

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  const handleAddToCart = () => {
    const success = addItem({
      id: product.id,
      name: product.name,
      variant,
      price: product.price,
      quantity,
      image: product.image || "",
    });

    if (success) {
      setAddedNotice(true);
      setTimeout(() => setAddedNotice(false), 2500);
    }
  };

  return (
    <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg md:py-section-gap pb-32 pt-24 md:pt-32">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter lg:gap-section-gap">
        <div className="md:col-span-7 space-y-stack-md">
          <div className="aspect-[4/5] bg-surface-container-low rounded-xl overflow-hidden relative group botanical-shadow">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-in-out group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-container-highest text-on-surface-variant">
                No Image
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-5 flex flex-col">
          <div className="mb-stack-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
                {product.category}
              </span>
              <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
              <span className="font-label-sm text-label-sm text-secondary font-medium">
                Invite-Only Access
              </span>
            </div>
            <h1 className="font-display-sm md:font-display-md text-display-sm md:text-display-md text-primary mb-stack-sm">
              {product.name}
            </h1>
            <p className="font-body-lg text-body-lg text-secondary mb-stack-md">
              {formatNaira(product.price)}
            </p>

            <ProductDescription
              description={
                product.description ||
                "Product details are managed by the storefront."
              }
            />
          </div>

          {approved ? (
            <div className="space-y-3 mb-stack-lg">
              <div className="flex gap-stack-sm">
                <div className="flex items-center border border-outline-variant rounded-full p-1 bg-surface">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="touch-target w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container"
                  >
                    <MinusIcon />
                  </button>
                  <span
                    className="w-12 text-center font-label-lg text-label-lg text-on-surface"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Increase quantity"
                    className="touch-target w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full hover:bg-surface-container"
                  >
                    <PlusIcon />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 bg-primary text-on-primary rounded-full font-label-lg text-label-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/10 hover:shadow-xl hover:-translate-y-1 duration-300"
                >
                  <BagIcon /> Add to Cart
                </button>
              </div>
              {addedNotice && (
                <p className="font-body-sm text-body-sm text-secondary flex items-center gap-1.5 animate-in fade-in">
                  <CheckIcon /> Added to your bag.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-surface-container-low border border-secondary/20 rounded-xl p-5 mb-stack-lg botanical-shadow">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center flex-shrink-0 mt-0.5">
                  <LockIcon />
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="font-label-md text-label-md text-primary font-bold">
                    {pending ? "Membership Under Review" : "Members-Only Store"}
                  </h4>
                  <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                    {pending
                      ? "Your access request is currently under review by our team. You will be able to purchase once verified."
                      : "This is an invite-only store. You need an approved referral invitation from an existing member to purchase."}
                  </p>
                  {!pending && (
                    <a
                      href="/invite"
                      className="inline-flex items-center gap-2 mt-1 font-label-sm text-label-sm text-primary uppercase tracking-widest font-bold underline underline-offset-4 hover:opacity-80 transition-opacity"
                    >
                      Redeem Referral Code / Request Access &rarr;
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-outline-variant/50 pt-stack-md mt-auto">
            <div className="border-b border-outline-variant/30">
              <button
                onClick={() => toggleSection("details")}
                className="w-full py-4 flex justify-between items-center font-label-md text-label-md text-on-surface hover:text-primary transition-colors uppercase tracking-wider"
              >
                Product Details
                <PlusIcon
                  className={`w-4 h-4 transition-transform duration-300 ${openSection === "details" ? "rotate-45" : ""}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${openSection === "details" ? "max-h-[500px] pb-4 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  Product information is managed by the storefront.
                </p>
              </div>
            </div>

            <div className="border-b border-outline-variant/30">
              <button
                type="button"
                onClick={() => toggleSection("availability")}
                className="w-full py-4 flex justify-between items-center font-label-md text-label-md text-on-surface hover:text-primary transition-colors uppercase tracking-wider"
              >
                Availability
                <PlusIcon
                  className={`w-4 h-4 transition-transform duration-300 ${openSection === "availability" ? "rotate-45" : ""}`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${openSection === "availability" ? "max-h-40 pb-4 opacity-100" : "max-h-0 opacity-0"}`}
              >
                <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                  {product.inventory > 0 ? `${product.inventory} available` : "Currently unavailable"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function PlusIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
