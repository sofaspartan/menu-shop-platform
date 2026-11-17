import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Menu, MenuItem, MenuItemAssignment, MenuSection, Restaurant } from '@/types'
import { normalizeCoverIntro } from '@/types'
import { RetailChrome } from '@/components/storefront/RetailChrome'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import {
  HomeAboutTeaserSection,
  HomeFeaturedSection,
  HomeSplashSection,
  isStoreHomeEnabled,
  useHomeSections,
} from '@/components/storefront/StoreHomeSections'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { PriceDisplay } from '@/components/storefront/PriceDisplay'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDb } from '@/hooks/useDb'
import { resolveListedPrice } from '@/lib/commerce'
import { storeCopy } from '@/lib/storeCopy'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'

type CatalogItem = {
  item: MenuItem
  assignment: Pick<MenuItemAssignment, 'id' | 'priceOverrideCents'>
}

export function RetailShopView({
  restaurant,
  menus,
  selectedMenu,
  sectionItems,
  featured,
  search,
  onSearchChange,
  onOpenItem,
  isItemOrderable,
  unavailableLabel,
}: {
  restaurant: Restaurant
  menus: Menu[]
  selectedMenu: Menu | null
  sectionItems: Array<{ section: MenuSection; items: CatalogItem[] }>
  featured: CatalogItem[]
  search: string
  onSearchChange: (value: string) => void
  onOpenItem: (item: MenuItem, priceOverride?: number) => void
  isItemOrderable: (item: MenuItem) => boolean
  unavailableLabel: (item: MenuItem) => string
}) {
  const { db } = useDb()
  const sales = useMemo(
    () => (db ? db.sales.filter((s) => s.restaurantId === restaurant.id) : []),
    [db, restaurant.id],
  )
  const copy = storeCopy(restaurant.storeKind)
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)
  const homeEnabled = isStoreHomeEnabled(restaurant)
  const homeSections = useHomeSections(restaurant)
  const coverIntro = normalizeCoverIntro(restaurant.pages?.coverIntro)
  const featuredEnabled = restaurant.pages?.featuredEnabled !== false
  const showCover =
    !homeEnabled &&
    coverIntro.enabled &&
    restaurant.branding.coverDisplay !== 'none' &&
    Boolean(restaurant.coverImageUrl)
  const featuredHero =
    !homeEnabled && !search && featuredEnabled ? (featured[0] ?? null) : null
  const sectionLinks = !search
    ? [
        ...(featuredHero ? [{ id: 'featured', name: 'Featured' }] : []),
        ...sectionItems.map(({ section }) => ({ id: section.id, name: section.name })),
      ]
    : []
  const showSectionNav = !homeEnabled && sectionLinks.length > 1
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    sectionLinks[0]?.id ?? null,
  )
  const sectionIdsKey = sectionLinks.map((s) => s.id).join(',')

  useEffect(() => {
    if (!sectionLinks.length) {
      setActiveSectionId(null)
      return
    }
    setActiveSectionId((prev) =>
      prev && sectionLinks.some((s) => s.id === prev) ? prev : sectionLinks[0].id,
    )

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const nextId = visible[0]?.target.id?.replace(/^section-/, '')
        if (nextId) {
          setActiveSectionId((prev) => (prev === nextId ? prev : nextId))
        }
      },
      { rootMargin: '-30% 0px -50% 0px', threshold: [0, 0.15, 0.4] },
    )

    for (const link of sectionLinks) {
      const el = document.getElementById(`section-${link.id}`)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [sectionIdsKey])

  const catalogBlock = (
    <div id="section-catalog" className={cn(contentClass, 'pb-28 pt-8')}>
      {menus.length > 1 ? (
        <div className="mb-8 flex flex-wrap gap-2">
          {menus.map((menu) => {
            const active = selectedMenu?.id === menu.id
            return (
              <Link
                key={menu.id}
                to={`/r/${restaurant.slug}/menu/${menu.slug}`}
                className={cn(
                  'rounded-full px-4 py-2.5 text-base transition-colors',
                  active
                    ? 'bg-[var(--sf-text)] font-medium text-[var(--sf-bg)]'
                    : 'text-[var(--sf-text)]/75 hover:text-[var(--sf-text)]',
                )}
              >
                {menu.name}
              </Link>
            )
          })}
        </div>
      ) : null}

      {!selectedMenu ? (
        <EmptyState title={copy.noCatalogTitle} description={copy.noCatalogBody} />
      ) : (
        <>
          {featuredHero ? (
            <FeaturedHero
              entry={featuredHero}
              sales={sales}
              onOpenItem={onOpenItem}
              isItemOrderable={isItemOrderable}
              unavailableLabel={unavailableLabel}
            />
          ) : null}

          {sectionItems.map(({ section, items }) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="mb-16 scroll-mt-40"
            >
              <div className="mb-6">
                <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--sf-text)] sm:text-[1.75rem]">
                  {section.name}
                </h2>
                {section.description ? (
                  <p className="mt-2 max-w-2xl text-base leading-relaxed text-[var(--sf-text)]/75">
                    {section.description}
                  </p>
                ) : null}
              </div>
              {items.length === 0 ? (
                <p className="text-base text-[var(--sf-text)]/65">No products match.</p>
              ) : (
                <ProductGrid
                  items={items}
                  sales={sales}
                  onOpenItem={onOpenItem}
                  isItemOrderable={isItemOrderable}
                  unavailableLabel={unavailableLabel}
                />
              )}
            </section>
          ))}
        </>
      )}
    </div>
  )

  let homeBody: ReactNode = null
  if (homeEnabled) {
    const nodes: ReactNode[] = []
    for (const section of homeSections) {
      if (section.kind === 'splash') {
        nodes.push(
          <HomeSplashSection key={section.id} restaurant={restaurant} section={section} />,
        )
      } else if (section.kind === 'aboutTeaser') {
        nodes.push(
          <HomeAboutTeaserSection
            key={section.id}
            restaurant={restaurant}
            section={section}
          />,
        )
      } else if (section.kind === 'featured') {
        nodes.push(
          <HomeFeaturedSection
            key={section.id}
            restaurant={restaurant}
            section={section}
            featured={featured}
            onOpenItem={onOpenItem}
          />,
        )
      } else if (section.kind === 'catalog') {
        nodes.push(<div key={section.id}>{catalogBlock}</div>)
      }
    }
    if (!homeSections.some((s) => s.kind === 'catalog')) {
      nodes.push(<div key="catalog-fallback">{catalogBlock}</div>)
    }
    homeBody = nodes
  }

  return (
    <div className="flex min-h-screen flex-col">
      <RetailChrome
        restaurant={restaurant}
        search={search}
        onSearchChange={onSearchChange}
      />

      {homeEnabled ? (
        <div className="flex-1">{homeBody}</div>
      ) : (
        <>
          {showCover ? (
            <div className="relative w-full overflow-hidden">
              <div
                className={cn(
                  'relative w-full',
                  coverIntro.height === 'tall'
                    ? 'aspect-[16/11] min-h-[320px] max-h-[640px] sm:min-h-[420px] sm:aspect-[21/10]'
                    : 'aspect-[21/9] min-h-[200px] max-h-[360px] sm:min-h-[260px]',
                )}
              >
                <img
                  src={restaurant.coverImageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {coverIntro.align === 'centerMiddle' ? (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/35 to-black/20" />
                ) : (
                  <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                )}
                <div
                  className={cn(
                    contentClass,
                    coverIntro.align === 'centerMiddle'
                      ? 'absolute inset-0 flex items-center justify-center py-10 text-center'
                      : cn(
                          'absolute inset-x-0 bottom-0 pb-8 pt-16 sm:pb-10',
                          coverIntro.align === 'centerBottom' &&
                            'flex justify-center text-center',
                        ),
                  )}
                >
                  <CoverIntroCopy
                    title={coverIntro.showTitle ? coverIntro.title : undefined}
                    description={
                      coverIntro.showDescription ? restaurant.description : undefined
                    }
                    buttonLabel={coverIntro.showButton ? coverIntro.buttonLabel : undefined}
                    buttonHref={coverIntro.buttonHref}
                    align={coverIntro.align}
                    onLight={false}
                  />
                </div>
              </div>
            </div>
          ) : coverIntro.enabled ? (
            <div
              className={cn(
                contentClass,
                'pb-2 pt-8',
                (coverIntro.align === 'centerBottom' ||
                  coverIntro.align === 'centerMiddle') &&
                  'flex justify-center text-center',
              )}
            >
              <CoverIntroCopy
                title={coverIntro.showTitle ? coverIntro.title : undefined}
                description={
                  coverIntro.showDescription ? restaurant.description : undefined
                }
                buttonLabel={coverIntro.showButton ? coverIntro.buttonLabel : undefined}
                buttonHref={coverIntro.buttonHref}
                align={coverIntro.align}
                onLight
              />
            </div>
          ) : null}

          {showSectionNav ? (
            <nav
              aria-label="Product sections"
              className="sticky top-[4.25rem] z-20 border-b border-[color-mix(in_srgb,var(--sf-text)_10%,transparent)] bg-[var(--sf-bg)]/95 backdrop-blur-md sm:top-[4.5rem]"
            >
              <div
                className={cn(
                  contentClass,
                  'flex items-center gap-1 overflow-x-auto py-3.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                )}
              >
                {sectionLinks.map((section) => {
                  const active = activeSectionId === section.id
                  return (
                    <a
                      key={section.id}
                      href={`#section-${section.id}`}
                      aria-current={active ? 'true' : undefined}
                      className={cn(
                        'shrink-0 rounded-md px-3 py-2 text-base transition-colors',
                        active
                          ? 'font-semibold text-[var(--sf-text)]'
                          : 'font-normal text-[var(--sf-text)]/75 hover:text-[var(--sf-text)]',
                      )}
                    >
                      {section.name}
                    </a>
                  )
                })}
              </div>
            </nav>
          ) : null}

          <main className="flex-1">{catalogBlock}</main>
        </>
      )}

      <StorefrontFooter restaurant={restaurant} />
    </div>
  )
}

function CoverIntroCopy({
  title,
  description,
  buttonLabel,
  buttonHref,
  align = 'left',
  onLight,
}: {
  title?: string
  description?: string
  buttonLabel?: string
  buttonHref?: string
  align?: 'left' | 'centerBottom' | 'centerMiddle'
  onLight?: boolean
}) {
  const heading = title?.trim()
  const body = description?.trim()
  const cta = buttonLabel?.trim()
  const href = (buttonHref?.trim() || (cta ? '#section-featured' : '')) || undefined

  if (!heading && !body && !cta) return null

  const external = Boolean(href && /^https?:\/\//i.test(href))
  const ctaClass = cn(
    'mt-5 inline-flex items-center rounded-2xl px-5 py-2.5 text-base font-medium transition-transform hover:-translate-y-0.5',
    onLight ? 'bg-[var(--sf-button)] text-[var(--sf-button-text)]' : 'bg-white text-stone-900',
  )

  return (
    <div
      className={cn(
        'max-w-2xl',
        (align === 'centerBottom' || align === 'centerMiddle') && 'mx-auto',
      )}
    >
      {heading ? (
        <h1
          className={cn(
            'font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl',
            onLight ? 'text-[var(--sf-text)]' : 'text-white',
          )}
        >
          {heading}
        </h1>
      ) : null}
      {body ? (
        <p
          className={cn(
            'text-base leading-relaxed sm:text-lg',
            heading ? 'mt-3' : '',
            onLight ? 'text-[var(--sf-text)]/80' : 'text-white/95',
          )}
        >
          {body}
        </p>
      ) : null}
      {cta && href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className={ctaClass}>
            {cta}
          </a>
        ) : (
          <a href={href} className={ctaClass}>
            {cta}
          </a>
        )
      ) : null}
    </div>
  )
}

function FeaturedHero({
  entry,
  sales,
  onOpenItem,
  isItemOrderable,
  unavailableLabel,
}: {
  entry: CatalogItem
  sales: import('@/types').Sale[]
  onOpenItem: (item: MenuItem, priceOverride?: number) => void
  isItemOrderable: (item: MenuItem) => boolean
  unavailableLabel: (item: MenuItem) => string
}) {
  const { item, assignment } = entry
  const available = isItemOrderable(item)
  const listPrice = assignment.priceOverrideCents ?? item.basePriceCents
  const listed = resolveListedPrice(
    listPrice,
    item.id,
    sales,
    undefined,
    item.salePriceCents,
  )
  const blurb = item.shortDescription || item.fullDescription

  return (
    <section id="section-featured" className="mb-16 scroll-mt-40">
      <button
        type="button"
        disabled={!available}
        onClick={() => onOpenItem(item, listed.priceCents)}
        className={cn(
          'group grid w-full grid-cols-1 gap-6 text-left lg:grid-cols-2 lg:items-center lg:gap-12',
          available ? 'cursor-pointer' : 'cursor-not-allowed opacity-55',
        )}
      >
        <div className="relative overflow-hidden bg-[color-mix(in_srgb,var(--sf-primary)_6%,white)]">
          <MenuItemImage
            src={item.imageUrl}
            alt=""
            className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.02] sm:aspect-[5/4] lg:aspect-[4/5]"
            fallbackClassName="aspect-[4/5] w-full sm:aspect-[5/4] lg:aspect-[4/5]"
          />
          {!available ? (
            <span className="absolute left-4 top-4">
              <Badge tone="warning">{unavailableLabel(item)}</Badge>
            </span>
          ) : listed.onSale ? (
            <span className="absolute left-4 top-4">
              <Badge tone="accent">{listed.percentOff}% off</Badge>
            </span>
          ) : null}
        </div>
        <div className="flex flex-col justify-center px-0 lg:py-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[var(--sf-text)]/55">
            Featured
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--sf-text)] sm:text-4xl lg:text-5xl">
            {item.name}
          </h2>
          {blurb ? (
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--sf-text)]/75 sm:text-lg">
              {blurb}
            </p>
          ) : null}
          <div className="mt-5">
            <PriceDisplay
              listPriceCents={listed.listPriceCents}
              priceCents={listed.priceCents}
              onSale={listed.onSale}
              size="lg"
            />
          </div>
          <span className="mt-6 inline-flex w-fit items-center rounded-2xl bg-[var(--sf-button)] px-5 py-2.5 text-base font-medium text-[var(--sf-button-text)] transition-transform group-hover:-translate-y-0.5">
            {available ? 'View product' : unavailableLabel(item)}
          </span>
        </div>
      </button>
    </section>
  )
}

