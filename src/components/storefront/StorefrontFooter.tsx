import { Link } from 'react-router-dom'
import type { Restaurant } from '@/types'
import { normalizeStoreFooter } from '@/types'
import { logoImageClass } from '@/lib/logoStyle'
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

  const links: Array<{ to: string; label: string }> = [{ to: base, label: 'Home' }]
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
          'flex flex-col gap-6 px-4 py-12 sm:px-6 lg:flex-row lg:items-start lg:justify-between',
        )}
      >
        <div className="max-w-sm space-y-3">
          {footer.showLogo !== false && restaurant.logoUrl ? (
            <img
              src={restaurant.logoUrl}
              alt=""
              className={logoImageClass('natural', 'footer')}
            />
          ) : null}
          <p className="font-display text-xl font-semibold tracking-tight text-[var(--sf-text)]">
            {company}
          </p>
          <p className="text-sm text-[var(--sf-text)]/55">{copyright}</p>
        </div>
        {footer.showPageLinks && links.length > 0 ? (
          <nav className="flex flex-wrap gap-1 lg:justify-end">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="rounded-md px-3 py-2 text-sm text-[var(--sf-text)]/75 transition-colors hover:text-[var(--sf-text)]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      {footer.showPoweredBy !== false ? (
        <div className="border-t border-[color-mix(in_srgb,var(--sf-text)_8%,transparent)] px-4 py-3 text-center text-xs text-[var(--sf-text)]/45">
          Powered by{' '}
          <a href="/" className="font-medium text-[var(--sf-text)]/65 hover:text-[var(--sf-text)]">
            MenuShop
          </a>
        </div>
      ) : null}
    </footer>
  )
}
