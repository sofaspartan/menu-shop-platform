import type {
  Display,
  DisplayGraphicSlide,
  DisplayItemSlide,
  BrandingLayout,
  DisplayKind,
  FeaturedCatalogScope,
  FeaturedSource,
  GraphicsChrome,
  MenuBoardLayout,
} from '@/types'
import { getDb, saveDb } from '@/data/db'
import { normalizeDisplay } from '@/lib/normalizeDisplay'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { createId, nowIso, slugify } from '@/lib/utils'

export async function listDisplays(restaurantId: string): Promise<Display[]> {
  const db = await getDb()
  return db.displays
    .filter((d) => d.restaurantId === restaurantId)
    .map(normalizeDisplay)
    .sort((a, b) => a.name.localeCompare(b.name))
}

async function uniqueDisplaySlug(
  restaurantId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const db = await getDb()
  let base = slugify(name) || 'display'
  let slug = base
  let n = 2
  while (
    db.displays.some(
      (d) =>
        d.restaurantId === restaurantId &&
        d.slug === slug &&
        d.id !== excludeId,
    )
  ) {
    slug = `${base}-${n++}`
  }
  return slug
}

function defaultsForKind(kind: DisplayKind): Pick<
  Display,
  | 'kind'
  | 'brandingLayout'
  | 'graphicsChrome'
  | 'graphicSlides'
  | 'featuredSource'
  | 'featuredCatalogScope'
  | 'menuIds'
  | 'sectionIds'
  | 'showPrices'
  | 'showSoldOut'
  | 'menuLayout'
  | 'showItemImages'
  | 'itemsPerAutoSlide'
  | 'itemSlides'
> {
  return {
    kind,
    brandingLayout: kind === 'branding' ? 'fullbleed' : 'card',
    graphicsChrome: 'fullscreen',
    graphicSlides: [],
    featuredSource: 'auto',
    featuredCatalogScope: 'daypart',
    menuIds: [],
    sectionIds: [],
    showPrices: true,
    showSoldOut: false,
    menuLayout: 'cards',
    showItemImages: true,
    itemsPerAutoSlide: 4,
    itemSlides: [],
  }
}

export async function createDisplay(
  userId: string,
  restaurantId: string,
  input: {
    name: string
    kind: DisplayKind
    headline?: string
    tagline?: string
    backgroundImageUrl?: string
  },
): Promise<Display> {
  await assertRestaurantAccess(userId, restaurantId, [
    'owner',
    'administrator',
    'manager',
  ])
  const slug = await uniqueDisplaySlug(restaurantId, input.name)
  const ts = nowIso()
  const display: Display = {
    id: createId('disp'),
    restaurantId,
    name: input.name.trim(),
    slug,
    active: true,
    slideDurationSec: 8,
    showLogo: true,
    showStoreName: true,
    headline: input.headline?.trim() || undefined,
    tagline: input.tagline?.trim() || undefined,
    backgroundImageUrl: input.backgroundImageUrl?.trim() || undefined,
    ...defaultsForKind(input.kind),
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.displays) d.displays = []
    d.displays.push(display)
  })
  return normalizeDisplay(display)
}

export type DisplayPatch = Partial<
  Pick<
    Display,
    | 'name'
    | 'active'
    | 'kind'
    | 'slideDurationSec'
    | 'showLogo'
    | 'showStoreName'
    | 'headline'
    | 'tagline'
    | 'backgroundImageUrl'
    | 'brandingLayout'
    | 'graphicsChrome'
    | 'graphicSlides'
    | 'featuredSource'
    | 'featuredCatalogScope'
    | 'menuIds'
    | 'sectionIds'
    | 'showPrices'
    | 'showSoldOut'
    | 'menuLayout'
    | 'showItemImages'
    | 'itemsPerAutoSlide'
    | 'itemSlides'
  >
> & { slug?: string }

