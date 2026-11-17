import type { AppDatabase } from '@/types'
import type { PersistenceAdapter } from './types'

export const DB_STORAGE_KEY = 'menushop:db:v1'
export const DB_REVISION_KEY = 'menushop:db:v1:rev'

export function readDbRevision(): string {
  try {
    return localStorage.getItem(DB_REVISION_KEY) || ''
  } catch {
    return ''
  }
}

export function writeDbRevision(revision = String(Date.now())): string {
  try {
    localStorage.setItem(DB_REVISION_KEY, revision)
  } catch {
    /* ignore quota / private mode */
  }
  return revision
}

export const localStorageAdapter: PersistenceAdapter = {
  async load() {
    try {
      const raw = localStorage.getItem(DB_STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw) as AppDatabase
    } catch {
      return null
    }
  },
  async save(db) {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db))
    writeDbRevision()
  },
  async clear() {
    localStorage.removeItem(DB_STORAGE_KEY)
    localStorage.removeItem(DB_REVISION_KEY)
  },
}
