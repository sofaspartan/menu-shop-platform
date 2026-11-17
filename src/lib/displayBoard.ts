import type {
  AppDatabase,
  Display,
  Menu,
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
  menuName?: string
  menuId?: string
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

function singularizeWord(word: string): string {
  const lower = word.toLowerCase()
  if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`
  if (lower.endsWith('sses') || lower.endsWith('xes') || lower.endsWith('zes')) {
    return lower.slice(0, -2)
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    return lower.slice(0, -1)
  }
  return lower
}

/** Turn a section/menu name into a short label: "Cold Drinks" → "cold drink". */
export function featuredSourceLabel(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'item'
  // Keep ampersand phrases intact but lowercase + singularize last word.
  const parts = cleaned.split(' ')
  const last = parts[parts.length - 1] ?? cleaned
  const singularLast = singularizeWord(last)
  return [...parts.slice(0, -1).map((p) => p.toLowerCase()), singularLast].join(
    ' ',
  )
}

/** Slide title like "Featured drink" / "Featured breakfast plate". */
export function featuredTitleForItems(items: BoardItemCard[]): string {
  if (!items.length) return 'Featured'
  const sectionNames = [...new Set(items.map((i) => i.sectionName).filter(Boolean))]
  if (sectionNames.length === 1) {
    return `Featured ${featuredSourceLabel(sectionNames[0]!)}`
  }
  const menuNames = [
    ...new Set(items.map((i) => i.menuName).filter((n): n is string => Boolean(n))),
  ]
  if (menuNames.length === 1) {
    return `Featured ${featuredSourceLabel(menuNames[0]!)}`
  }
  return 'Featured'
}

function toCard(
  item: MenuItem,
  sectionName: string,
  listPriceCents: number,
  sales: Sale[],
  now: Date,
  meta?: { sectionId?: string; menuName?: string; menuId?: string },
): BoardItemCard {
  const listed = resolveListedPrice(
    listPriceCents,
    item.id,
    sales,
    now,
    item.salePriceCents,
  )
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
    sectionId: meta?.sectionId,
    menuName: meta?.menuName,
    menuId: meta?.menuId,
  }
}

function resolveFeaturedMenus(
  db: AppDatabase,
  restaurant: Restaurant,
  display: Display,
  now: Date,
): Menu[] {
  const all = db.menus
    .filter((m) => m.restaurantId === restaurant.id && m.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  if (display.featuredCatalogScope === 'menus') {
    if (display.menuIds.length) {
      return all.filter((m) => display.menuIds.includes(m.id))
    }
    return all
  }

  // Daypart: currently serving by schedule.
  return getAvailableMenus(all, restaurant, now)
}

function collectCatalogCards(
  db: AppDatabase,
  restaurant: Restaurant,
  display: Display,
  now: Date,
  opts: { featuredOnly: boolean },
): BoardItemCard[] {
  const sales = db.sales.filter((s) => s.restaurantId === restaurant.id)
  const menus = resolveFeaturedMenus(db, restaurant, display, now)
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
      const sectionName = section?.name || menu.name || 'Featured'
      const list = assignment.priceOverrideCents ?? item.basePriceCents
      const card = toCard(item, sectionName, list, sales, now, {
        sectionId: assignment.sectionId,
        menuName: menu.name,
        menuId: menu.id,
      })
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
  const allMenus = db.menus
    .filter((m) => m.restaurantId === restaurant.id && m.active)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  const menus =
    display.menuCatalogScope === 'custom'
      ? display.menuIds.length
        ? allMenus.filter((m) => display.menuIds.includes(m.id))
        : allMenus
      : getAvailableMenus(allMenus, restaurant, now)

  const menuIdSet = new Set(menus.map((m) => m.id))
  const customSections = display.menuCatalogScope === 'custom'

  const sections = db.sections
    .filter(
      (s) =>
        s.restaurantId === restaurant.id &&
        !s.hidden &&
        menuIdSet.has(s.menuId) &&
        (customSections && display.sectionIds.length
          ? display.sectionIds.includes(s.id)
          : true),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))

  const result: BoardMenuSection[] = []

  for (const section of sections) {
    const menu = menus.find((m) => m.id === section.menuId)
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
        toCard(item, section.name, list, sales, now, {
          sectionId: section.id,
          menuName: menu?.name,
          menuId: menu?.id,
        }),
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
    const menu = assignment
      ? db.menus.find((m) => m.id === assignment.menuId)
      : undefined
    const list = assignment?.priceOverrideCents ?? item.basePriceCents
    cards.push(
      toCard(item, section?.name || menu?.name || 'Featured', list, sales, now, {
        sectionId: section?.id,
        menuName: menu?.name,
        menuId: menu?.id,
      }),
    )
  }
  return cards
}

function chunkCardsIntoFeaturedSlides(
  pool: BoardItemCard[],
  per: number,
): BoardSlide[] {
  const slides: BoardSlide[] = []
  // Keep items from the same section together so titles stay meaningful.
  const bySection = new Map<string, BoardItemCard[]>()
  for (const card of pool) {
    const key = card.sectionId || card.sectionName || 'featured'
    const list = bySection.get(key) ?? []
    list.push(card)
    bySection.set(key, list)
  }

  let slideN = 0
  for (const group of bySection.values()) {
    for (let i = 0; i < group.length; i += per) {
      const items = group.slice(i, i + per)
      slides.push({
        id: `auto-featured-${slideN++}`,
        kind: 'items',
        title: featuredTitleForItems(items),
        items,
      })
    }
  }
  return slides
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
      // Board title is owner copy (default "Menu") — store name lives in the header chrome.
      title: display.headline?.trim() || 'Menu',
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
        title: page.title?.trim() || featuredTitleForItems(items),
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
  return chunkCardsIntoFeaturedSlides(pool, per)
}
