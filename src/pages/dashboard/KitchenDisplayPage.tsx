import { useEffect, useMemo, useState } from 'react'
import { ChefHat, Package, RotateCcw, Undo2 } from 'lucide-react'
import type { Order, OrderStatus, Restaurant } from '@/types'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as orderService from '@/services/orderService'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { brandingStyleVars } from '@/lib/brandingCss'
import { storeCopy } from '@/lib/storeCopy'
import { cn, formatMoney } from '@/lib/utils'

type BoardColumnId = 'new' | 'in_progress' | 'ready'
type BoardMode = 'live' | 'recall'

const ACTIVE: OrderStatus[] = [
  'received',
  'confirmed',
  'preparing',
  'ready',
  'out_for_delivery',
]

const RECALL_WINDOW_MS = 24 * 60 * 60_000

export function KitchenDisplayPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db, revision, lastSyncedAt } = useDb({ pollMs: 2000 })
  const [now, setNow] = useState(() => Date.now())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [boardMode, setBoardMode] = useState<BoardMode>('live')

  const copy = storeCopy(current?.storeKind)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const orders = useMemo(() => {
    if (!db || !current) return [] as Order[]
    return db.orders
      .filter((o) => o.restaurantId === current.id && ACTIVE.includes(o.status))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  }, [db, current])

  const recallOrders = useMemo(() => {
    if (!db || !current) return [] as Order[]
    const cutoff = now - RECALL_WINDOW_MS
    return db.orders
      .filter(
        (o) =>
          o.restaurantId === current.id &&
          (o.status === 'completed' || o.status === 'cancelled') &&
          new Date(o.updatedAt).getTime() >= cutoff,
      )
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  }, [db, current, now])

  const columns = useMemo(() => {
    const newOrders = orders.filter((o) => o.status === 'received')
    const inProgress = orders.filter(
      (o) => o.status === 'confirmed' || o.status === 'preparing',
    )
    const ready = orders.filter(
      (o) => o.status === 'ready' || o.status === 'out_for_delivery',
    )
    return [
      {
        id: 'new' as const,
        title: 'New',
        subtitle: 'Accept incoming tickets',
        orders: newOrders,
      },
      {
        id: 'in_progress' as const,
        title: copy.bohPrepVerb,
        subtitle: copy.isRetail ? 'Pull and pack' : 'Fire and assemble',
        orders: inProgress,
      },
      {
        id: 'ready' as const,
        title: 'Ready',
        subtitle: copy.isRetail ? 'Pickup / shipping' : 'Pickup / delivery',
        orders: ready,
      },
    ]
  }, [orders, copy.bohPrepVerb, copy.isRetail])

  if (!current || !user) {
    return (
      <p className="text-sm text-stone-500">
        Select a {copy.storeNoun} to open the {copy.bohNoun.toLowerCase()}.
      </p>
    )
  }

  const restaurant = current
  const actor = user
  const Icon = copy.isRetail ? Package : ChefHat

  async function moveOrder(order: Order, status: OrderStatus) {
    setBusyId(order.id)
    setError('')
    try {
      await orderService.advanceOrderStatus(
        actor.id,
        restaurant.id,
        order.id,
        status,
      )
      if (boardMode === 'recall' && ACTIVE.includes(status)) {
        setBoardMode('live')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update order.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{copy.bohNoun}</h1>
          <p className="mt-1 max-w-2xl text-stone-500">{copy.bohBoardBlurb}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveIndicator pulseKey={`${revision}-${lastSyncedAt ?? 0}`} />
          <Badge tone="accent">{orders.length} active</Badge>
          {recallOrders.length ? (
            <Badge tone="neutral">{recallOrders.length} recallable</Badge>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-center">
        <BohDeviceFrame restaurant={restaurant} label={copy.bohShort}>
          <div className="flex h-full min-h-0 flex-col overflow-hidden bg-stone-100">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-stone-900">{restaurant.name}</p>
                  <p className="text-xs text-stone-500">
                    {copy.bohNoun} · {boardMode === 'live' ? 'board' : 'recall'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LiveIndicator
                  className="hidden sm:inline-flex"
                  pulseKey={`${revision}-${orders.length}-${recallOrders.length}`}
                />
                <div className="flex rounded-lg border border-stone-200 p-0.5">
                  <button
                    type="button"
                    onClick={() => setBoardMode('live')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium',
                      boardMode === 'live'
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'text-stone-600 hover:bg-stone-50',
                    )}
                  >
                    Live
                  </button>
                  <button
                    type="button"
                    onClick={() => setBoardMode('recall')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium',
                      boardMode === 'recall'
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'text-stone-600 hover:bg-stone-50',
                    )}
                  >
                    Recall
                  </button>
                </div>
                <p className="hidden text-xs font-medium tabular-nums text-stone-500 sm:block">
                  {new Date(now).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            {boardMode === 'live' ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-px overflow-hidden bg-stone-200 md:grid-cols-3">
                {columns.map((col) => (
                  <BohColumn
                    key={col.id}
                    column={col}
                    copy={copy}
                    now={now}
                    busyId={busyId}
                    onMove={(order, status) => void moveOrder(order, status)}
                  />
                ))}
              </div>
            ) : (
              <RecallPanel
                orders={recallOrders}
                copy={copy}
                now={now}
                busyId={busyId}
                onMove={(order, status) => void moveOrder(order, status)}
              />
            )}
          </div>
        </BohDeviceFrame>
      </div>
    </div>
  )
}

function BohDeviceFrame({
  restaurant,
  label,
  children,
}: {
  restaurant: Restaurant
  label: string
  children: React.ReactNode
}) {
  const style = brandingStyleVars(restaurant.branding)
  return (
    <div className="w-full max-w-6xl">
      <div className="mx-auto rounded-[1.25rem] border border-stone-300 bg-stone-800 p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex items-center justify-between px-2 text-stone-400">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {restaurant.name} · {label}
          </div>
          <div className="text-[11px] text-stone-500">{label}</div>
        </div>
        <div className="overflow-hidden rounded-xl bg-white" style={style}>
          <div className="h-[min(78vh,720px)] overflow-hidden">{children}</div>
        </div>
        <div className="mx-auto mt-3 h-1.5 w-36 rounded-full bg-stone-600" />
      </div>
      <p className="mt-4 text-center text-xs text-stone-500">
        Use Move back on live tickets, or open Recall for completed orders from the last 24 hours.
      </p>
    </div>
  )
}

function BohColumn({
  column,
  copy,
  now,
  busyId,
  onMove,
}: {
  column: {
    id: BoardColumnId
    title: string
    subtitle: string
    orders: Order[]
  }
  copy: ReturnType<typeof storeCopy>
  now: number
  busyId: string | null
  onMove: (order: Order, status: OrderStatus) => void
}) {
  return (
    <section className="flex min-h-0 flex-col bg-stone-50">
      <header className="shrink-0 border-b border-stone-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-stone-900">{column.title}</h2>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums',
              column.orders.length
                ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                : 'bg-stone-100 text-stone-400',
            )}
          >
            {column.orders.length}
          </span>
        </div>
        <p className="text-[11px] text-stone-500">{column.subtitle}</p>
      </header>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-2.5">
        {column.orders.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-stone-400">No tickets</p>
        ) : (
          column.orders.map((order) => (
            <BohTicket
              key={order.id}
              order={order}
              copy={copy}
              now={now}
              busy={busyId === order.id}
              mode="live"
              onMove={onMove}
            />
          ))
        )}
      </div>
    </section>
  )
}

