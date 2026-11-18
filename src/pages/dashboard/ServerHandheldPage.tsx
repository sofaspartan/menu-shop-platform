import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Search, UtensilsCrossed } from 'lucide-react'
import type { DiningTable, MenuItem, TableCheck } from '@/types'
import { normalizeDiningTable } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useDb } from '@/hooks/useDb'
import * as floorPlanService from '@/services/floorPlanService'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { brandingStyleVars } from '@/lib/brandingCss'
import { cn, formatMoney } from '@/lib/utils'

export function ServerHandheldPage() {
  const user = useAuthStore((s) => s.user)
  const current = useRestaurantStore((s) => s.current())
  const { db, revision } = useDb({ pollMs: 2000 })
  const [params, setParams] = useSearchParams()
  const tableParam = params.get('table')

  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({})

  const tables = useMemo(() => {
    if (!db || !current) return [] as DiningTable[]
    return (db.diningTables ?? [])
      .filter((t) => t.restaurantId === current.id && t.active !== false)
      .map((t) => normalizeDiningTable(t))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current, revision])

  const checks = useMemo(() => {
    if (!db || !current) return [] as TableCheck[]
    return (db.tableChecks ?? []).filter(
      (c) => c.restaurantId === current.id && !c.closedAt,
    )
  }, [db, current, revision])

  const selectedTable = tables.find((t) => t.id === tableParam) ?? null
  const openCheck = selectedTable
    ? floorPlanService.openCheckForTable(checks, selectedTable.id)
    : undefined

  const items = useMemo(() => {
    if (!db || !current) return [] as MenuItem[]
    const q = query.trim().toLowerCase()
    return (db.items ?? [])
      .filter((i) => i.restaurantId === current.id && i.active && i.availability !== 'hidden')
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current, query, revision])

  useEffect(() => {
    if (!tableParam && tables[0]) {
      const occupied = tables.find((t) => floorPlanService.openCheckForTable(checks, t.id))
      setParams({ table: (occupied ?? tables[0]).id }, { replace: true })
    }
  }, [tableParam, tables, checks, setParams])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant first.</p>
  }

  if (current.storeKind === 'retail') {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-3xl">Server handheld</h1>
        <p className="text-stone-500">Table service handheld is for restaurants.</p>
      </div>
    )
  }

  const style = brandingStyleVars(current.branding)

  async function addItem(item: MenuItem) {
    if (!selectedTable || !openCheck) return
    setBusy(true)
    setError('')
    try {
      const qty = qtyByItem[item.id] ?? 1
      await floorPlanService.addItemToTableCheck(
        user!.id,
        current!.id,
        openCheck.id,
        item,
        qty,
      )
      setFlash(`Added ${qty}× ${item.name} to ${selectedTable.name}`)
      window.setTimeout(() => setFlash(''), 1800)
      setQtyByItem((prev) => ({ ...prev, [item.id]: 1 }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add item.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Server handheld</h1>
          <p className="mt-1 max-w-xl text-stone-500">
            Mobile menu for the floor — pick a seated table and fire items onto its check.
          </p>
        </div>
        <Link
          to="/dashboard/dining"
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Floor plan
        </Link>
      </div>

      <div className="flex justify-center">
        <div className="w-full max-w-[390px]">
          <div className="rounded-[2.2rem] border border-stone-300 bg-stone-900 p-3 shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-3 text-[11px] text-stone-400">
              <span className="inline-flex items-center gap-1.5 font-medium tracking-wide uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Server
              </span>
              <span>{current.name}</span>
            </div>
            <div
              className="overflow-hidden rounded-[1.6rem] bg-white"
              style={style}
            >
              <div className="flex h-[min(78vh,720px)] flex-col">
                <header className="shrink-0 border-b border-stone-200 bg-stone-50 px-3 py-2.5">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {tables.map((t) => {
                      const occupied = Boolean(
                        floorPlanService.openCheckForTable(checks, t.id),
                      )
                      const active = selectedTable?.id === t.id
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setParams({ table: t.id })}
                          className={cn(
                            'shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold',
                            active
                              ? 'border-stone-900 bg-stone-900 text-white'
                              : occupied
                                ? 'border-orange-300 bg-orange-50 text-orange-900'
                                : 'border-stone-200 bg-white text-stone-500',
                          )}
                        >
                          {t.name}
                        </button>
                      )
                    })}
                  </div>
                  {selectedTable ? (
                    <p className="mt-1 text-xs text-stone-500">
                      {openCheck
                        ? `${openCheck.guestName} · #${openCheck.orderNumber} · party ${openCheck.partySize}`
                        : 'No open check — seat guests on the floor plan first.'}
                    </p>
                  ) : null}
                </header>

                <div className="shrink-0 border-b border-stone-100 px-3 py-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      className="pl-8"
                      placeholder="Search menu…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                {error ? (
                  <p className="px-3 pt-2 text-xs text-red-600">{error}</p>
                ) : null}
                {flash ? (
                  <p className="px-3 pt-2 text-xs text-emerald-700">{flash}</p>
                ) : null}

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
                  {!openCheck ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-stone-500">
                      <UtensilsCrossed className="h-8 w-8 text-stone-300" />
                      Seat a party on the floor plan, then return here to order.
                      <Link
                        to="/dashboard/dining"
                        className="text-[var(--color-brand)] underline"
                      >
                        Open floor plan
                      </Link>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((item) => {
                        const qty = qtyByItem[item.id] ?? 1
                        return (
                          <li
                            key={item.id}
                            className="flex gap-2 rounded-xl border border-stone-100 p-2"
                          >
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                              <MenuItemImage
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                                fallbackClassName="h-full w-full"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-stone-900">
                                {item.name}
                              </p>
                              <p className="text-xs text-stone-500">
                                {formatMoney(item.basePriceCents)}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <div className="inline-flex items-center rounded-lg border border-stone-200">
                                  <button
                                    type="button"
                                    className="px-2 py-1 text-stone-600"
                                    onClick={() =>
                                      setQtyByItem((p) => ({
                                        ...p,
                                        [item.id]: Math.max(1, qty - 1),
                                      }))
                                    }
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-semibold">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    className="px-2 py-1 text-stone-600"
                                    onClick={() =>
                                      setQtyByItem((p) => ({
                                        ...p,
                                        [item.id]: Math.min(20, qty + 1),
                                      }))
                                    }
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <Button
                                  size="sm"
                                  className="ml-auto"
                                  disabled={busy}
                                  onClick={() => void addItem(item)}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                {openCheck ? (
                  <footer className="shrink-0 border-t border-stone-200 bg-stone-50 px-3 py-2.5">
                    <div className="flex items-center justify-between text-xs text-stone-600">
                      <span>
                        Check · {openCheck.items.reduce((s, i) => s + i.quantity, 0)} items
                      </span>
                      <span className="font-semibold text-stone-900">
                        {formatMoney(
                          floorPlanService.computeCheckTotals(openCheck).totalCents,
                        )}
                      </span>
                    </div>
                    <Link
                      to="/dashboard/dining"
                      className="mt-2 block text-center text-xs font-medium text-[var(--color-brand)]"
                    >
                      View on floor plan →
                    </Link>
                  </footer>
                ) : null}
              </div>
            </div>
            <div className="mx-auto mt-3 h-1.5 w-24 rounded-full bg-stone-700" />
          </div>
          <p className="mt-3 text-center text-xs text-stone-500">
            Simulated server phone — changes sync to the live floor feed.
          </p>
        </div>
      </div>
    </div>
  )
}
