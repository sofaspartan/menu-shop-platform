import type { AppDatabase } from '@/types'
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
    if (existing && existing.version === 2) {
      if (!existing.brandThemes) existing.brandThemes = []
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