function RecallPanel({
  orders,
  copy,
  now,
  busyId,
  onMove,
}: {
  orders: Order[]
  copy: ReturnType<typeof storeCopy>
  now: number
  busyId: string | null
  onMove: (order: Order, status: OrderStatus) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-50">
      <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-[var(--brand-primary)]" />
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Recall completed tickets</h2>
            <p className="text-[11px] text-stone-500">
              Last 24 hours · pull a ticket back onto the live board
            </p>
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-3">
        {orders.length === 0 ? (
          <p className="px-2 py-12 text-center text-sm text-stone-400">
            No completed or cancelled orders to recall right now.
          </p>
        ) : (
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <BohTicket
                key={order.id}
                order={order}
                copy={copy}
                now={now}
                busy={busyId === order.id}
                mode="recall"
                onMove={onMove}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BohTicket({
  order,
  copy,
  now,
  busy,
  mode,
  onMove,
}: {
  order: Order
  copy: ReturnType<typeof storeCopy>
  now: number
  busy: boolean
  mode: BoardMode
  onMove: (order: Order, status: OrderStatus) => void
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const primary = mode === 'live' ? primaryNextStatus(order) : primaryRecallStatus(order)
  const moveOptions = orderService.retractStatusesFor(order)
  const elapsed = formatElapsed(now - new Date(order.createdAt).getTime())
  const urgent =
    mode === 'live' && now - new Date(order.createdAt).getTime() > 15 * 60_000
  const itemCount = order.items
    .filter((i) => !i.cancelled)
    .reduce((n, i) => n + i.quantity, 0)

  return (
    <article
      className={cn(
        'rounded-xl border bg-white p-3 shadow-sm',
        urgent ? 'border-amber-300 ring-1 ring-amber-200' : 'border-stone-200',
        order.status === 'received' && 'border-orange-300',
        order.status === 'cancelled' && 'border-red-200',
        order.status === 'completed' && 'border-stone-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl leading-none text-stone-900">
            #{order.orderNumber}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {order.customer.name} ·{' '}
            {order.fulfillment.type === 'delivery'
              ? copy.shipOrDeliveryLabel
              : copy.pickupLabel}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-xs font-semibold tabular-nums',
              urgent ? 'text-amber-700' : 'text-stone-500',
            )}
          >
            {elapsed}
          </p>
          <p className="text-[11px] capitalize text-stone-400">
            {statusLabel(order.status, copy)}
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-2 border-t border-stone-100 pt-3">
        {order.items
          .filter((item) => !item.cancelled)
          .map((item) => (
          <li key={item.id} className="text-sm">
            <div className="flex gap-2 font-medium text-stone-900">
              <span className="tabular-nums text-[var(--brand-primary)]">
                {item.quantity}×
              </span>
              <span className="min-w-0">{item.name}</span>
            </div>
            {item.modifiers.length ? (
              <ul className="mt-0.5 space-y-0.5 pl-6 text-xs text-stone-500">
                {item.modifiers.map((m) => (
                  <li key={`${m.groupId}-${m.optionId}`}>
                    {m.optionName}
                    {m.priceAdjustmentCents
                      ? ` (${formatMoney(m.priceAdjustmentCents)})`
                      : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            {item.comboSelections?.length ? (
              <ul className="mt-0.5 space-y-0.5 pl-6 text-xs text-stone-500">
                {item.comboSelections.map((c) => (
                  <li key={c.groupId}>
                    {c.groupName}: {c.itemName}
                  </li>
                ))}
              </ul>
            ) : null}
            {item.specialInstructions ? (
              <p className="mt-0.5 pl-6 text-xs italic text-stone-600">
                {copy.specialInstructionsLabel}: “{item.specialInstructions}”
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.fulfillment.instructions ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          {order.fulfillment.instructions}
        </p>
      ) : null}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-stone-400">
            {itemCount}{' '}
            {itemCount === 1
              ? copy.itemNoun.toLowerCase()
              : copy.itemNounPlural.toLowerCase()}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {mode === 'live' && moveOptions.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setShowMoveMenu((v) => !v)}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Move back
              </Button>
            ) : null}
            {primary ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                className="border-0"
                style={{
                  backgroundColor: 'var(--brand-button)',
                  color: 'var(--brand-button-text)',
                }}
                onClick={() => onMove(order, primary)}
              >
                {mode === 'recall' ? (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {recallActionLabel(primary, copy)}
                  </>
                ) : (
                  actionLabel(primary, copy)
                )}
              </Button>
            ) : null}
          </div>
        </div>

        {(showMoveMenu || mode === 'recall') && moveOptions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-stone-200 bg-stone-50 p-2">
            {moveOptions
              .filter((s) => (mode === 'recall' ? s !== primary : true))
              .map((status) => (
                <button
                  key={status}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setShowMoveMenu(false)
                    onMove(order, status)
                  }}
                  className="rounded-md border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:border-stone-300 disabled:opacity-50"
                >
                  {mode === 'recall'
                    ? recallActionLabel(status, copy)
                    : retractActionLabel(status, copy)}
                </button>
              ))}
            {mode === 'live' ? (
              <button
                type="button"
                className="rounded-md px-2 py-1 text-[11px] text-stone-400 hover:text-stone-600"
                onClick={() => setShowMoveMenu(false)}
              >
                Cancel
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  )
}

function primaryNextStatus(order: Order): OrderStatus | null {
  const next = orderService.nextStatusesFor(order).filter((s) => s !== 'cancelled')
  return next[0] ?? null
}

function primaryRecallStatus(order: Order): OrderStatus | null {
  return orderService.retractStatusesFor(order)[0] ?? null
}

function actionLabel(status: OrderStatus, copy: ReturnType<typeof storeCopy>): string {
  switch (status) {
    case 'confirmed':
      return 'Accept'
    case 'preparing':
      return copy.bohPrepAction
    case 'ready':
      return copy.bohReadyAction
    case 'out_for_delivery':
      return copy.isRetail ? 'Mark shipped' : 'Out for delivery'
    case 'completed':
      return 'Complete'
    default:
      return `Mark ${status.replaceAll('_', ' ')}`
  }
}

function retractActionLabel(
  status: OrderStatus,
  copy: ReturnType<typeof storeCopy>,
): string {
  switch (status) {
    case 'received':
      return 'To New'
    case 'confirmed':
      return 'To Accepted'
    case 'preparing':
      return `To ${copy.bohPrepVerb}`
    case 'ready':
      return 'To Ready'
    case 'out_for_delivery':
      return copy.isRetail ? 'To Shipped' : 'To Out'
    default:
      return `To ${status.replaceAll('_', ' ')}`
  }
}

function recallActionLabel(
  status: OrderStatus,
  copy: ReturnType<typeof storeCopy>,
): string {
  switch (status) {
    case 'received':
      return 'Recall as New'
    case 'confirmed':
      return 'Recall as Accepted'
    case 'preparing':
      return `Recall to ${copy.bohPrepVerb}`
    case 'ready':
      return 'Recall to Ready'
    case 'out_for_delivery':
      return copy.isRetail ? 'Recall as Shipped' : 'Recall as Out'
    case 'completed':
    case 'cancelled':
      return `Recall to ${status.replaceAll('_', ' ')}`
  }
}

function statusLabel(status: OrderStatus, copy: ReturnType<typeof storeCopy>): string {
  switch (status) {
    case 'received':
      return 'New'
    case 'confirmed':
      return 'Accepted'
    case 'preparing':
      return copy.bohPrepVerb
    case 'ready':
      return 'Ready'
    case 'out_for_delivery':
      return copy.isRetail ? 'Shipped' : 'Out'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
  }
}

function formatElapsed(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000))
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  return `${hours}h ${rem}m`
}
