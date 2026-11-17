import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Palette,
  QrCode,
  Store,
  UtensilsCrossed,
  Clock3,
  Eye,
  ChevronDown,
  Layers,
  FileText,
  Gift,
  Percent,
  TabletSmartphone,
  Monitor,
  MonitorPlay,
  Armchair,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { PLATFORM_NAME } from '@/lib/platformBrand'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

type NavGroup = {
  id: string
  label?: string
  /** When true, section can expand/collapse in the sidebar. */
  collapsible?: boolean
  items: NavItem[]
}

const NAV_OPEN_KEY = 'menushop:nav-open'

type OpenSections = Record<string, boolean>

function loadOpenSections(): OpenSections {
  try {
    const raw = localStorage.getItem(NAV_OPEN_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as OpenSections
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function pathInGroup(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => {
    if (item.end) return pathname === item.to
    return pathname === item.to || pathname.startsWith(`${item.to}/`)
  })
}

export function DashboardLayout() {
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const { restaurants, currentId, setCurrent, load, loading } = useRestaurantStore()
  const current = restaurants.find((r) => r.id === currentId) ?? null
  const copy = storeCopy(current?.storeKind)
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [openSections, setOpenSections] = useState<OpenSections>(() => loadOpenSections())

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
        collapsible: true,
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
        collapsible: true,
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
        collapsible: true,
        items: [
          { to: '/dashboard/branding', label: 'Branding', icon: Palette },
          { to: '/dashboard/pages', label: 'Pages & layout', icon: FileText },
          { to: '/dashboard/displays', label: copy.displayNounPlural, icon: MonitorPlay },
          { to: '/dashboard/pos', label: 'Point of sale', icon: TabletSmartphone },
          { to: '/dashboard/kitchen', label: copy.bohNoun, icon: Monitor },
          ...(copy.isRetail
            ? []
            : [{ to: '/dashboard/dining', label: 'Dining', icon: Armchair }]),
          { to: '/dashboard/preview', label: 'Preview', icon: Eye },
        ],
      },
    ],
    [copy],
  )

  // Keep the section that owns the current route expanded.
  useEffect(() => {
    const active = navGroups.find(
      (g) => g.collapsible && pathInGroup(location.pathname, g),
    )
    if (!active) return
    setOpenSections((prev) => {
      if (prev[active.id] === true) return prev
      const next = { ...prev, [active.id]: true }
      try {
        localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [location.pathname, navGroups])

  useEffect(() => {
    if (user) void load(user.id)
  }, [user, load])

  function isSectionOpen(group: NavGroup): boolean {
    if (!group.collapsible) return true
    if (openSections[group.id] !== undefined) return openSections[group.id]
    // Default: open when the current route lives in this section.
    return pathInGroup(location.pathname, group)
  }

  function toggleSection(groupId: string) {
    setOpenSections((prev) => {
      const currently =
        prev[groupId] ??
        pathInGroup(
          location.pathname,
          navGroups.find((g) => g.id === groupId) ?? { id: groupId, items: [] },
        )
      const next = { ...prev, [groupId]: !currently }
      try {
        localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

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
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">{PLATFORM_NAME}</div>
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
                {copy.newStoreCta}
              </button>
            </div>
          ) : null}
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
          {navGroups.map((group) => {
            const open = isSectionOpen(group)
            return (
              <div key={group.id}>
                {group.collapsible && group.label ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(group.id)}
                    aria-expanded={open}
                    className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left hover:bg-stone-50"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                      {group.label}
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 text-stone-400 transition-transform duration-200',
                        open ? 'rotate-0' : '-rotate-90',
                      )}
                    />
                  </button>
                ) : group.label ? (
                  <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {group.label}
                  </p>
                ) : null}

                {open ? (
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
                ) : null}
              </div>
            )
          })}
        </nav>

        <AccountMenu
          name={user.name}
          email={user.email}
          onSettings={() => {
            setMobileOpen(false)
            navigate('/dashboard/settings')
          }}
          onSignOut={async () => {
            await signOut()
            navigate('/')
          }}
        />
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

function AccountMenu({
  name,
  email,
  onSettings,
  onSignOut,
}: {
  name: string
  email: string
  onSettings: () => void
  onSignOut: () => void | Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?'

  return (
    <div className="relative mt-4 shrink-0 border-t border-stone-100 pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-stone-50"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-xs font-semibold text-[var(--color-brand)]">
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-stone-900">{name}</span>
          <span className="block truncate text-xs text-stone-500">{email}</span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-stone-400 transition', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="mt-1 space-y-0.5 rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
            onClick={() => {
              setOpen(false)
              onSettings()
            }}
          >
            <Settings className="h-4 w-4" />
            Account settings
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
            onClick={() => {
              setOpen(false)
              void onSignOut()
            }}
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}