export async function updateDisplay(
  userId: string,
  restaurantId: string,
  displayId: string,
  patch: DisplayPatch,
): Promise<Display> {
  await assertRestaurantAccess(userId, restaurantId, [
    'owner',
    'administrator',
    'manager',
  ])
  let updated: Display | null = null
  await saveDb((d) => {
    const display = d.displays.find(
      (x) => x.id === displayId && x.restaurantId === restaurantId,
    )
    if (!display) throw new Error('Display not found.')
    const next = normalizeDisplay(display)

    if (patch.name !== undefined) next.name = patch.name.trim()
    if (patch.active !== undefined) next.active = patch.active
    if (patch.kind !== undefined) next.kind = patch.kind
    if (patch.slideDurationSec !== undefined) {
      next.slideDurationSec = Math.max(3, Math.min(60, patch.slideDurationSec))
    }
    if (patch.showLogo !== undefined) next.showLogo = patch.showLogo
    if (patch.showStoreName !== undefined) next.showStoreName = patch.showStoreName
    if (patch.headline !== undefined) {
      next.headline = patch.headline.trim() || undefined
    }
    if (patch.tagline !== undefined) {
      next.tagline = patch.tagline.trim() || undefined
    }
    if (patch.backgroundImageUrl !== undefined) {
      next.backgroundImageUrl = patch.backgroundImageUrl.trim() || undefined
    }
    if (patch.brandingLayout !== undefined) {
      next.brandingLayout = patch.brandingLayout as BrandingLayout
    }
    if (patch.graphicsChrome !== undefined) {
      next.graphicsChrome = patch.graphicsChrome as GraphicsChrome
    }
    if (patch.graphicSlides !== undefined) next.graphicSlides = patch.graphicSlides
    if (patch.featuredSource !== undefined) {
      next.featuredSource = patch.featuredSource as FeaturedSource
    }
    if (patch.featuredCatalogScope !== undefined) {
      next.featuredCatalogScope = patch.featuredCatalogScope as FeaturedCatalogScope
    }
    if (patch.menuIds !== undefined) next.menuIds = patch.menuIds
    if (patch.sectionIds !== undefined) next.sectionIds = patch.sectionIds
    if (patch.showPrices !== undefined) next.showPrices = patch.showPrices
    if (patch.showSoldOut !== undefined) next.showSoldOut = patch.showSoldOut
    if (patch.menuLayout !== undefined) {
      next.menuLayout = patch.menuLayout as MenuBoardLayout
    }
    if (patch.showItemImages !== undefined) next.showItemImages = patch.showItemImages
    if (patch.itemsPerAutoSlide !== undefined) {
      next.itemsPerAutoSlide = Math.max(1, Math.min(8, patch.itemsPerAutoSlide))
    }
    if (patch.itemSlides !== undefined) next.itemSlides = patch.itemSlides
    if (patch.slug !== undefined) {
      next.slug = slugify(patch.slug) || next.slug
    }

    next.updatedAt = nowIso()
    // Drop legacy-only fields when rewriting.
    delete next.mode
    delete next.customSlides
    Object.assign(display, next)
    updated = normalizeDisplay(display)
  })
  return updated!
}

export async function deleteDisplay(
  userId: string,
  restaurantId: string,
  displayId: string,
): Promise<void> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  await saveDb((d) => {
    d.displays = d.displays.filter(
      (x) => !(x.id === displayId && x.restaurantId === restaurantId),
    )
  })
}

export function buildDisplayPath(storeSlug: string, displaySlug: string): string {
  return `/r/${storeSlug}/display/${displaySlug}`
}

export function buildDisplayUrl(
  origin: string,
  storeSlug: string,
  displaySlug: string,
): string {
  return `${origin.replace(/\/$/, '')}${buildDisplayPath(storeSlug, displaySlug)}`
}

export function createGraphicSlide(
  partial?: Partial<DisplayGraphicSlide>,
): DisplayGraphicSlide {
  return {
    id: createId('dslide'),
    imageUrl: partial?.imageUrl ?? '',
    title: partial?.title,
    subtitle: partial?.subtitle,
    sortOrder: partial?.sortOrder ?? 0,
  }
}

export function createItemSlide(
  partial?: Partial<DisplayItemSlide>,
): DisplayItemSlide {
  return {
    id: createId('dslide'),
    title: partial?.title,
    itemIds: partial?.itemIds ?? [],
    sortOrder: partial?.sortOrder ?? 0,
  }
}

/** @deprecated */
export function createCustomSlide(partial?: Partial<DisplayGraphicSlide>) {
  return createGraphicSlide(partial)
}
