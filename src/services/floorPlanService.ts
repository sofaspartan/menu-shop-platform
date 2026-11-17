import type {
  DiningRoom,
  DiningTable,
  DiningTableShape,
  FloorLabel,
  MenuItem,
  TableCheck,
  TableCheckLine,
  TableLineItemStatus,
  TableServiceStatus,
} from '@/types'
import { normalizeDiningTable } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createId, nowIso } from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'

function nextOrderNumber(existing: TableCheck[]): string {
  let max = 1000
  for (const c of existing) {
    const n = Number.parseInt(c.orderNumber, 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return String(max + 1)
}

export function computeCheckTotals(check: TableCheck): {
  subtotalCents: number
  discountCents: number
  taxCents: number
  totalCents: number
  servedCount: number
  itemCount: number
} {
  const itemCount = check.items.reduce((s, i) => s + i.quantity, 0)
  const servedCount = check.items
    .filter((i) => i.status === 'served')
    .reduce((s, i) => s + i.quantity, 0)
  const subtotalCents = check.items.reduce((s, i) => s + i.lineTotalCents, 0)
  const discountCents = Math.min(check.discountCents ?? 0, subtotalCents)
  const taxable = Math.max(0, subtotalCents - discountCents)
  const taxCents = Math.round(taxable * (check.taxRatePercent / 100))
  const totalCents = taxable + taxCents + (check.tipCents ?? 0)
  return { subtotalCents, discountCents, taxCents, totalCents, servedCount, itemCount }
}

export function openCheckForTable(
  checks: TableCheck[],
  tableId: string,
): TableCheck | undefined {
  return checks.find((c) => c.tableId === tableId && !c.closedAt)
}

export function serviceStatusForTable(
  checks: TableCheck[],
  tableId: string,
): TableServiceStatus | 'free' {
  const open = openCheckForTable(checks, tableId)
  return open?.status ?? 'free'
}

export async function listRooms(restaurantId: string): Promise<DiningRoom[]> {
  const db = await getDb()
  return (db.diningRooms ?? [])
    .filter((r) => r.restaurantId === restaurantId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export async function createRoom(
  userId: string,
  restaurantId: string,
  input: { name: string },
): Promise<DiningRoom> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const existing = await listRooms(restaurantId)
  const ts = nowIso()
  const room: DiningRoom = {
    id: createId('room'),
    restaurantId,
    name: input.name.trim() || `Room ${existing.length + 1}`,
    sortOrder: existing.length,
    canvasWidth: 900,
    canvasHeight: 600,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.diningRooms) d.diningRooms = []
    d.diningRooms.push(room)
  })
  return room
}

export async function updateRoom(
  userId: string,
  restaurantId: string,
  roomId: string,
  patch: Partial<Pick<DiningRoom, 'name' | 'sortOrder' | 'canvasWidth' | 'canvasHeight'>>,
): Promise<DiningRoom> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: DiningRoom | null = null
  await saveDb((d) => {
    if (!d.diningRooms) d.diningRooms = []
    const idx = d.diningRooms.findIndex(
      (r) => r.id === roomId && r.restaurantId === restaurantId,
    )
    if (idx < 0) throw new Error('Room not found')
    const next = {
      ...d.diningRooms[idx],
      ...patch,
      name:
        patch.name !== undefined
          ? patch.name.trim() || d.diningRooms[idx].name
          : d.diningRooms[idx].name,
      updatedAt: nowIso(),
    }
    d.diningRooms[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Room not found')
  return updated
}

export async function deleteRoom(
  userId: string,
  restaurantId: string,
  roomId: string,
): Promise<void> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.diningRooms = (d.diningRooms ?? []).filter(
      (r) => !(r.id === roomId && r.restaurantId === restaurantId),
    )
    d.floorLabels = (d.floorLabels ?? []).filter((l) => l.roomId !== roomId)
    for (const t of d.diningTables ?? []) {
      if (t.restaurantId === restaurantId && t.roomId === roomId) {
        t.roomId = undefined
        t.updatedAt = nowIso()
      }
    }
  })
}

export async function createFloorLabel(
  userId: string,
  restaurantId: string,
  input: { roomId: string; text: string; x: number; y: number },
): Promise<FloorLabel> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const ts = nowIso()
  const label: FloorLabel = {
    id: createId('flbl'),
    restaurantId,
    roomId: input.roomId,
    text: input.text.trim() || 'LABEL',
    x: input.x,
    y: input.y,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.floorLabels) d.floorLabels = []
    d.floorLabels.push(label)
  })
  return label
}

