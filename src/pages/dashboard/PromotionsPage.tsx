import { useMemo, useState } from 'react'
import { Percent, Tag, Trash2 } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as promotionService from '@/services/promotionService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { storeCopy } from '@/lib/storeCopy'
import { formatMoney } from '@/lib/utils'
import type { Coupon, Sale } from '@/types'

export function PromotionsPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [couponCode, setCouponCode] = useState('')
  const [couponType, setCouponType] = useState<'percent_off' | 'amount_off'>('percent_off')
  const [couponValue, setCouponValue] = useState('10')
  const [couponMin, setCouponMin] = useState('')

  const [saleName, setSaleName] = useState('')
  const [salePercent, setSalePercent] = useState('20')
  const [saleItemIds, setSaleItemIds] = useState('')
  const [saleStorewide, setSaleStorewide] = useState(false)

  const copy = storeCopy(current?.storeKind)

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
      })
      setCouponCode('')
      setCouponValue('10')
      setCouponMin('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create coupon.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleCoupon(coupon: Coupon) {
    if (!user || !current) return
    await promotionService.updateCoupon(user.id, current.id, coupon.id, {
      active: !coupon.active,
    })
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
      })
      setSaleName('')
      setSalePercent('20')
      setSaleItemIds('')
      setSaleStorewide(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create sale.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleSale(sale: Sale) {
    if (!user || !current) return
    await promotionService.updateSale(user.id, current.id, sale.id, {
      active: !sale.active,
    })
  }

  async function removeSale(id: string) {
    if (!user || !current) return
    if (!window.confirm('Delete this sale?')) return
    await promotionService.deleteSale(user.id, current.id, id)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
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
            coupons.map((coupon) => (
              <li
                key={coupon.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="font-mono text-sm font-semibold">{coupon.code}</div>
                  <div className="text-xs text-stone-500">
                    {coupon.type === 'percent_off'
                      ? `${coupon.percentOff}% off`
                      : `${formatMoney(coupon.amountOffCents ?? 0)} off`}
                    {coupon.minSubtotalCents
                      ? ` · min ${formatMoney(coupon.minSubtotalCents)}`
                      : ''}
                    {` · used ${coupon.usedCount}${coupon.usageLimit ? `/${coupon.usageLimit}` : ''}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void toggleCoupon(coupon)}>
                    <Badge tone={coupon.active ? 'success' : 'neutral'}>
                      {coupon.active ? 'Active' : 'Off'}
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
            ))
          )}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Percent className="h-5 w-5 text-stone-500" />
          <h2 className="text-lg font-semibold">Sales</h2>
        </div>
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
          <div className="sm:col-span-2">
            <Button type="button" disabled={busy} onClick={() => void createSale()}>
              Create sale
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
          {sales.length === 0 ? (
            <li className="px-4 py-6 text-sm text-stone-500">No sales yet.</li>
          ) : (
            sales.map((sale) => (
              <li
                key={sale.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-semibold">
                    {sale.name} · {sale.percentOff}% off
                  </div>
                  <div className="text-xs text-stone-500">
                    {sale.itemIds.length === 0
                      ? 'Storewide'
                      : `${sale.itemIds.length} item${sale.itemIds.length === 1 ? '' : 's'}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void toggleSale(sale)}>
                    <Badge tone={sale.active ? 'success' : 'neutral'}>
                      {sale.active ? 'Active' : 'Off'}
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
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
