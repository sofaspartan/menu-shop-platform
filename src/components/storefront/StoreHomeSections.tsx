import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type {
  HomeSection,
  MenuItem,
  MenuItemAssignment,
  Restaurant,
} from '@/types'
import { normalizeStoreHome } from '@/types'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { PriceDisplay } from '@/components/storefront/PriceDisplay'
import { Button } from '@/components/ui/Button'
import { useDb } from '@/hooks/useDb'
import { resolveListedPrice } from '@/lib/commerce'
import { logoImageClass } from '@/lib/logoStyle'
import { storeCopy } from '@/lib/storeCopy'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'

type FeaturedEntry = {
  item: MenuItem
  assignment?: Pick<MenuItemAssignment, 'priceOverrideCents'>
}

function resolveHref(restaurant: Restaurant, href?: string): string {
  const raw = (href || '').trim()
  if (!raw) return `/r/${restaurant.slug}`
  if (raw.startsWith('http') || raw.startsWith('#') || raw.startsWith('/')) return raw
  if (raw === 'about') return `/r/${restaurant.slug}/about`
  if (raw === 'contact') return `/r/${restaurant.slug}/contact`
  return `/r/${restaurant.slug}/${raw.replace(/^\//, '')}`
}

export function useHomeSections(restaurant: Restaurant | null | undefined): HomeSection[] {
  return useMemo(() => {
    if (!restaurant) return []
    const home = normalizeStoreHome(
      restaurant.pages?.home,
      restaurant.storeKind ?? 'restaurant',
    )
    if (!home.enabled) return []
    return home.sections.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  }, [restaurant])
}

export function isStoreHomeEnabled(restaurant: Restaurant | null | undefined): boolean {
  if (!restaurant) return false
  return normalizeStoreHome(
    restaurant.pages?.home,
    restaurant.storeKind ?? 'restaurant',
  ).enabled
}

