import { Link } from 'react-router-dom'
import type { Menu, MenuItem, MenuItemAssignment, MenuSection, Restaurant } from '@/types'
import { RetailChrome } from '@/components/storefront/RetailChrome'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { storeCopy } from '@/lib/storeCopy'
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
  bagCount,
  bagPulse,
  onOpenBag,
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
  bagCount: number
  bagPulse: boolean
  onOpenBag: () => void
  onOpenItem: (item: MenuItem, priceOverride?: number) => void
  isItemOrderable: (item: MenuItem) => boolean
  unavailableLabel: (item: MenuItem) => string
}) {
  const copy = storeCopy(restaurant.storeKind)
  const showHero =
    restaurant.branding.coverDisplay !== 'none' && Boolean(restaurant.coverImageUrl)

  return (
    <>
      <RetailChrome
        restaurant={restaurant}
        bagCount={bagCount}
        bagPulse={bagPulse}
        onOpenBag={onOpenBag}
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
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-8 sm:px-6 sm:pb-10">
              <p className="max-w-xl text-sm text-white/85 sm:text-base">
                {restaurant.description}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-6xl px-4 pb-2 pt-8 sm:px-6">
          <p className="max-w-2xl text-[15px] leading-relaxed text-[var(--sf-text)]/70">
            {restaurant.description}
          </p>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        {menus.length > 1 ? (
          <div className="mb-8 flex flex-wrap gap-2">
            {menus.map((menu) => {
              const active = selectedMenu?.id === menu.id
              return (
                <Link
                  key={menu.id}
                  to={`/r/${restaurant.slug}/menu/${menu.slug}`}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm transition-colors',
                    active
                      ? 'bg-[var(--sf-text)] font-medium text-[var(--sf-bg)]'
                      : 'text-[var(--sf-text)]/60 hover:text-[var(--sf-text)]',
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
            {sectionItems.length > 1 && !search ? (
              <div className="mb-10 flex gap-5 overflow-x-auto border-b border-[color-mix(in_srgb,var(--sf-text)_10%,transparent)] pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sectionItems.map(({ section }) => (
                  <a
                    key={section.id}
                    href={`#section-${section.id}`}
                    className="shrink-0 text-sm text-[var(--sf-text)]/55 transition-colors hover:text-[var(--sf-text)]"
                  >
                    {section.name}
                  </a>
                ))}
              </div>
            ) : null}

            {featured.length > 0 && !search ? (
              <section className="mb-14">
                <h2 className="mb-6 font-display text-2xl tracking-tight text-[var(--sf-text)] sm:text-3xl">
                  Featured
                </h2>
                <ProductGrid
                  items={featured}
                  onOpenItem={onOpenItem}
                  isItemOrderable={isItemOrderable}
                  unavailableLabel={unavailableLabel}
                />
              </section>
            ) : null}

            {sectionItems.map(({ section, items }) => (
              <section
                key={section.id}
                id={`section-${section.id}`}
                className="mb-16 scroll-mt-28"
              >
                <div className="mb-6">
                  <h2 className="font-display text-2xl tracking-tight text-[var(--sf-text)] sm:text-3xl">
                    {section.name}
                  </h2>
                  {section.description ? (
                    <p className="mt-2 max-w-2xl text-sm text-[var(--sf-text)]/55">
                      {section.description}
                    </p>
                  ) : null}
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-[var(--sf-text)]/50">No products match.</p>
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
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-3 xl:grid-cols-4">
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
              <div className="mt-3.5 space-y-1">
                <p className="text-[15px] font-medium leading-snug tracking-tight text-[var(--sf-text)]">
                  {item.name}
                </p>
                <p className="text-sm text-[var(--sf-text)]/70">{formatMoney(price)}</p>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
