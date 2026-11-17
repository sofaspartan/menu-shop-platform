import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import {
  Clock3,
  MapPin,
  Phone,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import type { MenuItem } from '@/types'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontNav } from '@/components/storefront/StorefrontNav'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { RetailShopView } from '@/components/storefront/RetailShopView'
import { RetailBagFab } from '@/components/storefront/RetailBagFab'
import {
  HomeAboutTeaserSection,
  HomeFeaturedSection,
  HomeSplashSection,
  isStoreHomeEnabled,
  useHomeSections,
} from '@/components/storefront/StoreHomeSections'
import { ItemCustomizer } from '@/components/storefront/ItemCustomizer'
import { BagDrawer } from '@/components/storefront/BagDrawer'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { FlyToBagOverlay } from '@/components/storefront/FlyToBagOverlay'
import { useBagAnimationStore } from '@/stores/bagAnimationStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDb } from '@/hooks/useDb'
import { useBagStore, type BagLine } from '@/stores/bagStore'
import { usePreviewStore } from '@/stores/previewStore'
import {
  formatHoursSummary,
  getAvailableMenus,
  isAcceptingOrders,
  isItemAvailableNow,
} from '@/lib/scheduling'
import { resolveListedPrice } from '@/lib/commerce'
import { storeCopy } from '@/lib/storeCopy'
import { isStorefrontShopPath } from '@/lib/storefrontNav'
import { formatPhone, cn } from '@/lib/utils'
import { trackEvent } from '@/services/analyticsService'
import { PriceDisplay } from '@/components/storefront/PriceDisplay'

