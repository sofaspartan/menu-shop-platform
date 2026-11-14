import type { AppDatabase } from '@/types'
import type { PersistenceAdapter } from './types'

const KEY = 'menushop:db:v1'

export const localStorageAdapter: PersistenceAdapter = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      return JSON.parse(raw) as AppDatabase
    } catch {
      return null
    }
  },
  async save(db) {
    localStorage.setItem(KEY, JSON.stringify(db))
  },
  async clear() {
    localStorage.removeItem(KEY)
  },
}
