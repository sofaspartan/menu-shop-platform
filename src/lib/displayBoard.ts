import type {
  AppDatabase,
  Display,
  MenuItem,
  Restaurant,
  Sale,
} from '@/types'
import { resolveListedPrice } from '@/lib/commerce'
import { isItemAvailableNow, getAvailableMenus } from '@/lib/scheduling'

export type BoardItemCard = {
  id: string
  name: string
  description?: string
  imageUrl?: string
  priceCents: number
  listPriceCents: number
  onSale: boolean
  soldOut: boolean
  sectionName: string
}

export type BoardSlide =
  | {
      id: string
      kind: 'branding'
      headline: string
      tagline?: string
      imageUrl?: string
    }
  | {
      id: string
      kind: 'featured'
      title: string
      items: BoardItemCard[]
    }
  | {
      id: string
      kind: 'section'
      title: string
      items: BoardItemCard[]
    }
  | {
      id: string
      kind: 'custom'
      title?: string
      subtitle?: string
      imageUrl?: string
    }

function toCard(
  item: MenuItem,
  sectionName: string,
  listPriceCents: number,
  sales: Sale[],
  now: Date,
): BoardItemCard {
  const listed = resolveListedPrice(listPriceCents, item.id, sales, now)
  const soldOut =
    item.availability === 'sold_out' ||
    Boolean(item.trackInventory && (item.stockQty ?? 0) <= 0)
  return {
    id: item.id,
    name: item.name,
    description: item.shortDescription || undefined,
    imageUrl: item.imageUrl,
    priceCents: listed.priceCents,
    listPriceCents: listed.listPriceCents,
    onSale: listed.onSale,
    soldOut,
    sectionName,
  }
}

/** Build the live slide deck for a digital display from current catalog state. */
export function buildDisplaySlides(
  db: AppDatabase,
  restaurant: Restaurant,
  display: Display,
  now = new Date(),
): BoardSlide[] {
  const slides: BoardSlide[] = []
  const sales = db.sales.filter((s) => s.restaurantId === restaurant.id)

  slides.push({
    id: `branding-${display.id}`,
    kind: 'branding',
    headline: display.headline || restaurant.name,
    tagline:
      display.tagline ||
      restaurant.pages.coverIntro?.title ||
      restaurant.pages.about.subtitle ||
      restaurant.pages.about.title ||
      undefined,
    imageUrl: restaurant.coverImageUrl,
  })

  const menus = getAvailableMenus(
    db.menus.filter((m) => m.restaurantId === restaurant.id),
    restaurant,
    now,
  ).filter((m) =>
    display.menuIds.length ? display.menuIds.includes(m.id) : true,
  )

  const sectionById = new Map(
    db.sections
      .filter((s) => s.restaurantId === restaurant.id)
      .map((s) => [s.id, s]),
  )

  const featured: BoardItemCard[] = []
  const bySection = new Map<string, BoardItemCard[]>()

  for (const menu of menus) {
    const assignments = db.assignments
      .filter((a) => a.menuId === menu.id && a.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    for (const assignment of assignments) {
      const item = db.items.find((i) => i.id === assignment.itemId)
      if (!item || !item.active) continue
      if (item.availability === 'hidden') continue

      const available = isItemAvailableNow(item, now)
      const soldOut =
        item.availability === 'sold_out' ||
        Boolean(item.trackInventory && (item.stockQty ?? 0) <= 0)

      if (!available && !soldOut) continue
      if (soldOut && !display.showSoldOut) continue
      if (!available && !display.showSoldOut) continue

      const section = sectionById.get(assignment.sectionId)
      const sectionName = section?.name || 'Featured'
      const list =
        assignment.priceOverrideCents ?? item.basePriceCents
      const card = toCard(item, sectionName, list, sales, now)

      if (assignment.featured && (display.mode === 'featured' || display.mode === 'mixed')) {
        if (!featured.some((f) => f.id === card.id)) featured.push(card)
      }

      if (display.mode === 'catalog' || display.mode === 'mixed') {
        const listItems = bySection.get(sectionName) || []
        if (!listItems.some((c) => c.id === card.id)) listItems.push(card)
        bySection.set(sectionName, listItems)
      }
    }
  }

  if (
    (display.mode === 'featured' || display.mode === 'mixed') &&
    featured.length
  ) {
    // Chunk featured into slides of up to 4
    for (let i = 0; i < featured.length; i += 4) {
      slides.push({
        id: `featured-${i}`,
        kind: 'featured',
        title: 'Featured',
        items: featured.slice(i, i + 4),
      })
    }
  }

  if (display.mode === 'catalog' || display.mode === 'mixed') {
    const orderedSections = [...bySection.entries()].sort((a, b) => {
      const ao =
        db.sections.find(
          (s) => s.restaurantId === restaurant.id && s.name === a[0],
        )?.sortOrder ?? 999
      const bo =
        db.sections.find(
          (s) => s.restaurantId === restaurant.id && s.name === b[0],
        )?.sortOrder ?? 999
      return ao - bo
    })
    for (const [sectionName, items] of orderedSections) {
      for (let i = 0; i < items.length; i += 6) {
        slides.push({
          id: `section-${sectionName}-${i}`,
          kind: 'section',
          title: sectionName,
          items: items.slice(i, i + 6),
        })
      }
    }
  }

  const customs = [...display.customSlides].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )
  for (const slide of customs) {
    if (!slide.imageUrl && !slide.title) continue
    slides.push({
      id: slide.id,
      kind: 'custom',
      title: slide.title,
      subtitle: slide.subtitle,
      imageUrl: slide.imageUrl,
    })
  }

  return slides
}
