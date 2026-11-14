import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Clock3,
  MapPin,
  Phone,
  Search,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react'
import type { MenuItem, Restaurant } from '@/types'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { ItemCustomizer } from '@/components/storefront/ItemCustomizer'
import { BagDrawer } from '@/components/storefront/BagDrawer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDb } from '@/hooks/useDb'
import { useBagStore, type BagLine } from '@/stores/bagStore'
import { usePreviewStore } from '@/stores/previewStore'
import { getAvailableMenus, isAcceptingOrders, isItemAvailableNow } from '@/lib/scheduling'
import { formatMoney, formatPhone, cn, getDayOfWeek } from '@/lib/utils'
import { trackEvent } from '@/services/analyticsService'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function RestaurantPage() {
  const { slug, menuSlug } = useParams<{ slug: string; menuSlug?: string }>()
  const [searchParams] = useSearchParams()
  const { db, loading } = useDb()
  const clock = usePreviewStore((s) => s.clock)
  const bagLines = useBagStore((s) => s.lines)
  const subtotalFor = useBagStore((s) => s.subtotalFor)

  const [search, setSearch] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null)
  const [bagOpen, setBagOpen] = useState(false)
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null)
  const [priceOverride, setPriceOverride] = useState<number | undefined>()
  const [editingLine, setEditingLine] = useState<BagLine | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const restaurant = useMemo(
    () => db?.restaurants.find((r) => r.slug === slug) ?? null,
    [db, slug],
  )

  const now = clock()

  useEffect(() => {
    if (!restaurant) return
    const src = searchParams.get('src')
    const qid = searchParams.get('qid')
    if (src === 'qr') {
      void trackEvent({
        restaurantId: restaurant.id,
        type: 'qr_scan',
        qrCodeId: qid || undefined,
      })
    } else {
      void trackEvent({
        restaurantId: restaurant.id,
        type: 'link_visit',
      })
    }
  }, [restaurant?.id])

  const menus = useMemo(() => {
    if (!restaurant || !db) return []
    return getAvailableMenus(
      db.menus.filter((m) => m.restaurantId === restaurant.id),
      restaurant,
      now,
    )
  }, [restaurant, db, now])

  const selectedMenu = useMemo(() => {
    if (!menus.length) return null
    if (menuSlug) {
      return menus.find((m) => m.slug === menuSlug) ?? menus[0]
    }
    return menus[0]
  }, [menus, menuSlug])

  useEffect(() => {
    if (!restaurant || !selectedMenu) return
    void trackEvent({
      restaurantId: restaurant.id,
      type: 'menu_view',
      menuId: selectedMenu.id,
    })
  }, [restaurant?.id, selectedMenu?.id])

  const sections = useMemo(() => {
    if (!db || !selectedMenu) return []
    return db.sections
      .filter((s) => s.menuId === selectedMenu.id && !s.hidden)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, selectedMenu])

  const dietaryLabels = useMemo(() => {
    if (!db || !restaurant) return []
    return db.dietaryLabels.filter((l) => l.restaurantId === restaurant.id)
  }, [db, restaurant])

  const itemsById = useMemo(() => {
    const map = new Map<string, MenuItem>()
    if (!db || !restaurant) return map
    for (const item of db.items) {
      if (item.restaurantId === restaurant.id) map.set(item.id, item)
    }
    return map
  }, [db, restaurant])

  const sectionItems = useMemo(() => {
    if (!db || !selectedMenu || !restaurant) return []
    const q = search.trim().toLowerCase()
    return sections.map((section) => {
      const assignments = db.assignments
        .filter(
          (a) =>
            a.menuId === selectedMenu.id &&
            a.sectionId === section.id &&
            a.visible,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)

      const items = assignments
        .map((a) => {
          const item = itemsById.get(a.itemId)
          if (!item || item.availability === 'hidden') return null
          if (q) {
            const hay = `${item.name} ${item.shortDescription}`.toLowerCase()
            if (!hay.includes(q)) return null
          }
          if (dietaryFilter && !item.dietaryLabelIds.includes(dietaryFilter)) {
            return null
          }
          return { assignment: a, item }
        })
        .filter(Boolean) as Array<{
        assignment: (typeof assignments)[0]
        item: MenuItem
      }>

      return { section, items }
    })
  }, [db, selectedMenu, restaurant, sections, itemsById, search, dietaryFilter])

  const featured = useMemo(() => {
    if (!db || !selectedMenu) return []
    return db.assignments
      .filter((a) => a.menuId === selectedMenu.id && a.featured && a.visible)
      .map((a) => {
        const item = itemsById.get(a.itemId)
        if (!item || item.availability === 'hidden') return null
        return { assignment: a, item }
      })
      .filter(Boolean) as Array<{
      assignment: { priceOverrideCents?: number; id: string }
      item: MenuItem
    }>
  }, [db, selectedMenu, itemsById])

  const restaurantLines = restaurant
    ? bagLines.filter((l) => l.restaurantId === restaurant.id)
    : []
  const bagCount = restaurantLines.reduce((n, l) => n + l.quantity, 0)
  const bagSubtotal = restaurant ? subtotalFor(restaurant.id) : 0

  useEffect(() => {
    if (!sections.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]?.target.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] },
    )
    for (const s of sections) {
      const el = document.getElementById(`section-${s.id}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sections, selectedMenu?.id])

  function openItem(item: MenuItem, override?: number, line?: BagLine) {
    if (!isItemOrderable(item, now)) return
    setCustomizerItem(item)
    setPriceOverride(override)
    setEditingLine(line ?? null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)]">
        <p className="animate-pulse-soft text-stone-500">Loading menu…</p>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-canvas)] px-6 text-center">
        <UtensilsCrossed className="mb-4 h-12 w-12 text-stone-300" />
        <h1 className="font-display text-3xl text-stone-900">Restaurant not found</h1>
        <p className="mt-2 max-w-md text-stone-500">
          We couldn’t find a storefront at this link. Check the URL or explore a demo.
        </p>
        <Link to="/" className="mt-6">
          <Button>Back to MenuShop</Button>
        </Link>
      </div>
    )
  }

  const accepting = isAcceptingOrders(restaurant, now)
  const hoursSummary = formatHoursSummary(restaurant, now)

  return (
    <StorefrontShell branding={restaurant.branding}>
      <header className="relative">
        {restaurant.branding.coverDisplay !== 'none' && restaurant.coverImageUrl ? (
          <div
            className={cn(
              'relative w-full overflow-hidden',
              restaurant.branding.coverDisplay === 'banner' ? 'h-40 sm:h-52' : 'h-56 sm:h-72',
            )}
          >
            <img
              src={restaurant.coverImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          </div>
        ) : (
          <div className="h-24 bg-[var(--sf-primary)]" />
        )}

        <div className="relative mx-auto max-w-5xl px-4 pb-6 sm:px-6">
          <div
            className={cn(
              'flex gap-4',
              restaurant.branding.logoPlacement === 'center'
                ? '-mt-12 flex-col items-center text-center'
                : '-mt-10 items-end sm:-mt-12',
            )}
          >
            {restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt=""
                className="h-20 w-20 rounded-[var(--sf-radius,12px)] border-4 border-[var(--sf-surface)] object-cover shadow-md sm:h-24 sm:w-24"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-[var(--sf-radius,12px)] border-4 border-[var(--sf-surface)] bg-[var(--sf-primary)] text-white shadow-md sm:h-24 sm:w-24">
                <UtensilsCrossed className="h-8 w-8" />
              </div>
            )}
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl text-[var(--sf-text)] sm:text-4xl">
                  {restaurant.name}
                </h1>
                <Badge tone={accepting ? 'success' : 'warning'}>
                  {accepting
                    ? 'Accepting orders'
                    : restaurant.ordering.temporarilyClosed
                      ? 'Temporarily closed'
                      : 'Not accepting orders'}
                </Badge>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-[var(--sf-text)]/70">
                {restaurant.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--sf-text)]/60">
                {restaurant.address.line1 ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {restaurant.address.line1}
                    {restaurant.address.city ? `, ${restaurant.address.city}` : ''}
                  </span>
                ) : null}
                {restaurant.phone ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {formatPhone(restaurant.phone)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {hoursSummary}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {menus.length > 1 ? (
        <nav className="border-b border-stone-200/80 bg-[var(--sf-surface)]/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto">
            {menus.map((menu) => {
              const active = selectedMenu?.id === menu.id
              return (
                <Link
                  key={menu.id}
                  to={`/r/${restaurant.slug}/menu/${menu.slug}`}
                  className={cn(
                    'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[var(--sf-button)] text-[var(--sf-button-text)]'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
                  )}
                >
                  {menu.name}
                </Link>
              )
            })}
          </div>
        </nav>
      ) : null}

      <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the menu"
                className="pl-9"
                aria-label="Search menu"
              />
            </div>
            {dietaryLabels.length ? (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDietaryFilter(null)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-medium',
                    !dietaryFilter
                      ? 'bg-[var(--sf-primary)] text-white'
                      : 'bg-stone-100 text-stone-600',
                  )}
                >
                  All
                </button>
                {dietaryLabels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() =>
                      setDietaryFilter((v) => (v === label.id ? null : label.id))
                    }
                    className={cn(
                      'rounded-lg px-3 py-2 text-xs font-medium',
                      dietaryFilter === label.id
                        ? 'bg-[var(--sf-primary)] text-white'
                        : 'bg-stone-100 text-stone-600',
                    )}
                  >
                    {label.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {sections.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#section-${s.id}`}
                  className={cn(
                    'shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    activeSection === `section-${s.id}`
                      ? 'bg-[var(--sf-accent)] text-white'
                      : 'text-[var(--sf-text)]/70 hover:bg-stone-100',
                  )}
                >
                  {s.name}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6">
        {!selectedMenu ? (
          <EmptyState
            title="No menus available right now"
            description="Check back during open hours or ask the restaurant for today’s offerings."
          />
        ) : (
          <>
            {featured.length > 0 && !search && !dietaryFilter ? (
              <section className="mb-10 animate-fade-up">
                <h2 className="mb-4 text-2xl">Featured</h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {featured.map(({ item, assignment }) => (
                    <button
                      key={assignment.id}
                      type="button"
                      onClick={() =>
                        openItem(item, assignment.priceOverrideCents)
                      }
                      className="w-56 shrink-0 text-left transition-transform hover:-translate-y-0.5"
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="mb-2 h-36 w-full rounded-[var(--sf-radius,12px)] object-cover"
                        />
                      ) : (
                        <div className="mb-2 flex h-36 items-center justify-center rounded-[var(--sf-radius,12px)] bg-stone-200/60">
                          <UtensilsCrossed className="h-6 w-6 text-stone-400" />
                        </div>
                      )}
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-[var(--sf-primary)]">
                        {formatMoney(
                          assignment.priceOverrideCents ?? item.basePriceCents,
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {sectionItems.map(({ section, items }, idx) => (
              <section
                key={section.id}
                id={`section-${section.id}`}
                className="mb-12 scroll-mt-36 animate-fade-up"
                style={{ animationDelay: `${Math.min(idx, 4) * 60}ms` }}
              >
                <h2 className="text-2xl">{section.name}</h2>
                {section.description ? (
                  <p className="mt-1 text-sm text-[var(--sf-text)]/60">
                    {section.description}
                  </p>
                ) : null}
                {items.length === 0 ? (
                  <p className="mt-4 text-sm text-stone-500">No items match your filters.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-stone-200/80">
                    {items.map(({ item, assignment }) => {
                      const available = isItemOrderable(item, now)
                      const price =
                        assignment.priceOverrideCents ?? item.basePriceCents
                      const labels = dietaryLabels.filter((l) =>
                        item.dietaryLabelIds.includes(l.id),
                      )
                      return (
                        <li key={assignment.id}>
                          <button
                            type="button"
                            disabled={!available}
                            onClick={() =>
                              openItem(item, assignment.priceOverrideCents)
                            }
                            className={cn(
                              'flex w-full gap-4 py-4 text-left transition-opacity',
                              available
                                ? 'hover:opacity-90'
                                : 'cursor-not-allowed opacity-55',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-medium text-[var(--sf-text)]">
                                  {item.name}
                                </h3>
                                {!available ? (
                                  <Badge tone="warning">
                                    {unavailableLabel(item)}
                                  </Badge>
                                ) : null}
                                {labels.map((l) => (
                                  <Badge key={l.id} tone="brand">
                                    {l.name}
                                  </Badge>
                                ))}
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm text-[var(--sf-text)]/60">
                                {item.shortDescription}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-[var(--sf-primary)]">
                                {formatMoney(price)}
                              </p>
                            </div>
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt=""
                                className="h-24 w-24 shrink-0 rounded-[var(--sf-radius,12px)] object-cover sm:h-28 sm:w-28"
                              />
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            ))}
          </>
        )}
      </main>

      {bagCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4 sm:hidden">
          <button
            type="button"
            onClick={() => setBagOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-[var(--sf-button)] px-5 py-4 text-[var(--sf-button-text)] shadow-lg animate-slide-up"
          >
            <span className="flex items-center gap-2 font-medium">
              <ShoppingBag className="h-5 w-5" />
              View bag · {bagCount}
            </span>
            <span className="font-semibold">{formatMoney(bagSubtotal)}</span>
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setBagOpen(true)}
        className="fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-2xl bg-[var(--sf-button)] px-4 py-3 text-[var(--sf-button-text)] shadow-lg transition-transform hover:-translate-y-0.5 sm:inline-flex"
      >
        <ShoppingBag className="h-5 w-5" />
        <span className="font-medium">
          Bag{bagCount > 0 ? ` · ${bagCount}` : ''}
        </span>
        {bagCount > 0 ? (
          <span className="text-sm opacity-90">{formatMoney(bagSubtotal)}</span>
        ) : null}
      </button>

      <BagDrawer
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        restaurant={restaurant}
        onEditLine={(line) => {
          const item = itemsById.get(line.itemId)
          if (!item) return
          setBagOpen(false)
          openItem(item, undefined, line)
        }}
      />

      <ItemCustomizer
        open={Boolean(customizerItem)}
        onClose={() => {
          setCustomizerItem(null)
          setEditingLine(null)
        }}
        restaurant={restaurant}
        item={customizerItem}
        priceOverrideCents={priceOverride}
        editingLine={editingLine}
      />
    </StorefrontShell>
  )
}

function isItemOrderable(item: MenuItem, at: Date) {
  return isItemAvailableNow(item, at)
}

function unavailableLabel(item: MenuItem) {
  switch (item.availability) {
    case 'sold_out':
      return 'Sold out'
    case 'temporarily_unavailable':
      return 'Unavailable'
    default:
      return item.active ? 'Unavailable' : 'Unavailable'
  }
}

function formatHoursSummary(restaurant: Restaurant, at: Date) {
  const day = getDayOfWeek(at)
  const hours = restaurant.businessHours.find((h) => h.day === day)
  if (!hours) return 'Hours unavailable'
  if (hours.closed) return `Closed ${DAY_NAMES[day]}`
  return `Today ${hours.open}–${hours.close}`
}
