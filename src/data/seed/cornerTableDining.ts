import type {
  DiningRoom,
  DiningTable,
  FloorLabel,
  Reservation,
  TableCheck,
} from '@/types'

const CORNER_TABLE_ID = 'rest_corner_table'
const VISIT_MS = 90 * 60_000

const ROOM_MAIN = 'room_ct_main'
const ROOM_TERRACE = 'room_ct_terrace'
const ROOM_FAMILY = 'room_ct_family'

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

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString()
}

/** Rooms, floor plan, bookings, and live table checks for The Corner Table. */
export function buildCornerTableDiningSeed(ts: string): {
  rooms: DiningRoom[]
  tables: DiningTable[]
  floorLabels: FloorLabel[]
  reservations: Reservation[]
  tableChecks: TableCheck[]
} {
  const restaurantId = CORNER_TABLE_ID

  const rooms: DiningRoom[] = [
    {
      id: ROOM_MAIN,
      restaurantId,
      name: 'Main hall',
      sortOrder: 0,
      canvasWidth: 920,
      canvasHeight: 620,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ROOM_TERRACE,
      restaurantId,
      name: 'Terrace',
      sortOrder: 1,
      canvasWidth: 820,
      canvasHeight: 520,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: ROOM_FAMILY,
      restaurantId,
      name: 'Family',
      sortOrder: 2,
      canvasWidth: 720,
      canvasHeight: 480,
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  const floorLabels: FloorLabel[] = [
    {
      id: 'flbl_ct_kitchen',
      restaurantId,
      roomId: ROOM_MAIN,
      text: 'KITCHEN PASS',
      x: 36,
      y: 28,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'flbl_ct_bar',
      restaurantId,
      roomId: ROOM_MAIN,
      text: 'BAR — 6 STOOLS',
      x: 720,
      y: 36,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'flbl_ct_terrace',
      restaurantId,
      roomId: ROOM_TERRACE,
      text: 'OUTDOOR HEATERS',
      x: 40,
      y: 24,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'flbl_ct_family',
      restaurantId,
      roomId: ROOM_FAMILY,
      text: 'PRIVATE DINING',
      x: 40,
      y: 24,
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  const tables: DiningTable[] = [
    // Main hall
    {
      id: 'tbl_ct_t1',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T1',
      seats: 2,
      shape: 'round',
      x: 70,
      y: 110,
      width: 88,
      height: 88,
      active: true,
      sortOrder: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_1',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T2',
      seats: 2,
      shape: 'round',
      x: 200,
      y: 110,
      width: 88,
      height: 88,
      active: true,
      sortOrder: 1,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_2',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T3',
      seats: 4,
      shape: 'square',
      x: 70,
      y: 250,
      width: 96,
      height: 96,
      active: true,
      sortOrder: 2,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_t4',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T4',
      seats: 4,
      shape: 'square',
      x: 210,
      y: 250,
      width: 96,
      height: 96,
      active: true,
      sortOrder: 3,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_t5',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T5',
      seats: 4,
      shape: 'square',
      x: 350,
      y: 250,
      width: 96,
      height: 96,
      active: true,
      sortOrder: 4,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_t7',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T7',
      seats: 2,
      shape: 'round',
      x: 70,
      y: 420,
      width: 88,
      height: 88,
      active: true,
      sortOrder: 5,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_t8',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'T8',
      seats: 2,
      shape: 'round',
      x: 200,
      y: 420,
      width: 88,
      height: 88,
      active: true,
      sortOrder: 6,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_4',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'B1',
      seats: 4,
      shape: 'booth',
      x: 480,
      y: 120,
      width: 160,
      height: 78,
      active: true,
      sortOrder: 7,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_4b',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'B2',
      seats: 4,
      shape: 'booth',
      x: 480,
      y: 260,
      width: 160,
      height: 78,
      active: true,
      sortOrder: 8,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_bar',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'Bar 1',
      seats: 2,
      shape: 'bar',
      x: 740,
      y: 100,
      width: 64,
      height: 64,
      active: true,
      sortOrder: 9,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_bar2',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'Bar 2',
      seats: 2,
      shape: 'bar',
      x: 740,
      y: 180,
      width: 64,
      height: 64,
      active: true,
      sortOrder: 10,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_bar3',
      restaurantId,
      roomId: ROOM_MAIN,
      name: 'Bar 3',
      seats: 1,
      shape: 'bar',
      x: 740,
      y: 260,
      width: 64,
      height: 64,
      active: true,
      sortOrder: 11,
      createdAt: ts,
      updatedAt: ts,
    },
    // Terrace
    {
      id: 'tbl_ct_patio',
      restaurantId,
      roomId: ROOM_TERRACE,
      name: 'P1',
      seats: 4,
      shape: 'square',
      x: 80,
      y: 100,
      width: 100,
      height: 100,
      active: true,
      sortOrder: 20,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_p2',
      restaurantId,
      roomId: ROOM_TERRACE,
      name: 'P2',
      seats: 4,
      shape: 'square',
      x: 240,
      y: 100,
      width: 100,
      height: 100,
      active: true,
      sortOrder: 21,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_p3',
      restaurantId,
      roomId: ROOM_TERRACE,
      name: 'P3',
      seats: 2,
      shape: 'round',
      x: 400,
      y: 110,
      width: 88,
      height: 88,
      active: true,
      sortOrder: 22,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_p4',
      restaurantId,
      roomId: ROOM_TERRACE,
      name: 'P4',
      seats: 2,
      shape: 'round',
      x: 80,
      y: 280,
      width: 88,
      height: 88,
      active: true,
      sortOrder: 23,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_p5',
      restaurantId,
      roomId: ROOM_TERRACE,
      name: 'P5',
      seats: 6,
      shape: 'rectangle',
      x: 240,
      y: 280,
      width: 150,
      height: 90,
      active: true,
      sortOrder: 24,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_p6',
      restaurantId,
      roomId: ROOM_TERRACE,
      name: 'P6',
      seats: 4,
      shape: 'booth',
      x: 460,
      y: 280,
      width: 150,
      height: 78,
      active: true,
      sortOrder: 25,
      createdAt: ts,
      updatedAt: ts,
    },
    // Family
    {
      id: 'tbl_ct_6',
      restaurantId,
      roomId: ROOM_FAMILY,
      name: 'F1',
      seats: 6,
      shape: 'rectangle',
      x: 80,
      y: 120,
      width: 188,
      height: 108,
      active: true,
      sortOrder: 30,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_8',
      restaurantId,
      roomId: ROOM_FAMILY,
      name: 'F2',
      seats: 8,
      shape: 'rectangle',
      x: 300,
      y: 120,
      width: 220,
      height: 120,
      active: true,
      sortOrder: 31,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_f3',
      restaurantId,
      roomId: ROOM_FAMILY,
      name: 'F3',
      seats: 4,
      shape: 'square',
      x: 80,
      y: 300,
      width: 100,
      height: 100,
      active: true,
      sortOrder: 32,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tbl_ct_f4',
      restaurantId,
      roomId: ROOM_FAMILY,
      name: 'F4',
      seats: 4,
      shape: 'booth',
      x: 260,
      y: 310,
      width: 150,
      height: 78,
      active: true,
      sortOrder: 33,
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
      id: 'rsv_ct_t4_live',
      restaurantId,
      tableId: 'tbl_ct_t4',
      guestName: 'Ayesha K.',
      guestPhone: '5550101212',
      partySize: 3,
      startAt: minutesAgo(42),
      endAt: new Date(Date.now() + 50 * 60_000).toISOString(),
      notes: 'Demo open check on T4',
      status: 'seated',
      source: 'walk_in',
      confirmationCode: 'T4LIVE',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_b1_live',
      restaurantId,
      tableId: 'tbl_ct_4',
      guestName: 'Noah P.',
      partySize: 4,
      startAt: minutesAgo(55),
      endAt: new Date(Date.now() + 40 * 60_000).toISOString(),
      status: 'seated',
      source: 'online',
      confirmationCode: 'B1FOOD',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_b2_live',
      restaurantId,
      tableId: 'tbl_ct_4b',
      guestName: 'Mia Santos',
      partySize: 2,
      startAt: minutesAgo(12),
      endAt: new Date(Date.now() + 80 * 60_000).toISOString(),
      notes: 'Menus out',
      status: 'seated',
      source: 'walk_in',
      confirmationCode: 'B2SEAT',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_t5_live',
      restaurantId,
      tableId: 'tbl_ct_t5',
      guestName: 'Chris D.',
      partySize: 3,
      startAt: minutesAgo(8),
      endAt: new Date(Date.now() + 85 * 60_000).toISOString(),
      notes: 'Water served',
      status: 'seated',
      source: 'walk_in',
      confirmationCode: 'T5SEAT',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_p1_bill',
      restaurantId,
      tableId: 'tbl_ct_patio',
      guestName: 'Elena V.',
      partySize: 4,
      startAt: minutesAgo(70),
      endAt: new Date(Date.now() + 20 * 60_000).toISOString(),
      status: 'seated',
      source: 'online',
      confirmationCode: 'P1BILL',
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'rsv_ct_today_dinner',
      restaurantId,
      tableId: 'tbl_ct_t4',
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

  const tableChecks: TableCheck[] = [
    {
      id: 'tchk_ct_t4',
      restaurantId,
      tableId: 'tbl_ct_t4',
      roomId: ROOM_MAIN,
      reservationId: 'rsv_ct_t4_live',
      orderNumber: '1048',
      guestName: 'Ayesha K.',
      partySize: 3,
      serverName: 'Bilal A.',
      status: 'ordered',
      seatedAt: minutesAgo(42),
      taxRatePercent: 8.875,
      discountCents: 420,
      discountLabel: 'Happy hour — 10% drinks',
      notes: '4 of 6 served',
      items: [
        {
          id: 'tcl_t4_1',
          menuItemId: 'item_burger',
          name: 'Classic Burger',
          quantity: 1,
          unitPriceCents: 1699,
          lineTotalCents: 1699,
          modifiersNote: 'Medium · Extra cheese',
          status: 'served',
        },
        {
          id: 'tcl_t4_2',
          menuItemId: 'item_steak',
          name: 'Flat Iron Steak',
          quantity: 1,
          unitPriceCents: 3299,
          lineTotalCents: 3299,
          modifiersNote: 'Medium rare',
          status: 'preparing',
        },
        {
          id: 'tcl_t4_3',
          menuItemId: 'item_pasta',
          name: 'Cacio e Pepe',
          quantity: 1,
          unitPriceCents: 1899,
          lineTotalCents: 1899,
          modifiersNote: 'Extra spicy',
          status: 'held',
        },
        {
          id: 'tcl_t4_4',
          menuItemId: 'item_fries',
          name: 'Truffle Fries',
          quantity: 1,
          unitPriceCents: 799,
          lineTotalCents: 799,
          status: 'served',
        },
        {
          id: 'tcl_t4_5',
          menuItemId: 'item_cocktail',
          name: 'House Cocktail',
          quantity: 2,
          unitPriceCents: 1200,
          lineTotalCents: 2400,
          status: 'served',
        },
        {
          id: 'tcl_t4_6',
          menuItemId: 'item_lemonade',
          name: 'Fresh Lemonade',
          quantity: 1,
          unitPriceCents: 450,
          lineTotalCents: 450,
          status: 'served',
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tchk_ct_b1',
      restaurantId,
      tableId: 'tbl_ct_4',
      roomId: ROOM_MAIN,
      reservationId: 'rsv_ct_b1_live',
      orderNumber: '1049',
      guestName: 'Noah P.',
      partySize: 4,
      serverName: 'Maya Chen',
      status: 'food_ready',
      seatedAt: minutesAgo(55),
      taxRatePercent: 8.875,
      items: [
        {
          id: 'tcl_b1_1',
          menuItemId: 'item_salmon',
          name: 'Seared Salmon',
          quantity: 2,
          unitPriceCents: 2499,
          lineTotalCents: 4998,
          status: 'ready',
        },
        {
          id: 'tcl_b1_2',
          menuItemId: 'item_chicken_roast',
          name: 'Roast Chicken',
          quantity: 1,
          unitPriceCents: 2199,
          lineTotalCents: 2199,
          status: 'ready',
        },
        {
          id: 'tcl_b1_3',
          menuItemId: 'item_caesar',
          name: 'Caesar Salad',
          quantity: 1,
          unitPriceCents: 1299,
          lineTotalCents: 1299,
          status: 'served',
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tchk_ct_b2',
      restaurantId,
      tableId: 'tbl_ct_4b',
      roomId: ROOM_MAIN,
      reservationId: 'rsv_ct_b2_live',
      orderNumber: '1050',
      guestName: 'Mia Santos',
      partySize: 2,
      serverName: 'Luis Ortega',
      status: 'seated',
      seatedAt: minutesAgo(12),
      taxRatePercent: 8.875,
      notes: 'Menus out',
      items: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tchk_ct_t5',
      restaurantId,
      tableId: 'tbl_ct_t5',
      roomId: ROOM_MAIN,
      reservationId: 'rsv_ct_t5_live',
      orderNumber: '1051',
      guestName: 'Chris D.',
      partySize: 3,
      serverName: 'Maya Chen',
      status: 'seated',
      seatedAt: minutesAgo(8),
      taxRatePercent: 8.875,
      notes: 'Water served',
      items: [],
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'tchk_ct_p1',
      restaurantId,
      tableId: 'tbl_ct_patio',
      roomId: ROOM_TERRACE,
      reservationId: 'rsv_ct_p1_bill',
      orderNumber: '1046',
      guestName: 'Elena V.',
      partySize: 4,
      serverName: 'Bilal A.',
      status: 'bill_printed',
      seatedAt: minutesAgo(70),
      billPrintedAt: minutesAgo(4),
      taxRatePercent: 8.875,
      items: [
        {
          id: 'tcl_p1_1',
          menuItemId: 'item_grain',
          name: 'Grain Bowl',
          quantity: 2,
          unitPriceCents: 1499,
          lineTotalCents: 2998,
          status: 'served',
        },
        {
          id: 'tcl_p1_2',
          menuItemId: 'item_avocado_toast',
          name: 'Avocado Toast',
          quantity: 1,
          unitPriceCents: 1299,
          lineTotalCents: 1299,
          status: 'served',
        },
        {
          id: 'tcl_p1_3',
          menuItemId: 'item_latte',
          name: 'House Latte',
          quantity: 2,
          unitPriceCents: 499,
          lineTotalCents: 998,
          status: 'served',
        },
      ],
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  return { rooms, tables, floorLabels, reservations, tableChecks }
}

/** Upsert Corner Table floor plan + bookings + live checks into an existing DB. */
export function upsertCornerTableDiningSeed(
  diningRooms: DiningRoom[] | undefined,
  diningTables: DiningTable[] | undefined,
  floorLabels: FloorLabel[] | undefined,
  reservations: Reservation[] | undefined,
  tableChecks: TableCheck[] | undefined,
  ts: string,
): {
  diningRooms: DiningRoom[]
  diningTables: DiningTable[]
  floorLabels: FloorLabel[]
  reservations: Reservation[]
  tableChecks: TableCheck[]
  changed: boolean
} {
  const seed = buildCornerTableDiningSeed(ts)
  const nextRooms = [...(diningRooms ?? [])]
  const nextTables = [...(diningTables ?? [])]
  const nextLabels = [...(floorLabels ?? [])]
  const nextReservations = [...(reservations ?? [])]
  const nextChecks = [...(tableChecks ?? [])]
  let changed = false

  for (const room of seed.rooms) {
    const idx = nextRooms.findIndex((r) => r.id === room.id)
    if (idx < 0) {
      nextRooms.push(room)
      changed = true
    } else {
      nextRooms[idx] = { ...nextRooms[idx], ...room, createdAt: nextRooms[idx].createdAt || room.createdAt }
      changed = true
    }
  }

  for (const table of seed.tables) {
    const idx = nextTables.findIndex((t) => t.id === table.id)
    if (idx < 0) {
      nextTables.push(table)
      changed = true
    } else {
      // Refresh layout so the demo floor plan stays current; keep active flag if operator toggled.
      nextTables[idx] = {
        ...table,
        active: nextTables[idx].active,
        createdAt: nextTables[idx].createdAt || table.createdAt,
      }
      changed = true
    }
  }

  for (const label of seed.floorLabels) {
    const idx = nextLabels.findIndex((l) => l.id === label.id)
    if (idx < 0) {
      nextLabels.push(label)
      changed = true
    } else {
      nextLabels[idx] = { ...label, createdAt: nextLabels[idx].createdAt || label.createdAt }
      changed = true
    }
  }

  for (const reservation of seed.reservations) {
    const idx = nextReservations.findIndex((r) => r.id === reservation.id)
    if (idx < 0) {
      nextReservations.push(reservation)
      changed = true
    } else {
      nextReservations[idx] = {
        ...nextReservations[idx],
        ...reservation,
        createdAt: nextReservations[idx].createdAt || reservation.createdAt,
      }
      changed = true
    }
  }

  for (const check of seed.tableChecks) {
    const idx = nextChecks.findIndex((c) => c.id === check.id)
    if (idx < 0) {
      nextChecks.push(check)
      changed = true
    } else if (!nextChecks[idx].closedAt) {
      // Refresh open demo checks so seatedAt / item statuses stay demo-fresh.
      nextChecks[idx] = {
        ...check,
        createdAt: nextChecks[idx].createdAt || check.createdAt,
      }
      changed = true
    }
  }

  return {
    diningRooms: nextRooms,
    diningTables: nextTables,
    floorLabels: nextLabels,
    reservations: nextReservations,
    tableChecks: nextChecks,
    changed,
  }
}
