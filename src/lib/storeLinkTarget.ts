import type { Restaurant } from '@/types'

/** Where a storefront CTA / hero button should go. */
export type StoreLinkKind =
  | 'shop'
  | 'about'
  | 'contact'
  | 'home'
  | 'featured'
  | 'aboutSection'
  | 'path'
  | 'url'

export interface StoreLinkTarget {
  kind: StoreLinkKind
  /** Relative path under `/r/:slug/` when kind is `path` (e.g. `menu/lunch`). */
  path?: string
  /** Absolute http(s) URL when kind is `url`. */
  url?: string
}

export const STORE_LINK_KIND_OPTIONS: Array<{ value: StoreLinkKind; label: string }> = [
  { value: 'shop', label: 'Shop / Menu' },
  { value: 'about', label: 'About page' },
  { value: 'contact', label: 'Contact page' },
  { value: 'home', label: 'Home (top)' },
  { value: 'featured', label: 'Featured section' },
  { value: 'aboutSection', label: 'About teaser (home)' },
  { value: 'path', label: 'Named page / path' },
  { value: 'url', label: 'Custom URL' },
]

/** Infer a structured target from a legacy free-text href. */
export function parseStoreLinkHref(href?: string | null): StoreLinkTarget {
  const raw = (href || '').trim()
  if (!raw) return { kind: 'shop' }

  if (/^https?:\/\//i.test(raw)) return { kind: 'url', url: raw }
  if (raw === '#' || raw === '#top') return { kind: 'home' }
  if (raw === '#section-featured' || raw === 'featured') return { kind: 'featured' }
  if (raw === '#section-about' || raw === 'aboutSection') return { kind: 'aboutSection' }
  if (raw === 'shop' || raw === 'menu' || raw === 'catalog') return { kind: 'shop' }
  if (raw === 'about') return { kind: 'about' }
  if (raw === 'contact') return { kind: 'contact' }
  if (raw === 'home' || raw === '/') return { kind: 'home' }

  if (raw.startsWith('/r/')) {
    const parts = raw.split('/').filter(Boolean)
    const rest = parts.slice(2).join('/')
    if (!rest) return { kind: 'home' }
    if (rest === 'shop' || rest === 'menu') return { kind: 'shop' }
    if (rest === 'about') return { kind: 'about' }
    if (rest === 'contact') return { kind: 'contact' }
    return { kind: 'path', path: rest }
  }

  if (raw.startsWith('/')) {
    return { kind: 'path', path: raw.replace(/^\//, '') }
  }

  if (raw.startsWith('#')) {
    if (raw.includes('featured')) return { kind: 'featured' }
    if (raw.includes('about')) return { kind: 'aboutSection' }
    return { kind: 'path', path: raw }
  }

  return { kind: 'path', path: raw.replace(/^\//, '') }
}

/** Persist target back to the compact href string used in stored pages. */
export function serializeStoreLinkTarget(target: StoreLinkTarget): string {
  switch (target.kind) {
    case 'shop':
      return 'shop'
    case 'about':
      return 'about'
    case 'contact':
      return 'contact'
    case 'home':
      return 'home'
    case 'featured':
      return '#section-featured'
    case 'aboutSection':
      return '#section-about'
    case 'url':
      return (target.url || '').trim()
    case 'path':
      return (target.path || '').trim().replace(/^\//, '')
    default:
      return 'shop'
  }
}

export type ResolvedStoreLink =
  | { mode: 'internal'; to: string }
  | { mode: 'hash'; href: string }
  | { mode: 'external'; href: string }

/** Resolve a stored href (or structured target) for the live storefront. */
export function resolveStoreLink(
  restaurant: Pick<Restaurant, 'slug'>,
  hrefOrTarget?: string | StoreLinkTarget | null,
): ResolvedStoreLink {
  const target =
    typeof hrefOrTarget === 'object' && hrefOrTarget
      ? hrefOrTarget
      : parseStoreLinkHref(typeof hrefOrTarget === 'string' ? hrefOrTarget : '')

  const base = `/r/${restaurant.slug}`

  switch (target.kind) {
    case 'shop':
      return { mode: 'internal', to: `${base}/shop` }
    case 'about':
      return { mode: 'internal', to: `${base}/about` }
    case 'contact':
      return { mode: 'internal', to: `${base}/contact` }
    case 'home':
      return { mode: 'internal', to: base }
    case 'featured':
      return { mode: 'hash', href: '#section-featured' }
    case 'aboutSection':
      return { mode: 'hash', href: '#section-about' }
    case 'url': {
      const url = (target.url || '').trim()
      if (!url) return { mode: 'internal', to: base }
      return { mode: 'external', href: url }
    }
    case 'path': {
      const path = (target.path || '').trim()
      if (!path) return { mode: 'internal', to: base }
      if (path.startsWith('#')) return { mode: 'hash', href: path }
      if (/^https?:\/\//i.test(path)) return { mode: 'external', href: path }
      return { mode: 'internal', to: `${base}/${path.replace(/^\//, '')}` }
    }
    default:
      return { mode: 'internal', to: base }
  }
}
