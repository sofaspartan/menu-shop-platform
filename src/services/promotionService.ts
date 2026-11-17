import type { Coupon, Sale } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { normalizeCouponCode } from '@/lib/commerce'
import { createId, nowIso } from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'

export async function listCoupons(userId: string, restaurantId: string): Promise<Coupon[]> {
  await assertRestaurantAccess(userId, restaurantId)
  const db = await getDb()
  return db.coupons
    .filter((c) => c.restaurantId === restaurantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function listSales(userId: string, restaurantId: string): Promise<Sale[]> {
  await assertRestaurantAccess(userId, restaurantId)
  const db = await getDb()
  return db.sales
    .filter((s) => s.restaurantId === restaurantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function getActiveSalesForStore(restaurantId: string): Promise<Sale[]> {
  const db = await getDb()
  return db.sales.filter((s) => s.restaurantId === restaurantId)
}

export async function findCouponByCode(
  restaurantId: string,
  code: string,
): Promise<Coupon | null> {
  const normalized = normalizeCouponCode(code)
  if (!normalized) return null
  const db = await getDb()
  return (
    db.coupons.find(
      (c) => c.restaurantId === restaurantId && c.code === normalized,
    ) ?? null
  )
}

export async function createCoupon(
  userId: string,
  restaurantId: string,
  input: Omit<Coupon, 'id' | 'restaurantId' | 'usedCount' | 'createdAt' | 'updatedAt' | 'code'> & {
    code: string
  },
): Promise<Coupon> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const code = normalizeCouponCode(input.code)
  if (!code) throw new Error('Coupon code is required.')
  const db = await getDb()
  if (db.coupons.some((c) => c.restaurantId === restaurantId && c.code === code)) {
    throw new Error('That coupon code already exists.')
  }
  const ts = nowIso()
  const coupon: Coupon = {
    id: createId('cpn'),
    restaurantId,
    code,
    type: input.type,
    percentOff: input.percentOff,
    amountOffCents: input.amountOffCents,
    minSubtotalCents: input.minSubtotalCents,
    maxDiscountCents: input.maxDiscountCents,
    itemIds: input.itemIds,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    active: input.active ?? true,
    usageLimit: input.usageLimit,
    usedCount: 0,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => d.coupons.push(coupon))
  return coupon
}

export async function updateCoupon(
  userId: string,
  restaurantId: string,
  couponId: string,
  patch: Partial<Coupon>,
): Promise<Coupon> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: Coupon | null = null
  await saveDb((d) => {
    const coupon = d.coupons.find(
      (c) => c.id === couponId && c.restaurantId === restaurantId,
    )
    if (!coupon) throw new Error('Coupon not found.')
    if (patch.code) {
      const code = normalizeCouponCode(patch.code)
      if (
        d.coupons.some(
          (c) =>
            c.restaurantId === restaurantId &&
            c.code === code &&
            c.id !== couponId,
        )
      ) {
        throw new Error('That coupon code already exists.')
      }
      coupon.code = code
    }
    const { id: _id, restaurantId: _r, usedCount: _u, createdAt: _c, ...rest } = patch
    Object.assign(coupon, rest, { updatedAt: nowIso() })
    updated = coupon
  })
  return updated!
}

export async function deleteCoupon(
  userId: string,
  restaurantId: string,
  couponId: string,
): Promise<void> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.coupons = d.coupons.filter(
      (c) => !(c.id === couponId && c.restaurantId === restaurantId),
    )
  })
}

export async function createSale(
  userId: string,
  restaurantId: string,
  input: Omit<Sale, 'id' | 'restaurantId' | 'createdAt' | 'updatedAt'>,
): Promise<Sale> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  if (input.percentOff <= 0 || input.percentOff > 90) {
    throw new Error('Sale percent must be between 1 and 90.')
  }
  const ts = nowIso()
  const sale: Sale = {
    id: createId('sale'),
    restaurantId,
    name: input.name.trim() || `${input.percentOff}% off`,
    percentOff: input.percentOff,
    itemIds: input.itemIds ?? [],
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    active: input.active ?? true,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => d.sales.push(sale))
  return sale
}

export async function updateSale(
  userId: string,
  restaurantId: string,
  saleId: string,
  patch: Partial<Sale>,
): Promise<Sale> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: Sale | null = null
  await saveDb((d) => {
    const sale = d.sales.find((s) => s.id === saleId && s.restaurantId === restaurantId)
    if (!sale) throw new Error('Sale not found.')
    const { id: _id, restaurantId: _r, createdAt: _c, ...rest } = patch
    Object.assign(sale, rest, { updatedAt: nowIso() })
    updated = sale
  })
  return updated!
}

export async function deleteSale(
  userId: string,
  restaurantId: string,
  saleId: string,
): Promise<void> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.sales = d.sales.filter(
      (s) => !(s.id === saleId && s.restaurantId === restaurantId),
    )
  })
}
