import type {
  Coupon,
  CurrencyCents,
  DayOfWeek,
  LoyaltyAccount,
  LoyaltyReward,
  LoyaltySettings,
  MenuItem,
  PromoScheduleMode,
  Sale,
} from '@/types'
import { formatMoney, parseTimeToMinutes } from '@/lib/utils'

export interface ListedPrice {
  /** Pre-sale list / assignment price */
  listPriceCents: CurrencyCents
  /** What the customer pays (after active sale %) */
  priceCents: CurrencyCents
  sale?: Sale
  percentOff?: number
  onSale: boolean
}

export type PromoLifecycleStatus =
  | 'live'
  | 'scheduled'
  | 'between_cycles'
  | 'expired'
  | 'off'

/** @deprecated Use PromoLifecycleStatus */
export type SaleLifecycleStatus = PromoLifecycleStatus

type SchedulablePromo = {
  active: boolean
  startsAt?: string
  endsAt?: string
  scheduleMode?: PromoScheduleMode
  daysOfWeek?: DayOfWeek[]
  startTime?: string
  endTime?: string
  expiredAt?: string
  updatedAt?: string
}

function resolveScheduleMode(
  promo: SchedulablePromo,
  fallback: PromoScheduleMode,
): PromoScheduleMode {
  return promo.scheduleMode ?? fallback
}

/** True when endsAt has passed — eligible for auto-deactivate (not for `always`). */
export function promoPastCampaignEnd(
  promo: SchedulablePromo,
  at: Date = new Date(),
  fallbackMode: PromoScheduleMode = 'fixed',
): boolean {
  const mode = resolveScheduleMode(promo, fallbackMode)
  if (mode === 'always') return false
  return Boolean(promo.endsAt && new Date(promo.endsAt) < at)
}

export function salePastCampaignEnd(sale: Sale, at: Date = new Date()): boolean {
  return promoPastCampaignEnd(sale, at, 'fixed')
}

export function couponPastCampaignEnd(coupon: Coupon, at: Date = new Date()): boolean {
  return promoPastCampaignEnd(coupon, at, 'always')
}

function applyPromoExpirations(
  promos: SchedulablePromo[],
  fallbackMode: PromoScheduleMode,
  at: Date,
  nowIso: () => string,
): number {
  const ts = nowIso()
  let count = 0
  for (const promo of promos) {
    if (!promo.active) continue
    if (!promoPastCampaignEnd(promo, at, fallbackMode)) continue
    promo.active = false
    promo.expiredAt = ts
    promo.updatedAt = ts
    count += 1
  }
  return count
}

/** Mutates sales in place: ended campaigns → active false (kept for history). */
export function applySaleExpirations(
  sales: Sale[],
  at: Date = new Date(),
  nowIso: () => string = () => new Date().toISOString(),
): number {
  return applyPromoExpirations(sales, 'fixed', at, nowIso)
}

/** Mutates coupons in place: ended campaigns → active false (kept for history). */
export function applyCouponExpirations(
  coupons: Coupon[],
  at: Date = new Date(),
  nowIso: () => string = () => new Date().toISOString(),
): number {
  return applyPromoExpirations(coupons, 'always', at, nowIso)
}

function withinWeeklyWindow(promo: SchedulablePromo, at: Date): boolean {
  const days = promo.daysOfWeek ?? []
  if (!days.length) return false
  const day = at.getDay() as DayOfWeek
  if (!days.includes(day)) return false

  const startM = parseTimeToMinutes(promo.startTime || '00:00')
  const endM = parseTimeToMinutes(promo.endTime || '23:59')
  const minutes = at.getHours() * 60 + at.getMinutes()

  if (endM < startM) {
    // Overnight window (e.g. 20:00–02:00)
    return minutes >= startM || minutes <= endM
  }
  return minutes >= startM && minutes <= endM
}

function isScheduleLive(
  promo: SchedulablePromo,
  at: Date,
  fallbackMode: PromoScheduleMode,
): boolean {
  if (!promo.active) return false
  if (promo.startsAt && new Date(promo.startsAt) > at) return false
  if (promoPastCampaignEnd(promo, at, fallbackMode)) return false

  const mode = resolveScheduleMode(promo, fallbackMode)
  if (mode === 'weekly') return withinWeeklyWindow(promo, at)
  // always | fixed: live whenever enabled and inside campaign bounds
  return true
}

