import type { AppDatabase } from '@/types'

export interface PersistenceAdapter {
  load(): Promise<AppDatabase | null>
  save(db: AppDatabase): Promise<void>
  clear(): Promise<void>
}
