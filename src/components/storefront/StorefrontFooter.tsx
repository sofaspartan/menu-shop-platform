import { Link } from 'react-router-dom'
import type { Restaurant } from '@/types'
import { normalizeStoreFooter } from '@/types'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'

export function StorefrontFooter({ restaurant }: { restaurant: Restaurant }) {
  const footer = normalizeStoreFooter(restaurant.pages?.footer)
  if (!footer.enabled) return null

  const base = `/r/${restaurant.slug}`
  const company = (footer.companyName?.trim() || restaurant.name).trim()
  const year = new Date().getFullYear()
  const copyright =
    footer.copyright?.trim() || `© ${year} ${company}. All rights reserved.`

  const links: Array<{ to: string; label: string }> = [{ to: base, label: 'Shop' }]
  if (restaurant.pages?.about?.enabled) {
    links.push({ to: `${base}/about`, label: restaurant.pages.about.title || 'About' })
  }
  if (restaurant.pages?.contact?.enabled) {
    links.push({
      to: `${base}/contact`,
      label: restaurant.pages.contact.title || 'Contact',
    })
  }

  return (
    <footer className="mt-auto border-t border-[color-mix(in_srgb,var(--sf-text)_12%,transparent)] bg-[var(--sf-bg)]">
      <div
        className={cn(
          storefrontContentClass(restaurant.storefrontWidth),
          'flex flex-col items-center gap-4 px-4 py-10 text-center sm:px-6',
        )}
      >
        <p className="font-display text-xl font-semibold tracking-tight text-[var(--sf-text)] sm:text-2xl">
          {company}
        </p>
        {footer.showPageLinks && links.length > 0 ? (
          <nav className="flex flex-wrap items-center justify-center gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-3 py-2 text-base text-[var(--sf-text)]/75 transition-colors hover:text-[var(--sf-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
        <p className="text-sm text-[var(--sf-text)]/55">{copyright}</p>
      </div>
    </footer>
  )
}