export async function updateFloorLabel(
  userId: string,
  restaurantId: string,
  labelId: string,
  patch: Partial<Pick<FloorLabel, 'text' | 'x' | 'y'>>,
): Promise<FloorLabel> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: FloorLabel | null = null
  await saveDb((d) => {
    if (!d.floorLabels) d.floorLabels = []
    const idx = d.floorLabels.findIndex(
      (l) => l.id === labelId && l.restaurantId === restaurantId,
    )
    if (idx < 0) throw new Error('Label not found')
    const next = {
      ...d.floorLabels[idx],
      ...patch,
      text:
        patch.text !== undefined
          ? patch.text.trim() || d.floorLabels[idx].text
          : d.floorLabels[idx].text,
      updatedAt: nowIso(),
    }
    d.floorLabels[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Label not found')
  return updated
}

export async function deleteFloorLabel(
  userId: string,
  restaurantId: string,
  labelId: string,
): Promise<void> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.floorLabels = (d.floorLabels ?? []).filter(
      (l) => !(l.id === labelId && l.restaurantId === restaurantId),
    )
  })
}

const SHAPE_DEFAULTS: Record<DiningTableShape, { width: number; height: number }> = {
  round: { width: 88, height: 88 },
  square: { width: 96, height: 96 },
  rectangle: { width: 150, height: 90 },
  booth: { width: 160, height: 78 },
  bar: { width: 64, height: 64 },
}

export async function createLayoutTable(
  userId: string,
  restaurantId: string,
  input: {
    roomId: string
    name: string
    seats: number
    shape: DiningTableShape
    x: number
    y: number
  },
): Promise<DiningTable> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const db = await getDb()
  const existing = (db.diningTables ?? []).filter((t) => t.restaurantId === restaurantId)
  const size = SHAPE_DEFAULTS[input.shape]
  const ts = nowIso()
  const table = normalizeDiningTable({
    id: createId('tbl'),
    restaurantId,
    roomId: input.roomId,
    name: input.name.trim() || input.shape.toUpperCase(),
    seats: input.seats,
    shape: input.shape,
    x: input.x,
    y: input.y,
    width: size.width,
    height: size.height,
    active: true,
    sortOrder: existing.length,
    createdAt: ts,
    updatedAt: ts,
  })
  await saveDb((d) => {
    if (!d.diningTables) d.diningTables = []
    d.diningTables.push(table)
  })
  return table
}

