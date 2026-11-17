import type {
  AppDatabase,
  Display,
  MenuItem,
  Restaurant,
  Sale,
} from '@/types'
import { resolveListedPrice } from '@/lib/commerce'
import { normalizeDisplay } from '@/lib/normalizeDisplay'
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
  sectionId?: string
}

export type BoardMenuSection = {
  id: string
  name: string
  items: BoardItemCard[]
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
      kind: 'graphic'
      title?: string
      subtitle?: string
      imageUrl: string
    }
  | {
      id: string
      kind: 'items'
      title: string
      items: BoardItemCard[]
    }
  | {
      id: string
      kind: 'menu'
      title: string
      sections: BoardMenuSection[]
    }

function toCard(
  item: MenuItem,
  sectionName: string,
  listPriceCents: number,
  sales: Sale[],
  now: Date,
  sectionId?: string,
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
    sectionId,
  }
}

function collectCatalogCards(
  db: AppDatabase,
  restaurant: Restaurant,
  display: Display,
  now: Date,
  opts: { featuredOnly: boolean },
): BoardItemCard[] {
  const sales = db.sales.filter((s) => s.restaurantId === restaurant.id)
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
  const cards: BoardItemCard[] = []

  for (const menu of menus) {
    const assignments = db.assignments
      .filter((a) => a.menuId === menu.id && a.visible)
      .sort((a, b) => a.sortOrder - b.sortOrder)

    for (const assignment of assignments) {
      if (opts.featuredOnly && !assignment.featured) continue
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
      const list = assignment.priceOverrideCents ?? item.basePriceCents
      const card = toCard(
        item,
        sectionName,
        list,
        sales,
        now,
        assignment.sectionId,
      )
      if (!cards.some((c) => c.id === card.id)) cards.push(card)
    }
  }

  return cards
}

/** Group available catalog items into menu-board sections. */
export function collectMenuBoardSections(
  db: AppDatabase,
  restaurant: Restaurant,
  display: Display,
  now: Date,
): BoardMenuSection[] {
  const sales = db.sales.filter((s) => s.restaurantId === restaurant.id)
  const menus = getAvailableMenus(
    db.menus.filter((m) => m.restaurantId === restaurant.id),
    restaurant,
    now,
  ).filter((m) =>
    display.menuIds.length ? display.menuIds.includes(m.id) : true,
  )
  const menuIdSet = new Set(menus.map((m) => m.id))

  const sections = db.sections
    .filter(
      (s) =>
        s.restaurantId === restaurant.id &&
        !s.hidden &&
        menuIdSet.has(s.menuId) &&
        (display.sectionIds.length
          ? display.sectionIds.includes(s.id)
          : true),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  const result: BoardMenuSection[] = []

  for (const section of sections) {
    const assignments = db.assignments
      .filter(
        (a) =>
          a.menuId === section.menuId &&
          a.sectionId === section.id &&
          a.visible,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)

    const items: BoardItemCard[] = []
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

      const list = assignment.priceOverrideCents ?? item.basePriceCents
      items.push(
        toCard(item, section.name, list, sales, now, section.id),
      )
    }

    if (items.length) {
      result.push({ id: section.id, name: section.name, items })
    }
  }

  return result
}

function cardsForItemIds(
  db: AppDatabase,
  restaurant: Restaurant,
  display: Display,
  itemIds: string[],
  now: Date,
): BoardItemCard[] {
  const sales = db.sales.filter((s) => s.restaurantId === restaurant.id)
  const cards: BoardItemCard[] = []
  for (const itemId of itemIds) {
    const item = db.items.find(
      (i) => i.id === itemId && i.restaurantId === restaurant.id,
    )
    if (!item || !item.active) continue
    if (item.availability === 'hidden') continue
    const available = isItemAvailableNow(item, now)
    const soldOut =
      item.availability === 'sold_out' ||
      Boolean(item.trackInventory && (item.stockQty ?? 0) <= 0)
    if (!available && !soldOut) continue
    if (soldOut && !display.showSoldOut) continue
    if (!available && !display.showSoldOut) continue

    const assignment = db.assignments.find(
      (a) =>
        a.restaurantId === restaurant.id &&
        a.itemId === item.id &&
        a.visible,
    )
    const section = assignment
      ? db.sections.find((s) => s.id === assignment.sectionId)
      : undefined
    const list = assignment?.priceOverrideCents ?? item.basePriceCents
    cards.push(
      toCard(item, section?.name || 'Featured', list, sales, now, section?.id),
    )
  }
  return cards
}

/** Build the live slide deck for a digital display from current catalog state. */
export function buildDisplaySlides(
  db: AppDatabase,
  restaurant: Restaurant,
  rawDisplay: Display,
  now = new Date(),
): BoardSlide[] {
  const display = normalizeDisplay(rawDisplay)
  const slides: BoardSlide[] = []

  if (display.kind === 'branding') {
    slides.push({
      id: `branding-${display.id}`,
      kind: 'branding',
      headline: display.headline || restaurant.name,
      tagline:
        display.tagline ||
        restaurant.pages.coverIntro?.title ||
        restaurant.pages.about.subtitle ||
        undefined,
      imageUrl:
        display.backgroundImageUrl ||
        restaurant.coverImageUrl ||
        undefined,
    })
    return slides
  }

  if (display.kind === 'graphics') {
    const graphics = [...display.graphicSlides]
      .filter((s) => s.imageUrl.trim())
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const g of graphics) {
      slides.push({
        id: g.id,
        kind: 'graphic',
        title: g.title,
        subtitle: g.subtitle,
        imageUrl: g.imageUrl.trim(),
      })
    }
    return slides
  }

  if (display.kind === 'menu') {
    const sections = collectMenuBoardSections(db, restaurant, display, now)
    if (!sections.length) return slides
    slides.push({
      id: `menu-${display.id}`,
      kind: 'menu',
      title: display.headline || restaurant.name,
      sections,
    })
    return slides
  }

  // Featured board
  if (display.featuredSource === 'manual') {
    const pages = [...display.itemSlides].sort((a, b) => a.sortOrder - b.sortOrder)
    for (const page of pages) {
      const items = cardsForItemIds(db, restaurant, display, page.itemIds, now)
      if (!items.length) continue
      slides.push({
        id: page.id,
        kind: 'items',
        title: page.title?.trim() || 'Featured',
        items,
      })
    }
    return slides
  }

  const featured = collectCatalogCards(db, restaurant, display, now, {
    featuredOnly: true,
  })
  // If nothing is marked featured, fall back to a broader catalog sample.
  const pool =
    featured.length > 0
      ? featured
      : collectCatalogCards(db, restaurant, display, now, { featuredOnly: false })

  const per = display.itemsPerAutoSlide || 4
  for (let i = 0; i < pool.length; i += per) {
    slides.push({
      id: `auto-featured-${i}`,
      kind: 'items',
      title: 'Featured',
      items: pool.slice(i, i + per),
    })
  }

  return slides
}
