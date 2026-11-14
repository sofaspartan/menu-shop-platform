import { useEffect, useState } from 'react'
import type { AppDatabase } from '@/types'
import { getDb, subscribeDb } from '@/data/db'

export function useDb() {
  const [db, setDb] = useState<AppDatabase | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    getDb().then((data) => {
      if (alive) {
        setDb(data)
        setLoading(false)
      }
    })
    const unsub = subscribeDb(() => {
      getDb().then((data) => {
        if (alive) setDb({ ...data })
      })
    })
    return () => {
      alive = false
      unsub()
    }
  }, [])

  return { db, loading }
}
