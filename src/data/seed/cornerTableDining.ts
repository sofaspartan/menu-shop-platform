import type { DiningTable, Reservation } from '@/types'

const CORNER_TABLE_ID = 'rest_corner_table'
const VISIT_MS = 90 * 60_000

function atLocal(daysFromNow: number, hour: number, minute: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d
}

function range(daysFromNow: number, hour: number, minute: number): {
  startAt: string
  endAt: string
} {
  const start = atLocal(daysFromNow, hour, minute)
  return {
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + VISIT_MS).toISOString(),
  }
}

/** Floor plan + sample bookings for The Corner Table demo. */
export function buildCornerTableDiningSeed(ts: string): {
  tables: DiningTable[]
  reservations: Reservation[]
} {
  const restaurantId = CORNER_TABLE_ID

  const tables: DiningTable[] = [
    {
      id: 'tbl_ct_1',
      restaurantId,
      name: 'Window 1',
      seats: 2,
      active: true,
      sortOrder: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_2',
      restaurantId,
      name: 'Window 2',
      seats: 2,
      active: true,
      sortOrder: 1,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_bar',
      restaurantId,
      name: 'Bar 2',
      seats: 2,
      active: true,
      sortOrder: 2,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_4',
      restaurantId,
      name: 'Booth A',
      seats: 4,
      active: true,
      sortOrder: 3,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_4b',
      restaurantId,
      name: 'Booth B',
      seats: 4,
      active: true,
      sortOrder: 4,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_patio',
      restaurantId,
      name: 'Patio 4',
      seats: 4,
      active: true,
      sortOrder: 5,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_6',
      restaurantId,
      name: 'Garden 6',
      seats: 6,
      active: true,
      sortOrder: 6,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_8',
      restaurantId,
      name: 'Private 8',
      seats: 8,
      active: true,
      sortOrder: 7,
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  const lunch = range(0, 12, 0)
  const dinnerEarly = range(0, 18, 0)
  const dinnerLate = range(0, 19, 30)
  const tomorrowLunch = range(1, 12, 30)
  const tomorrowAnni = range(1, 18, 30)
  const tomorrowParty = range(1, 19, 30)
  const dayAfter = range(2, 17, 0)
  const yesterday = range(-1, 19, 0)

  const reservations: Reservation[] = [
    {
      id: 'rsv_ct_walkin_now',
      restaurantId,
      tableId: 'tbl_ct_1',
      guestName: 'Casey Nguyen',
      guestPhone: '5550101111',
      partySize: 2,
      ...lunch,
      notes: 'Walk-in — already seated for lunch',
      status: 'seated',
      source: 'walk_in',
      confirmationCode: 'WALKIN',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_today_dinner',
      restaurantId,
      tableId: 'tbl_ct_4',
      guestName: 'Sam Rivera',
      guestEmail: 'sam.rivera@example.com',
      guestPhone: '5550102222',
      partySize: 3,
      ...dinnerEarly,
      notes: 'High chair if available',
      status: 'booked',
      source: 'online',
      confirmationCode: 'SAM6PM',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_today_phone',
      restaurantId,
      tableId: 'tbl_ct_6',
      guestName: 'Priya Shah',
      guestPhone: '5550103333',
      partySize: 5,
      ...dinnerLate,
      notes: 'Called ahead — birthday dessert',
      status: 'booked',
      source: 'phone',
      confirmationCode: 'PRIYA7',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_cancel',
      restaurantId,
      tableId: 'tbl_ct_2',
      guestName: 'Morgan Blake',
      guestEmail: 'morgan@example.com',
      partySize: 2,
      ...range(0, 17, 0),
      notes: 'Cancelled same-day',
      status: 'cancelled',
      source: 'online',
      confirmationCode: 'CXL2PM',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_tomorrow_lunch',
      restaurantId,
      tableId: 'tbl_ct_2',
      guestName: 'Alex Kim',
      guestEmail: 'alex.kim@example.com',
      guestPhone: '5550104444',
      partySize: 2,
      ...tomorrowLunch,
      status: 'booked',
      source: 'online',
      confirmationCode: 'ALEX12',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_demo',
      restaurantId,
      tableId: 'tbl_ct_4',
      guestName: 'Jordan Lee',
      guestEmail: 'jordan@example.com',
      guestPhone: '5550109999',
      partySize: 4,
      ...tomorrowAnni,
      notes: 'Anniversary — quiet corner if possible',
      status: 'booked',
      source: 'online',
      confirmationCode: 'CT4DEMO',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_party',
      restaurantId,
      tableId: 'tbl_ct_8',
      guestName: 'Taylor Brooks',
      guestEmail: 'taylor@example.com',
      guestPhone: '5550105555',
      partySize: 7,
      ...tomorrowParty,
      notes: 'Work dinner — need the private room',
      status: 'booked',
      source: 'phone',
      confirmationCode: 'PARTY8',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_day_after',
      restaurantId,
      tableId: 'tbl_ct_patio',
      guestName: 'Riley Chen',
      guestEmail: 'riley@example.com',
      partySize: 4,
      ...dayAfter,
      notes: 'Patio preferred',
      status: 'booked',
      source: 'online',
      confirmationCode: 'PATIO4',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_yesterday',
      restaurantId,
      tableId: 'tbl_ct_4b',
      guestName: 'Jamie Ortiz',
      guestPhone: '5550106666',
      partySize: 4,
      ...yesterday,
      status: 'completed',
      source: 'walk_in',
      confirmationCode: 'DONE4',
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  return { tables, reservations }
}

/** Upsert Corner Table demo floor plan + sample bookings into an existing DB. */
export function upsertCornerTableDiningSeed(
  diningTables: DiningTable[] | undefined,
  reservations: Reservation[] | undefined,
  ts: string,
): { diningTables: DiningTable[]; reservations: Reservation[]; changed: boolean } {
  const seed = buildCornerTableDiningSeed(ts)
  const nextTables = [...(diningTables ?? [])]
  const nextReservations = [...(reservations ?? [])]
  let changed = false

  for (const table of seed.tables) {
    const idx = nextTables.findIndex((t) => t.id === table.id)
    if (idx < 0) {
      nextTables.push(table)
      changed = true
    } else {
      // Keep operator edits to name/seats/active, but ensure restaurant link.
      if (nextTables[idx].restaurantId !== table.restaurantId) {
        nextTables[idx] = { ...nextTables[idx], restaurantId: table.restaurantId }
        changed = true
      }
    }
  }

  for (const reservation of seed.reservations) {
    const idx = nextReservations.findIndex((r) => r.id === reservation.id)
    if (idx < 0) {
      nextReservations.push(reservation)
      changed = true
    } else {
      // Refresh demo fixture times/status so “today/tomorrow” stay current.
      nextReservations[idx] = {
        ...nextReservations[idx],
        ...reservation,
        createdAt: nextReservations[idx].createdAt || reservation.createdAt,
      }
      changed = true
    }
  }

  return { diningTables: nextTables, reservations: nextReservations, changed }
}
