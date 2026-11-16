import type { DayOfWeek, Menu, MenuItem, Restaurant, ScheduleRule } from '@/types'
import { getDayOfWeek, parseTimeToMinutes } from '@/lib/utils'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatHoursSummary(restaurant: Restaurant, at: Date = new Date()) {
  const day = getDayOfWeek(at)
  const hours = restaurant.businessHours.find((h) => h.day === day)
  if (!hours) return 'Hours unavailable'
  if (hours.closed) return `Closed ${DAY_NAMES[day]}`
  return `Today ${hours.open}–${hours.close}`
}

export interface SimulatedClock {
  date: Date
}

function isWithinSchedule(rule: ScheduleRule | undefined, at: Date): boolean {
  if (!rule || !rule.enabled) return true

  const day = getDayOfWeek(at)
  if (!rule.daysOfWeek.includes(day)) return false

  if (rule.startDate) {
    const start = new Date(`${rule.startDate}T00:00:00`)
    if (at < start) return false
  }
  if (rule.endDate) {
    const end = new Date(`${rule.endDate}T23:59:59`)
    if (at > end) return false
  }

  const minutes = at.getHours() * 60 + at.getMinutes()
  const startM = parseTimeToMinutes(rule.startTime)
  const endM = parseTimeToMinutes(rule.endTime)

  if (endM < startM) {
    // Overnight window
    return minutes >= startM || minutes <= endM
  }
  return minutes >= startM && minutes <= endM
}

export function isMenuAvailableNow(menu: Menu, at: Date = new Date()): boolean {
  if (!menu.active) return false
  return isWithinSchedule(menu.schedule, at)
}

export function isItemAvailableNow(item: MenuItem, at: Date = new Date()): boolean {
  if (!item.active) return false
  if (item.availability === 'hidden') return false
  if (item.availability === 'sold_out') return false
  if (item.availability === 'temporarily_unavailable') return false
  return isWithinSchedule(item.schedule, at)
}

export function isRestaurantOpen(restaurant: Restaurant, at: Date = new Date()): boolean {
  if (restaurant.ordering.temporarilyClosed) return false
  const day = getDayOfWeek(at) as DayOfWeek
  const hours = restaurant.businessHours.find((h) => h.day === day)
  if (!hours || hours.closed) return false
  const minutes = at.getHours() * 60 + at.getMinutes()
  const openM = parseTimeToMinutes(hours.open)
  const closeM = parseTimeToMinutes(hours.close)
  if (closeM < openM) return minutes >= openM || minutes <= closeM
  return minutes >= openM && minutes <= closeM
}

export function isAcceptingOrders(restaurant: Restaurant, at: Date = new Date()): boolean {
  if (!restaurant.ordering.acceptingOrders) return false
  if (restaurant.ordering.temporarilyClosed) return false
  if (!isRestaurantOpen(restaurant, at)) return false

  const day = getDayOfWeek(at)
  const hours = restaurant.businessHours.find((h) => h.day === day)
  if (!hours || hours.closed) return false

  const cutoff = restaurant.ordering.orderCutoffMinutesBeforeClose
  const minutes = at.getHours() * 60 + at.getMinutes()
  const closeM = parseTimeToMinutes(hours.close)
  const openM = parseTimeToMinutes(hours.open)

  if (closeM >= openM) {
    return minutes <= closeM - cutoff
  }
  // Overnight: cutoff relative to close after midnight
  if (minutes >= openM) return true
  return minutes <= closeM - cutoff
}

export function getAvailableMenus(
  menus: Menu[],
  restaurant: Restaurant,
  at: Date = new Date(),
): Menu[] {
  const active = menus
    .filter((m) => m.restaurantId === restaurant.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const available = active.filter((m) => isMenuAvailableNow(m, at))
  const unavailableVisible = active.filter(
    (m) => !isMenuAvailableNow(m, at) && m.showWhenUnavailable,
  )

  if (restaurant.overlapBehavior === 'prioritize' && available.length > 1) {
    const top = [...available].sort((a, b) => b.priority - a.priority)[0]
    return top ? [top, ...unavailableVisible] : unavailableVisible
  }

  return [...available, ...unavailableVisible]
}

export function formatScheduleSummary(rule?: ScheduleRule): string {
  if (!rule || !rule.enabled) return 'Always available'
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayLabel = rule.daysOfWeek.map((d) => days[d]).join(', ')
  return `${dayLabel} · ${rule.startTime}–${rule.endTime}`
}