export function HomeSplashSection({
  restaurant,
  section,
}: {
  restaurant: Restaurant
  section: HomeSection
}) {
  const image = restaurant.coverImageUrl
  const layout = section.splashLayout === 'fullBleedBottom' ? 'fullBleedBottom' : 'fullBleedCenter'
  const logoStyle = section.logoStyle === 'roundedSquare' ? 'roundedSquare' : 'natural'

  return (
    <section className="relative isolate min-h-[88vh] w-full overflow-hidden">
      {image ? (
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--sf-primary) 85%, black), color-mix(in srgb, var(--sf-accent) 65%, var(--sf-primary)))',
          }}
        />
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div
        className={cn(
          'relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col px-6 py-16 text-white sm:px-10',
          layout === 'fullBleedCenter'
            ? 'items-center justify-center text-center'
            : 'items-start justify-end pb-20 text-left',
        )}
      >
        {section.showLogo !== false && restaurant.logoUrl ? (
          <img
            src={restaurant.logoUrl}
            alt=""
            className={cn(
              'mb-8',
              logoImageClass(logoStyle, 'splash'),
              layout === 'fullBleedCenter' && 'mx-auto',
            )}
          />
        ) : null}
        {section.showTitle !== false && section.title ? (
          <h1
            className="max-w-3xl font-display text-4xl font-semibold tracking-tight sm:text-6xl"
            style={{ fontFamily: 'var(--sf-heading, var(--brand-heading))' }}
          >
            {section.title}
          </h1>
        ) : null}
        {section.showSubtitle !== false && section.subtitle ? (
          <p
            className={cn(
              'mt-4 max-w-xl text-base text-white/85 sm:text-lg',
              layout === 'fullBleedCenter' && 'mx-auto',
            )}
          >
            {section.subtitle}
          </p>
        ) : null}
        {section.primaryButtonLabel || section.secondaryButtonLabel ? (
          <div
            className={cn(
              'mt-8 flex flex-wrap gap-3',
              layout === 'fullBleedCenter' && 'justify-center',
            )}
          >
            {section.primaryButtonLabel ? (
              <Link to={resolveHref(restaurant, section.primaryButtonHref)}>
                <Button className="bg-white text-stone-900 hover:bg-white/90">
                  {section.primaryButtonLabel}
                </Button>
              </Link>
            ) : null}
            {section.secondaryButtonLabel ? (
              <Link to={resolveHref(restaurant, section.secondaryButtonHref)}>
                <Button
                  variant="outline"
                  className="border-white/50 bg-transparent text-white hover:bg-white/10"
                >
                  {section.secondaryButtonLabel}
                </Button>
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function HomeAboutTeaserSection({
  restaurant,
  section,
}: {
  restaurant: Restaurant
  section: HomeSection
}) {
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)
  const layout = section.aboutLayout ?? 'splitImageRight'
  const image =
    section.aboutImageUrl ||
    restaurant.pages?.about?.heroImageUrl ||
    restaurant.coverImageUrl
  const title = section.aboutTitle || restaurant.pages?.about?.title || 'About'
  const body =
    section.aboutBody ||
    restaurant.pages?.about?.subtitle ||
    restaurant.pages?.about?.body?.slice(0, 220) ||
    restaurant.description
  const buttonLabel = section.aboutButtonLabel || 'Learn more'
  const aboutHref = `/r/${restaurant.slug}/about`

  const copyBlock = (
    <div className="flex flex-col justify-center">
      <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--sf-text)] sm:text-4xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-base leading-relaxed text-[var(--sf-text)]/70 sm:text-lg">
          {body}
        </p>
      ) : null}
      {restaurant.pages?.about?.enabled !== false ? (
        <div className="mt-6">
          <Link to={aboutHref}>
            <Button>{buttonLabel}</Button>
          </Link>
        </div>
      ) : null}
    </div>
  )

  const media = image ? (
    <div className="overflow-hidden rounded-[var(--sf-radius,1rem)]">
      <img src={image} alt="" className="aspect-[4/5] w-full object-cover sm:aspect-[5/4]" />
    </div>
  ) : (
    <div
      className="aspect-[4/5] rounded-[var(--sf-radius,1rem)] sm:aspect-[5/4]"
      style={{
        background:
          'linear-gradient(145deg, color-mix(in srgb, var(--sf-primary) 35%, white), color-mix(in srgb, var(--sf-accent) 25%, white))',
      }}
    />
  )

  if (layout === 'stacked') {
    return (
      <section className={cn(contentClass, 'px-4 py-16 sm:px-6')}>
        <div className="mx-auto max-w-3xl space-y-8 text-center">{media}{copyBlock}</div>
      </section>
    )
  }

  return (
    <section className={cn(contentClass, 'px-4 py-16 sm:px-6')}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        {layout === 'splitImageLeft' ? (
          <>
            {copyBlock}
            {media}
          </>
        ) : (
          <>
            {media}
            {copyBlock}
          </>
        )}
      </div>
    </section>
  )
}

