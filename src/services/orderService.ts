import type {
  MenuItem,
  ModifierGroup,
  Order,
  OrderLineItem,
  OrderStatus,
  OrderingSettings,
  Restaurant,
} from '@/types'
import { getDb, saveDb } from '@/data/db'
import {
  computeCouponDiscount,
  computeLoyaltyDiscount,
  isCouponActive,
  itemHasStock,
  normalizeCouponCode,
  pointsEarnedForSubtotal,
  resolveListedPrice,
} from '@/lib/commerce'
import {
  calculateLineUnitPrice,
  calculateOrderPricing,
  validateModifierSelections,
  type BagComboSelection,
  type BagModifierSelection,
} from '@/lib/pricing'
import {
  createId,
  normalizePhoneKey,
  nowIso,
  phoneLoyaltyEmail,
} from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { trackEvent } from '@/services/analyticsService'
import { expireEndedPromotions } from '@/services/promotionService'
import { normalizeLoyaltySettings } from '@/types'

export interface PlaceOrderInput {
  restaurantId: string
  customer: Order['customer']
  fulfillment: Order['fulfillment']
  tipCents: number
  simulatedCardLast4: string
  lines: Array<{
    itemId: string
    quantity: number
    modifiers: BagModifierSelection[]
    comboSelections?: BagComboSelection[]
    specialInstructions?: string
  }>
  couponCode?: string
  loyaltyRewardId?: string
  /**
   * POS walk-in path: earn/lookup loyalty by customer.phone when no email.
   * Online checkout continues to use email.
   */
  loyaltyByPhone?: boolean
  /** Client-submitted total is ignored — server recalculates */
  clientTotalCents?: number
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
  received: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'out_for_delivery', 'cancelled'],
  ready: ['completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

/** Kitchen / fulfillment can send tickets backward or recall completed ones. */
const STATUS_RETRACT: Record<OrderStatus, OrderStatus[]> = {
  received: [],
  confirmed: ['received'],
  preparing: ['confirmed', 'received'],
  ready: ['preparing', 'confirmed'],
  out_for_delivery: ['ready', 'preparing'],
  completed: ['ready', 'out_for_delivery', 'preparing', 'confirmed'],
  cancelled: ['received', 'preparing'],
}

function allowedTransitions(order: Order): OrderStatus[] {
  const forward =
    order.status === 'preparing'
      ? order.fulfillment.type === 'delivery'
        ? (['out_for_delivery', 'cancelled'] as OrderStatus[])
        : (['ready', 'cancelled'] as OrderStatus[])
      : STATUS_FLOW[order.status]
  const retract = STATUS_RETRACT[order.status] ?? []
  // Deduplicate while preserving order (forward first).
  return [...new Set([...forward, ...retract])]
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const db = await getDb()
  const restaurant = db.restaurants.find((r) => r.id === input.restaurantId)
  if (!restaurant) throw new Error('Restaurant not found.')
  if (!restaurant.ordering.acceptingOrders || restaurant.ordering.temporarilyClosed) {
    throw new Error('This restaurant is not accepting orders right now.')
  }

  if (input.fulfillment.type === 'pickup' && !restaurant.ordering.pickupEnabled) {
    throw new Error('Pickup is not available.')
  }
  if (input.fulfillment.type === 'delivery' && !restaurant.ordering.deliveryEnabled) {
    throw new Error('Delivery is not available.')
  }
  if (!input.customer.name.trim() || !input.customer.phone.trim()) {
    throw new Error('Name and phone are required.')
  }
  if (input.fulfillment.type === 'delivery' && !input.fulfillment.address?.line1) {
    throw new Error('Delivery address is required.')
  }
  if (!input.lines.length) throw new Error('Your bag is empty.')

  const loyalty = normalizeLoyaltySettings(restaurant.loyalty)
  await expireEndedPromotions(restaurant.id)
  const sales = db.sales.filter((s) => s.restaurantId === restaurant.id)
  const now = new Date()

  const lineItems: OrderLineItem[] = []
  let subtotal = 0
  const qtyByItem = new Map<string, number>()

  for (const line of input.lines) {
    const item = db.items.find(
      (i) => i.id === line.itemId && i.restaurantId === input.restaurantId,
    )
    if (!item || !item.active || item.availability !== 'available' || !itemHasStock(item)) {
      throw new Error(`Item “${item?.name ?? line.itemId}” is unavailable.`)
    }

    const requested = (qtyByItem.get(item.id) ?? 0) + line.quantity
    qtyByItem.set(item.id, requested)
    if (item.trackInventory && requested > (item.stockQty ?? 0)) {
      throw new Error(
        `Only ${item.stockQty ?? 0} left of “${item.name}”. Reduce quantity and try again.`,
      )
    }

    const groupIds = db.itemModifiers
      .filter((m) => m.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => m.modifierGroupId)
    const groups = groupIds
      .map((id) => db.modifierGroups.find((g) => g.id === id))
      .filter(Boolean) as ModifierGroup[]

    const errors = validateModifierSelections(groups, line.modifiers)
    if (errors.length) throw new Error(errors[0])

    const combo = db.combos.find((c) => c.itemId === item.id)
    if (item.isCombo && combo) {
      for (const cg of combo.componentGroups) {
        const sel = line.comboSelections?.find((s) => s.groupId === cg.id)
        const count = sel ? 1 : 0
        if (cg.required && count < cg.minQuantity) {
          throw new Error(`Please select “${cg.name}” for ${item.name}.`)
        }
        if (sel && !cg.allowedItemIds.includes(sel.itemId)) {
          throw new Error(`Invalid selection for “${cg.name}”.`)
        }
      }
    }

    const assignment = db.assignments.find(
      (a) =>
        a.itemId === item.id &&
        a.restaurantId === restaurant.id &&
        a.visible,
    )
    const listBase =
      assignment?.priceOverrideCents ??
      (item.isCombo && combo ? combo.basePriceCents : item.basePriceCents)
    const listed = resolveListedPrice(
      listBase,
      item.id,
      sales,
      now,
      item.salePriceCents ?? combo?.salePriceCents,
    )

    // Sale applies to the catalog base; modifiers / combo upgrades stay full price.
    const priced = calculateLineUnitPrice(
      {
        item,
        quantity: line.quantity,
        modifiers: line.modifiers,
        comboSelections: line.comboSelections,
        specialInstructions: line.specialInstructions,
        priceOverrideCents: listed.priceCents,
      },
      groups,
      combo,
      db.items,
    )

    const lineTotal = priced.unitPriceCents * line.quantity
    subtotal += lineTotal
    lineItems.push({
      id: createId('oli'),
      sourceItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      quantity: line.quantity,
      unitPriceCents: priced.unitPriceCents,
      lineTotalCents: lineTotal,
      specialInstructions: line.specialInstructions,
      modifiers: priced.modifiers,
      isCombo: item.isCombo,
      comboSelections: priced.comboSelections,
    })
  }

  if (
    input.fulfillment.type === 'delivery' &&
    subtotal < restaurant.ordering.minimumDeliveryCents
  ) {
    throw new Error(
      `Delivery minimum is $${(restaurant.ordering.minimumDeliveryCents / 100).toFixed(2)}.`,
    )
  }

  let discountCents = 0
  let discountLabel: string | undefined
  let couponCode: string | undefined
  let couponId: string | undefined

  if (input.couponCode?.trim()) {
    const code = normalizeCouponCode(input.couponCode)
    const coupon = db.coupons.find(
      (c) => c.restaurantId === restaurant.id && c.code === code,
    )
    if (!coupon || !isCouponActive(coupon, now)) {
      throw new Error('That coupon is invalid or expired.')
    }
    const result = computeCouponDiscount(
      coupon,
      lineItems.map((l) => ({
        itemId: l.sourceItemId,
        lineTotalCents: l.lineTotalCents,
      })),
    )
    if ('error' in result) throw new Error(result.error)
    discountCents = result.discountCents
    discountLabel = result.label
    couponCode = coupon.code
    couponId = coupon.id
  }

  let loyaltyRewardId: string | undefined
  let loyaltyPointsRedeemed = 0
  let loyaltyAccountId: string | undefined
  const email = input.customer.email?.trim().toLowerCase()
  const phoneKey = normalizePhoneKey(input.customer.phone)
  const phoneLoyalty =
    Boolean(input.loyaltyByPhone) && !email && phoneKey.length >= 10
  const canAccrueLoyalty = Boolean(email) || phoneLoyalty

  if (input.loyaltyRewardId) {
    if (!loyalty.enabled) throw new Error('Loyalty rewards are not enabled.')
    if (!email && !phoneLoyalty) {
      throw new Error('Enter your email or phone to redeem loyalty rewards.')
    }
    const reward = loyalty.rewards.find((r) => r.id === input.loyaltyRewardId)
    if (!reward) throw new Error('Loyalty reward not found.')
    const account = db.loyaltyAccounts.find((a) => {
      if (a.restaurantId !== restaurant.id) return false
      if (email && a.email === email) return true
      if (phoneLoyalty) {
        return (
          a.email === phoneLoyaltyEmail(phoneKey) ||
          normalizePhoneKey(a.phone || '') === phoneKey
        )
      }
      return false
    })
    if (!account || account.pointsBalance < reward.pointsCost) {
      throw new Error('Not enough loyalty points for that reward.')
    }
    const freeLine =
      reward.type === 'free_item' && reward.itemId
        ? lineItems.find((l) => l.sourceItemId === reward.itemId)
        : undefined
    const remainingSubtotal = Math.max(0, subtotal - discountCents)
    const result = computeLoyaltyDiscount(
      reward,
      remainingSubtotal,
      freeLine?.lineTotalCents,
    )
    if ('error' in result) throw new Error(result.error)
    discountCents += result.discountCents
    discountLabel = discountLabel
      ? `${discountLabel} + ${result.label}`
      : result.label
    loyaltyRewardId = reward.id
    loyaltyPointsRedeemed = reward.pointsCost
    loyaltyAccountId = account.id
  }

  const taxableBase = Math.max(0, subtotal - discountCents)
  const earned = pointsEarnedForSubtotal(loyalty, taxableBase)

  const pricing = calculateOrderPricing(
    subtotal,
    restaurant.ordering,
    input.fulfillment.type,
    Math.max(0, input.tipCents),
    {
      discountCents,
      discountLabel,
      couponCode,
      loyaltyPointsEarned: loyalty.enabled && canAccrueLoyalty ? earned : undefined,
      loyaltyPointsRedeemed: loyaltyPointsRedeemed || undefined,
      loyaltyRewardId,
    },
  )

  const ts = nowIso()
  const orderCount = db.orders.filter((o) => o.restaurantId === restaurant.id).length
  const order: Order = {
    id: createId('ord'),
    restaurantId: restaurant.id,
    orderNumber: String(1000 + orderCount + 1),
    reference: createId('ordref'),
    status: 'received',
    customer: {
      name: input.customer.name.trim(),
      phone: input.customer.phone.trim(),
      email: input.customer.email?.trim(),
    },
    fulfillment: input.fulfillment,
    items: lineItems,
    pricing,
    payment: {
      method: 'simulated',
      status: 'authorized',
      simulatedCardLast4: input.simulatedCardLast4.replace(/\D/g, '').slice(-4) || '4242',
      message: 'Simulated payment — no real charge was made.',
    },
    statusHistory: [{ status: 'received', at: ts }],
    estimatedReadyAt: new Date(
      Date.now() + restaurant.ordering.estimatedPrepMinutes * 60_000,
    ).toISOString(),
    createdAt: ts,
    updatedAt: ts,
    loyaltyAccountId,
  }

  await saveDb((d) => {
    d.orders.unshift(order)

    // Inventory
    for (const [itemId, qty] of qtyByItem) {
      const item = d.items.find((i) => i.id === itemId)
      if (!item?.trackInventory) continue
      item.stockQty = Math.max(0, (item.stockQty ?? 0) - qty)
      item.updatedAt = ts
      if (item.stockQty <= 0) {
        item.availability = 'sold_out'
      }
    }

    // Coupon usage
    if (couponId) {
      const coupon = d.coupons.find((c) => c.id === couponId)
      if (coupon) {
        coupon.usedCount += 1
        coupon.updatedAt = ts
      }
    }

    // Loyalty earn / redeem (email online, or opted-in phone on POS)
    if (loyalty.enabled && canAccrueLoyalty) {
      let account = d.loyaltyAccounts.find((a) => {
        if (a.restaurantId !== restaurant.id) return false
        if (email && a.email === email) return true
        if (phoneLoyalty) {
          return (
            a.email === phoneLoyaltyEmail(phoneKey) ||
            normalizePhoneKey(a.phone || '') === phoneKey
          )
        }
        return false
      })
      if (!account) {
        account = {
          id: createId('loyal'),
          restaurantId: restaurant.id,
          email: email || phoneLoyaltyEmail(phoneKey),
          phone: input.customer.phone.trim(),
          name: input.customer.name.trim(),
          pointsBalance: 0,
          lifetimePoints: 0,
          createdAt: ts,
          updatedAt: ts,
        }
        d.loyaltyAccounts.push(account)
      } else {
        account.phone = input.customer.phone.trim()
        account.name = input.customer.name.trim()
        if (email && (!account.email || account.email.startsWith('phone:'))) {
          account.email = email
        }
      }

      if (loyaltyPointsRedeemed > 0) {
        account.pointsBalance = Math.max(0, account.pointsBalance - loyaltyPointsRedeemed)
        d.loyaltyLedger.push({
          id: createId('llg'),
          restaurantId: restaurant.id,
          accountId: account.id,
          orderId: order.id,
          delta: -loyaltyPointsRedeemed,
          reason: `Redeemed reward`,
          balanceAfter: account.pointsBalance,
          createdAt: ts,
        })
      }

      if (earned > 0) {
        account.pointsBalance += earned
        account.lifetimePoints += earned
        d.loyaltyLedger.push({
          id: createId('llg'),
          restaurantId: restaurant.id,
          accountId: account.id,
          orderId: order.id,
          delta: earned,
          reason: 'Points earned on order',
          balanceAfter: account.pointsBalance,
          createdAt: ts,
        })
      }

      account.updatedAt = ts
      order.loyaltyAccountId = account.id
      // Keep pricing snapshot in sync with final earn amount already set
    }
  })

  await trackEvent({
    restaurantId: restaurant.id,
    type: 'order_placed',
    orderId: order.id,
  })
  return order
}

export async function getOrderByReference(reference: string): Promise<Order | null> {
  const db = await getDb()
  return db.orders.find((o) => o.reference === reference || o.id === reference) ?? null
}

export async function listOrders(
  userId: string,
  restaurantId: string,
): Promise<Order[]> {
  await assertRestaurantAccess(userId, restaurantId)
  const db = await getDb()
  return db.orders
    .filter((o) => o.restaurantId === restaurantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
}

export async function advanceOrderStatus(
  userId: string,
  restaurantId: string,
  orderId: string,
  nextStatus: OrderStatus,
  note?: string,
): Promise<Order> {
  await assertRestaurantAccess(userId, restaurantId)
  let updated: Order | null = null
  await saveDb((d) => {
    const order = d.orders.find((o) => o.id === orderId && o.restaurantId === restaurantId)
    if (!order) throw new Error('Order not found.')
    const allowed = allowedTransitions(order)
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Cannot move from ${order.status} to ${nextStatus}.`)
    }
    const previous = order.status
    order.status = nextStatus
    order.updatedAt = nowIso()
    const trimmedNote = note?.trim() || undefined
    if (nextStatus === 'cancelled') {
      order.cancellationNote = trimmedNote
    }
    const historyNote =
      trimmedNote ??
      (isRetractTransition(previous, nextStatus)
        ? previous === 'completed' || previous === 'cancelled'
          ? `Recalled from ${previous.replaceAll('_', ' ')}`
          : `Moved back from ${previous.replaceAll('_', ' ')}`
        : undefined)
    order.statusHistory.push({
      status: nextStatus,
      at: order.updatedAt,
      note: historyNote,
      byUserId: userId,
    })
    if (nextStatus === 'completed') {
      order.payment.status = 'captured'
    }
    updated = order
  })
  return updated!
}

/** Cancel a single line item; optional note is shown to the customer on the tracker. */
export async function cancelOrderLineItem(
  userId: string,
  restaurantId: string,
  orderId: string,
  lineItemId: string,
  note?: string,
): Promise<Order> {
  await assertRestaurantAccess(userId, restaurantId)
  let updated: Order | null = null
  await saveDb((d) => {
    const order = d.orders.find((o) => o.id === orderId && o.restaurantId === restaurantId)
    if (!order) throw new Error('Order not found.')
    if (order.status === 'cancelled' || order.status === 'completed') {
      throw new Error('Cannot cancel items on a closed order.')
    }
    const item = order.items.find((i) => i.id === lineItemId)
    if (!item) throw new Error('Line item not found.')
    if (item.cancelled) throw new Error('Item already cancelled.')

    const trimmed = note?.trim() || undefined
    item.cancelled = true
    item.cancellationNote = trimmed

    const remaining = order.items.filter((i) => !i.cancelled)
    if (remaining.length === 0) {
      order.status = 'cancelled'
      order.cancellationNote =
        trimmed || 'All items were cancelled.'
      order.statusHistory.push({
        status: 'cancelled',
        at: nowIso(),
        note: order.cancellationNote,
        byUserId: userId,
      })
    } else {
      // Reprice merchandise from active lines; keep tax rate, drop fees proportionally simple.
      const subtotal = remaining.reduce((s, i) => s + i.lineTotalCents, 0)
      const taxRate = order.pricing.taxRatePercent / 100
      const taxCents = Math.round(subtotal * taxRate)
      order.pricing.subtotalCents = subtotal
      order.pricing.taxCents = taxCents
      order.pricing.totalCents =
        subtotal -
        (order.pricing.discountCents ?? 0) +
        taxCents +
        order.pricing.deliveryFeeCents +
        order.pricing.tipCents
      order.statusHistory.push({
        status: order.status,
        at: nowIso(),
        note: trimmed
          ? `Cancelled item “${item.name}”: ${trimmed}`
          : `Cancelled item “${item.name}”`,
        byUserId: userId,
      })
    }
    order.updatedAt = nowIso()
    updated = order
  })
  return updated!
}

function isRetractTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (STATUS_RETRACT[from] ?? []).includes(to)
}

export async function rejectOrder(
  userId: string,
  restaurantId: string,
  orderId: string,
  note?: string,
) {
  return advanceOrderStatus(userId, restaurantId, orderId, 'cancelled', note)
}

export async function addInternalNote(
  userId: string,
  restaurantId: string,
  orderId: string,
  note: string,
) {
  await assertRestaurantAccess(userId, restaurantId)
  await saveDb((d) => {
    const order = d.orders.find((o) => o.id === orderId && o.restaurantId === restaurantId)
    if (!order) throw new Error('Order not found.')
    order.internalNotes = note
    order.updatedAt = nowIso()
  })
}

export function nextStatusesFor(order: Order): OrderStatus[] {
  if (order.status === 'preparing') {
    return order.fulfillment.type === 'delivery'
      ? ['out_for_delivery', 'cancelled']
      : ['ready', 'cancelled']
  }
  return STATUS_FLOW[order.status]
}

/** Prior / recall statuses available from the kitchen display. */
export function retractStatusesFor(order: Order): OrderStatus[] {
  let options = [...(STATUS_RETRACT[order.status] ?? [])]
  if (order.status === 'completed' && order.fulfillment.type === 'pickup') {
    options = options.filter((s) => s !== 'out_for_delivery')
  }
  if (order.status === 'completed' && order.fulfillment.type === 'delivery') {
    // Prefer shipping/out path first for delivery recalls.
    options = [
      'out_for_delivery',
      ...options.filter((s) => s !== 'out_for_delivery'),
    ]
  }
  return options
}

export function estimateReadyLabel(restaurant: Restaurant, settings?: OrderingSettings) {
  const mins = settings?.estimatedPrepMinutes ?? restaurant.ordering.estimatedPrepMinutes
  return `About ${mins} minutes`
}

export type { MenuItem }
