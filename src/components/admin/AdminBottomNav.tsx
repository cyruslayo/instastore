'use client';
import { useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Menu,
  X,
  Sliders,
  UserCheck,
  Users,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { signOut } from '@/lib/auth';

interface AdminBottomNavProps {
  pathname: string;
}

export default function AdminBottomNav({ pathname }: AdminBottomNavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = 'bg-primary text-on-primary font-semibold shadow-xs';
  const inactive = 'text-on-surface-variant hover:bg-surface-container-high';

  const primaryItems = [
    { href: '/admin', label: 'Overview', icon: LayoutDashboard, active: pathname === '/admin' },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, active: pathname.startsWith('/admin/orders') },
    { href: '/admin/products', label: 'Products', icon: Package, active: pathname.startsWith('/admin/products') },
  ];

  const secondaryItems = [
    { href: '/admin/content', label: 'Site Content (CMS)', description: 'Banners, announcements, bank transfer', icon: Sliders, active: pathname.startsWith('/admin/content') },
    { href: '/admin/referrals', label: 'Referrals & Access', description: 'Member applications & invites', icon: UserCheck, active: pathname.startsWith('/admin/referrals') },
    { href: '/admin/customers', label: 'Customer Directory', description: 'Profiles and permissions', icon: Users, active: pathname.startsWith('/admin/customers') },
  ];

  const isMoreActive = secondaryItems.some((item) => item.active);

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Sign out failed:', error.message);
        return;
      }
      window.location.replace(new URL('/admin', window.location.origin).toString());
    } catch (err: any) {
      console.error('Sign out failed:', err?.message || 'Unknown error');
    }
  };

  return (
    <>
      {/* Slide-up Drawer for Secondary Views */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 bg-surface rounded-t-3xl border-t border-outline-variant botanical-shadow p-5 pb-safe max-h-[80dvh] flex flex-col space-y-4 animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-secondary" />
                <span className="font-headline-sm text-base text-primary font-bold">
                  Management Tools
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="touch-target p-2 rounded-full text-on-surface-variant hover:bg-surface-container transition-colors flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 overflow-y-auto max-h-[50dvh]">
              {secondaryItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center justify-between p-3.5 rounded-xl transition-all ${
                    item.active
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${item.active ? 'text-secondary-container' : 'text-secondary'}`} />
                    <div>
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className={`text-[11px] ${item.active ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>
                        {item.description}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className={`w-4 h-4 ${item.active ? 'text-on-primary/60' : 'text-on-surface-variant/50'}`} />
                </a>
              ))}
            </div>

            <div className="pt-2 border-t border-outline-variant/40">
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-error/10 text-error font-label-sm text-xs uppercase tracking-wider font-bold hover:bg-error/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Admin</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
              aria-current={item.active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all touch-target ${
                item.active ? active : inactive
              }`}
            >
              <item.icon className="w-5 h-5 mb-0.5 shrink-0" aria-hidden="true" />
              <span className="font-label-sm text-[11px] leading-tight truncate">{item.label}</span>
            </a>
          ))}

          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-expanded={drawerOpen}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all touch-target relative ${
              isMoreActive || drawerOpen ? active : inactive
            }`}
          >
            {isMoreActive && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface" />
            )}
            <Menu className="w-5 h-5 mb-0.5 shrink-0" aria-hidden="true" />
            <span className="font-label-sm text-[11px] leading-tight">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

