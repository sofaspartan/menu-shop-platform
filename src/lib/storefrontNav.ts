import type { Restaurant } from '@/types'
import { normalizeStoreHome } from '@/types'
import { storeCopy } from '@/lib/storeCopy'

function homeEnabled(restaurant: Restaurant): boolean {
  return normalizeStoreHome(
    restaurant.pages?.home,
    restaurant.storeKind ?? 'restaurant',
  ).enabled
}

export type StorefrontNavLink = {
  to: string
  label: string
  /** Exact match for root-style links; shop also matches /menu/:slug. */
  end: boolean
  kind: 'home' | 'shop' | 'page'
}

export function storefrontBase(slug: string) {
  return `/r/${slug}`
}

export function storefrontShopPath(slug: string) {
  return `/r/${slug}/shop`
}

export function storefrontHomePath(slug: string) {
  return `/r/${slug}`
}

/** Nav links: Home first when homepage is enabled, then Shop/Menu, About, Contact. */
export function storefrontNavLinks(restaurant: Restaurant): StorefrontNavLink[] {
  const copy = storeCopy(restaurant.storeKind)
  const base = storefrontBase(restaurant.slug)
  const shop = storefrontShopPath(restaurant.slug)
  const pages = restaurant.pages
  const homeOn = homeEnabled(restaurant)
  const shopLabel = copy.isRetail ? 'Shop' : 'Menu'

  const links: StorefrontNavLink[] = homeOn
    ? [
        { to: base, label: 'Home', end: true, kind: 'home' },
        { to: shop, label: shopLabel, end: false, kind: 'shop' },
      ]
    : [{ to: base, label: shopLabel, end: true, kind: 'shop' }]

  if (pages?.about?.enabled) {
    links.push({
      to: `${base}/about`,
      label: pages.about.title || 'About',
      end: false,
      kind: 'page',
    })
  }
  if (pages?.contact?.enabled) {
    links.push({
      to: `${base}/contact`,
      label: pages.contact.title || 'Contact',
      end: false,
      kind: 'page',
    })
  }

  return links
}

export function isStorefrontShopPath(pathname: string, slug: string): boolean {
  const base = storefrontBase(slug)
  const shop = storefrontShopPath(slug)
  return (
    pathname === shop ||
    pathname.startsWith(`${shop}/`) ||
    pathname.startsWith(`${base}/menu/`)
  )
}

export function isStorefrontNavActive(
  link: StorefrontNavLink,
  pathname: string,
  slug: string,
): boolean {
  const base = storefrontBase(slug)
  if (link.kind === 'shop') {
    if (link.end) {
      // Homepage off: root is the shop.
      return pathname === base || isStorefrontShopPath(pathname, slug)
    }
    return isStorefrontShopPath(pathname, slug)
  }
  if (link.end) return pathname === link.to
  return pathname === link.to
}

/** Logo / brand mark destination. */
export function storefrontBrandHref(restaurant: Restaurant): string {
  return homeEnabled(restaurant)
    ? storefrontHomePath(restaurant.slug)
    : storefrontBase(restaurant.slug)
}
