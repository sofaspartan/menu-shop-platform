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
  calculateLineUnitPrice,
  calculateOrderPricing,
  validateModifierSelections,
  type BagComboSelection,
  type BagModifierSelection,
} from '@/lib/pricing'
import { createId, nowIso } from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { trackEvent } from '@/services/analyticsService'

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

  const lineItems: OrderLineItem[] = []
  let subtotal = 0

  for (const line of input.lines) {
    const item = db.items.find(
      (i) => i.id === line.itemId && i.restaurantId === input.restaurantId,
    )
    if (!item || !item.active || item.availability !== 'available') {
      throw new Error(`Item “${item?.name ?? line.itemId}” is unavailable.`)
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

    const priced = calculateLineUnitPrice(
      {
        item,
        quantity: line.quantity,
        modifiers: line.modifiers,
        comboSelections: line.comboSelections,
        specialInstructions: line.specialInstructions,
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

  const pricing = calculateOrderPricing(
    subtotal,
    restaurant.ordering,
    input.fulfillment.type,
    Math.max(0, input.tipCents),
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
  }

  await saveDb((d) => {
    d.orders.unshift(order)
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
    const allowed = STATUS_FLOW[order.status]
    if (!allowed.includes(nextStatus)) {
      throw new Error(`Cannot move from ${order.status} to ${nextStatus}.`)
    }
    order.status = nextStatus
    order.updatedAt = nowIso()
    order.statusHistory.push({
      status: nextStatus,
      at: order.updatedAt,
      note,
      byUserId: userId,
    })
    if (nextStatus === 'completed') {
      order.payment.status = 'captured'
    }
    updated = order
  })
  return updated!
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

export function estimateReadyLabel(restaurant: Restaurant, settings?: OrderingSettings) {
  const mins = settings?.estimatedPrepMinutes ?? restaurant.ordering.estimatedPrepMinutes
  return `About ${mins} minutes`
}

export type { MenuItem }
