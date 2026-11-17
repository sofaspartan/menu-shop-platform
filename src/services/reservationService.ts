import type {
  DiningTable,
  Reservation,
  ReservationSettings,
  ReservationSource,
  ReservationStatus,
  Restaurant,
} from '@/types'
import { normalizeReservationSettings } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createId, nowIso } from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'

export { normalizeReservationSettings }

function confirmationCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

function activeStatuses(status: ReservationStatus): boolean {
  return status === 'booked' || status === 'seated'
}

export async function listTables(restaurantId: string): Promise<DiningTable[]> {
  const db = await getDb()
  return (db.diningTables ?? [])
    .filter((t) => t.restaurantId === restaurantId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export async function createTable(
  userId: string,
  restaurantId: string,
  input: { name: string; seats: number },
): Promise<DiningTable> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const seats = Math.max(1, Math.min(24, Math.round(input.seats) || 2))
  const name = input.name.trim() || `Table ${seats}`
  const ts = nowIso()
  const existing = await listTables(restaurantId)
  const table: DiningTable = {
    id: createId('tbl'),
    restaurantId,
    name,
    seats,
    active: true,
    sortOrder: existing.length,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.diningTables) d.diningTables = []
    d.diningTables.push(table)
  })
  return table
}

export async function updateTable(
  userId: string,
  restaurantId: string,
  tableId: string,
  patch: Partial<Pick<DiningTable, 'name' | 'seats' | 'active' | 'sortOrder'>>,
): Promise<DiningTable> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: DiningTable | null = null
  await saveDb((d) => {
    if (!d.diningTables) d.diningTables = []
    const idx = d.diningTables.findIndex(
      (t) => t.id === tableId && t.restaurantId === restaurantId,
    )
    if (idx < 0) throw new Error('Table not found')
    const next = {
      ...d.diningTables[idx],
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() || d.diningTables[idx].name : d.diningTables[idx].name,
      seats:
        patch.seats !== undefined
          ? Math.max(1, Math.min(24, Math.round(patch.seats) || 1))
          : d.diningTables[idx].seats,
      updatedAt: nowIso(),
    }
    d.diningTables[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Table not found')
  return updated
}

export async function deleteTable(
  userId: string,
  restaurantId: string,
  tableId: string,
): Promise<void> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.diningTables = (d.diningTables ?? []).filter(
      (t) => !(t.id === tableId && t.restaurantId === restaurantId),
    )
    // Detach from open reservations rather than deleting history.
    for (const r of d.reservations ?? []) {
      if (r.restaurantId === restaurantId && r.tableId === tableId) {
        r.tableId = undefined
        r.updatedAt = nowIso()
      }
    }
  })
}

export async function updateReservationSettings(
  userId: string,
  restaurantId: string,
  patch: Partial<ReservationSettings>,
): Promise<Restaurant> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let restaurant: Restaurant | null = null
  await saveDb((d) => {
    const idx = d.restaurants.findIndex((r) => r.id === restaurantId)
    if (idx < 0) throw new Error('Restaurant not found')
    const next = {
      ...d.restaurants[idx],
      reservations: normalizeReservationSettings({
        ...d.restaurants[idx].reservations,
        ...patch,
      }),
      updatedAt: nowIso(),
    }
    d.restaurants[idx] = next
    restaurant = next
  })
  if (!restaurant) throw new Error('Restaurant not found')
  return restaurant
}

export async function listReservations(
  restaurantId: string,
  opts?: { from?: string; to?: string },
): Promise<Reservation[]> {
  const db = await getDb()
  const from = opts?.from ? new Date(opts.from).getTime() : 0
  const to = opts?.to ? new Date(opts.to).getTime() : Number.POSITIVE_INFINITY
  return (db.reservations ?? [])
    .filter((r) => {
      if (r.restaurantId !== restaurantId) return false
      const start = new Date(r.startAt).getTime()
      return start >= from && start <= to
    })
    .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
}

function occupiedTableIds(
  reservations: Reservation[],
  startMs: number,
  endMs: number,
  excludeId?: string,
): Set<string> {
  const occupied = new Set<string>()
  for (const r of reservations) {
    if (excludeId && r.id === excludeId) continue
    if (!activeStatuses(r.status) || !r.tableId) continue
    const rs = new Date(r.startAt).getTime()
    const re = new Date(r.endAt).getTime()
    if (overlaps(startMs, endMs, rs, re)) occupied.add(r.tableId)
  }
  return occupied
}

export async function findAvailableTables(
  restaurantId: string,
  partySize: number,
  startAt: string,
  endAt: string,
  excludeReservationId?: string,
): Promise<DiningTable[]> {
  const db = await getDb()
  const startMs = new Date(startAt).getTime()
  const endMs = new Date(endAt).getTime()
  const occupied = occupiedTableIds(
    (db.reservations ?? []).filter((r) => r.restaurantId === restaurantId),
    startMs,
    endMs,
    excludeReservationId,
  )
  return (db.diningTables ?? [])
    .filter(
      (t) =>
        t.restaurantId === restaurantId &&
        t.active &&
        t.seats >= partySize &&
        !occupied.has(t.id),
    )
    .sort((a, b) => a.seats - b.seats || a.sortOrder - b.sortOrder)
}