/** Whether the sale currently discounts the storefront (owner on + inside schedule). */
export function isSaleActive(sale: Sale, at: Date = new Date()): boolean {
  if (sale.percentOff <= 0) return false
  return isScheduleLive(sale, at, 'fixed')
}

export function getPromoLifecycleStatus(
  promo: SchedulablePromo,
  at: Date = new Date(),
  fallbackMode: PromoScheduleMode = 'fixed',
): PromoLifecycleStatus {
  if (promo.expiredAt || promoPastCampaignEnd(promo, at, fallbackMode)) return 'expired'
  if (!promo.active) return 'off'
  if (promo.startsAt && new Date(promo.startsAt) > at) return 'scheduled'
  if (isScheduleLive(promo, at, fallbackMode)) return 'live'
  if (resolveScheduleMode(promo, fallbackMode) === 'weekly') return 'between_cycles'
  return 'off'
}

export function getSaleLifecycleStatus(
  sale: Sale,
  at: Date = new Date(),
): PromoLifecycleStatus {
  return getPromoLifecycleStatus(sale, at, 'fixed')
}

export function getCouponLifecycleStatus(
  coupon: Coupon,
  at: Date = new Date(),
): PromoLifecycleStatus {
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return 'expired'
  }
  return getPromoLifecycleStatus(coupon, at, 'always')
}

export function describePromoSchedule(
  promo: SchedulablePromo,
  fallbackMode: PromoScheduleMode = 'fixed',
): string {
  const mode = resolveScheduleMode(promo, fallbackMode)
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : null

  if (mode === 'always') return 'Always on while enabled'
  if (mode === 'weekly') {
    const days = (promo.daysOfWeek ?? [])
      .slice()
      .sort((a, b) => a - b)
      .map((d) => dayNames[d])
      .join(', ')
    const window = `${promo.startTime || '00:00'}–${promo.endTime || '23:59'}`
    const bounds = [fmt(promo.startsAt), fmt(promo.endsAt)].filter(Boolean).join(' → ')
    return `Weekly ${days || '(no days)'} ${window}${bounds ? ` · ${bounds}` : ''}`
  }

  if (promo.startsAt || promo.endsAt) {
    return `One-time ${fmt(promo.startsAt) || 'now'} → ${fmt(promo.endsAt) || 'open'}`
  }
  return 'One-time (no end set)'
}

export function describeSaleSchedule(sale: Sale): string {
  return describePromoSchedule(sale, 'fixed')
}

export function describeCouponSchedule(coupon: Coupon): string {
  return describePromoSchedule(coupon, 'always')
}

export function isCouponActive(coupon: Coupon, at: Date = new Date()): boolean {
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return false
  return isScheduleLive(coupon, at, 'always')
}

/** Best active sale for an item (highest percent wins). */
export function findBestSale(
  itemId: string,
  sales: Sale[],
  at: Date = new Date(),
): Sale | undefined {
  let best: Sale | undefined
  for (const sale of sales) {
    if (!isSaleActive(sale, at)) continue
    const applies =
      sale.itemIds.length === 0 || sale.itemIds.includes(itemId)
    if (!applies) continue
    if (!best || sale.percentOff > best.percentOff) best = sale
  }
  return best
}

export function resolveListedPrice(
  listPriceCents: CurrencyCents,
  itemId: string,
  sales: Sale[],
  at: Date = new Date(),
  /** Per-item/bundle sale price (absolute), when set below list. */
  itemSalePriceCents?: CurrencyCents,
): ListedPrice {
  const sale = findBestSale(itemId, sales, at)
  const fromPromo = sale
    ? Math.max(0, Math.round(listPriceCents * (1 - sale.percentOff / 100)))
    : null
  const fromItem =
    itemSalePriceCents != null &&
    itemSalePriceCents >= 0 &&
    itemSalePriceCents < listPriceCents
      ? itemSalePriceCents
      : null

  if (fromPromo == null && fromItem == null) {
    return { listPriceCents, priceCents: listPriceCents, onSale: false }
  }

  // Prefer the lower customer price when both apply.
  if (fromItem != null && (fromPromo == null || fromItem <= fromPromo)) {
    const percentOff = Math.round((1 - fromItem / listPriceCents) * 100)
    return {
      listPriceCents,
      priceCents: fromItem,
      percentOff,
      onSale: true,
    }
  }

  return {
    listPriceCents,
    priceCents: fromPromo!,
    sale,
    percentOff: sale!.percentOff,
    onSale: fromPromo! < listPriceCents,
  }
}

