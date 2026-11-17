import { useEffect, useState } from 'react'
import type { AppDatabase } from '@/types'
import {
  getDb,
  getDbRevision,
  startDbRealtimeSync,
  subscribeDb,
  syncDbFromDisk,
} from '@/data/db'

function snapshotDb(data: AppDatabase): AppDatabase {
  // Deep clone so React trees always see a fresh graph after mutations/sync.
  return JSON.parse(JSON.stringify(data)) as AppDatabase
}

export function useDb(options?: { pollMs?: number }) {
  const [db, setDb] = useState<AppDatabase | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const pollMs = options?.pollMs

  useEffect(() => {
    let alive = true
    startDbRealtimeSync()

    getDb().then((data) => {
      if (!alive) return
      setDb(snapshotDb(data))
      setRevision(getDbRevision())
      setLastSyncedAt(Date.now())
      setLoading(false)
    })

    const unsub = subscribeDb(() => {
      getDb().then((data) => {
        if (!alive) return
        setDb(snapshotDb(data))
        setRevision(getDbRevision())
        setLastSyncedAt(Date.now())
      })
    })

    const pollId =
      pollMs && pollMs > 0
        ? window.setInterval(() => {
            void syncDbFromDisk()
          }, pollMs)
        : null

    return () => {
      alive = false
      unsub()
      if (pollId) window.clearInterval(pollId)
    }
  }, [pollMs])

  return { db, loading, revision, lastSyncedAt }
}
