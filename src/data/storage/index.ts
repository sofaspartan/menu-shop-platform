import type { PersistenceAdapter } from './types'
import {
  DB_REVISION_KEY,
  DB_STORAGE_KEY,
  localStorageAdapter,
  readDbRevision,
  writeDbRevision,
} from './localStorageAdapter'

/**
 * Persistence factory. Local development and the Netlify-friendly POC use
 * localStorage. Swap this for a Netlify Blobs / Postgres adapter later without
 * changing repositories or UI.
 */
export function getPersistenceAdapter(): PersistenceAdapter {
  return localStorageAdapter
}

export type { PersistenceAdapter }
export { DB_REVISION_KEY, DB_STORAGE_KEY, readDbRevision, writeDbRevision }
