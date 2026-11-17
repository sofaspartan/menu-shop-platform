import { Link } from 'react-router-dom'
import type { Menu, MenuItem, MenuItemAssignment, MenuSection, Restaurant } from '@/types'
import { RetailChrome } from '@/components/storefront/RetailChrome'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { storeCopy } from '@/lib/storeCopy'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { formatMoney, cn } from '@/lib/utils'

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
  const copy = storeCopy(restaurant.storeKind)
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)
  const showHero =
    restaurant.branding.coverDisplay !== 'none' && Boolean(restaurant.coverImageUrl)
  const featuredHero = featured[0] ?? null
  const sectionLinks =
    sectionItems.length > 1 && !search
      ? sectionItems.map(({ section }) => ({ id: section.id, name: section.name }))
      : undefined

  return (
    <>
      <RetailChrome
        restaurant={restaurant}
        search={search}
        onSearchChange={onSearchChange}
      />

      {showHero ? (
        <div className="relative w-full overflow-hidden">
          <div className="relative aspect-[21/9] min-h-[200px] max-h-[360px] w-full sm:min-h-[260px]">
            <img
              src={restaurant.coverImageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent" />
            <div className={cn(contentClass, 'absolute inset-x-0 bottom-0 pb-8 sm:pb-10')}>
              <p className="max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
                {restaurant.description}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className={cn(contentClass, 'pb-2 pt-8')}>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--sf-text)]/80 sm:text-lg">
            {restaurant.description}
          </p>
        </div>
      )}

      {/* Sits under the cover; sticks under the site header once you scroll past it. */}
      {sectionLinks ? (
        <nav
          aria-label="Product sections"
          className="sticky top-[4.25rem] z-20 border-b border-[color-mix(in_srgb,var(--sf-text)_10%,transparent)] bg-[var(--sf-bg)]/95 backdrop-blur-md sm:top-[4.5rem]"
        >
          <div
            className={cn(
              contentClass,
              'flex gap-5 overflow-x-auto py-2.5 sm:gap-6 sm:py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            )}
          >
            {sectionLinks.map((section) => (
              <a
                key={section.id}
                href={`#section-${section.id}`}
                className="shrink-0 text-base text-[var(--sf-text)]/70 transition-colors hover:text-[var(--sf-text)]"
              >
                {section.name}
              </a>
            ))}
          </div>
        </nav>
      ) : null}

      <main className={cn(contentClass, 'pb-28 pt-8')}>
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
            {featuredHero && !search ? (
              <FeaturedHero
                entry={featuredHero}
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
                    onOpenItem={onOpenItem}
                    isItemOrderable={isItemOrderable}
                    unavailableLabel={unavailableLabel}
                  />
                )}
              </section>
            ))}
          </>
        )}
      </main>
    </>
  )
}

function FeaturedHero({
  entry,
  onOpenItem,
  isItemOrderable,
  unavailableLabel,
}: {
  entry: CatalogItem
  onOpenItem: (item: MenuItem, priceOverride?: number) => void
  isItemOrderable: (item: MenuItem) => boolean
  unavailableLabel: (item: MenuItem) => string
}) {
  const { item, assignment } = entry
  const available = isItemOrderable(item)
  const price = assignment.priceOverrideCents ?? item.basePriceCents
  const blurb = item.shortDescription || item.fullDescription

  return (
    <section className="mb-16">
      <button
        type="button"
        disabled={!available}
        onClick={() => onOpenItem(item, assignment.priceOverrideCents)}
        className={cn(
          'group grid w-full gap-6 text-left lg:grid-cols-2 lg:items-center lg:gap-12',
          available ? '' : 'cursor-not-allowed opacity-55',
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
          <p className="mt-5 text-xl text-[var(--sf-text)]">{formatMoney(price)}</p>
          <span className="mt-6 inline-flex w-fit items-center rounded-full bg-[var(--sf-button)] px-5 py-2.5 text-base font-medium text-[var(--sf-button-text)] transition-transform group-hover:-translate-y-0.5">
            {available ? 'View product' : unavailableLabel(item)}
          </span>
        </div>
      </button>
    </section>
  )
}

function ProductGrid({
  items,
  onOpenItem,
  isItemOrderable,
  unavailableLabel,
}: {
  items: CatalogItem[]
  onOpenItem: (item: MenuItem, priceOverride?: number) => void
  isItemOrderable: (item: MenuItem) => boolean
  unavailableLabel: (item: MenuItem) => string
}) {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-14">
      {items.map(({ item, assignment }) => {
        const available = isItemOrderable(item)
        const price = assignment.priceOverrideCents ?? item.basePriceCents
        return (
          <li key={assignment.id}>
            <button
              type="button"
              disabled={!available}
              onClick={() => onOpenItem(item, assignment.priceOverrideCents)}
              className={cn(
                'group w-full text-left',
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
                ) : null}
              </div>
              <div className="mt-4 space-y-1.5">
                <p className="text-lg font-medium leading-snug tracking-tight text-[var(--sf-text)]">
                  {item.name}
                </p>
                <p className="text-base text-[var(--sf-text)]/80">{formatMoney(price)}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
