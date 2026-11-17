import { useEffect, useMemo, useState } from 'react'
import {
  AlarmClock,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Package,
  ShoppingBag,
  UtensilsCrossed,
  WalletCards,
} from 'lucide-react'
import type {
  DiningTable,
  Employee,
  Order,
  Reservation,
  Restaurant,
  TimeClockEntry,
} from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import * as employeeService from '@/services/employeeService'
import * as reservationService from '@/services/reservationService'
import { cn, formatMoney } from '@/lib/utils'

export type PosHubView = 'home' | 'dine_in' | 'ordering' | 'pick_up' | 'clock' | 'recall'

export function PosHomeHubFixed({
  restaurant,
  isRetail,
  onDineIn,
  onToGo,
  onPickUp,
  onClock,
  onRecall,
  onOpenDrawer,
  drawerFlash,
}: {
  restaurant: Restaurant
  isRetail: boolean
  onDineIn: () => void
  onToGo: () => void
  onPickUp: () => void
  onClock: () => void
  onRecall: () => void
  onOpenDrawer: () => void
  drawerFlash: boolean
}) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const tiles: Array<{
    id: string
    label: string
    blurb: string
    icon: typeof Package
    onClick: () => void
    hide?: boolean
  }> = [
    {
      id: 'dine_in',
      label: 'Dine In',
      blurb: 'Seat a table',
      icon: UtensilsCrossed,
      onClick: onDineIn,
      hide: isRetail,
    },
    {
      id: 'to_go',
      label: isRetail ? 'Sale' : 'To Go',
      blurb: isRetail ? 'Ring up a sale' : 'Counter / takeout order',
      icon: Package,
      onClick: onToGo,
    },
    {
      id: 'clock',
      label: 'Clock In/Out',
      blurb: 'Staff time clock',
      icon: AlarmClock,
      onClick: onClock,
    },
    {
      id: 'pick_up',
      label: 'Pick Up',
      blurb: 'Ready & waiting orders',
      icon: ShoppingBag,
      onClick: onPickUp,
    },
    {
      id: 'drawer',
      label: 'Drawer',
      blurb: 'Open cash drawer',
      icon: WalletCards,
      onClick: onOpenDrawer,
    },
    {
      id: 'recall',
      label: 'Recall',
      blurb: 'Recent tickets',
      icon: ClipboardList,
      onClick: onRecall,
    },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-stone-50">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
        <div>
          <p className="text-sm font-semibold tabular-nums text-stone-800">
            {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </p>
          <p className="text-xs text-stone-500">
            {now.toLocaleDateString([], { month: '2-digit', day: '2-digit' })}
          </p>
        </div>
        <p className="font-display text-lg text-stone-900">Welcome</p>
        <Badge tone="accent">POS</Badge>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-6">
        {drawerFlash ? (
          <div className="absolute inset-x-4 top-3 z-20 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm sm:inset-x-6">
            Cash drawer opened (simulated).
          </div>
        ) : null}

        <div className="mx-auto grid w-full max-w-xl flex-1 grid-cols-2 grid-rows-3 gap-2.5 sm:gap-3">
          {tiles
            .filter((t) => !t.hide)
            .map((tile) => {
              const Icon = tile.icon
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={tile.onClick}
                  className="flex min-h-0 flex-col items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-100/90 px-2 py-2 text-center transition hover:border-[var(--brand-primary)]/40 hover:bg-white hover:shadow-sm active:scale-[0.98] sm:gap-2 sm:px-3"
                >
                  <Icon className="h-7 w-7 shrink-0 text-[var(--brand-primary)] sm:h-8 sm:w-8" />
                  <span className="text-sm font-semibold text-stone-900 sm:text-base">
                    {tile.label}
                  </span>
                  <span className="text-[11px] leading-snug text-stone-500 sm:text-xs">
                    {tile.blurb}
                  </span>
                </button>
              )
            })}
        </div>

        <p className="mt-3 shrink-0 text-center text-xs text-stone-400">{restaurant.name}</p>
      </div>
    </div>
  )
}

