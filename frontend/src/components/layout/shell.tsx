'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { useQuery } from '@tanstack/react-query';
import {
  Banknote, Bell, BookOpenCheck, Bot, Building2, CalendarRange, ClipboardList, Coins,
  FileBarChart2, FileText, Gauge, Globe, HardHat, Landmark, LayoutDashboard, LogOut, Menu,
  Moon, Package, Search, Settings, ShieldAlert, ShieldCheck, ShoppingCart, Sun, Truck,
  UserCircle2, Users, Warehouse as WarehouseIcon, Wrench, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { get } from '@/lib/api';
import { useAuth, useI18n } from '@/components/providers';

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  resource?: string;
}
interface NavGroup {
  labelKey?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { href: '/projects', labelKey: 'nav.projects', icon: Building2, resource: 'projects' },
      { href: '/ai', labelKey: 'nav.ai', icon: Bot },
    ],
  },
  {
    labelKey: 'nav.directory',
    items: [
      { href: '/directory/clients', labelKey: 'nav.clients', icon: Landmark, resource: 'parties' },
      { href: '/directory/suppliers', labelKey: 'nav.suppliers', icon: Truck, resource: 'parties' },
      { href: '/directory/consultants', labelKey: 'nav.consultants', icon: UserCircle2, resource: 'parties' },
      { href: '/directory/contractors', labelKey: 'nav.contractors', icon: HardHat, resource: 'parties' },
    ],
  },
  {
    labelKey: 'nav.procurement',
    items: [
      { href: '/procurement/purchase-orders', labelKey: 'nav.purchaseOrders', icon: ShoppingCart, resource: 'procurement' },
      { href: '/inventory/materials', labelKey: 'nav.materials', icon: Package, resource: 'inventory' },
      { href: '/inventory/warehouses', labelKey: 'nav.warehouses', icon: WarehouseIcon, resource: 'inventory' },
      { href: '/inventory/movements', labelKey: 'nav.stockMovements', icon: ClipboardList, resource: 'inventory' },
      { href: '/equipment', labelKey: 'nav.equipment', icon: Wrench, resource: 'equipment' },
    ],
  },
  {
    labelKey: 'nav.finance',
    items: [
      { href: '/finance/supplier-payments', labelKey: 'nav.supplierPayments', icon: Banknote, resource: 'payments' },
      { href: '/hr/payroll', labelKey: 'nav.payroll', icon: Coins, resource: 'payroll' },
    ],
  },
  {
    labelKey: 'nav.hr',
    items: [
      { href: '/hr/employees', labelKey: 'nav.employees', icon: Users, resource: 'hr' },
      { href: '/hr/attendance', labelKey: 'nav.attendance', icon: CalendarRange, resource: 'hr' },
      { href: '/hr/trainings', labelKey: 'nav.safety', icon: ShieldCheck, resource: 'hr' },
    ],
  },
  {
    labelKey: 'nav.admin',
    items: [
      { href: '/admin/users', labelKey: 'nav.users', icon: Users, resource: 'users' },
      { href: '/admin/audit-logs', labelKey: 'nav.auditLogs', icon: BookOpenCheck, resource: 'audit' },
      { href: '/admin/settings', labelKey: 'nav.settings', icon: Settings, resource: 'settings' },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, locale, dir, switchLocale } = useI18n();
  const { user, logout, can, loading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => get('/notifications/unread-count'),
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: searchResults } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => get(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.length >= 2,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleNav = useMemo(
    () =>
      NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.resource || can(i.resource, 'read')),
      })).filter((g) => g.items.length),
    [can],
  );

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-bold text-white shadow">
          D
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">{t('app.name')}</p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-400">{t('app.tagline')}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
        {visibleNav.map((group, gi) => (
          <div key={gi}>
            {group.labelKey && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
                {t(group.labelKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const href = `/${locale}${item.href}`;
                const active = pathname === href || pathname?.startsWith(`${href}/`);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
                      active
                        ? 'bg-brand-700 font-medium text-white shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <LogOut className="h-4 w-4" /> {t('auth.signOut')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-e border-zinc-200 bg-white dark:border-zinc-800 dark:bg-surface-muted-dark lg:block">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-zinc-950/50 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: dir === 'rtl' ? 280 : -280 }}
              animate={{ x: 0 }}
              exit={{ x: dir === 'rtl' ? 280 : -280 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 start-0 z-50 w-64 bg-white dark:bg-surface-muted-dark lg:hidden"
            >
              {sidebar}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-zinc-200/70 px-4 dark:border-zinc-800 sm:px-6">
          <button
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            onClick={() => {
              setSearchOpen(true);
              setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white/60 px-3 text-sm text-zinc-400 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/60 sm:max-w-md"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">{t('nav.search')}</span>
            <kbd className="ms-auto hidden rounded border border-zinc-300 px-1.5 text-[10px] text-zinc-400 dark:border-zinc-600 sm:block">
              ⌘K
            </kbd>
          </button>

          <div className="ms-auto flex items-center gap-1.5">
            {/* Language */}
            <div className="group relative">
              <button className="flex items-center gap-1 rounded-xl p-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Language">
                <Globe className="h-4 w-4" />
                <span className="uppercase">{locale}</span>
              </button>
              <div className="invisible absolute end-0 top-full z-50 mt-1 w-32 rounded-xl border border-zinc-200 bg-white p-1 opacity-0 shadow-glass transition-all group-hover:visible group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900">
                {[
                  ['en', 'English'],
                  ['ar', 'العربية'],
                  ['fr', 'Français'],
                ].map(([code, label]) => (
                  <button
                    key={code}
                    onClick={() => switchLocale(code)}
                    className={cn(
                      'block w-full rounded-lg px-3 py-1.5 text-start text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800',
                      code === locale && 'font-semibold text-brand-700 dark:text-brand-300',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <button
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              className="rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Toggle theme"
            >
              {mounted && resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Notifications */}
            <Link
              href={`/${locale}/notifications`}
              className="relative rounded-xl p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label={t('nav.notifications')}
            >
              <Bell className="h-4 w-4" />
              {unread?.count > 0 && (
                <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unread.count}
                </span>
              )}
            </Link>

            {/* User */}
            <div className="ms-2 flex items-center gap-2 border-s border-zinc-200 ps-3 dark:border-zinc-700">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-200">
                {user.firstName[0]}
                {user.lastName[0]}
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-medium leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[10px] text-zinc-400">{user.role.name.replace(/_/g, ' ')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Global search overlay */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-zinc-950/40 p-4 pt-24 backdrop-blur-sm"
              onMouseDown={(e) => e.target === e.currentTarget && setSearchOpen(false)}
            >
              <div className="card mx-auto max-w-xl p-3">
                <div className="flex items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
                  <Search className="h-4 w-4 text-zinc-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('nav.search')}
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                  <button onClick={() => setSearchOpen(false)} aria-label="Close">
                    <X className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto pt-2">
                  {(searchResults?.results ?? []).map((r: any, i: number) => (
                    <button
                      key={i}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        setSearchOpen(false);
                        const target =
                          r.type === 'project'
                            ? `/projects/${r.id}`
                            : r.type === 'task'
                              ? `/projects/${r.projectId}/schedule`
                              : r.type === 'employee'
                                ? '/hr/employees'
                                : r.type === 'material'
                                  ? '/inventory/materials'
                                  : r.type === 'purchase-order'
                                    ? '/procurement/purchase-orders'
                                    : r.type === 'invoice'
                                      ? `/projects/${r.projectId}/invoices`
                                      : r.type === 'document'
                                        ? `/projects/${r.projectId}/documents`
                                        : '/directory/suppliers';
                        router.push(`/${locale}${target}`);
                      }}
                    >
                      <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-800">
                        {r.type}
                      </span>
                      <span className="truncate">
                        {r.name ?? r.title ?? r.number ?? `${r.firstName ?? ''} ${r.lastName ?? ''}`}
                      </span>
                    </button>
                  ))}
                  {query.length >= 2 && (searchResults?.results ?? []).length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-zinc-400">{t('common.noData')}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-auto max-w-[1500px]"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
