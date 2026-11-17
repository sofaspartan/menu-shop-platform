import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Search, X } from 'lucide-react'
import type { Restaurant } from '@/types'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { storeCopy } from '@/lib/storeCopy'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'

export function RetailChrome({
  restaurant,
  search,
  onSearchChange,
  showSearch = true,
}: {
  restaurant: Restaurant
  search?: string
  onSearchChange?: (value: string) => void
  showSearch?: boolean
}) {
  const location = useLocation()
  const copy = storeCopy(restaurant.storeKind)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(Boolean(search))
  const base = `/r/${restaurant.slug}`
  const pages = restaurant.pages
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)

  const links = [
    { to: base, label: 'Shop', end: true },
    pages?.about?.enabled
      ? { to: `${base}/about`, label: pages.about.title || 'About', end: false }
      : null,
    pages?.contact?.enabled
      ? { to: `${base}/contact`, label: pages.contact.title || 'Contact', end: false }
      : null,
  ].filter(Boolean) as Array<{ to: string; label: string; end: boolean }>

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  function isActive(link: { to: string; end: boolean }) {
    return link.end
      ? location.pathname === link.to || location.pathname.startsWith(`${base}/menu/`)
      : location.pathname === link.to
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[color-mix(in_srgb,var(--sf-text)_10%,transparent)] bg-[var(--sf-bg)]/95 backdrop-blur-md">
        <div className={cn(contentClass, 'flex items-center justify-between gap-4 py-3.5')}>
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
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    'rounded-md px-3 py-2 text-base transition-colors',
                    isActive(link)
                      ? 'font-semibold text-[var(--sf-text)]'
                      : 'text-[var(--sf-text)]/75 hover:text-[var(--sf-text)]',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {showSearch && onSearchChange ? (
              <button
                type="button"
                aria-label={searchOpen ? 'Close search' : 'Search'}
                aria-expanded={searchOpen}
                onClick={() => {
                  setSearchOpen((v) => !v)
                  if (searchOpen) onSearchChange('')
                  setMenuOpen(false)
                }}
                className="hidden h-10 w-10 items-center justify-center rounded-full text-[var(--sf-text)]/70 hover:bg-[var(--sf-surface)] hover:text-[var(--sf-text)] md:inline-flex"
              >
                {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
              </button>
            ) : null}

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--sf-text)]/80 hover:bg-[var(--sf-surface)] hover:text-[var(--sf-text)] md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((v) => !v)
                setSearchOpen(false)
              }}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {showSearch && searchOpen && onSearchChange ? (
          <div className="hidden border-t border-[color-mix(in_srgb,var(--sf-text)_8%,transparent)] py-3 md:block">
            <div className={contentClass}>
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

        {menuOpen ? (
          <div className="border-t border-[color-mix(in_srgb,var(--sf-text)_8%,transparent)] py-4 md:hidden">
            <div className={cn(contentClass, 'space-y-4')}>
              <nav className="flex flex-col gap-1">
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'rounded-lg px-3 py-3 text-base',
                      isActive(link)
                        ? 'bg-[var(--sf-text)] font-semibold text-[var(--sf-bg)]'
                        : 'text-[var(--sf-text)]/85 hover:bg-[var(--sf-surface)]',
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              {showSearch && onSearchChange ? (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--sf-text)]/40" />
                  <input
                    type="search"
                    value={search ?? ''}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={`Search ${copy.itemNounPlural.toLowerCase()}…`}
                    className="h-12 w-full rounded-xl border border-stone-200 bg-[var(--sf-surface)] py-2 pl-11 pr-4 text-base text-[var(--sf-text)] outline-none ring-[var(--sf-primary)] placeholder:text-[var(--sf-text)]/45 focus:ring-2"
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
    </header>
  )
}
