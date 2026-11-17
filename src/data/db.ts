import type { AppDatabase } from '@/types'
import {
  defaultStorePagesFor,
  normalizeAboutPage,
  normalizeContactPage,
  normalizeCoverIntro,
  normalizeStoreFooter,
} from '@/types'
import {
  DB_REVISION_KEY,
  DB_STORAGE_KEY,
  getPersistenceAdapter,
  readDbRevision,
} from '@/data/storage'
import { buildDemoDatabase } from '@/data/seed/demo'
import { applyCouponExpirations, applySaleExpirations } from '@/lib/commerce'
import { nowIso } from '@/lib/utils'

let memory: AppDatabase | null = null
let initPromise: Promise<AppDatabase> | null = null
const listeners = new Set<() => void>()
let revision = 0
let lastSeenDiskRevision = ''
let syncStarted = false
let broadcast: BroadcastChannel | null = null
const BROADCAST_CHANNEL = 'menushop-db'

export function subscribeDb(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getDbRevision(): number {
  return revision
}

function notify() {
  revision += 1
  listeners.forEach((l) => l())
}

/**
 * Keep dashboard kitchen displays, POS, and customer order trackers in sync
 * across tabs/windows/iframes that share the same origin storage.
 */
export function startDbRealtimeSync(): void {
  if (syncStarted || typeof window === 'undefined') return
  syncStarted = true
  lastSeenDiskRevision = readDbRevision()

  window.addEventListener('storage', (event) => {
    if (event.key !== DB_STORAGE_KEY && event.key !== DB_REVISION_KEY) return
    void ingestExternalDbUpdate()
  })

  try {
    broadcast = new BroadcastChannel(BROADCAST_CHANNEL)
    broadcast.onmessage = (event: MessageEvent<{ type?: string }>) => {
      if (event.data?.type === 'db-updated') {
        void ingestExternalDbUpdate()
      }
    }
  } catch {
    broadcast = null
  }
}

async function ingestExternalDbUpdate(): Promise<void> {
  const diskRev = readDbRevision()
  if (diskRev && diskRev === lastSeenDiskRevision && memory) return
  const loaded = await getPersistenceAdapter().load()
  if (!loaded) return
  memory = loaded
  lastSeenDiskRevision = diskRev || readDbRevision()
  notify()
}

/** Poll-friendly refresh used by live screens as a safety net. */
export async function syncDbFromDisk(): Promise<AppDatabase> {
  startDbRealtimeSync()
  const diskRev = readDbRevision()
  if (memory && diskRev && diskRev === lastSeenDiskRevision) {
    return memory
  }
  const loaded = await getPersistenceAdapter().load()
  if (loaded) {
    memory = loaded
    lastSeenDiskRevision = diskRev || readDbRevision()
    notify()
    return loaded
  }
  return getDb()
}

function publishDbUpdated() {
  lastSeenDiskRevision = readDbRevision()
  try {
    broadcast?.postMessage({ type: 'db-updated', at: Date.now() })
  } catch {
    /* channel closed */
  }
}

export async function getDb(): Promise<AppDatabase> {
  if (memory) return memory
  if (initPromise) return initPromise

  initPromise = (async () => {
    const adapter = getPersistenceAdapter()
    const existing = await adapter.load()
    // Bump when seed assets/schema change so demos refresh cleanly.
    if (
      existing &&
      (existing.version === 11 ||
        existing.version === 12 ||
        existing.version === 13 ||
        existing.version === 14 ||
        existing.version === 15 ||
        existing.version === 16 ||
        existing.version === 17)
    ) {
      if (!existing.brandThemes) existing.brandThemes = []
      if (!existing.coupons) existing.coupons = []
      if (!existing.sales) existing.sales = []
      if (!existing.loyaltyAccounts) existing.loyaltyAccounts = []
      if (!existing.loyaltyLedger) existing.loyaltyLedger = []
      if (!existing.displays) existing.displays = []
      // Soft-migrate older display drafts in place.
      existing.displays = existing.displays.map((d) => {
        const kind =
          d.kind === 'branding' ||
          d.kind === 'graphics' ||
          d.kind === 'featured' ||
          d.kind === 'menu'
            ? d.kind
            : d.mode === 'branding' ||
                d.mode === 'graphics' ||
                d.mode === 'menu'
              ? d.mode
              : d.mode === 'catalog'
                ? 'menu'
                : 'featured'
        return {
          ...d,
          kind,
          graphicsChrome: d.graphicsChrome === 'framed' ? 'framed' : 'fullscreen',
          graphicSlides:
            d.graphicSlides ??
            (d.customSlides || [])
              .filter((s) => s.imageUrl)
              .map((s) => ({
                id: s.id,
                imageUrl: s.imageUrl || '',
                title: s.title,
                subtitle: s.subtitle,
                sortOrder: s.sortOrder,
              })),
          featuredSource: d.featuredSource === 'manual' ? 'manual' : 'auto',
          featuredCatalogScope:
            d.featuredCatalogScope === 'menus' ||
            (d.featuredCatalogScope !== 'daypart' && (d.menuIds?.length ?? 0) > 0)
              ? 'menus'
              : 'daypart',
          menuIds: d.menuIds ?? [],
          sectionIds: d.sectionIds ?? [],
          showPrices: d.showPrices !== false,
          showSoldOut: Boolean(d.showSoldOut),
          menuLayout: d.menuLayout === 'columns' ? 'columns' : 'cards',
          brandingLayout: d.brandingLayout === 'fullbleed' ? 'fullbleed' : 'card',
          showItemImages: d.showItemImages !== false,
          itemsPerAutoSlide: d.itemsPerAutoSlide || 4,
          itemSlides: d.itemSlides ?? [],
          showLogo: d.showLogo !== false,
          showStoreName: d.showStoreName !== false,
          slideDurationSec: d.slideDurationSec || 8,
        }
      })
      const expiredSales = applySaleExpirations(existing.sales, new Date(), nowIso)
      const expiredCoupons = applyCouponExpirations(existing.coupons, new Date(), nowIso)
      if (expiredSales + expiredCoupons > 0) {
        await adapter.save(existing)
      }
      for (const r of existing.restaurants) {
        if (!r.storeKind) r.storeKind = 'restaurant'
        if (!r.storefrontLayout) {
          r.storefrontLayout = r.storeKind === 'retail' ? 'retail' : 'restaurant'
        }
        if (!r.storefrontWidth) {
          r.storefrontWidth = 'margined'
        }
        if (!r.loyalty) {
          r.loyalty = {
            enabled: false,
            pointsPerDollar: 1,
            rewards: [],
          }
        }
        if (!r.pages) {
          r.pages = defaultStorePagesFor(r.storeKind ?? 'restaurant')
        } else {
          r.pages.about = normalizeAboutPage(r.pages.about)
          r.pages.contact = normalizeContactPage(r.pages.contact)
          r.pages.coverIntro = normalizeCoverIntro(r.pages.coverIntro)
          r.pages.footer = normalizeStoreFooter(r.pages.footer)
          if (r.pages.featuredEnabled === undefined) r.pages.featuredEnabled = true
        }
      }
      memory = existing
      lastSeenDiskRevision = readDbRevision()
      return existing
    }
    const seeded = await buildDemoDatabase()
    memory = seeded
    await adapter.save(seeded)
    lastSeenDiskRevision = readDbRevision()
    return seeded
  })()

  try {
    return await initPromise
  } finally {
    initPromise = null
  }
}

export async function saveDb(mutator: (db: AppDatabase) => void): Promise<AppDatabase> {
  startDbRealtimeSync()
  const db = await getDb()
  mutator(db)
  memory = db
  await getPersistenceAdapter().save(db)
  publishDbUpdated()
  notify()
  return db
}

export async function replaceDb(db: AppDatabase): Promise<void> {
  startDbRealtimeSync()
  memory = db
  await getPersistenceAdapter().save(db)
  publishDbUpdated()
  notify()
}

export async function resetDemoData(): Promise<AppDatabase> {
  const seeded = await buildDemoDatabase()
  await replaceDb(seeded)
  return seeded
}

export function getDbSync(): AppDatabase | null {
  return memory
}
