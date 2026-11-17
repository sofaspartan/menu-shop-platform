import type { Employee, TimeClockEntry } from '@/types'

const RESTAURANT_ID = 'rest_corner_table'

export function buildCornerTableEmployeesSeed(ts: string): {
  employees: Employee[]
  timeClockEntries: TimeClockEntry[]
} {
  const employees: Employee[] = [
    {
      id: 'emp_ct_alex',
      restaurantId: RESTAURANT_ID,
      name: 'Alex Morgan',
      email: 'owner@thecornertable.demo',
      phone: '5550102000',
      role: 'manager',
      pin: '0000',
      active: true,
      hourlyWageCents: 0,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'emp_ct_maya',
      restaurantId: RESTAURANT_ID,
      name: 'Maya Chen',
      phone: '5550102101',
      role: 'server',
      pin: '1234',
      active: true,
      hourlyWageCents: 1800,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'emp_ct_luis',
      restaurantId: RESTAURANT_ID,
      name: 'Luis Ortega',
      phone: '5550102102',
      role: 'cashier',
      pin: '2222',
      active: true,
      hourlyWageCents: 1700,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'emp_ct_priya',
      restaurantId: RESTAURANT_ID,
      name: 'Priya Shah',
      phone: '5550102103',
      role: 'kitchen',
      pin: '3434',
      active: true,
      hourlyWageCents: 2000,
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'emp_ct_sam',
      restaurantId: RESTAURANT_ID,
      name: 'Sam Rivera',
      role: 'host',
      pin: '4545',
      active: true,
      hourlyWageCents: 1600,
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  const clockIn = new Date()
  clockIn.setHours(clockIn.getHours() - 3)
  const timeClockEntries: TimeClockEntry[] = [
    {
      id: 'clk_ct_maya',
      restaurantId: RESTAURANT_ID,
      employeeId: 'emp_ct_maya',
      clockInAt: clockIn.toISOString(),
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'clk_ct_luis',
      restaurantId: RESTAURANT_ID,
      employeeId: 'emp_ct_luis',
      clockInAt: new Date(clockIn.getTime() + 20 * 60_000).toISOString(),
      createdAt: ts,
      updatedAt: ts,
    },
  ]

  return { employees, timeClockEntries }
}

export function upsertCornerTableEmployeesSeed(
  employees: Employee[] | undefined,
  timeClockEntries: TimeClockEntry[] | undefined,
  ts: string,
): {
  employees: Employee[]
  timeClockEntries: TimeClockEntry[]
  changed: boolean
} {
  const seed = buildCornerTableEmployeesSeed(ts)
  const nextEmployees = [...(employees ?? [])]
  const nextClocks = [...(timeClockEntries ?? [])]
  let changed = false

  for (const emp of seed.employees) {
    const idx = nextEmployees.findIndex((e) => e.id === emp.id)
    if (idx < 0) {
      nextEmployees.push(emp)
      changed = true
    }
  }

  for (const entry of seed.timeClockEntries) {
    const idx = nextClocks.findIndex((e) => e.id === entry.id)
    if (idx < 0) {
      nextClocks.push(entry)
      changed = true
    }
  }

  return { employees: nextEmployees, timeClockEntries: nextClocks, changed }
}
