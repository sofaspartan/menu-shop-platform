import type { Display, DisplayCustomSlide, DisplayMode } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { createId, nowIso, slugify } from '@/lib/utils'

export async function listDisplays(restaurantId: string): Promise<Display[]> {
  const db = await getDb()
  return db.displays
    .filter((d) => d.restaurantId === restaurantId)
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

export async function createDisplay(
  userId: string,
  restaurantId: string,
  input: {
    name: string
    mode?: DisplayMode
    headline?: string
    tagline?: string
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
    mode: input.mode ?? 'mixed',
    menuIds: [],
    slideDurationSec: 8,
    showPrices: true,
    showSoldOut: false,
    showLogo: true,
    showStoreName: true,
    headline: input.headline?.trim() || undefined,
    tagline: input.tagline?.trim() || undefined,
    customSlides: [],
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.displays) d.displays = []
    d.displays.push(display)
  })
  return display
}

export async function updateDisplay(
  userId: string,
  restaurantId: string,
  displayId: string,
  patch: Partial<
    Pick<
      Display,
      | 'name'
      | 'active'
      | 'mode'
      | 'menuIds'
      | 'slideDurationSec'
      | 'showPrices'
      | 'showSoldOut'
      | 'showLogo'
      | 'showStoreName'
      | 'headline'
      | 'tagline'
      | 'customSlides'
    >
  > & { slug?: string },
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
    if (patch.name !== undefined) display.name = patch.name.trim()
    if (patch.active !== undefined) display.active = patch.active
    if (patch.mode !== undefined) display.mode = patch.mode
    if (patch.menuIds !== undefined) display.menuIds = patch.menuIds
    if (patch.slideDurationSec !== undefined) {
      display.slideDurationSec = Math.max(3, Math.min(60, patch.slideDurationSec))
    }
    if (patch.showPrices !== undefined) display.showPrices = patch.showPrices
    if (patch.showSoldOut !== undefined) display.showSoldOut = patch.showSoldOut
    if (patch.showLogo !== undefined) display.showLogo = patch.showLogo
    if (patch.showStoreName !== undefined) display.showStoreName = patch.showStoreName
    if (patch.headline !== undefined) {
      display.headline = patch.headline.trim() || undefined
    }
    if (patch.tagline !== undefined) {
      display.tagline = patch.tagline.trim() || undefined
    }
    if (patch.customSlides !== undefined) display.customSlides = patch.customSlides
    if (patch.slug !== undefined) {
      display.slug = slugify(patch.slug) || display.slug
    }
    display.updatedAt = nowIso()
    updated = display
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

export function createCustomSlide(
  partial?: Partial<DisplayCustomSlide>,
): DisplayCustomSlide {
  return {
    id: createId('dslide'),
    title: partial?.title,
    subtitle: partial?.subtitle,
    imageUrl: partial?.imageUrl,
    sortOrder: partial?.sortOrder ?? 0,
  }
}
