import { useMemo, useState } from 'react'
import { Plus, UserRound } from 'lucide-react'
import type { Employee, EmployeeRole } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useDb } from '@/hooks/useDb'
import * as employeeService from '@/services/employeeService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatMoney } from '@/lib/utils'

const ROLE_OPTIONS: Array<{ id: EmployeeRole; label: string }> = [
  { id: 'manager', label: 'Manager' },
  { id: 'server', label: 'Server' },
  { id: 'cashier', label: 'Cashier' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'host', label: 'Host' },
]

export function EmployeesPage() {
  const user = useAuthStore((s) => s.user)
  const current = useRestaurantStore((s) => s.current())
  const { db, revision } = useDb({ pollMs: 4000 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<EmployeeRole>('server')
  const [pin, setPin] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const employees = useMemo(() => {
    if (!db || !current) return [] as Employee[]
    return (db.employees ?? [])
      .filter((e) => e.restaurantId === current.id)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  }, [db, current, revision])

  const openClocks = useMemo(() => {
    if (!db || !current) return new Set<string>()
    return new Set(
      (db.timeClockEntries ?? [])
        .filter((e) => e.restaurantId === current.id && !e.clockOutAt)
        .map((e) => e.employeeId),
    )
  }, [db, current, revision])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a store to manage employees.</p>
  }

  const restaurant = current
  const actor = user

  async function run(action: () => Promise<void>, ok?: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      if (ok) setMessage(ok)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl">Employees</h1>
        <p className="mt-1 max-w-2xl text-stone-500">
          Manage floor staff for the POS — roles, 4-digit clock PINs, and who is currently on the
          clock.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <h2 className="font-display text-xl">Add employee</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Name" htmlFor="emp-name">
            <Input
              id="emp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Lee"
            />
          </Field>
          <Field label="Role" htmlFor="emp-role">
            <Select
              id="emp-role"
              value={role}
              onChange={(e) => setRole(e.target.value as EmployeeRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Clock PIN (4 digits)" htmlFor="emp-pin">
            <Input
              id="emp-pin"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
            />
          </Field>
          <Field label="Phone" htmlFor="emp-phone">
            <Input id="emp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="emp-email">
            <Input
              id="emp-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await employeeService.createEmployee(actor.id, restaurant.id, {
                name,
                role,
                pin,
                phone,
                email,
              })
              setName('')
              setPin('')
              setPhone('')
              setEmail('')
              setRole('server')
            }, 'Employee added')
          }
        >
          <Plus className="h-4 w-4" />
          Add employee
        </Button>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Team</h2>
        {employees.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No employees yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-100">
            {employees.map((emp) => (
              <li
                key={emp.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-600">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-900">{emp.name}</p>
                      <Badge tone="neutral">{emp.role}</Badge>
                      {openClocks.has(emp.id) ? (
                        <Badge tone="success">On clock</Badge>
                      ) : null}
                      {!emp.active ? <Badge tone="danger">Inactive</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      PIN ···{emp.pin.slice(-2)}
                      {emp.phone ? ` · ${emp.phone}` : ''}
                      {emp.hourlyWageCents
                        ? ` · ${formatMoney(emp.hourlyWageCents)}/hr`
                        : ''}
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={emp.active}
                    disabled={busy}
                    onChange={(e) =>
                      void run(async () => {
                        await employeeService.updateEmployee(
                          actor.id,
                          restaurant.id,
                          emp.id,
                          { active: e.target.checked },
                        )
                      })
                    }
                  />
                  Active
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
