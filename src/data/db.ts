import type { AppDatabase } from '@/types'
import {
  defaultStorePagesFor,
  normalizeAboutPage,
  normalizeContactPage,
  normalizeCoverIntro,
  normalizeStoreFooter,
} from '@/types'
import { getPersistenceAdapter } from '@/data/storage'
import { buildDemoDatabase } from '@/data/seed/demo'

let memory: AppDatabase | null = null
let initPromise: Promise<AppDatabase> | null = null
const listeners = new Set<() => void>()

export function subscribeDb(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notify() {
  listeners.forEach((l) => l())
}

export async function getDb(): Promise<AppDatabase> {
  if (memory) return memory
  if (initPromise) return initPromise

  initPromise = (async () => {
    const adapter = getPersistenceAdapter()
    const existing = await adapter.load()
    // Bump when seed assets/schema change so demos refresh cleanly.
    if (existing && existing.version === 11) {
      if (!existing.brandThemes) existing.brandThemes = []
      if (!existing.coupons) existing.coupons = []
      if (!existing.sales) existing.sales = []
      if (!existing.loyaltyAccounts) existing.loyaltyAccounts = []
      if (!existing.loyaltyLedger) existing.loyaltyLedger = []
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
      return existing
    }
    const seeded = await buildDemoDatabase()
    memory = seeded
    await adapter.save(seeded)
    return seeded
  })()

  try {
    return await initPromise
  } finally {
    initPromise = null
  }
}

export async function saveDb(mutator: (db: AppDatabase) => void): Promise<AppDatabase> {
  const db = await getDb()
  mutator(db)
  memory = db
  await getPersistenceAdapter().save(db)
  notify()
  return db
}

export async function replaceDb(db: AppDatabase): Promise<void> {
  memory = db
  await getPersistenceAdapter().save(db)
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