export function HomeFeaturedSection({
  restaurant,
  section,
  featured,
  onOpenItem,
}: {
  restaurant: Restaurant
  section: HomeSection
  featured: FeaturedEntry[]
  onOpenItem?: (item: MenuItem, priceOverride?: number) => void
}) {
  const { db } = useDb()
  const sales = useMemo(
    () => (db ? db.sales.filter((s) => s.restaurantId === restaurant.id) : []),
    [db, restaurant.id],
  )
  const copy = storeCopy(restaurant.storeKind)
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)
  const layout = section.featuredLayout === 'grid' ? 'grid' : 'carousel'
  const limit = layout === 'carousel' ? featured.length : section.featuredCount ?? 4
  const items = featured.slice(0, Math.max(1, limit))
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (layout !== 'carousel' || items.length <= 1) return
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % items.length)
    }, 5000)
    return () => window.clearInterval(id)
  }, [layout, items.length])

  if (!items.length) return null

  if (layout === 'carousel') {
    const entry = items[Math.min(index, items.length - 1)]
    const listed = resolveListedPrice(
      entry.assignment?.priceOverrideCents ?? entry.item.basePriceCents,
      entry.item.id,
      sales,
      undefined,
      entry.item.salePriceCents,
    )
    return (
      <section id="section-featured" className={cn(contentClass, 'px-4 py-16 sm:px-6')}>
        <div className="mb-8 flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--sf-text)]">
            Featured
          </h2>
          {items.length > 1 ? (
            <div className="flex gap-2">
              {items.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Featured ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-2 rounded-full transition-all',
                    i === index ? 'w-6 bg-[var(--sf-primary)]' : 'w-2 bg-[var(--sf-text)]/20',
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onOpenItem?.(entry.item, listed.priceCents)}
          className="grid w-full overflow-hidden rounded-[var(--sf-radius,1.25rem)] border border-[color-mix(in_srgb,var(--sf-text)_10%,transparent)] bg-[var(--sf-surface)] text-left transition hover:border-[var(--sf-primary)] lg:grid-cols-2"
        >
          <div className="aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[360px]">
            <MenuItemImage
              src={entry.item.imageUrl}
              alt=""
              storeKind={restaurant.storeKind}
              className="h-full w-full object-cover"
              fallbackClassName="h-full min-h-[240px] w-full"
            />
          </div>
          <div className="flex flex-col justify-center p-8 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--sf-accent)]">
              Featured {copy.itemNoun}
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold text-[var(--sf-text)]">
              {entry.item.name}
            </h3>
            {entry.item.shortDescription ? (
              <p className="mt-3 text-[var(--sf-text)]/70">{entry.item.shortDescription}</p>
            ) : null}
            <div className="mt-6">
              <PriceDisplay
                listPriceCents={listed.listPriceCents}
                priceCents={listed.priceCents}
                onSale={listed.onSale}
                size="lg"
              />
            </div>
          </div>
        </button>
      </section>
    )
  }

  return (
    <section id="section-featured" className={cn(contentClass, 'px-4 py-16 sm:px-6')}>
      <h2 className="mb-8 font-display text-3xl font-semibold tracking-tight text-[var(--sf-text)]">
        Featured
      </h2>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((entry) => {
          const listed = resolveListedPrice(
            entry.assignment?.priceOverrideCents ?? entry.item.basePriceCents,
            entry.item.id,
            sales,
            undefined,
            entry.item.salePriceCents,
          )
          return (
            <li key={entry.item.id}>
              <button
                type="button"
                onClick={() => onOpenItem?.(entry.item, listed.priceCents)}
                className="group w-full text-left"
              >
                <div className="aspect-square overflow-hidden rounded-[var(--sf-radius,1rem)]">
                  <MenuItemImage
                    src={entry.item.imageUrl}
                    alt=""
                    storeKind={restaurant.storeKind}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    fallbackClassName="h-full w-full"
                  />
                </div>
                <p className="mt-3 font-medium text-[var(--sf-text)]">{entry.item.name}</p>
                <PriceDisplay
                  listPriceCents={listed.listPriceCents}
                  priceCents={listed.priceCents}
                  onSale={listed.onSale}
                  className="mt-1"
                />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** Renders splash / about / featured; catalog is left to the parent. */
export function HomeMarketingSections({
  restaurant,
  sections,
  featured,
  onOpenItem,
}: {
  restaurant: Restaurant
  sections: HomeSection[]
  featured: FeaturedEntry[]
  onOpenItem?: (item: MenuItem, priceOverride?: number) => void
}) {
  return (
    <>
      {sections.map((section) => {
        if (section.kind === 'splash') {
          return (
            <HomeSplashSection key={section.id} restaurant={restaurant} section={section} />
          )
        }
        if (section.kind === 'aboutTeaser') {
          return (
            <HomeAboutTeaserSection
              key={section.id}
              restaurant={restaurant}
              section={section}
            />
          )
        }
        if (section.kind === 'featured') {
          return (
            <HomeFeaturedSection
              key={section.id}
              restaurant={restaurant}
              section={section}
              featured={featured}
              onOpenItem={onOpenItem}
            />
          )
        }
        return null
      })}
    </>
  )
}