function ProductGrid({
  items,
  sales,
  onOpenItem,
  isItemOrderable,
  unavailableLabel,
}: {
  items: CatalogItem[]
  sales: import('@/types').Sale[]
  onOpenItem: (item: MenuItem, priceOverride?: number) => void
  isItemOrderable: (item: MenuItem) => boolean
  unavailableLabel: (item: MenuItem) => string
}) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
      {items.map(({ item, assignment }) => {
        const available = isItemOrderable(item)
        const listPrice = assignment.priceOverrideCents ?? item.basePriceCents
        const listed = resolveListedPrice(
          listPrice,
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
              onClick={() => onOpenItem(item, listed.priceCents)}
              className={cn(
                'group w-full cursor-pointer text-left',
                available ? '' : 'cursor-not-allowed opacity-50',
              )}
            >
              <div className="relative overflow-hidden bg-[color-mix(in_srgb,var(--sf-primary)_6%,white)]">
                <MenuItemImage
                  src={item.imageUrl}
                  alt=""
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  fallbackClassName="aspect-square w-full"
                />
                {!available ? (
                  <span className="absolute left-3 top-3">
                    <Badge tone="warning">{unavailableLabel(item)}</Badge>
                  </span>
                ) : listed.onSale ? (
                  <span className="absolute left-3 top-3">
                    <Badge tone="accent">{listed.percentOff}% off</Badge>
                  </span>
                ) : null}
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-lg font-medium leading-snug tracking-tight text-[var(--sf-text)]">
                  {item.name}
                </p>
                <PriceDisplay
                  listPriceCents={listed.listPriceCents}
                  priceCents={listed.priceCents}
                  onSale={listed.onSale}
                />
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
