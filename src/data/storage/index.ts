import type { PersistenceAdapter } from './types'
import { localStorageAdapter } from './localStorageAdapter'

/**
 * Persistence factory. Local development and the Netlify-friendly POC use
 * localStorage. Swap this for a Netlify Blobs / Postgres adapter later without
 * changing repositories or UI.
 */
export function getPersistenceAdapter(): PersistenceAdapter {
  return localStorageAdapter
}

export type { PersistenceAdapter }
