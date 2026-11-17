import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, X } from 'lucide-react'
import type { Restaurant } from '@/types'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'

export function RetailChrome({
  restaurant,
  bagCount = 0,
  bagPulse = false,
  onOpenBag,
  search,
  onSearchChange,
  showSearch = true,
}: {
  restaurant: Restaurant
  bagCount?: number
  bagPulse?: boolean
  onOpenBag?: () => void
  search?: string
  onSearchChange?: (value: string) => void
  showSearch?: boolean
}) {
  const location = useLocation()
  const copy = storeCopy(restaurant.storeKind)
  const [searchOpen, setSearchOpen] = useState(Boolean(search))
  const base = `/r/${restaurant.slug}`
  const pages = restaurant.pages

  const links = [
    { to: base, label: 'Shop', end: true },
    pages?.about?.enabled
      ? { to: `${base}/about`, label: pages.about.title || 'About', end: false }
      : null,
    pages?.contact?.enabled
      ? { to: `${base}/contact`, label: pages.contact.title || 'Contact', end: false }
      : null,
  ].filter(Boolean) as Array<{ to: string; label: string; end: boolean }>

  return (
    <header className="sticky top-0 z-30 border-b border-[color-mix(in_srgb,var(--sf-text)_10%,transparent)] bg-[var(--sf-bg)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
        <Link to={base} className="flex min-w-0 items-center gap-3">
          {restaurant.logoUrl ? (
            <MenuItemImage
              src={restaurant.logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover sm:h-10 sm:w-10"
              fallbackClassName="h-9 w-9 shrink-0 rounded-full sm:h-10 sm:w-10"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sf-primary)] text-sm font-semibold text-white sm:h-10 sm:w-10">
              {restaurant.name.slice(0, 1)}
            </span>
          )}
          <span className="truncate font-display text-xl tracking-tight text-[var(--sf-text)] sm:text-2xl">
            {restaurant.name}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = link.end
                ? location.pathname === link.to ||
                  location.pathname.startsWith(`${base}/menu/`)
                : location.pathname === link.to
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'rounded-md px-3 py-2 text-base transition-colors',
                    active
                      ? 'font-semibold text-[var(--sf-text)]'
                      : 'text-[var(--sf-text)]/75 hover:text-[var(--sf-text)]',
                  )}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {showSearch && onSearchChange ? (
            <button
              type="button"
              aria-label={searchOpen ? 'Close search' : 'Search'}
              aria-expanded={searchOpen}
              onClick={() => {
                setSearchOpen((v) => !v)
                if (searchOpen) onSearchChange('')
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--sf-text)]/70 hover:bg-[var(--sf-surface)] hover:text-[var(--sf-text)]"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
          ) : null}

          {onOpenBag ? (
            <button
              type="button"
              data-bag-target
              aria-label={`Open ${copy.bagNoun}`}
              onClick={onOpenBag}
              className={cn(
                'relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--sf-text)]/70 hover:bg-[var(--sf-surface)] hover:text-[var(--sf-text)]',
                bagPulse && 'bag-catch-pulse',
              )}
            >
              <ShoppingBag className="h-5 w-5" />
              {bagCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-button)] px-1 text-xs font-semibold text-[var(--sf-button-text)]">
                  {bagCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      {/* Mobile page links */}
      <div className="flex gap-1 overflow-x-auto border-t border-[color-mix(in_srgb,var(--sf-text)_8%,transparent)] px-4 py-2 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {links.map((link) => {
          const active = link.end
            ? location.pathname === link.to ||
              location.pathname.startsWith(`${base}/menu/`)
            : location.pathname === link.to
          return (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-base',
                active
                  ? 'bg-[var(--sf-text)] text-[var(--sf-bg)]'
                  : 'text-[var(--sf-text)]/75',
              )}
            >
              {link.label}
            </Link>
          )
        })}
      </div>

      {showSearch && searchOpen && onSearchChange ? (
        <div className="border-t border-[color-mix(in_srgb,var(--sf-text)_8%,transparent)] px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <input
              autoFocus
              type="search"
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${copy.itemNounPlural.toLowerCase()}…`}
              className="h-12 w-full rounded-xl border border-stone-200 bg-[var(--sf-surface)] px-4 text-base text-[var(--sf-text)] outline-none ring-[var(--sf-primary)] placeholder:text-[var(--sf-text)]/45 focus:ring-2"
            />
          </div>
        </div>
      ) : null}
    </header>
  )
}
