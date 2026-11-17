import type {
  CashDrawerEvent,
  Employee,
  EmployeeRole,
  TimeClockEntry,
} from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createId, nowIso } from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'

const ROLES: EmployeeRole[] = ['manager', 'server', 'cashier', 'kitchen', 'host']

export function isEmployeeRole(value: string): value is EmployeeRole {
  return ROLES.includes(value as EmployeeRole)
}

export function normalizePin(pin: string): string {
  return pin.replace(/\D/g, '').slice(0, 4)
}

export async function listEmployees(restaurantId: string): Promise<Employee[]> {
  const db = await getDb()
  return (db.employees ?? [])
    .filter((e) => e.restaurantId === restaurantId)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function createEmployee(
  userId: string,
  restaurantId: string,
  input: {
    name: string
    role: EmployeeRole
    pin: string
    email?: string
    phone?: string
    hourlyWageCents?: number
  },
): Promise<Employee> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const pin = normalizePin(input.pin)
  if (pin.length !== 4) throw new Error('PIN must be 4 digits.')
  const name = input.name.trim()
  if (!name) throw new Error('Name is required.')

  const db = await getDb()
  const clash = (db.employees ?? []).some(
    (e) => e.restaurantId === restaurantId && e.active && e.pin === pin,
  )
  if (clash) throw new Error('That PIN is already in use by another active employee.')

  const ts = nowIso()
  const employee: Employee = {
    id: createId('emp'),
    restaurantId,
    name,
    role: input.role,
    pin,
    email: input.email?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    hourlyWageCents: input.hourlyWageCents,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.employees) d.employees = []
    d.employees.push(employee)
  })
  return employee
}

export async function updateEmployee(
  userId: string,
  restaurantId: string,
  employeeId: string,
  patch: Partial<
    Pick<Employee, 'name' | 'role' | 'pin' | 'email' | 'phone' | 'active' | 'hourlyWageCents'>
  >,
): Promise<Employee> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: Employee | null = null
  await saveDb((d) => {
    if (!d.employees) d.employees = []
    const idx = d.employees.findIndex(
      (e) => e.id === employeeId && e.restaurantId === restaurantId,
    )
    if (idx < 0) throw new Error('Employee not found.')
    const nextPin = patch.pin !== undefined ? normalizePin(patch.pin) : d.employees[idx].pin
    if (patch.pin !== undefined && nextPin.length !== 4) {
      throw new Error('PIN must be 4 digits.')
    }
    if (
      patch.pin !== undefined &&
      d.employees.some(
        (e) =>
          e.restaurantId === restaurantId &&
          e.active &&
          e.id !== employeeId &&
          e.pin === nextPin,
      )
    ) {
      throw new Error('That PIN is already in use by another active employee.')
    }
    const next: Employee = {
      ...d.employees[idx],
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() || d.employees[idx].name : d.employees[idx].name,
      pin: nextPin,
      email: patch.email !== undefined ? patch.email.trim() || undefined : d.employees[idx].email,
      phone: patch.phone !== undefined ? patch.phone.trim() || undefined : d.employees[idx].phone,
      updatedAt: nowIso(),
    }
    d.employees[idx] = next
    updated = next
  })
  if (!updated) throw new Error('Employee not found.')
  return updated
}

export async function findEmployeeByPin(
  restaurantId: string,
  pin: string,
): Promise<Employee | null> {
  const normalized = normalizePin(pin)
  if (normalized.length !== 4) return null
  const db = await getDb()
  return (
    (db.employees ?? []).find(
      (e) => e.restaurantId === restaurantId && e.active && e.pin === normalized,
    ) ?? null
  )
}

export async function getOpenClockEntry(
  restaurantId: string,
  employeeId: string,
): Promise<TimeClockEntry | null> {
  const db = await getDb()
  return (
    (db.timeClockEntries ?? []).find(
      (e) =>
        e.restaurantId === restaurantId &&
        e.employeeId === employeeId &&
        !e.clockOutAt,
    ) ?? null
  )
}

export async function clockIn(
  restaurantId: string,
  pin: string,
): Promise<{ employee: Employee; entry: TimeClockEntry }> {
  const employee = await findEmployeeByPin(restaurantId, pin)
  if (!employee) throw new Error('Invalid PIN.')
  const open = await getOpenClockEntry(restaurantId, employee.id)
  if (open) throw new Error(`${employee.name} is already clocked in.`)
  const ts = nowIso()
  const entry: TimeClockEntry = {
    id: createId('clk'),
    restaurantId,
    employeeId: employee.id,
    clockInAt: ts,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.timeClockEntries) d.timeClockEntries = []
    d.timeClockEntries.push(entry)
  })
  return { employee, entry }
}

export async function clockOut(
  restaurantId: string,
  pin: string,
): Promise<{ employee: Employee; entry: TimeClockEntry }> {
  const employee = await findEmployeeByPin(restaurantId, pin)
  if (!employee) throw new Error('Invalid PIN.')
  let updated: TimeClockEntry | null = null
  await saveDb((d) => {
    if (!d.timeClockEntries) d.timeClockEntries = []
    const idx = d.timeClockEntries.findIndex(
      (e) =>
        e.restaurantId === restaurantId &&
        e.employeeId === employee.id &&
        !e.clockOutAt,
    )
    if (idx < 0) throw new Error(`${employee.name} is not clocked in.`)
    const next = {
      ...d.timeClockEntries[idx],
      clockOutAt: nowIso(),
      updatedAt: nowIso(),
    }
    d.timeClockEntries[idx] = next
    updated = next
  })
  if (!updated) throw new Error(`${employee.name} is not clocked in.`)
  return { employee, entry: updated }
}

export async function openCashDrawer(
  restaurantId: string,
  employeeId?: string,
  note?: string,
): Promise<CashDrawerEvent> {
  const ts = nowIso()
  const event: CashDrawerEvent = {
    id: createId('drw'),
    restaurantId,
    employeeId,
    openedAt: ts,
    note: note?.trim() || 'POS drawer open',
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    if (!d.cashDrawerEvents) d.cashDrawerEvents = []
    d.cashDrawerEvents.push(event)
  })
  return event
}

export async function listOpenClocks(restaurantId: string): Promise<TimeClockEntry[]> {
  const db = await getDb()
  return (db.timeClockEntries ?? []).filter(
    (e) => e.restaurantId === restaurantId && !e.clockOutAt,
  )
}

export async function listRecentClockEntries(
  restaurantId: string,
  limit = 40,
): Promise<TimeClockEntry[]> {
  const db = await getDb()
  return (db.timeClockEntries ?? [])
    .filter((e) => e.restaurantId === restaurantId)
    .sort((a, b) => (a.clockInAt < b.clockInAt ? 1 : -1))
    .slice(0, limit)
}
