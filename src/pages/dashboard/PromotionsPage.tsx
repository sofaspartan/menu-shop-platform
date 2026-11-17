import { useEffect, useMemo, useState } from 'react'
import { Percent, Plus, Search, Tag, Trash2 } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as promotionService from '@/services/promotionService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import {
  describeCouponSchedule,
  describeSaleSchedule,
  getCouponLifecycleStatus,
  getSaleLifecycleStatus,
  type PromoLifecycleStatus,
} from '@/lib/commerce'
import { storeCopy } from '@/lib/storeCopy'
import { formatMoney, cn } from '@/lib/utils'
import type { Coupon, DayOfWeek, PromoScheduleMode, Sale } from '@/types'

const DAY_OPTIONS: Array<{ value: DayOfWeek; label: string }> = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
]

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | undefined {
  if (!value.trim()) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toISOString()
}

function lifecycleBadge(status: PromoLifecycleStatus): {
  tone: 'success' | 'neutral' | 'warning' | 'accent'
  label: string
} {
  switch (status) {
    case 'live':
      return { tone: 'success', label: 'Live' }
    case 'scheduled':
      return { tone: 'accent', label: 'Scheduled' }
    case 'between_cycles':
      return { tone: 'accent', label: 'Between cycles' }
    case 'expired':
      return { tone: 'warning', label: 'Expired' }
    default:
      return { tone: 'neutral', label: 'Off' }
  }
}

