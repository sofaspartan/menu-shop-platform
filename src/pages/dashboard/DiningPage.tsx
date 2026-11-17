import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Armchair, CalendarDays, LayoutGrid, Plus, Trash2 } from 'lucide-react'
import type { DiningTable, Reservation } from '@/types'
import { normalizeReservationSettings } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useDb } from '@/hooks/useDb'
import * as reservationService from '@/services/reservationService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { ModalTabs } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

type DiningTab = 'bookings' | 'tables' | 'settings'

const TABS: Array<{ id: DiningTab; label: string }> = [
  { id: 'bookings', label: 'Bookings' },
  { id: 'tables', label: 'Tables' },
  { id: 'settings', label: 'Settings' },
]

function todayInputValue(): string {
  const d = new Date()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function DiningPage() {
  const user = useAuthStore((s) => s.user)
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)
  const { db, revision } = useDb({ pollMs: 3000 })
  const [tab, setTab] = useState<DiningTab>('bookings')
  const [day, setDay] = useState(todayInputValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [tableName, setTableName] = useState('')
  const [tableSeats, setTableSeats] = useState(2)

  const [walkName, setWalkName] = useState('')
  const [walkParty, setWalkParty] = useState(2)
  const [walkTableId, setWalkTableId] = useState('')
  const [walkNotes, setWalkNotes] = useState('')

  const settings = normalizeReservationSettings(current?.reservations)

  const tables = useMemo(() => {
    if (!db || !current) return [] as DiningTable[]
    return (db.diningTables ?? [])
      .filter((t) => t.restaurantId === current.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current, revision])

  const bookings = useMemo(() => {
    if (!db || !current) return [] as Reservation[]
    const start = new Date(`${day}T00:00:00`).getTime()
    const end = start + 24 * 60 * 60_000
    return (db.reservations ?? [])
      .filter((r) => {
        if (r.restaurantId !== current.id) return false
        const t = new Date(r.startAt).getTime()
        return t >= start && t < end
      })
      .sort((a, b) => (a.startAt < b.startAt ? -1 : 1))
  }, [db, current, day, revision])

  useEffect(() => {
    if (!walkTableId && tables[0]) setWalkTableId(tables[0].id)
  }, [tables, walkTableId])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to manage dining.</p>
  }

  if (current.storeKind === 'retail') {
    return (
      <div className="space-y-3 animate-fade-up">
        <h1 className="font-display text-3xl">Dining</h1>
        <p className="max-w-xl text-stone-500">
          Table reservations are for restaurant storefronts. Switch to a restaurant to manage
          tables and bookings.
        </p>
      </div>
    )
  }

  const restaurant = current
  const actor = user

  async function run(action: () => Promise<void>, ok?: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      await load(actor.id)
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
        <h1 className="font-display text-3xl">Dining</h1>
        <p className="mt-1 max-w-2xl text-stone-500">
          Manage tables, seat walk-ins, and take online reservations alongside takeout ordering.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ModalTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'bookings' ? (
        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Today’s book</h2>
                <p className="text-sm text-stone-500">Online bookings and walk-ins for the day.</p>
              </div>
              <Field label="Day" htmlFor="dining-day">
                <Input
                  id="dining-day"
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </Field>
            </div>

            {bookings.length === 0 ? (
              <p className="text-sm text-stone-500">No reservations for this day yet.</p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {bookings.map((r) => {
                  const table = tables.find((t) => t.id === r.tableId)
                  return (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-stone-900">{r.guestName}</p>
                          <Badge tone="neutral">{r.partySize} guests</Badge>
                          <Badge tone="accent">{r.source.replace('_', ' ')}</Badge>
                          <Badge
                            tone={
                              r.status === 'cancelled' || r.status === 'no_show'
                                ? 'danger'
                                : r.status === 'seated'
                                  ? 'success'
                                  : 'neutral'
                            }
                          >
                            {r.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">
                          {formatWhen(r.startAt)}
                          {table ? ` · ${table.name}` : ' · Unassigned'}
                          {r.confirmationCode ? ` · ${r.confirmationCode}` : ''}
                        </p>
                        {r.notes ? (
                          <p className="mt-1 text-sm text-stone-600">{r.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {r.status === 'booked' ? (
                          <>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await reservationService.updateReservationStatus(
                                    actor.id,
                                    restaurant.id,
                                    r.id,
                                    'seated',
                                  )
                                }, 'Guest seated')
                              }
                            >
                              Seat
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await reservationService.updateReservationStatus(
                                    actor.id,
                                    restaurant.id,
                                    r.id,
                                    'cancelled',
                                  )
                                }, 'Reservation cancelled')
                              }
                            >
                              Cancel
                            </Button>
                          </>
                        ) : null}
                        {r.status === 'seated' ? (
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await reservationService.updateReservationStatus(
                                  actor.id,
                                  restaurant.id,
                                  r.id,
                                  'completed',
                                )
                              }, 'Table cleared')
                            }
                          >
                            Complete
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
            <h2 className="font-display text-xl">Seat a walk-in</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Guest name" htmlFor="walk-name">
                <Input
                  id="walk-name"
                  value={walkName}
                  onChange={(e) => setWalkName(e.target.value)}
                  placeholder="Walk-in guest"
                />
              </Field>
              <Field label="Party size" htmlFor="walk-party">
                <Input
                  id="walk-party"
                  type="number"
                  min={1}
                  max={settings.maxPartySize}
                  value={walkParty}
                  onChange={(e) => setWalkParty(Number(e.target.value) || 1)}
                />
              </Field>
              <Field label="Table" htmlFor="walk-table">
                <Select
                  id="walk-table"
                  value={walkTableId}
                  onChange={(e) => setWalkTableId(e.target.value)}
                >
                  {tables
                    .filter((t) => t.active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.seats} seats
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Notes" htmlFor="walk-notes">
                <Input
                  id="walk-notes"
                  value={walkNotes}
                  onChange={(e) => setWalkNotes(e.target.value)}
                />
              </Field>
            </div>
            <Button
              disabled={busy || !walkTableId}
                  onClick={() =>
                void run(async () => {
                  await reservationService.createReservation(restaurant.id, {
                    userId: actor.id,
                    guestName: walkName || 'Walk-in',
                    partySize: walkParty,
                    startAt: new Date().toISOString(),
                    notes: walkNotes,
                    source: 'walk_in',
                    tableId: walkTableId,
                    status: 'seated',
                  })
                  setWalkName('')
                  setWalkNotes('')
                }, 'Walk-in seated')
              }
            >
              <Armchair className="h-4 w-4" />
              Seat now
            </Button>
          </section>
        </div>
      ) : null}

      {tab === 'tables' ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Floor tables</h2>
              <p className="mt-1 text-sm text-stone-500">
                Quick seat counts for bookings. For rooms, shapes, and the live seating map, open
                Tables.
              </p>
            </div>
            <Link
              to="/dashboard/tables"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-medium text-stone-800 hover:bg-white"
            >
              <LayoutGrid className="h-4 w-4" />
              Open floor plan
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px_auto]">
            <Field label="Name" htmlFor="tbl-name">
              <Input
                id="tbl-name"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                placeholder="Booth A"
              />
            </Field>
            <Field label="Seats" htmlFor="tbl-seats">
              <Input
                id="tbl-seats"
                type="number"
                min={1}
                max={24}
                value={tableSeats}
                onChange={(e) => setTableSeats(Number(e.target.value) || 1)}
              />
            </Field>
            <div className="flex items-end">
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await reservationService.createTable(actor.id, restaurant.id, {
                      name: tableName,
                      seats: tableSeats,
                    })
                    setTableName('')
                  }, 'Table added')
                }
              >
                <Plus className="h-4 w-4" />
                Add table
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-stone-100">
            {tables.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-stone-900">{t.name}</p>
                  <p className="text-sm text-stone-500">{t.seats} seats</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={t.active}
                      onChange={(e) =>
                        void run(async () => {
                          await reservationService.updateTable(actor.id, restaurant.id, t.id, {
                            active: e.target.checked,
                          })
                        })
                      }
                    />
                    Active
                  </label>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await reservationService.deleteTable(actor.id, restaurant.id, t.id)
                      }, 'Table removed')
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Online reservations</h2>
              <p className="mt-1 text-sm text-stone-500">
                Guests book at <code className="text-xs">/r/{restaurant.slug}/reserve</code>. Point
                homepage hero buttons to “Reservations” from Pages & layout.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) =>
                  void run(async () => {
                    await reservationService.updateReservationSettings(
                      actor.id,
                      restaurant.id,
                      { enabled: e.target.checked },
                    )
                  }, 'Settings saved')
                }
              />
              Enabled
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['slotMinutes', 'Slot spacing (minutes)', settings.slotMinutes],
                ['durationMinutes', 'Visit length (minutes)', settings.durationMinutes],
                ['maxPartySize', 'Max party size', settings.maxPartySize],
                ['minLeadMinutes', 'Minimum lead time (minutes)', settings.minLeadMinutes],
                ['maxDaysAhead', 'Bookable days ahead', settings.maxDaysAhead],
              ] as const
            ).map(([key, label, value]) => (
              <Field key={key} label={label} htmlFor={`res-${key}`}>
                <Input
                  id={`res-${key}`}
                  type="number"
                  min={1}
                  value={value}
                  onChange={(e) =>
                    void run(async () => {
                      await reservationService.updateReservationSettings(
                        actor.id,
                        restaurant.id,
                        { [key]: Number(e.target.value) || value },
                      )
                    })
                  }
                />
              </Field>
            ))}
          </div>

          <div
            className={cn(
              'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
              settings.enabled
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-stone-200 bg-stone-50 text-stone-600',
            )}
          >
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {settings.enabled
                ? 'Online booking is live. Guests pick a party size, day, and open timeslot.'
                : 'Online booking is off. Staff can still seat walk-ins from the Bookings tab.'}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  )
}
