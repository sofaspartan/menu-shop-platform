import type { AnalyticsEvent, AnalyticsEventType, Order } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createId, nowIso } from '@/lib/utils'

const SESSION_KEY = 'menushop:anon-session'

export function getAnonSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = createId('sess')
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export async function trackEvent(input: {
  restaurantId: string
  type: AnalyticsEventType
  menuId?: string
  itemId?: string
  qrCodeId?: string
  orderId?: string
  metadata?: Record<string, string | number | boolean>
}): Promise<void> {
  const event: AnalyticsEvent = {
    id: createId('evt'),
    at: nowIso(),
    sessionId: getAnonSessionId(),
    ...input,
  }
  await saveDb((d) => {
    d.analyticsEvents.push(event)
    if (input.type === 'qr_scan' && input.qrCodeId) {
      const qr = d.qrCodes.find((q) => q.id === input.qrCodeId)
      if (qr) {
        qr.scanCount += 1
        qr.updatedAt = nowIso()
      }
    }
  })
}

export interface DateRange {
  start: Date
  end: Date
}

export function rangeFromPreset(preset: string): DateRange {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  switch (preset) {
    case 'yesterday': {
      start.setDate(start.getDate() - 1)
      end.setDate(end.getDate() - 1)
      break
    }
    case '7d':
      start.setDate(start.getDate() - 6)
      break
    case '30d':
      start.setDate(start.getDate() - 29)
      break
    case 'month':
      start.setDate(1)
      break
    case 'today':
    default:
      break
  }
  return { start, end }
}

function inRange(iso: string, range: DateRange) {
  const t = new Date(iso).getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

export async function getAnalyticsSummary(restaurantId: string, range: DateRange) {
  const db = await getDb()
  const orders = db.orders.filter(
    (o) =>
      o.restaurantId === restaurantId &&
      o.status !== 'cancelled' &&
      inRange(o.createdAt, range),
  )
  const events = db.analyticsEvents.filter(
    (e) => e.restaurantId === restaurantId && inRange(e.at, range),
  )

  const totalSales = orders.reduce((s, o) => s + o.pricing.totalCents, 0)
  const totalOrders = orders.length
  const avgOrder = totalOrders ? Math.round(totalSales / totalOrders) : 0
  const avgItems = totalOrders
    ? orders.reduce((s, o) => s + o.items.reduce((n, i) => n + i.quantity, 0), 0) / totalOrders
    : 0

  const itemCounts = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const order of orders) {
    for (const item of order.items) {
      const cur = itemCounts.get(item.sourceItemId) || {
        name: item.name,
        qty: 0,
        revenue: 0,
      }
      cur.qty += item.quantity
      cur.revenue += item.lineTotalCents
      itemCounts.set(item.sourceItemId, cur)
    }
  }

  const popularItems = [...itemCounts.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)

  const pickup = orders.filter((o) => o.fulfillment.type === 'pickup').length
  const delivery = orders.filter((o) => o.fulfillment.type === 'delivery').length

  const volumeByDay = buildDailyVolume(orders, range)

  const menuViews = countBy(events.filter((e) => e.type === 'menu_view'), (e) => e.menuId || 'unknown')
  const itemViews = countBy(events.filter((e) => e.type === 'item_view'), (e) => e.itemId || 'unknown')
  const adds = countBy(events.filter((e) => e.type === 'item_add_to_bag'), (e) => e.itemId || 'unknown')
  const removes = countBy(
    events.filter((e) => e.type === 'item_remove_from_bag'),
    (e) => e.itemId || 'unknown',
  )

  const qrScans = db.qrCodes
    .filter((q) => q.restaurantId === restaurantId)
    .map((q) => ({
      id: q.id,
      name: q.name,
      campaign: q.campaign,
      scans: events.filter((e) => e.type === 'qr_scan' && e.qrCodeId === q.id).length,
      lifetimeScans: q.scanCount,
    }))

  const modifierFrequency = new Map<string, number>()
  for (const order of orders) {
    for (const item of order.items) {
      for (const mod of item.modifiers) {
        const key = `${mod.groupName}: ${mod.optionName}`
        modifierFrequency.set(key, (modifierFrequency.get(key) || 0) + item.quantity)
      }
    }
  }

  const sessionsWithOrder = new Set(
    events.filter((e) => e.type === 'order_placed').map((e) => e.sessionId),
  )
  const sessionsWithView = new Set(
    events.filter((e) => e.type === 'menu_view' || e.type === 'link_visit').map((e) => e.sessionId),
  )
  const conversion =
    sessionsWithView.size > 0
      ? Math.round((sessionsWithOrder.size / sessionsWithView.size) * 1000) / 10
      : 0

  return {
    totalOrders,
    totalSales,
    avgOrder,
    avgItems: Math.round(avgItems * 10) / 10,
    popularItems,
    leastPopularItems: [...itemCounts.values()].sort((a, b) => a.qty - b.qty).slice(0, 5),
    pickup,
    delivery,
    volumeByDay,
    menuViews,
    itemViews,
    adds,
    removes,
    qrScans,
    topModifiers: [...modifierFrequency.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    conversion,
    eventCount: events.length,
  }
}

function countBy<T>(items: T[], keyFn: (t: T) => string) {
  const map = new Map<string, number>()
  for (const item of items) {
    const k = keyFn(item)
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
}

function buildDailyVolume(orders: Order[], range: DateRange) {
  const days: Array<{ date: string; orders: number; sales: number }> = []
  const cursor = new Date(range.start)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(range.end)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const dayOrders = orders.filter((o) => o.createdAt.slice(0, 10) === key)
    days.push({
      date: key,
      orders: dayOrders.length,
      sales: dayOrders.reduce((s, o) => s + o.pricing.totalCents, 0) / 100,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