export function PromotionsPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [tab, setTab] = useState<'coupons' | 'sales'>('coupons')
  const [query, setQuery] = useState('')
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null)
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [couponCode, setCouponCode] = useState('')
  const [couponType, setCouponType] = useState<'percent_off' | 'amount_off'>('percent_off')
  const [couponValue, setCouponValue] = useState('10')
  const [couponMin, setCouponMin] = useState('')
  const [couponMode, setCouponMode] = useState<PromoScheduleMode>('always')
  const [couponStartsAt, setCouponStartsAt] = useState('')
  const [couponEndsAt, setCouponEndsAt] = useState('')
  const [couponDays, setCouponDays] = useState<DayOfWeek[]>([1, 2, 3, 4, 5])
  const [couponStartTime, setCouponStartTime] = useState('00:00')
  const [couponEndTime, setCouponEndTime] = useState('23:59')

  const [saleName, setSaleName] = useState('')
  const [salePercent, setSalePercent] = useState('20')
  const [saleItemIds, setSaleItemIds] = useState('')
  const [saleStorewide, setSaleStorewide] = useState(false)
  const [saleMode, setSaleMode] = useState<PromoScheduleMode>('always')
  const [saleStartsAt, setSaleStartsAt] = useState('')
  const [saleEndsAt, setSaleEndsAt] = useState('')
  const [saleDays, setSaleDays] = useState<DayOfWeek[]>([5, 6])
  const [saleStartTime, setSaleStartTime] = useState('00:00')
  const [saleEndTime, setSaleEndTime] = useState('23:59')

  const copy = storeCopy(current?.storeKind)

  useEffect(() => {
    if (!current) return
    void promotionService.expireEndedPromotions(current.id)
  }, [current?.id])

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const coupons = useMemo(() => {
    if (!db || !current) return []
    return db.coupons
      .filter((c) => c.restaurantId === current.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [db, current])

  const sales = useMemo(() => {
    if (!db || !current) return []
    return db.sales
      .filter((s) => s.restaurantId === current.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [db, current])

  const items = useMemo(() => {
    if (!db || !current) return []
    return db.items
      .filter((i) => i.restaurantId === current.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current])

  const filteredCoupons = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return coupons
    return coupons.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        describeCouponSchedule(c).toLowerCase().includes(q),
    )
  }, [coupons, query])

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sales
    return sales.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        describeSaleSchedule(s).toLowerCase().includes(q),
    )
  }, [sales, query])

  const selectedCoupon =
    filteredCoupons.find((c) => c.id === selectedCouponId) ??
    (!creating && !query ? coupons[0] : null) ??
    null
  const selectedSale =
    filteredSales.find((s) => s.id === selectedSaleId) ??
    (!creating && !query ? sales[0] : null) ??
    null

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a store to manage promotions.</p>
  }

  function startCreate() {
    setCreating(true)
    setSelectedCouponId(null)
    setSelectedSaleId(null)
  }

  function selectCoupon(id: string) {
    setCreating(false)
    setSelectedCouponId(id)
  }

  function selectSale(id: string) {
    setCreating(false)
    setSelectedSaleId(id)
  }

  async function createCoupon() {
    if (!user || !current) return
    setBusy(true)
    setError('')
    try {
      const value = Number.parseFloat(couponValue)
      const created = await promotionService.createCoupon(user.id, current.id, {
        code: couponCode,
        type: couponType,
        percentOff: couponType === 'percent_off' ? value : undefined,
        amountOffCents:
          couponType === 'amount_off' ? Math.round(value * 100) : undefined,
        minSubtotalCents: couponMin
          ? Math.round(Number.parseFloat(couponMin) * 100)
          : undefined,
        active: true,
        scheduleMode: couponMode,
        startsAt: couponMode === 'always' ? undefined : fromDatetimeLocalValue(couponStartsAt),
        endsAt: couponMode === 'always' ? undefined : fromDatetimeLocalValue(couponEndsAt),
        daysOfWeek: couponMode === 'weekly' ? couponDays : undefined,
        startTime: couponMode === 'weekly' ? couponStartTime : undefined,
        endTime: couponMode === 'weekly' ? couponEndTime : undefined,
      })
      setCouponCode('')
      setCouponValue('10')
      setCouponMin('')
      setCouponMode('always')
      setCouponStartsAt('')
      setCouponEndsAt('')
      setCouponDays([1, 2, 3, 4, 5])
      setCouponStartTime('00:00')
      setCouponEndTime('23:59')
      setCreating(false)
      setSelectedCouponId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create coupon.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleCoupon(coupon: Coupon) {
    if (!user || !current) return
    const turningOn = !coupon.active
    await promotionService.updateCoupon(user.id, current.id, coupon.id, {
      active: turningOn,
      ...(turningOn ? { expiredAt: undefined } : {}),
    })
  }

  function toggleCouponDay(day: DayOfWeek) {
    setCouponDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  async function removeCoupon(id: string) {
    if (!user || !current) return
    if (!window.confirm('Delete this coupon?')) return
    await promotionService.deleteCoupon(user.id, current.id, id)
  }

  async function createSale() {
    if (!user || !current) return
    setBusy(true)
    setError('')
    try {
      const percent = Number.parseFloat(salePercent)
      let itemIds: string[] = []
      if (!saleStorewide) {
        const names = saleItemIds
          .split('\n')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
        itemIds = items
          .filter((i) => names.includes(i.name.toLowerCase()) || names.includes(i.id))
          .map((i) => i.id)
        if (!itemIds.length) {
          throw new Error('Enter item names (one per line) or mark the sale storewide.')
        }
      }
      const created = await promotionService.createSale(user.id, current.id, {
        name: saleName.trim() || `${percent}% off`,
        percentOff: percent,
        itemIds,
        active: true,
        scheduleMode: saleMode,
        startsAt: saleMode === 'always' ? undefined : fromDatetimeLocalValue(saleStartsAt),
        endsAt: saleMode === 'always' ? undefined : fromDatetimeLocalValue(saleEndsAt),
        daysOfWeek: saleMode === 'weekly' ? saleDays : undefined,
        startTime: saleMode === 'weekly' ? saleStartTime : undefined,
        endTime: saleMode === 'weekly' ? saleEndTime : undefined,
      })
      setSaleName('')
      setSalePercent('20')
      setSaleItemIds('')
      setSaleStorewide(false)
      setSaleMode('always')
      setSaleStartsAt('')
      setSaleEndsAt('')
      setSaleDays([5, 6])
      setSaleStartTime('00:00')
      setSaleEndTime('23:59')
      setCreating(false)
      setSelectedSaleId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create sale.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleSale(sale: Sale) {
    if (!user || !current) return
    const turningOn = !sale.active
    await promotionService.updateSale(user.id, current.id, sale.id, {
      active: turningOn,
      // Re-arm expired campaigns by clearing marker; owner should extend endsAt if needed.
      ...(turningOn ? { expiredAt: undefined } : {}),
    })
  }

  function toggleSaleDay(day: DayOfWeek) {
    setSaleDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    )
  }

  async function removeSale(id: string) {
    if (!user || !current) return
    if (!window.confirm('Delete this sale?')) return
    await promotionService.deleteSale(user.id, current.id, id)
  }
  void tick

  const listEmpty =
    tab === 'coupons' ? filteredCoupons.length === 0 : filteredSales.length === 0

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-stone-900">Coupons & sales</h1>
          <p className="mt-1 text-sm text-stone-500">
            Coupons apply at checkout. Sales discount listed prices on the {copy.catalogNoun} so
            customers see the original price struck through.
          </p>
        </div>
        <Button type="button" onClick={startCreate}>
          <Plus className="h-4 w-4" />
          New {tab === 'coupons' ? 'coupon' : 'sale'}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'coupons' as const, label: 'Coupons', icon: Tag },
            { id: 'sales' as const, label: 'Sales', icon: Percent },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id)
              setCreating(false)
              setQuery('')
            }}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium',
              tab === t.id
                ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder={tab === 'coupons' ? 'Search coupons…' : 'Search sales…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-1">
          {listEmpty && !creating ? (
            <p className="px-3 py-4 text-sm text-stone-500">
              {query
                ? 'No matches.'
                : tab === 'coupons'
                  ? 'No coupons yet.'
                  : 'No sales yet.'}
            </p>
          ) : null}
          {tab === 'coupons'
            ? filteredCoupons.map((coupon) => {
                const status = getCouponLifecycleStatus(coupon, new Date())
                const badge = lifecycleBadge(status)
                const active =
                  !creating && (selectedCoupon?.id ?? '') === coupon.id
                return (
                  <button
                    key={coupon.id}
                    type="button"
                    onClick={() => selectCoupon(coupon.id)}
                    className={cn(
                      'flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm',
                      active
                        ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                        : 'text-stone-700 hover:bg-stone-50',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono font-medium">{coupon.code}</span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </span>
                    <span className="mt-0.5 text-[11px] opacity-70">
                      {coupon.type === 'percent_off'
                        ? `${coupon.percentOff}% off`
                        : `${formatMoney(coupon.amountOffCents ?? 0)} off`}
                    </span>
                  </button>
                )
              })
            : filteredSales.map((sale) => {
                const status = getSaleLifecycleStatus(sale, new Date())
                const badge = lifecycleBadge(status)
                const active = !creating && (selectedSale?.id ?? '') === sale.id
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => selectSale(sale.id)}
                    className={cn(
                      'flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm',
                      active
                        ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                        : 'text-stone-700 hover:bg-stone-50',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{sale.name}</span>
                      <Badge tone={badge.tone}>{badge.label}</Badge>
                    </span>
                    <span className="mt-0.5 text-[11px] opacity-70">
                      {sale.percentOff}% off
                    </span>
                  </button>
                )
              })}
          {creating ? (
            <div className="rounded-xl bg-[var(--color-brand-soft)] px-3 py-2.5 text-sm font-medium text-[var(--color-brand)]">
              New {tab === 'coupons' ? 'coupon' : 'sale'}
            </div>
          ) : null}
        </aside>

        {creating && tab === 'coupons' ? (
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">New coupon</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Create a checkout code customers can redeem.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Code" htmlFor="cpn-code">
                <Input
                  id="cpn-code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="SAVE10"
                />
              </Field>
              <Field label="Type" htmlFor="cpn-type">
                <Select
                  id="cpn-type"
                  value={couponType}
                  onChange={(e) =>
                    setCouponType(e.target.value as 'percent_off' | 'amount_off')
                  }
                >
                  <option value="percent_off">Percent off</option>
                  <option value="amount_off">Fixed $ off</option>
                </Select>
              </Field>
              <Field
                label={couponType === 'percent_off' ? 'Percent' : 'Amount ($)'}
                htmlFor="cpn-val"
              >
                <Input
                  id="cpn-val"
                  type="number"
                  min={0}
                  step={couponType === 'percent_off' ? 1 : 0.01}
                  value={couponValue}
                  onChange={(e) => setCouponValue(e.target.value)}
                />
              </Field>
              <Field label="Min subtotal ($) optional" htmlFor="cpn-min">
                <Input
                  id="cpn-min"
                  type="number"
                  min={0}
                  step={0.01}
                  value={couponMin}
                  onChange={(e) => setCouponMin(e.target.value)}
                />
              </Field>
              <Field label="Schedule" htmlFor="cpn-mode">
                <Select
                  id="cpn-mode"
                  value={couponMode}
                  onChange={(e) => setCouponMode(e.target.value as PromoScheduleMode)}
                >
                  <option value="always">Always on</option>
                  <option value="fixed">One-time (expires)</option>
                  <option value="weekly">Weekly (cyclical)</option>
                </Select>
              </Field>
              {couponMode !== 'always' ? (
                <>
                  <Field
                    label={couponMode === 'weekly' ? 'Campaign start (optional)' : 'Starts'}
                    htmlFor="cpn-start"
                  >
                    <Input
                      id="cpn-start"
                      type="datetime-local"
                      value={couponStartsAt}
                      onChange={(e) => setCouponStartsAt(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={
                      couponMode === 'weekly'
                        ? 'Campaign end (auto-expires)'
                        : 'Ends (auto-expires)'
                    }
                    htmlFor="cpn-end"
                  >
                    <Input
                      id="cpn-end"
                      type="datetime-local"
                      value={couponEndsAt}
                      onChange={(e) => setCouponEndsAt(e.target.value)}
                      min={couponStartsAt || undefined}
                    />
                  </Field>
                </>
              ) : null}
              {couponMode === 'weekly' ? (
                <>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium text-stone-700">Days of week</p>
                    <div className="flex flex-wrap gap-2">
                      {DAY_OPTIONS.map((day) => {
                        const on = couponDays.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleCouponDay(day.value)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-sm font-medium',
                              on
                                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                                : 'border-stone-200 text-stone-600 hover:bg-stone-50',
                            )}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <Field label="Daily start time" htmlFor="cpn-time-start">
                    <Input
                      id="cpn-time-start"
                      type="time"
                      value={couponStartTime}
                      onChange={(e) => setCouponStartTime(e.target.value)}
                    />
                  </Field>
                  <Field label="Daily end time" htmlFor="cpn-time-end">
                    <Input
                      id="cpn-time-end"
                      type="time"
                      value={couponEndTime}
                      onChange={(e) => setCouponEndTime(e.target.value)}
                    />
                  </Field>
                </>
              ) : null}
            </div>
            <Button type="button" disabled={busy} onClick={() => void createCoupon()}>
              Create coupon
            </Button>
          </div>
        ) : null}

        {creating && tab === 'sales' ? (
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">New sale</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Discount listed prices on the {copy.catalogNoun}.
                </p>
              </div>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sale name" htmlFor="sale-name">
                <Input
                  id="sale-name"
                  value={saleName}
                  onChange={(e) => setSaleName(e.target.value)}
                  placeholder="Weekend sale"
                />
              </Field>
              <Field label="Percent off" htmlFor="sale-pct">
                <Input
                  id="sale-pct"
                  type="number"
                  min={1}
                  max={90}
                  value={salePercent}
                  onChange={(e) => setSalePercent(e.target.value)}
                />
              </Field>
              <Field label="Schedule" htmlFor="sale-mode">
                <Select
                  id="sale-mode"
                  value={saleMode}
                  onChange={(e) => setSaleMode(e.target.value as PromoScheduleMode)}
                >
                  <option value="always">Always on</option>
                  <option value="fixed">One-time (expires)</option>
                  <option value="weekly">Weekly (cyclical)</option>
                </Select>
              </Field>
              {saleMode !== 'always' ? (
                <>
                  <Field
                    label={saleMode === 'weekly' ? 'Campaign start (optional)' : 'Starts'}
                    htmlFor="sale-start"
                  >
                    <Input
                      id="sale-start"
                      type="datetime-local"
                      value={saleStartsAt}
                      onChange={(e) => setSaleStartsAt(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={
                      saleMode === 'weekly'
                        ? 'Campaign end (auto-expires)'
                        : 'Ends (auto-expires)'
                    }
                    htmlFor="sale-end"
                  >
                    <Input
                      id="sale-end"
                      type="datetime-local"
                      value={saleEndsAt}
                      onChange={(e) => setSaleEndsAt(e.target.value)}
                      min={saleStartsAt || undefined}
                    />
                  </Field>
                </>
              ) : null}
              {saleMode === 'weekly' ? (
                <>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium text-stone-700">Days of week</p>
                    <div className="flex flex-wrap gap-2">
                      {DAY_OPTIONS.map((day) => {
                        const on = saleDays.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleSaleDay(day.value)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-sm font-medium',
                              on
                                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                                : 'border-stone-200 text-stone-600 hover:bg-stone-50',
                            )}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <Field label="Daily start time" htmlFor="sale-time-start">
                    <Input
                      id="sale-time-start"
                      type="time"
                      value={saleStartTime}
                      onChange={(e) => setSaleStartTime(e.target.value)}
                    />
                  </Field>
                  <Field label="Daily end time" htmlFor="sale-time-end">
                    <Input
                      id="sale-time-end"
                      type="time"
                      value={saleEndTime}
                      onChange={(e) => setSaleEndTime(e.target.value)}
                    />
                  </Field>
                </>
              ) : null}
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={saleStorewide}
                    onChange={(e) => setSaleStorewide(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300"
                  />
                  Storewide (all items)
                </label>
              </div>
              {!saleStorewide ? (
                <div className="sm:col-span-2">
                  <Field label="Item names (one per line)" htmlFor="sale-items">
                    <Textarea
                      id="sale-items"
                      rows={3}
                      value={saleItemIds}
                      onChange={(e) => setSaleItemIds(e.target.value)}
                      placeholder={items
                        .slice(0, 3)
                        .map((i) => i.name)
                        .join('\n')}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void createSale()}>
                Create sale
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const start = new Date()
                  start.setMinutes(0, 0, 0)
                  const end = new Date(start)
                  end.setMonth(end.getMonth() + 3)
                  setSaleMode('weekly')
                  setSaleDays([5, 6])
                  setSaleStartTime('00:00')
                  setSaleEndTime('23:59')
                  setSaleStartsAt(toDatetimeLocalValue(start))
                  setSaleEndsAt(toDatetimeLocalValue(end))
                  setSaleName((n) => n || 'Weekend sale')
                }}
              >
                Prefill weekend cycle
              </Button>
            </div>
          </div>
        ) : null}

        {!creating && tab === 'coupons' && selectedCoupon ? (
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl font-mono">{selectedCoupon.code}</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {describeCouponSchedule(selectedCoupon)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleCoupon(selectedCoupon)}
                >
                  {selectedCoupon.active ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => void removeCoupon(selectedCoupon.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Discount</p>
                <p className="mt-1 font-medium">
                  {selectedCoupon.type === 'percent_off'
                    ? `${selectedCoupon.percentOff}% off`
                    : `${formatMoney(selectedCoupon.amountOffCents ?? 0)} off`}
                </p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Status</p>
                <p className="mt-1 font-medium">
                  {lifecycleBadge(getCouponLifecycleStatus(selectedCoupon, new Date())).label}
                  {' · '}
                  {selectedCoupon.active ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Usage</p>
                <p className="mt-1 font-medium">
                  {selectedCoupon.usedCount}
                  {selectedCoupon.usageLimit ? ` / ${selectedCoupon.usageLimit}` : ''}
                </p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Min subtotal</p>
                <p className="mt-1 font-medium">
                  {selectedCoupon.minSubtotalCents
                    ? formatMoney(selectedCoupon.minSubtotalCents)
                    : 'None'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!creating && tab === 'sales' && selectedSale ? (
          <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl">{selectedSale.name}</h2>
                <p className="mt-1 text-sm text-stone-500">
                  {describeSaleSchedule(selectedSale)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void toggleSale(selectedSale)}
                >
                  {selectedSale.active ? 'Disable' : 'Enable'}
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => void removeSale(selectedSale.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Discount</p>
                <p className="mt-1 font-medium">{selectedSale.percentOff}% off</p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Scope</p>
                <p className="mt-1 font-medium">
                  {selectedSale.itemIds.length === 0
                    ? 'Storewide'
                    : `${selectedSale.itemIds.length} item${selectedSale.itemIds.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2 sm:col-span-2">
                <p className="text-xs uppercase tracking-wider text-stone-400">Status</p>
                <p className="mt-1 font-medium">
                  {lifecycleBadge(getSaleLifecycleStatus(selectedSale, new Date())).label}
                  {' · '}
                  {selectedSale.active ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {!creating && listEmpty ? (
          <div className="flex items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-sm text-stone-500">
            {query
              ? 'No matches for your search.'
              : `Create a ${tab === 'coupons' ? 'coupon' : 'sale'} to get started.`}
          </div>
        ) : null}
      </div>
    </div>
  )
}
