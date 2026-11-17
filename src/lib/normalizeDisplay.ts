import type {
  Display,
  DisplayGraphicSlide,
  DisplayItemSlide,
  DisplayKind,
  BrandingLayout,
  FeaturedCatalogScope,
  FeaturedSource,
  GraphicsChrome,
  LogoStyle,
  MenuBoardLayout,
  MenuCatalogScope,
} from '@/types'
import { normalizeLogoStyle } from '@/lib/logoStyle'

function asKind(display: Display): DisplayKind {
  if (
    display.kind === 'branding' ||
    display.kind === 'graphics' ||
    display.kind === 'featured' ||
    display.kind === 'menu' ||
    display.kind === 'orderStatus'
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
    showLive: raw.showLive !== false,
    showDate: raw.showDate !== false,
    showTime: raw.showTime !== false,
    showHeader: raw.showHeader !== false,
    logoStyle: normalizeLogoStyle(raw.logoStyle) as LogoStyle,
    backgroundImageUrl: raw.backgroundImageUrl,
    brandingLayout: (raw.brandingLayout === 'fullbleed'
      ? 'fullbleed'
      : 'card') as BrandingLayout,
    graphicsChrome,
    graphicSlides,
    featuredSource,
    featuredCatalogScope,
    menuIds: raw.menuIds ?? [],
    sectionIds: raw.sectionIds ?? [],
    menuCatalogScope: (raw.menuCatalogScope === 'custom' ||
    (raw.menuCatalogScope !== 'daypart' &&
      ((raw.menuIds?.length ?? 0) > 0 || (raw.sectionIds?.length ?? 0) > 0))
      ? 'custom'
      : 'daypart') as MenuCatalogScope,
    showPrices: raw.showPrices !== false,
    showSoldOut: Boolean(raw.showSoldOut),
    menuLayout: (raw.menuLayout === 'columns' ? 'columns' : 'cards') as MenuBoardLayout,
    showItemImages: raw.showItemImages !== false,
    itemsPerAutoSlide: Math.max(1, Math.min(8, raw.itemsPerAutoSlide || 4)),
    showFeaturedTitle: raw.showFeaturedTitle !== false,
    itemSlides,
    orderStatusShowPreparing: raw.orderStatusShowPreparing !== false,
    orderStatusShowReady: raw.orderStatusShowReady !== false,
    orderStatusShowGuestName: raw.orderStatusShowGuestName !== false,
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
    case 'orderStatus':
      return 'Order status board'
  }
}