export function PosDineInSeatView({
  tables,
  reservations,
  onBack,
  onSeatAndOrder,
}: {
  tables: DiningTable[]
  reservations: Reservation[]
  onBack: () => void
  onSeatAndOrder: (
    table: DiningTable,
    guestName: string,
    partySize: number,
  ) => void | Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [guestName, setGuestName] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const occupied = useMemo(() => {
    const set = new Set<string>()
    for (const r of reservations) {
      if ((r.status === 'booked' || r.status === 'seated') && r.tableId) {
        const start = new Date(r.startAt).getTime()
        const end = new Date(r.endAt).getTime()
        const now = Date.now()
        if (now >= start - 30 * 60_000 && now <= end) set.add(r.tableId)
      }
    }
    return set
  }, [reservations])

  const selected = tables.find((t) => t.id === selectedId) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 hover:bg-stone-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="font-semibold text-stone-900">Dine in</p>
          <p className="text-xs text-stone-500">Choose a table, then start the ticket</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tables
            .filter((t) => t.active)
            .map((t) => {
              const isBusy = occupied.has(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    setSelectedId(t.id)
                    setPartySize(Math.min(partySize, t.seats))
                  }}
                  className={cn(
                    'rounded-2xl border px-3 py-4 text-left',
                    selectedId === t.id
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/10'
                      : isBusy
                        ? 'border-stone-100 bg-stone-50 opacity-50'
                        : 'border-stone-200 hover:bg-stone-50',
                  )}
                >
                  <p className="font-medium text-stone-900">{t.name}</p>
                  <p className="text-xs text-stone-500">
                    {t.seats} seats{isBusy ? ' · occupied' : ''}
                  </p>
                </button>
              )
            })}
        </div>

        {selected ? (
          <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-medium text-stone-800">Seat {selected.name}</p>
            <label className="block text-xs font-medium text-stone-600">
              Guest name
              <input
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Walk-in party"
              />
            </label>
            <label className="block text-xs font-medium text-stone-600">
              Party size
              <input
                type="number"
                min={1}
                max={selected.seats}
                className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value) || 1)}
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                setError('')
                void Promise.resolve(
                  onSeatAndOrder(selected, guestName.trim() || 'Walk-in', partySize),
                )
                  .catch((err) => {
                    setError(err instanceof Error ? err.message : 'Could not seat table.')
                  })
                  .finally(() => setBusy(false))
              }}
            >
              Seat & start order
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PosClockView({
  restaurantId,
  employees,
  openClocks,
  onBack,
  onChanged,
}: {
  restaurantId: string
  employees: Employee[]
  openClocks: TimeClockEntry[]
  onBack: () => void
  onChanged: () => void
}) {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const openByEmployee = useMemo(() => {
    const map = new Map<string, TimeClockEntry>()
    for (const e of openClocks) map.set(e.employeeId, e)
    return map
  }, [openClocks])

  async function submit(mode: 'in' | 'out') {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result =
        mode === 'in'
          ? await employeeService.clockIn(restaurantId, pin)
          : await employeeService.clockOut(restaurantId, pin)
      setMessage(
        mode === 'in'
          ? `${result.employee.name} clocked in.`
          : `${result.employee.name} clocked out.`,
      )
      setPin('')
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock action failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 hover:bg-stone-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="font-semibold text-stone-900">Clock In/Out</p>
          <p className="text-xs text-stone-500">Enter your 4-digit PIN</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="mx-auto max-w-xs space-y-3">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-5 text-center">
            <p className="font-display text-3xl tracking-[0.35em] text-stone-900">
              {pin.padEnd(4, '•').slice(0, 4)}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'C'].map((key) => (
              <button
                key={key}
                type="button"
                className="rounded-xl border border-stone-200 bg-white py-3 text-lg font-medium hover:bg-stone-50"
                onClick={() => {
                  if (key === '⌫') setPin((p) => p.slice(0, -1))
                  else if (key === 'C') setPin('')
                  else if (pin.length < 4) setPin((p) => p + key)
                }}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button disabled={busy || pin.length !== 4} onClick={() => void submit('in')}>
              Clock in
            </Button>
            <Button
              variant="outline"
              disabled={busy || pin.length !== 4}
              onClick={() => void submit('out')}
            >
              Clock out
            </Button>
          </div>
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
            On the clock
          </p>
          <ul className="space-y-2">
            {employees
              .filter((e) => e.active && openByEmployee.has(e.id))
              .map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-stone-800">{e.name}</span>
                  <Badge tone="success">{e.role}</Badge>
                </li>
              ))}
            {!employees.some((e) => openByEmployee.has(e.id)) ? (
              <li className="text-sm text-stone-500">Nobody clocked in.</li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  )
}

export function PosPickUpView({
  orders,
  onBack,
  onAdvance,
}: {
  orders: Order[]
  onBack: () => void
  onAdvance: (order: Order, status: 'ready' | 'completed') => Promise<void>
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const list = orders
    .filter(
      (o) =>
        o.fulfillment.type === 'pickup' &&
        ['received', 'confirmed', 'preparing', 'ready'].includes(o.status),
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 hover:bg-stone-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="font-semibold text-stone-900">Pick up</p>
          <p className="text-xs text-stone-500">Hand off waiting orders</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {list.length === 0 ? (
          <p className="text-sm text-stone-500">No pickup orders in progress.</p>
        ) : (
          list.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl text-stone-900">#{order.orderNumber}</p>
                  <p className="text-sm text-stone-600">{order.customer.name}</p>
                  <p className="text-xs capitalize text-stone-500">{order.status}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {order.status !== 'ready' && order.status !== 'completed' ? (
                    <Button
                      size="sm"
                      disabled={busyId === order.id}
                      onClick={() => {
                        setBusyId(order.id)
                        setError('')
                        void onAdvance(order, 'ready')
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : 'Update failed.'),
                          )
                          .finally(() => setBusyId(null))
                      }}
                    >
                      Mark ready
                    </Button>
                  ) : null}
                  {order.status === 'ready' ? (
                    <Button
                      size="sm"
                      disabled={busyId === order.id}
                      onClick={() => {
                        setBusyId(order.id)
                        setError('')
                        void onAdvance(order, 'completed')
                          .catch((err) =>
                            setError(err instanceof Error ? err.message : 'Update failed.'),
                          )
                          .finally(() => setBusyId(null))
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Picked up
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm text-stone-500">
                {formatMoney(order.pricing.totalCents)} · {order.items.length} item
                {order.items.length === 1 ? '' : 's'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function PosRecallView({
  orders,
  onBack,
}: {
  orders: Order[]
  onBack: () => void
}) {
  const recent = [...orders]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 20)

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-lg p-1.5 hover:bg-stone-100">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="font-semibold text-stone-900">Recall</p>
          <p className="text-xs text-stone-500">Recent tickets</p>
        </div>
      </div>
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {recent.map((order) => (
          <li
            key={order.id}
            className="rounded-2xl border border-stone-200 px-4 py-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-stone-900">#{order.orderNumber}</p>
              <Badge tone="neutral">{order.fulfillment.type.replace('_', ' ')}</Badge>
            </div>
            <p className="mt-1 text-stone-600">
              {order.customer.name} · {formatMoney(order.pricing.totalCents)} · {order.status}
            </p>
            <p className="text-xs text-stone-400">
              {new Date(order.createdAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </li>
        ))}
        {recent.length === 0 ? (
          <li className="text-sm text-stone-500">No recent orders.</li>
        ) : null}
      </ul>
    </div>
  )
}

export async function seatTableForPos(
  restaurantId: string,
  userId: string,
  table: DiningTable,
  guestName: string,
  partySize: number,
): Promise<void> {
  await reservationService.createReservation(restaurantId, {
    userId,
    guestName,
    partySize: Math.min(partySize, table.seats),
    startAt: new Date().toISOString(),
    source: 'walk_in',
    tableId: table.id,
    status: 'seated',
    notes: 'Seated from POS',
  })
}