export function RestaurantPage() {
  const { slug, menuSlug } = useParams<{ slug: string; menuSlug?: string }>()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { db, loading } = useDb()
  const previewEnabled = usePreviewStore((s) => s.enabled)
  const simulatedAt = usePreviewStore((s) => s.simulatedAt)
  const bagLines = useBagStore((s) => s.lines)
  const pulseToken = useBagAnimationStore((s) => s.pulseToken)
  const flight = useBagAnimationStore((s) => s.flight)
  const [bagPulseKey, setBagPulseKey] = useState(0)
  /** Full-width mobile bag only while catching an add, then collapses to the side FAB. */
  const [bagCatchExpanded, setBagCatchExpanded] = useState(false)
  const trackedVisit = useRef<string | null>(null)
  const trackedMenu = useRef<string | null>(null)

  useEffect(() => {
    if (flight) setBagCatchExpanded(true)
  }, [flight])

  useEffect(() => {
    if (pulseToken === 0) return
    setBagPulseKey(pulseToken)
    setBagCatchExpanded(true)
  }, [pulseToken])

  const [search, setSearch] = useState('')
  const [dietaryFilter, setDietaryFilter] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bagOpen, setBagOpen] = useState(false)
  const [customizerItem, setCustomizerItem] = useState<MenuItem | null>(null)
  const [priceOverride, setPriceOverride] = useState<number | undefined>()
  const [editingLine, setEditingLine] = useState<BagLine | null>(null)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [liveTick, setLiveTick] = useState(() => Date.now())

  const restaurant = useMemo(
    () => db?.restaurants.find((r) => r.slug === slug) ?? null,
    [db, slug],
  )

  const sales = useMemo(
    () =>
      db && restaurant
        ? db.sales.filter((s) => s.restaurantId === restaurant.id)
        : [],
    [db, restaurant],
  )

  useEffect(() => {
    if (previewEnabled) return
    const id = window.setInterval(() => setLiveTick(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [previewEnabled])

  const now = useMemo(() => {
    if (previewEnabled && simulatedAt) return simulatedAt
    return new Date(liveTick)
  }, [previewEnabled, simulatedAt, liveTick])

  useEffect(() => {
    if (!restaurant) return
    const key = `${restaurant.id}:${searchParams.get('src')}:${searchParams.get('qid')}`
    if (trackedVisit.current === key) return
    trackedVisit.current = key
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
  }, [restaurant, searchParams])

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
    const key = `${restaurant.id}:${selectedMenu.id}`
    if (trackedMenu.current === key) return
    trackedMenu.current = key
    void trackEvent({
      restaurantId: restaurant.id,
      type: 'menu_view',
      menuId: selectedMenu.id,
    })
  }, [restaurant, selectedMenu])

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
      .filter((a) => a.menuId === selectedMenu.id && a.visible)
      .map((a) => {
        const item = itemsById.get(a.itemId)
        if (!item || item.availability === 'hidden') return null
        if (!(a.featured || item.featured)) return null
        return { assignment: a, item }
      })
      .filter(Boolean) as Array<{
      assignment: { priceOverrideCents?: number; id: string }
      item: MenuItem
    }>
  }, [db, selectedMenu, itemsById])

  const homeEnabled = isStoreHomeEnabled(restaurant)
  const homeSections = useHomeSections(restaurant)
  const onShopRoute =
    Boolean(menuSlug) ||
    (slug ? isStorefrontShopPath(location.pathname, slug) : false)
  const showHomePage = Boolean(homeEnabled && restaurant && !onShopRoute)

  const restaurantLines = restaurant
    ? bagLines.filter((l) => l.restaurantId === restaurant.id)
    : []
  const bagCount = restaurantLines.reduce((n, l) => n + l.quantity, 0)
  const prevBagCountRef = useRef(bagCount)

  useLayoutEffect(() => {
    if (bagCount > prevBagCountRef.current) {
      setBagCatchExpanded(true)
    }
    if (bagCount === 0) {
      setBagCatchExpanded(false)
    }
    prevBagCountRef.current = bagCount
  }, [bagCount])

  /** Always collapse the catch bar back to the side FAB after a short beat. */
  useEffect(() => {
    if (!bagCatchExpanded) return
    const t = window.setTimeout(() => setBagCatchExpanded(false), 2400)
    return () => window.clearTimeout(t)
  }, [bagCatchExpanded, bagCount, pulseToken])

  const sectionIdsKey = sections.map((s) => s.id).join(',')

  useEffect(() => {
    if (!sections.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const nextId = visible[0]?.target.id
        if (nextId) {
          setActiveSection((prev) => (prev === nextId ? prev : nextId))
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.2, 0.45] },
    )
    for (const s of sections) {
      const el = document.getElementById(`section-${s.id}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sectionIdsKey])

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
          <Button>Back to home</Button>
        </Link>
      </div>
    )
  }

  const store = restaurant
  const accepting = isAcceptingOrders(store, now)
  const hoursSummary = formatHoursSummary(store, now)
  const activeDietary = dietaryLabels.find((l) => l.id === dietaryFilter)
  const showCover = store.branding.coverDisplay !== 'none' && store.coverImageUrl
  const copy = storeCopy(store.storeKind)
  const isRetailLayout =
    (store.storefrontLayout ??
      (store.storeKind === 'retail' ? 'retail' : 'restaurant')) === 'retail'

  if (isRetailLayout) {
    return (
      <StorefrontShell branding={restaurant.branding}>
        <RetailShopView
          restaurant={restaurant}
          menus={menus}
          selectedMenu={selectedMenu}
          sectionItems={sectionItems}
          featured={featured}
          search={search}
          onSearchChange={setSearch}
          onOpenItem={(item, override) => openItem(item, override)}
          isItemOrderable={(item) => isItemOrderable(item, now)}
          unavailableLabel={unavailableLabel}
          pageMode={showHomePage ? 'home' : 'shop'}
        />
        <RetailBagFab
          storeKind={restaurant.storeKind}
          bagCount={bagCount}
          bagPulse={bagPulseKey > 0}
          bagCatchExpanded={bagCatchExpanded}
          onOpen={() => setBagOpen(true)}
        />
        <FlyToBagOverlay />
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

  function renderHomeSection(section: (typeof homeSections)[number]) {
    if (section.kind === 'splash') {
      return (
        <HomeSplashSection key={section.id} restaurant={store} section={section} />
      )
    }
    if (section.kind === 'aboutTeaser') {
      return (
        <HomeAboutTeaserSection
          key={section.id}
          restaurant={store}
          section={section}
        />
      )
    }
    if (section.kind === 'featured') {
      return (
        <HomeFeaturedSection
          key={section.id}
          restaurant={store}
          section={section}
          featured={featured}
          onOpenItem={(item, override) => openItem(item, override)}
        />
      )
    }
    return null
  }

  const bagAndModals = (
    <>
      {bagCatchExpanded && bagCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4 sm:hidden">
          <button
            type="button"
            data-bag-target
            onClick={() => setBagOpen(true)}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--sf-button)] px-5 py-4 text-[var(--sf-button-text)] shadow-lg',
              bagPulseKey > 0 && 'bag-catch-pulse',
            )}
            key={`mobile-bag-full-${bagPulseKey}`}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="font-medium">{copy.viewBag}</span>
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--sf-button-text)]/20 px-1.5 text-sm font-semibold">
              {bagCount}
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-bag-target
          onClick={() => setBagOpen(true)}
          className={cn(
            'fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-2xl bg-[var(--sf-button)] px-4 py-3 text-[var(--sf-button-text)] shadow-lg sm:hidden',
            bagPulseKey > 0 && 'bag-catch-pulse',
          )}
          key={`mobile-bag-fab-${bagPulseKey}`}
          aria-label={`Open ${copy.bagNoun}`}
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="font-medium">{copy.viewBag}</span>
          {bagCount > 0 ? (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--sf-button-text)]/20 px-1.5 text-sm font-semibold">
              {bagCount}
            </span>
          ) : null}
        </button>
      )}

      <button
        type="button"
        data-bag-target
        onClick={() => setBagOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-2xl bg-[var(--sf-button)] px-4 py-3 text-[var(--sf-button-text)] shadow-lg transition-transform hover:-translate-y-0.5 sm:inline-flex',
          bagPulseKey > 0 && 'bag-catch-pulse',
        )}
        key={`desktop-bag-${bagPulseKey}`}
        aria-label={`Open ${copy.bagNoun}`}
      >
        <ShoppingBag className="h-5 w-5" />
        <span className="font-medium">{copy.viewBag}</span>
        {bagCount > 0 ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--sf-button-text)]/20 px-1.5 text-sm font-semibold">
            {bagCount}
          </span>
        ) : null}
      </button>

      <FlyToBagOverlay />

      <BagDrawer
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        restaurant={store}
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
        restaurant={store}
        item={customizerItem}
        priceOverrideCents={priceOverride}
        editingLine={editingLine}
      />
    </>
  )

  if (showHomePage) {
    return (
      <StorefrontShell branding={store.branding}>
        <div className="sticky top-0 z-30 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
            <StorefrontNav restaurant={store} />
          </div>
        </div>
        {homeSections.map(renderHomeSection)}
        <StorefrontFooter restaurant={store} />
        {bagAndModals}
      </StorefrontShell>
    )
  }

  return (
    <StorefrontShell branding={store.branding}>
      {homeEnabled ? (
        <div className="sticky top-0 z-30 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
            <StorefrontNav restaurant={store} />
          </div>
        </div>
      ) : null}

      {!homeEnabled ? (
      <header className="relative">
        {showCover ? (
          <div
            className={cn(
              'relative w-full overflow-hidden',
              restaurant.branding.coverDisplay === 'banner'
                ? 'min-h-[220px] sm:min-h-[280px]'
                : 'min-h-[280px] sm:min-h-[360px]',
            )}
          >
            <img
              src={restaurant.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
            <div className="relative mx-auto flex h-full min-h-[inherit] max-w-5xl flex-col justify-end px-4 pb-8 pt-16 sm:px-6 sm:pb-10">
              <div
                className={cn(
                  'flex items-start gap-4',
                  restaurant.branding.logoPlacement === 'center' &&
                    'flex-col items-center text-center',
                )}
              >
                {restaurant.logoUrl ? (
                  <MenuItemImage
                    src={restaurant.logoUrl}
                    alt=""
                    storeKind={store.storeKind}
                    className="mt-1 h-16 w-16 shrink-0 rounded-[var(--sf-radius,12px)] border-2 border-white/80 object-cover shadow-lg sm:h-20 sm:w-20"
                    fallbackClassName="mt-1 h-16 w-16 shrink-0 rounded-[var(--sf-radius,12px)] border-2 border-white/80 bg-white/20 sm:h-20 sm:w-20"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-4xl leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] sm:text-5xl">
                    {restaurant.name}
                  </h1>
                  <div
                    className={cn(
                      'mt-3 flex flex-wrap items-center gap-2',
                      restaurant.branding.logoPlacement === 'center' && 'justify-center',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide',
                        accepting
                          ? 'bg-emerald-400/95 text-emerald-950'
                          : 'bg-amber-300/95 text-amber-950',
                      )}
                    >
                      {accepting
                        ? 'Accepting orders'
                        : restaurant.ordering.temporarilyClosed
                          ? 'Temporarily closed'
                          : 'Not accepting orders'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[var(--sf-primary)] px-4 py-10 text-white sm:px-6">
            <div className="mx-auto max-w-5xl">
              <h1 className="font-display text-4xl sm:text-5xl">{restaurant.name}</h1>
            </div>
          </div>
        )}

        <div className="border-b border-stone-200/70 bg-[var(--sf-surface)]">
          <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
            <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--sf-text)]/80">
              {restaurant.description}
            </p>
            <div className="mt-4 flex flex-col gap-2 text-sm text-[var(--sf-text)]/70 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
              {restaurant.address.line1 ? (
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sf-primary)]" />
                  <span>
                    {restaurant.address.line1}
                    {restaurant.address.city ? `, ${restaurant.address.city}` : ''}
                  </span>
                </span>
              ) : null}
              {restaurant.phone ? (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="inline-flex items-center gap-2 hover:text-[var(--sf-primary)]"
                >
                  <Phone className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" />
                  {formatPhone(restaurant.phone)}
                </a>
              ) : null}
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" />
                {hoursSummary}
              </span>
            </div>
          </div>
        </div>
      </header>
      ) : null}

      <div
        id="section-catalog"
        className={cn(
          'sticky z-20 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur',
          homeEnabled ? 'top-[3.25rem]' : 'top-0',
        )}
      >
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          {!homeEnabled ? <StorefrontNav restaurant={store} /> : null}
          {menus.length > 1 ? (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {menus.map((menu) => {
                const active = selectedMenu?.id === menu.id
                return (
                  <Link
                    key={menu.id}
                    to={`/r/${restaurant.slug}/menu/${menu.slug}`}
                    className={cn(
                      'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[var(--sf-primary)]/15 text-[var(--sf-primary)] ring-1 ring-[var(--sf-primary)]/25'
                        : 'text-[var(--sf-text)]/65 hover:text-[var(--sf-text)]',
                    )}
                  >
                    {menu.name}
                  </Link>
                )
              })}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the menu"
                className="h-11 border-stone-200/90 bg-[var(--sf-surface)] pl-9"
                aria-label="Search menu"
              />
              {search ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            {dietaryLabels.length ? (
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium ring-1 transition-colors',
                  filtersOpen || dietaryFilter
                    ? 'bg-[var(--sf-primary)] text-white ring-[var(--sf-primary)]'
                    : 'bg-[var(--sf-surface)] text-[var(--sf-text)]/80 ring-stone-200/80 hover:bg-white',
                )}
                aria-expanded={filtersOpen}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">
                  {activeDietary ? activeDietary.name : 'Filters'}
                </span>
              </button>
            ) : null}
          </div>

          {filtersOpen && dietaryLabels.length ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setDietaryFilter(null)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium',
                  !dietaryFilter
                    ? 'bg-[var(--sf-primary)] text-white'
                    : 'bg-[var(--sf-surface)] text-[var(--sf-text)]/70 ring-1 ring-stone-200',
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
                    'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium',
                    dietaryFilter === label.id
                      ? 'bg-[var(--sf-primary)] text-white'
                      : 'bg-[var(--sf-surface)] text-[var(--sf-text)]/70 ring-1 ring-stone-200',
                  )}
                >
                  {label.name}
                </button>
              ))}
            </div>
          ) : null}

          {sections.length > 1 ? (
            <div className="mt-3 flex gap-1 overflow-x-auto border-t border-stone-200/70 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sections.map((s) => {
                const active = activeSection === `section-${s.id}`
                return (
                  <a
                    key={s.id}
                    href={`#section-${s.id}`}
                    className={cn(
                      'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'border-[var(--sf-accent)] text-[var(--sf-text)]'
                        : 'border-transparent text-[var(--sf-text)]/55 hover:text-[var(--sf-text)]',
                    )}
                  >
                    {s.name}
                  </a>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>

      <main
        className={cn(
          'mx-auto max-w-5xl px-4 pt-6 sm:px-6',
          bagCatchExpanded && bagCount > 0 ? 'pb-32' : 'pb-28',
        )}
      >
        {!selectedMenu ? (
          <EmptyState title={copy.noCatalogTitle} description={copy.noCatalogBody} />
        ) : (
          <>
            {featured.length > 0 && !homeEnabled && !search && !dietaryFilter ? (
              <section className="mb-10 animate-fade-up">
                <div className="mb-5 border-b border-[color-mix(in_srgb,var(--sf-text)_14%,transparent)] pb-3">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--sf-text)] sm:text-[1.75rem]">
                    Featured
                  </h2>
                </div>
                {isRetailLayout ? (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
                    {featured.map(({ item, assignment }) => {
                      const listed = resolveListedPrice(
                        assignment.priceOverrideCents ?? item.basePriceCents,
                        item.id,
                        sales,
                        undefined,
                        item.salePriceCents,
                      )
                      return (
                      <li key={assignment.id}>
                        <button
                          type="button"
                          onClick={() => openItem(item, listed.priceCents)}
                          className="w-full text-left transition-transform hover:-translate-y-0.5"
                        >
                          <MenuItemImage
                            src={item.imageUrl}
                            alt=""
                            storeKind={store.storeKind}
                            className="aspect-square w-full rounded-[var(--sf-radius,12px)] object-cover"
                            fallbackClassName="aspect-square w-full rounded-[var(--sf-radius,12px)]"
                          />
                          <p className="mt-2.5 text-sm font-medium leading-snug text-[var(--sf-text)]">
                            {item.name}
                          </p>
                          <div className="mt-0.5">
                            <PriceDisplay
                              listPriceCents={listed.listPriceCents}
                              priceCents={listed.priceCents}
                              onSale={listed.onSale}
                              size="sm"
                            />
                          </div>
                        </button>
                      </li>
                    )})}
                  </ul>
                ) : (
                  <div className="flex gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {featured.map(({ item, assignment }) => {
                      const listed = resolveListedPrice(
                        assignment.priceOverrideCents ?? item.basePriceCents,
                        item.id,
                        sales,
                        undefined,
                        item.salePriceCents,
                      )
                      return (
                      <button
                        key={assignment.id}
                        type="button"
                        onClick={() => openItem(item, listed.priceCents)}
                        className="w-60 shrink-0 text-left transition-transform hover:-translate-y-0.5"
                      >
                        <MenuItemImage
                          src={item.imageUrl}
                          alt=""
                            storeKind={store.storeKind}
                          className="mb-3 h-40 w-full rounded-[var(--sf-radius,12px)] object-cover"
                          fallbackClassName="mb-3 h-40 w-full rounded-[var(--sf-radius,12px)]"
                        />
                        <p className="font-medium text-[var(--sf-text)]">{item.name}</p>
                        <div className="mt-0.5">
                          <PriceDisplay
                            listPriceCents={listed.listPriceCents}
                            priceCents={listed.priceCents}
                            onSale={listed.onSale}
                            size="sm"
                          />
                        </div>
                      </button>
                    )})}
                  </div>
                )}
              </section>
            ) : null}

            {sectionItems.map(({ section, items }, idx) => (
              <section
                key={section.id}
                id={`section-${section.id}`}
                className="mb-12 scroll-mt-44 animate-fade-up"
                style={{ animationDelay: `${Math.min(idx, 4) * 60}ms` }}
              >
                <div className="mb-5 border-b border-[color-mix(in_srgb,var(--sf-text)_14%,transparent)] pb-3">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--sf-text)] sm:text-[1.75rem]">
                    {section.name}
                  </h2>
                  {section.description ? (
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--sf-text)]/65">
                      {section.description}
                    </p>
                  ) : null}
                </div>
                {items.length === 0 ? (
                  <p className="mt-4 text-sm text-stone-500">No items match your filters.</p>
                ) : isRetailLayout ? (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4">
                    {items.map(({ item, assignment }) => {
                      const available = isItemOrderable(item, now)
                      const listed = resolveListedPrice(
                        assignment.priceOverrideCents ?? item.basePriceCents,
                        item.id,
                        sales,
                        undefined,
                        item.salePriceCents,
                      )
                      return (
                        <li key={assignment.id}>
                          <button
                            type="button"
                            disabled={!available}
                            onClick={() => openItem(item, listed.priceCents)}
                            className={cn(
                              'w-full text-left transition-transform',
                              available
                                ? 'hover:-translate-y-0.5'
                                : 'cursor-not-allowed opacity-55',
                            )}
                          >
                            <div className="relative">
                              <MenuItemImage
                                src={item.imageUrl}
                                alt=""
                            storeKind={store.storeKind}
                                className="aspect-square w-full rounded-[var(--sf-radius,12px)] object-cover"
                                fallbackClassName="aspect-square w-full rounded-[var(--sf-radius,12px)]"
                              />
                              {!available ? (
                                <span className="absolute left-2 top-2">
                                  <Badge tone="warning">{unavailableLabel(item)}</Badge>
                                </span>
                              ) : listed.onSale ? (
                                <span className="absolute left-2 top-2">
                                  <Badge tone="accent">{listed.percentOff}% off</Badge>
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2.5 text-sm font-medium leading-snug text-[var(--sf-text)]">
                              {item.name}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--sf-text)]/55">
                              {item.shortDescription}
                            </p>
                            <div className="mt-1.5">
                              <PriceDisplay
                                listPriceCents={listed.listPriceCents}
                                priceCents={listed.priceCents}
                                onSale={listed.onSale}
                                size="sm"
                              />
                            </div>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <ul className="divide-y divide-stone-200/70">
                    {items.map(({ item, assignment }) => {
                      const available = isItemOrderable(item, now)
                      const listed = resolveListedPrice(
                        assignment.priceOverrideCents ?? item.basePriceCents,
                        item.id,
                        sales,
                        undefined,
                        item.salePriceCents,
                      )
                      const labels = dietaryLabels.filter((l) =>
                        item.dietaryLabelIds.includes(l.id),
                      )
                      return (
                        <li key={assignment.id}>
                          <button
                            type="button"
                            disabled={!available}
                            onClick={() => openItem(item, listed.priceCents)}
                            className={cn(
                              'flex w-full gap-4 py-5 text-left transition-opacity',
                              available ? 'hover:opacity-90' : 'cursor-not-allowed opacity-55',
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-base font-semibold text-[var(--sf-text)]">
                                  {item.name}
                                </h3>
                                {!available ? (
                                  <Badge tone="warning">{unavailableLabel(item)}</Badge>
                                ) : listed.onSale ? (
                                  <Badge tone="accent">{listed.percentOff}% off</Badge>
                                ) : null}
                              </div>
                              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--sf-text)]/65">
                                {item.shortDescription}
                              </p>
                              {labels.length ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {labels.slice(0, 3).map((l) => (
                                    <span
                                      key={l.id}
                                      className="rounded-md bg-[color-mix(in_srgb,var(--sf-primary)_10%,white)] px-2 py-0.5 text-[11px] font-medium text-[var(--sf-primary)]"
                                    >
                                      {l.name}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                              <div className="mt-3">
                                <PriceDisplay
                                  listPriceCents={listed.listPriceCents}
                                  priceCents={listed.priceCents}
                                  onSale={listed.onSale}
                                  size="sm"
                                />
                              </div>
                            </div>
                            <MenuItemImage
                              src={item.imageUrl}
                              alt=""
                            storeKind={store.storeKind}
                              className="h-24 w-24 shrink-0 rounded-[var(--sf-radius,12px)] object-cover sm:h-28 sm:w-28"
                              fallbackClassName="h-24 w-24 shrink-0 rounded-[var(--sf-radius,12px)] sm:h-28 sm:w-28"
                            />
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

      <StorefrontFooter restaurant={store} />
      {bagAndModals}
    </StorefrontShell>
  )
}

function isItemOrderable(item: MenuItem, at: Date) {
  return isItemAvailableNow(item, at)
}

function unavailableLabel(item: MenuItem) {
  if (item.trackInventory && (item.stockQty ?? 0) <= 0) return 'Sold out'
  switch (item.availability) {
    case 'sold_out':
      return 'Sold out'
    case 'temporarily_unavailable':
      return 'Unavailable'
    default:
      return 'Unavailable'
  }
}