export function itemHasStock(item: Pick<MenuItem, 'trackInventory' | 'stockQty'>): boolean {
  if (!item.trackInventory) return true
  return (item.stockQty ?? 0) > 0
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '')
}

export function computeCouponDiscount(
  coupon: Coupon,
  lines: Array<{ itemId: string; lineTotalCents: number }>,
): { discountCents: number; label: string } | { error: string } {
  const eligibleSubtotal = lines
    .filter(
      (l) =>
        !coupon.itemIds?.length || coupon.itemIds.includes(l.itemId),
    )
    .reduce((sum, l) => sum + l.lineTotalCents, 0)

  if (coupon.minSubtotalCents != null && eligibleSubtotal < coupon.minSubtotalCents) {
    return {
      error: `Coupon requires at least ${formatMoney(coupon.minSubtotalCents)} on eligible items.`,
    }
  }
  if (eligibleSubtotal <= 0) {
    return { error: 'This coupon does not apply to items in your bag.' }
  }

  let discount = 0
  if (coupon.type === 'percent_off') {
    discount = Math.round(eligibleSubtotal * ((coupon.percentOff ?? 0) / 100))
  } else {
    discount = coupon.amountOffCents ?? 0
  }
  if (coupon.maxDiscountCents != null) {
    discount = Math.min(discount, coupon.maxDiscountCents)
  }
  discount = Math.min(discount, eligibleSubtotal)
  if (discount <= 0) return { error: 'Coupon has no discount value.' }

  const label =
    coupon.type === 'percent_off'
      ? `${coupon.percentOff}% off (${coupon.code})`
      : `${formatMoney(discount)} off (${coupon.code})`

  return { discountCents: discount, label }
}

export function computeLoyaltyDiscount(
  reward: LoyaltyReward,
  subtotalCents: number,
  freeItemLineTotal?: number,
): { discountCents: number; label: string } | { error: string } {
  if (reward.type === 'percent_off') {
    let discount = Math.round(subtotalCents * ((reward.percentOff ?? 0) / 100))
    if (reward.maxDiscountCents != null) {
      discount = Math.min(discount, reward.maxDiscountCents)
    }
    discount = Math.min(discount, subtotalCents)
    return {
      discountCents: discount,
      label: reward.label || `${reward.percentOff}% loyalty reward`,
    }
  }
  if (reward.type === 'amount_off') {
    const discount = Math.min(reward.amountOffCents ?? 0, subtotalCents)
    return {
      discountCents: discount,
      label: reward.label || `${formatMoney(discount)} loyalty reward`,
    }
  }
  // free_item
  const discount = Math.min(freeItemLineTotal ?? 0, subtotalCents)
  if (discount <= 0) {
    return { error: 'Add the free reward item to your bag to redeem this reward.' }
  }
  return {
    discountCents: discount,
    label: reward.label || 'Free item reward',
  }
}

export function pointsEarnedForSubtotal(
  settings: LoyaltySettings,
  subtotalAfterDiscountsCents: number,
): number {
  if (!settings.enabled || settings.pointsPerDollar <= 0) return 0
  const dollars = Math.max(0, subtotalAfterDiscountsCents) / 100
  return Math.floor(dollars * settings.pointsPerDollar)
}

export function nextRewardProgress(
  settings: LoyaltySettings,
  balance: number,
): { next?: LoyaltyReward; pointsNeeded: number } {
  const sorted = [...settings.rewards].sort((a, b) => a.pointsCost - b.pointsCost)
  const next = sorted.find((r) => r.pointsCost > balance) ?? sorted[sorted.length - 1]
  if (!next) return { pointsNeeded: 0 }
  return {
    next,
    pointsNeeded: Math.max(0, next.pointsCost - balance),
  }
}

export function accountDisplay(account: LoyaltyAccount): string {
  if (account.email && !account.email.startsWith('phone:')) return account.email
  if (account.phone) {
    const digits = account.phone.replace(/\D/g, '')
    if (digits.length >= 10) {
      const d = digits.slice(-10)
      return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    }
    return account.phone
  }
  if (account.email?.startsWith('phone:')) {
    const d = account.email.slice('phone:'.length)
    if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  }
  return account.email || 'Loyalty member'
}