export async function updateLayoutTable(
  userId: string,
  restaurantId: string,
  tableId: string,
  patch: Partial<
    Pick<
      DiningTable,
      | 'name'
      | 'seats'
      | 'shape'
      | 'x'
      | 'y'
      | 'width'
      | 'height'
      | 'rotation'
      | 'roomId'
      | 'active'
      | 'sortOrder'
    >
  >,
): Promise<DiningTable> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: DiningTable | null = null
  await saveDb((d) => {
    if (!d.diningTables) d.diningTables = []
    const idx = d.diningTables.findIndex(
      (t) => t.id === tableId && t.restaurantId === restaurantId,
    )
    if (idx < 0) throw new Error('Table not found')
    const current = normalizeDiningTable(d.diningTables[idx])
    let width = patch.width ?? current.width
    let height = patch.height ?? current.height
    if (patch.shape && patch.shape !== current.shape && patch.width === undefined) {
      width = SHAPE_DEFAULTS[patch.shape].width
      height = SHAPE_DEFAULTS[patch.shape].height
    }
    const next = normalizeDiningTable({
      ...current,
      ...patch,
      width,
      height,
      name: patch.name !== undefined ? patch.name.trim() || current.name : current.name,
      seats:
        patch.seats !== undefined
          ? Math.max(1, Math.min(24, Math.round(patch.seats) || 1))
          : current.seats,
      updatedAt: nowIso(),
    })
    d.diningTables[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Table not found')
  return updated
}

export async function seatWalkInAtTable(
  userId: string,
  restaurantId: string,
  input: {
    tableId: string
    guestName: string
    partySize: number
    reservationId?: string
    serverName?: string
    serverEmployeeId?: string
  },
): Promise<TableCheck> {
  await assertRestaurantAccess(userId, restaurantId)
  const db = await getDb()
  const table = (db.diningTables ?? []).find(
    (t) => t.id === input.tableId && t.restaurantId === restaurantId,
  )
  if (!table) throw new Error('Table not found')
  if (openCheckForTable(db.tableChecks ?? [], table.id)) {
    throw new Error('Table already has an open check.')
  }
  const restaurant = db.restaurants.find((r) => r.id === restaurantId)
  const ts = nowIso()
  const checks = (db.tableChecks ?? []).filter((c) => c.restaurantId === restaurantId)
  const check: TableCheck = {
    id: createId('tchk'),
    restaurantId,
    tableId: table.id,
    roomId: table.roomId,
    reservationId: input.reservationId,
    orderNumber: nextOrderNumber(checks),
    guestName: input.guestName.trim() || 'Walk-in',
    partySize: Math.max(1, Math.min(24, Math.round(input.partySize) || 1)),
    serverName: input.serverName,
    serverEmployeeId: input.serverEmployeeId,
    status: 'seated',
    seatedAt: ts,
    items: [],
    taxRatePercent: restaurant?.ordering.taxRatePercent ?? 8.875,
    createdAt: ts,
    updatedAt: ts,
  }

  await saveDb((d) => {
    if (!d.tableChecks) d.tableChecks = []
    d.tableChecks.push(check)
    if (input.reservationId) {
      const r = (d.reservations ?? []).find(
        (x) => x.id === input.reservationId && x.restaurantId === restaurantId,
      )
      if (r) {
        r.status = 'seated'
        r.tableId = table.id
        r.updatedAt = ts
      }
    }
  })
  return check
}

export async function addItemToTableCheck(
  userId: string,
  restaurantId: string,
  checkId: string,
  item: MenuItem,
  quantity = 1,
  modifiersNote?: string,
): Promise<TableCheck> {
  await assertRestaurantAccess(userId, restaurantId)
  const qty = Math.max(1, Math.min(99, Math.round(quantity) || 1))
  let updated: TableCheck | null = null
  await saveDb((d) => {
    if (!d.tableChecks) d.tableChecks = []
    const idx = d.tableChecks.findIndex(
      (c) => c.id === checkId && c.restaurantId === restaurantId && !c.closedAt,
    )
    if (idx < 0) throw new Error('Open check not found')
    const check = d.tableChecks[idx]
    const line: TableCheckLine = {
      id: createId('tcl'),
      menuItemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      quantity: qty,
      unitPriceCents: item.basePriceCents,
      lineTotalCents: item.basePriceCents * qty,
      modifiersNote: modifiersNote?.trim() || undefined,
      status: 'queued',
    }
    const next: TableCheck = {
      ...check,
      items: [...check.items, line],
      status: check.status === 'seated' ? 'ordered' : check.status === 'bill_printed' ? 'ordered' : check.status,
      billPrintedAt: check.status === 'bill_printed' ? undefined : check.billPrintedAt,
      updatedAt: nowIso(),
    }
    d.tableChecks[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Open check not found')
  return updated
}

export async function updateCheckLineStatus(
  userId: string,
  restaurantId: string,
  checkId: string,
  lineId: string,
  status: TableLineItemStatus,
): Promise<TableCheck> {
  await assertRestaurantAccess(userId, restaurantId)
  let updated: TableCheck | null = null
  await saveDb((d) => {
    if (!d.tableChecks) d.tableChecks = []
    const idx = d.tableChecks.findIndex(
      (c) => c.id === checkId && c.restaurantId === restaurantId && !c.closedAt,
    )
    if (idx < 0) throw new Error('Open check not found')
    const check = d.tableChecks[idx]
    const items = check.items.map((l) => (l.id === lineId ? { ...l, status } : l))
    let nextStatus: TableServiceStatus = check.status
    if (items.some((l) => l.status === 'ready') && check.status !== 'bill_printed') {
      nextStatus = 'food_ready'
    } else if (items.some((l) => l.status !== 'served' && l.status !== 'held') && items.length) {
      nextStatus = check.status === 'seated' ? 'ordered' : check.status === 'bill_printed' ? 'bill_printed' : 'ordered'
    }
    if (check.status === 'bill_printed') nextStatus = 'bill_printed'
    const next = { ...check, items, status: nextStatus, updatedAt: nowIso() }
    d.tableChecks[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Open check not found')
  return updated
}

export async function setTableCheckStatus(
  userId: string,
  restaurantId: string,
  checkId: string,
  status: TableServiceStatus,
): Promise<TableCheck> {
  await assertRestaurantAccess(userId, restaurantId)
  let updated: TableCheck | null = null
  await saveDb((d) => {
    if (!d.tableChecks) d.tableChecks = []
    const idx = d.tableChecks.findIndex(
      (c) => c.id === checkId && c.restaurantId === restaurantId && !c.closedAt,
    )
    if (idx < 0) throw new Error('Open check not found')
    const ts = nowIso()
    const next: TableCheck = {
      ...d.tableChecks[idx],
      status,
      billPrintedAt: status === 'bill_printed' ? ts : d.tableChecks[idx].billPrintedAt,
      updatedAt: ts,
    }
    d.tableChecks[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Open check not found')
  return updated
}

export async function printTableBill(
  userId: string,
  restaurantId: string,
  checkId: string,
): Promise<TableCheck> {
  return setTableCheckStatus(userId, restaurantId, checkId, 'bill_printed')
}

export async function closeTableCheck(
  userId: string,
  restaurantId: string,
  checkId: string,
): Promise<TableCheck> {
  await assertRestaurantAccess(userId, restaurantId)
  let updated: TableCheck | null = null
  await saveDb((d) => {
    if (!d.tableChecks) d.tableChecks = []
    const idx = d.tableChecks.findIndex(
      (c) => c.id === checkId && c.restaurantId === restaurantId && !c.closedAt,
    )
    if (idx < 0) throw new Error('Open check not found')
    const ts = nowIso()
    const check = d.tableChecks[idx]
    const next: TableCheck = { ...check, closedAt: ts, updatedAt: ts }
    d.tableChecks[idx] = next
    if (check.reservationId) {
      const r = (d.reservations ?? []).find(
        (x) => x.id === check.reservationId && x.restaurantId === restaurantId,
      )
      if (r && r.status === 'seated') {
        r.status = 'completed'
        r.updatedAt = ts
      }
    }
    updated = next
  })
  if (!updated) throw new Error('Open check not found')
  return updated
}
