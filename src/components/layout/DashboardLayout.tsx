import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  QrCode,
  Settings,
  Store,
  UtensilsCrossed,
  Clock3,
  Eye,
  ChevronDown,
  Layers,
  FileText,
  Gift,
  Percent,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { restaurants, currentId, setCurrent, load, loading } = useRestaurantStore()
  const current = restaurants.find((r) => r.id === currentId) ?? null
  const copy = storeCopy(current?.storeKind)
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)

  const navGroups: NavGroup[] = useMemo(
    () => [
      {
        id: 'ops',
        items: [
          { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
          { to: '/dashboard/orders', label: 'Orders', icon: ClipboardList },
        ],
      },
      {
        id: 'catalog',
        label: copy.catalogNounTitle,
        items: [
          { to: '/dashboard/menus', label: copy.catalogNounPlural, icon: Menu },
          { to: '/dashboard/items', label: copy.itemLibrary, icon: UtensilsCrossed },
          { to: '/dashboard/modifiers', label: copy.modifiersNoun, icon: Store },
          { to: '/dashboard/combos', label: copy.comboNounPlural, icon: Layers },
          { to: '/dashboard/scheduling', label: 'Scheduling', icon: Clock3 },
        ],
      },
      {
        id: 'marketing',
        label: 'Marketing',
        items: [
          { to: '/dashboard/promotions', label: 'Coupons & sales', icon: Percent },
          { to: '/dashboard/loyalty', label: 'Loyalty', icon: Gift },
          { to: '/dashboard/qr', label: 'QR codes', icon: QrCode },
          { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
        ],
      },
      {
        id: 'storefront',
        label: 'Storefront',
        items: [
          { to: '/dashboard/branding', label: 'Branding', icon: Palette },
          { to: '/dashboard/pages', label: 'Pages & layout', icon: FileText },
          { to: '/dashboard/preview', label: 'Preview', icon: Eye },
        ],
      },
      {
        id: 'account',
        label: 'Account',
        items: [{ to: '/dashboard/settings', label: 'Settings', icon: Settings }],
      },
    ],
    [copy],
  )

  useEffect(() => {
    if (user) void load(user.id)
  }, [user, load])

  if (!user) return null

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] lg:flex">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-stone-200 bg-white p-4 transition-transform lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 lg:self-start',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="mb-6 flex shrink-0 items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">MenuShop</div>
            <div className="text-xs text-stone-500">{copy.dashboardSubtitle}</div>
          </div>
        </div>

        <div className="relative mb-4 shrink-0">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-left"
            onClick={() => setSwitcherOpen((v) => !v)}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {current?.name || (loading ? 'Loading…' : 'Select a store')}
              </div>
              <div className="truncate text-xs text-stone-500">
                {current
                  ? `${current.storeKind === 'retail' ? 'Retail' : 'Restaurant'} · /r/${current.slug}`
                  : 'Create or choose a store'}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
          </button>
          {switcherOpen ? (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white p-1 shadow-lg">
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={cn(
                    'block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-stone-50',
                    r.id === currentId && 'bg-[var(--color-brand-soft)]',
                  )}
                  onClick={() => {
                    setCurrent(r.id)
                    setSwitcherOpen(false)
                  }}
                >
                  <span className="block truncate font-medium">{r.name}</span>
                  <span className="block text-xs text-stone-500 capitalize">
                    {r.storeKind ?? 'restaurant'}
                  </span>
                </button>
              ))}
              <button
                type="button"
                className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--color-brand)] hover:bg-stone-50"
                onClick={() => {
                  setSwitcherOpen(false)
                  navigate('/dashboard/restaurants/new')
                }}
              >
                + New store
              </button>
            </div>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2">
          {navGroups.map((group) => (
            <div key={group.id}>
              {group.label ? (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50',
                        isActive &&
                          'bg-[var(--color-brand-soft)] text-[var(--color-brand)]',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-4 shrink-0 border-t border-stone-100 pt-4">
          <div className="px-3 text-sm font-medium">{user.name}</div>
          <div className="px-3 text-xs text-stone-500">{user.email}</div>
          <Button
            variant="ghost"
            className="mt-2 w-full justify-start"
            onClick={async () => {
              await signOut()
              navigate('/')
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-stone-900/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <button
            type="button"
            className="rounded-lg p-2 hover:bg-stone-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="font-medium lg:hidden">{current?.name || 'Dashboard'}</div>
          <div className="ml-auto flex items-center gap-2">
            {current ? (
              <a
                href={`/r/${current.slug}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50"
              >
                View storefront
              </a>
            ) : null}
          </div>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
