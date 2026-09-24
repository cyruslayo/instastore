"use client";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Menu,
  X,
  Sliders,
  Truck,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { signOut } from "@/lib/auth";

interface AdminBottomNavProps {
  pathname: string;
}

export default function AdminBottomNav({ pathname }: AdminBottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);

  const active = "bg-primary text-on-primary font-semibold shadow-xs";
  const inactive = "text-on-surface-variant hover:bg-surface-container-high";

  const primaryItems = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: LayoutDashboard,
      active: pathname === "/admin",
    },
    {
      href: "/admin/orders",
      label: "Orders",
      icon: ShoppingCart,
      active: pathname.startsWith("/admin/orders"),
    },
    {
      href: "/admin/products",
      label: "Products",
      icon: Package,
      active: pathname.startsWith("/admin/products"),
    },
  ];

  const secondaryItems = [
    {
      href: "/admin/delivery",
      label: "Delivery",
      description: "Delivery zones and fees",
      icon: Truck,
      active: pathname.startsWith("/admin/delivery"),
    },
    {
      href: "/admin/content",
      label: "Store Settings",
      description: "Announcements and bank transfer",
      icon: Sliders,
      active: pathname.startsWith("/admin/content"),
    },
  ];

  const isMoreActive = secondaryItems.some((item) => item.active);

  const closeDrawer = () => {
    if (drawerRef.current?.open) drawerRef.current.close();
    else setDrawerOpen(false);
  };

  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawerOpen && drawer && !drawer.open) drawer.showModal();
  }, [drawerOpen]);

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error("Sign out failed:", error.message);
        return;
      }
      window.location.replace(
        new URL("/admin", window.location.origin).toString(),
      );
    } catch (err: any) {
      console.error("Sign out failed:", err?.message || "Unknown error");
    }
  };

  return (
    <>
      {/* Slide-up Drawer for Secondary Views */}
      <dialog
        ref={drawerRef}
        id="admin-more-drawer"
        aria-labelledby="admin-more-title"
        aria-modal="true"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="hidden open:flex md:hidden fixed inset-x-0 bottom-0 top-auto m-0 max-h-[80dvh] w-full max-w-none flex-col space-y-4 overflow-y-auto rounded-t-3xl border-t border-outline-variant bg-surface p-5 pb-safe text-on-surface botanical-shadow animate-in slide-in-from-bottom duration-250 backdrop:bg-black/60 backdrop:backdrop-blur-xs"
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
            <h2 id="admin-more-title" className="font-headline-sm text-base text-primary font-bold">
              Management Tools
            </h2>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            autoFocus
            className="touch-target p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 space-y-1.5 overflow-y-auto max-h-[50dvh]">
          {secondaryItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={closeDrawer}
              className={`flex min-h-12 items-center justify-between p-3.5 rounded-xl transition-all ${
                item.active
                  ? "bg-primary text-on-primary font-bold"
                  : "bg-surface-container-low hover:bg-surface-container text-on-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon
                  className={`w-5 h-5 ${item.active ? "text-secondary-container" : "text-secondary"}`}
                />
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div
                    className={`text-[11px] ${item.active ? "text-on-primary/80" : "text-on-surface-variant"}`}
                  >
                    {item.description}
                  </div>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 ${item.active ? "text-on-primary/60" : "text-on-surface-variant/50"}`}
              />
            </a>
          ))}
        </div>

        <div className="pt-2 border-t border-outline-variant/40">
          <button
            type="button"
            onClick={handleSignOut}
            className="min-h-12 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-error/10 text-error font-label-sm text-xs uppercase tracking-wider font-bold hover:bg-error/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Admin</span>
          </button>
        </div>
      </dialog>

      {/* Primary Fixed Bottom Navigation */}
      <nav
        aria-label="Admin mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md shadow-[0_-4px_24px_rgba(24,35,26,0.08)] border-t border-outline-variant/30 pb-safe"
      >
        <div className="grid grid-cols-4 items-center px-2 py-1.5 gap-1">
          {primaryItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all touch-target ${
                item.active ? active : inactive
              }`}
            >
              <item.icon
                className="w-5 h-5 mb-0.5 shrink-0"
                aria-hidden="true"
              />
              <span className="font-label-sm text-[11px] leading-tight truncate">
                {item.label}
              </span>
            </a>
          ))}

          <button
            type="button"
            onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
            aria-expanded={drawerOpen}
            aria-controls="admin-more-drawer"
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all touch-target relative ${
              isMoreActive || drawerOpen ? active : inactive
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface" />
            )}
            <Menu className="w-5 h-5 mb-0.5 shrink-0" aria-hidden="true" />
            <span className="font-label-sm text-[11px] leading-tight">
              More
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
