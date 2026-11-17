import type {
  Display,
  DisplayGraphicSlide,
  DisplayItemSlide,
  DisplayKind,
  FeaturedCatalogScope,
  FeaturedSource,
  GraphicsChrome,
} from '@/types'

function asKind(display: Display): DisplayKind {
  if (
    display.kind === 'branding' ||
    display.kind === 'graphics' ||
    display.kind === 'featured' ||
    display.kind === 'menu'
  ) {
    return display.kind
  }
  // Legacy mode → kind
  if (
    display.mode === 'branding' ||
    display.mode === 'graphics' ||
    display.mode === 'featured' ||
    display.mode === 'menu'
  ) {
    return display.mode
  }
  if (display.mode === 'catalog') return 'menu'
  if (display.mode === 'mixed') return 'featured'
  if ((display.customSlides?.length ?? 0) > 0 && display.mode === undefined) {
    return 'graphics'
  }
  return 'featured'
}

/** Normalize legacy display records into the current shape. */
export function normalizeDisplay(raw: Display): Display {
  const kind = asKind(raw)
  const legacyCustoms = raw.customSlides ?? []
  const graphicSlides: DisplayGraphicSlide[] =
    raw.graphicSlides?.length
      ? raw.graphicSlides
      : legacyCustoms
          .filter((s) => Boolean(s.imageUrl))
          .map((s) => ({
            id: s.id,
            imageUrl: s.imageUrl || '',
            title: s.title,
            subtitle: s.subtitle,
            sortOrder: s.sortOrder,
          }))

  const itemSlides: DisplayItemSlide[] = raw.itemSlides ?? []
  const featuredSource: FeaturedSource =
    raw.featuredSource === 'manual' ? 'manual' : 'auto'
  const featuredCatalogScope: FeaturedCatalogScope =
    raw.featuredCatalogScope === 'menus' ||
    (raw.featuredCatalogScope !== 'daypart' && (raw.menuIds?.length ?? 0) > 0)
      ? 'menus'
      : 'daypart'
  const graphicsChrome: GraphicsChrome =
    raw.graphicsChrome === 'framed' ? 'framed' : 'fullscreen'

  return {
    ...raw,
    kind,
    slideDurationSec: raw.slideDurationSec || 8,
    showLogo: raw.showLogo !== false,
    showStoreName: raw.showStoreName !== false,
    backgroundImageUrl: raw.backgroundImageUrl,
    graphicsChrome,
    graphicSlides,
    featuredSource,
    featuredCatalogScope,
    menuIds: raw.menuIds ?? [],
    sectionIds: raw.sectionIds ?? [],
    showPrices: raw.showPrices !== false,
    showSoldOut: Boolean(raw.showSoldOut),
    showItemImages: raw.showItemImages !== false,
    itemsPerAutoSlide: Math.max(1, Math.min(8, raw.itemsPerAutoSlide || 4)),
    itemSlides,
  }
}

export function displayKindLabel(kind: DisplayKind): string {
  switch (kind) {
    case 'branding':
      return 'Branding sign'
    case 'graphics':
      return 'Graphics slideshow'
    case 'featured':
      return 'Featured items'
    case 'menu':
      return 'Ordering menu'
  }
}
