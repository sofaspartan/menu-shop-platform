import { Link, useLocation } from 'react-router-dom'
import type { Restaurant } from '@/types'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'

export function StorefrontNav({ restaurant }: { restaurant: Restaurant }) {
  const location = useLocation()
  const copy = storeCopy(restaurant.storeKind)
  const pages = restaurant.pages
  const base = `/r/${restaurant.slug}`

  const links = [
    { to: base, label: copy.isRetail ? 'Shop' : 'Menu', end: true },
    pages?.about?.enabled
      ? { to: `${base}/about`, label: pages.about.title || 'About', end: false }
      : null,
    pages?.contact?.enabled
      ? { to: `${base}/contact`, label: pages.contact.title || 'Contact', end: false }
      : null,
  ].filter(Boolean) as Array<{ to: string; label: string; end: boolean }>

  if (links.length <= 1) return null

  return (
    <nav className="mb-3 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-[var(--sf-button)] text-[var(--sf-button-text)]'
                : 'bg-[var(--sf-surface)] text-[var(--sf-text)]/75 ring-1 ring-stone-200/80 hover:bg-white',
            )}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