export async function listOpenSlots(
  restaurantId: string,
  dayIsoDate: string,
  partySize: number,
): Promise<Array<{ startAt: string; endAt: string; tables: number }>> {
  const db = await getDb()
  const restaurant = db.restaurants.find((r) => r.id === restaurantId)
  if (!restaurant) throw new Error('Restaurant not found')
  const settings = normalizeReservationSettings(restaurant.reservations)
  if (!settings.enabled) return []

  const day = restaurant.businessHours.find((h) => {
    const d = new Date(`${dayIsoDate}T12:00:00`)
    return h.day === d.getDay()
  })
  if (!day || day.closed) return []

  const [openH, openM] = day.open.split(':').map(Number)
  const [closeH, closeM] = day.close.split(':').map(Number)
  const dayStart = new Date(`${dayIsoDate}T00:00:00`)
  const openMs = new Date(dayStart).setHours(openH, openM, 0, 0)
  const closeMs = new Date(dayStart).setHours(closeH, closeM, 0, 0)
  const now = Date.now()
  const lead = settings.minLeadMinutes * 60_000
  const duration = settings.durationMinutes * 60_000
  const step = settings.slotMinutes * 60_000
  const slots: Array<{ startAt: string; endAt: string; tables: number }> = []

  for (let start = openMs; start + duration <= closeMs; start += step) {
    if (start < now + lead) continue
    const end = start + duration
    const tables = await findAvailableTables(
      restaurantId,
      partySize,
      new Date(start).toISOString(),
      new Date(end).toISOString(),
    )
    if (tables.length > 0) {
      slots.push({
        startAt: new Date(start).toISOString(),
        endAt: new Date(end).toISOString(),
        tables: tables.length,
      })
    }
  }
  return slots
}

export async function createReservation(
  restaurantId: string,
  input: {
    guestName: string
    guestEmail?: string
    guestPhone?: string
    partySize: number
    startAt: string
    notes?: string
    source: ReservationSource
    tableId?: string
    userId?: string
    status?: ReservationStatus
  },
): Promise<Reservation> {
  if (input.userId) {
    await assertRestaurantAccess(input.userId, restaurantId, [
      'owner',
      'administrator',
      'manager',
    ])
  }

  const db = await getDb()
  const restaurant = db.restaurants.find((r) => r.id === restaurantId)
  if (!restaurant) throw new Error('Restaurant not found')
  const settings = normalizeReservationSettings(restaurant.reservations)

  if (!input.userId && !settings.enabled) {
    throw new Error('Online reservations are not enabled.')
  }

  const partySize = Math.max(1, Math.min(settings.maxPartySize, Math.round(input.partySize) || 1))
  const startMs = new Date(input.startAt).getTime()
  if (Number.isNaN(startMs)) throw new Error('Invalid reservation time.')

  const endMs = startMs + settings.durationMinutes * 60_000
  const startAt = new Date(startMs).toISOString()
  const endAt = new Date(endMs).toISOString()

  if (!input.userId) {
    const lead = settings.minLeadMinutes * 60_000
    if (startMs < Date.now() + lead) {
      throw new Error('That time is too soon to book online.')
    }
    const max = Date.now() + settings.maxDaysAhead * 24 * 60 * 60_000
    if (startMs > max) {
      throw new Error('That date is too far ahead.')
    }
  }

  const available = await findAvailableTables(restaurantId, partySize, startAt, endAt)
  let tableId = input.tableId
  if (tableId) {
    if (!available.some((t) => t.id === tableId)) {
      throw new Error('That table is not available for this party and time.')
    }
  } else if (available.length) {
    tableId = available[0].id
  } else if (input.source === 'online') {
    throw new Error('No tables available for that party size and time.')
  }

  const ts = nowIso()
  const reservation: Reservation = {
    id: createId('rsv'),
    restaurantId,
    tableId,
    guestName: input.guestName.trim() || 'Guest',
    guestEmail: input.guestEmail?.trim() || undefined,
    guestPhone: input.guestPhone?.trim() || undefined,
    partySize,
    startAt,
    endAt,
    notes: input.notes?.trim() || undefined,
    status: input.status ?? 'booked',
    source: input.source,
    confirmationCode: confirmationCode(),
    createdAt: ts,
    updatedAt: ts,
  }

  await saveDb((d) => {
    if (!d.reservations) d.reservations = []
    d.reservations.push(reservation)
  })
  return reservation
}

export async function updateReservationStatus(
  userId: string,
  restaurantId: string,
  reservationId: string,
  status: ReservationStatus,
  tableId?: string | null,
): Promise<Reservation> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: Reservation | null = null
  await saveDb((d) => {
    if (!d.reservations) d.reservations = []
    const idx = d.reservations.findIndex(
      (r) => r.id === reservationId && r.restaurantId === restaurantId,
    )
    if (idx < 0) throw new Error('Reservation not found')
    const next: Reservation = {
      ...d.reservations[idx],
      status,
      updatedAt: nowIso(),
    }
    if (tableId !== undefined) {
      next.tableId = tableId || undefined
    }
    d.reservations[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Reservation not found')
  return updated
}
