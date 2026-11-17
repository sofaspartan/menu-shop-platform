import { useEffect, useMemo, useState } from 'react'
import { Percent, Tag, Trash2 } from 'lucide-react'
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

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a store to manage promotions.</p>
  }

  async function createCoupon() {
    if (!user || !current) return
    setBusy(true)
    setError('')
    try {
      const value = Number.parseFloat(couponValue)
      await promotionService.createCoupon(user.id, current.id, {
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
      await promotionService.createSale(user.id, current.id, {
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

  return (
    <div className="space-y-10 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Coupons & sales</h1>
        <p className="mt-1 text-sm text-stone-500">
          Coupons apply at checkout. Sales discount listed prices on the {copy.catalogNoun} so
          customers see the original price struck through.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-stone-500" />
          <h2 className="text-lg font-semibold">Coupons</h2>
        </div>
        <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
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
                hint="When this passes, the coupon turns off but stays in your list."
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
          ) : (
            <p className="sm:col-span-2 text-xs text-stone-500">
              This code stays redeemable until you disable it (or it hits a usage limit).
            </p>
          )}
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
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy} onClick={() => void createCoupon()}>
              Create coupon
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {coupons.length === 0 ? (
            <li className="px-4 py-6 text-sm text-stone-500">No coupons yet.</li>
          ) : (
            coupons.map((coupon) => {
              const status = getCouponLifecycleStatus(coupon, new Date())
              void tick
              const badge = lifecycleBadge(status)
              return (
                <li
                  key={coupon.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold">{coupon.code}</div>
                    <div className="text-xs text-stone-500">
                      {coupon.type === 'percent_off'
                        ? `${coupon.percentOff}% off`
                        : `${formatMoney(coupon.amountOffCents ?? 0)} off`}
                      {coupon.minSubtotalCents
                        ? ` · min ${formatMoney(coupon.minSubtotalCents)}`
                        : ''}
                      {` · used ${coupon.usedCount}${coupon.usageLimit ? `/${coupon.usageLimit}` : ''}`}
                      {' · '}
                      {describeCouponSchedule(coupon)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    <button type="button" onClick={() => void toggleCoupon(coupon)}>
                      <Badge tone={coupon.active ? 'success' : 'neutral'}>
                        {coupon.active ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete coupon"
                      onClick={() => void removeCoupon(coupon.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-stone-500" />
          <h2 className="text-lg font-semibold">Sales</h2>
        </div>
        <p className="text-sm text-stone-500">
          Always-on, one-time, or weekly. Fixed/weekly campaigns auto-expire when their end
          passes (turned off, not deleted).
        </p>
        <div className="grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
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
          <div className="hidden sm:block" />
          {saleMode !== 'always' ? (
            <>
              <Field
                label={saleMode === 'weekly' ? 'Campaign start (optional)' : 'Starts'}
                htmlFor="sale-start"
                hint={
                  saleMode === 'fixed'
                    ? 'Leave blank to start immediately.'
                    : 'Weekly cycles begin after this time.'
                }
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
                  saleMode === 'weekly' ? 'Campaign end (auto-expires)' : 'Ends (auto-expires)'
                }
                htmlFor="sale-end"
                hint="When this passes, the sale turns off but stays in your list."
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
          ) : (
            <p className="sm:col-span-2 text-xs text-stone-500">
              Stays on the storefront until you disable it.
            </p>
          )}
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
              <Field
                label="Item names (one per line)"
                htmlFor="sale-items"
                hint="Match catalog item names exactly."
              >
                <Textarea
                  id="sale-items"
                  rows={3}
                  value={saleItemIds}
                  onChange={(e) => setSaleItemIds(e.target.value)}
                  placeholder={items.slice(0, 3).map((i) => i.name).join('\n')}
                />
              </Field>
            </div>
          ) : null}
          <div className="sm:col-span-2 flex flex-wrap gap-2">
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
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {sales.length === 0 ? (
            <li className="px-4 py-6 text-sm text-stone-500">No sales yet.</li>
          ) : (
            sales.map((sale) => {
              const status = getSaleLifecycleStatus(sale, new Date())
              // tick forces re-eval of live/between_cycles without remounting
              void tick
              const badge = lifecycleBadge(status)
              return (
                <li
                  key={sale.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {sale.name} · {sale.percentOff}% off
                    </div>
                    <div className="text-xs text-stone-500">
                      {sale.itemIds.length === 0
                        ? 'Storewide'
                        : `${sale.itemIds.length} item${sale.itemIds.length === 1 ? '' : 's'}`}
                      {' · '}
                      {describeSaleSchedule(sale)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    <button type="button" onClick={() => void toggleSale(sale)}>
                      <Badge tone={sale.active ? 'success' : 'neutral'}>
                        {sale.active ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Delete sale"
                      onClick={() => void removeSale(sale.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </section>
    </div>
  )
}
