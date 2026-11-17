import type {
  Coupon,
  CurrencyCents,
  DayOfWeek,
  LoyaltyAccount,
  LoyaltyReward,
  LoyaltySettings,
  MenuItem,
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

export type SaleLifecycleStatus =
  | 'live'
  | 'scheduled'
  | 'between_cycles'
  | 'expired'
  | 'off'

/** True when endsAt has passed — eligible for auto-deactivate. */
export function salePastCampaignEnd(sale: Sale, at: Date = new Date()): boolean {
  return Boolean(sale.endsAt && new Date(sale.endsAt) < at)
}

/** Mutates sales in place: ended campaigns → active false (kept for history). */
export function applySaleExpirations(
  sales: Sale[],
  at: Date = new Date(),
  nowIso: () => string = () => new Date().toISOString(),
): number {
  const ts = nowIso()
  let count = 0
  for (const sale of sales) {
    if (!sale.active) continue
    if (!salePastCampaignEnd(sale, at)) continue
    sale.active = false
    sale.expiredAt = ts
    sale.updatedAt = ts
    count += 1
  }
  return count
}

function withinWeeklyWindow(sale: Sale, at: Date): boolean {
  const days = sale.daysOfWeek ?? []
  if (!days.length) return false
  const day = at.getDay() as DayOfWeek
  if (!days.includes(day)) return false

  const startM = parseTimeToMinutes(sale.startTime || '00:00')
  const endM = parseTimeToMinutes(sale.endTime || '23:59')
  const minutes = at.getHours() * 60 + at.getMinutes()

  if (endM < startM) {
    // Overnight window (e.g. 20:00–02:00)
    return minutes >= startM || minutes <= endM
  }
  return minutes >= startM && minutes <= endM
}

/** Whether the sale currently discounts the storefront (owner on + inside schedule). */
export function isSaleActive(sale: Sale, at: Date = new Date()): boolean {
  if (!sale.active || sale.percentOff <= 0) return false
  if (sale.startsAt && new Date(sale.startsAt) > at) return false
  if (salePastCampaignEnd(sale, at)) return false

  const mode = sale.scheduleMode ?? 'fixed'
  if (mode === 'weekly') {
    return withinWeeklyWindow(sale, at)
  }
  // Fixed: any time between startsAt and endsAt (bounds already checked).
  return true
}

export function getSaleLifecycleStatus(
  sale: Sale,
  at: Date = new Date(),
): SaleLifecycleStatus {
  if (sale.expiredAt || salePastCampaignEnd(sale, at)) return 'expired'
  if (!sale.active) return 'off'
  if (sale.startsAt && new Date(sale.startsAt) > at) return 'scheduled'
  if (isSaleActive(sale, at)) return 'live'
  if ((sale.scheduleMode ?? 'fixed') === 'weekly') return 'between_cycles'
  return 'off'
}

export function describeSaleSchedule(sale: Sale): string {
  const mode = sale.scheduleMode ?? 'fixed'
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

  if (mode === 'weekly') {
    const days = (sale.daysOfWeek ?? [])
      .slice()
      .sort((a, b) => a - b)
      .map((d) => dayNames[d])
      .join(', ')
    const window = `${sale.startTime || '00:00'}–${sale.endTime || '23:59'}`
    const bounds = [fmt(sale.startsAt), fmt(sale.endsAt)].filter(Boolean).join(' → ')
    return `Weekly ${days || '(no days)'} ${window}${bounds ? ` · ${bounds}` : ''}`
  }

  if (sale.startsAt || sale.endsAt) {
    return `One-time ${fmt(sale.startsAt) || 'now'} → ${fmt(sale.endsAt) || 'open'}`
  }
  return 'Always on while enabled'
}

export function isCouponActive(coupon: Coupon, at: Date = new Date()): boolean {
  if (!coupon.active) return false
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return false
  if (coupon.startsAt && new Date(coupon.startsAt) > at) return false
  if (coupon.endsAt && new Date(coupon.endsAt) < at) return false
  return true
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
): ListedPrice {
  const sale = findBestSale(itemId, sales, at)
  if (!sale) {
    return { listPriceCents, priceCents: listPriceCents, onSale: false }
  }
  const priceCents = Math.max(
    0,
    Math.round(listPriceCents * (1 - sale.percentOff / 100)),
  )
  return {
    listPriceCents,
    priceCents,
    sale,
    percentOff: sale.percentOff,
    onSale: priceCents < listPriceCents,
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
  return account.email
}
