import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Truck,
  UtensilsCrossed,
} from 'lucide-react'
import type { Order, OrderStatus, Restaurant } from '@/types'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useDb } from '@/hooks/useDb'
import { formatMoney, formatPhone, cn } from '@/lib/utils'
import { DEFAULT_BRANDING } from '@/types'

export function OrderTrackerPage() {
  const { reference } = useParams<{ reference: string }>()
  const location = useLocation()
  const { db, loading } = useDb()
  const justPlaced = Boolean(
    (location.state as { justPlaced?: boolean } | null)?.justPlaced,
  )

  const order = useMemo(() => {
    if (!db || !reference) return null
    return (
      db.orders.find((o) => o.reference === reference || o.id === reference) ??
      null
    )
  }, [db, reference])

  const restaurant = useMemo(() => {
    if (!db || !order) return null
    return db.restaurants.find((r) => r.id === order.restaurantId) ?? null
  }, [db, order])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse-soft text-stone-500">Loading order…</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <Package className="mb-4 h-12 w-12 text-stone-300" />
        <h1 className="font-display text-3xl">Order not found</h1>
        <p className="mt-2 max-w-md text-stone-500">
          We couldn’t find an order with that reference. Double-check the link from your
          confirmation.
        </p>
        <Link to="/" className="mt-6">
          <Button>Home</Button>
        </Link>
      </div>
    )
  }

  const branding = restaurant?.branding ?? DEFAULT_BRANDING
  const steps = timelineSteps(order)
  const statusLabel = statusDisplayLabel(order)
  const isTerminal = order.status === 'completed' || order.status === 'cancelled'

  return (
    <StorefrontShell branding={branding}>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {justPlaced ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 animate-fade-up">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-medium text-emerald-900">Order placed successfully</p>
              <p className="text-sm text-emerald-800/80">
                We’ll update this page as the kitchen progresses your order.
              </p>
            </div>
          </div>
        ) : null}

        <div className="animate-fade-up">
          <p className="text-sm font-medium uppercase tracking-wider text-[var(--sf-primary)]">
            {restaurant?.name ?? 'Your order'}
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl">Order #{order.orderNumber}</h1>
          <p className="mt-1 text-sm text-[var(--sf-text)]/60">
            Reference {order.reference}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge
              tone={
                order.status === 'cancelled'
                  ? 'danger'
                  : order.status === 'completed'
                    ? 'success'
                    : 'brand'
              }
            >
              {statusLabel}
            </Badge>
            <Badge tone="neutral">
              {order.fulfillment.type === 'delivery' ? 'Delivery' : 'Pickup'}
            </Badge>
          </div>
        </div>

        <section className="mt-10 animate-fade-up" style={{ animationDelay: '80ms' }}>
          <h2 className="mb-5 text-xl">Progress</h2>
          <ol className="relative space-y-0">
            {steps.map((step, index) => {
              const done = step.state === 'done'
              const current = step.state === 'current'
              const upcoming = step.state === 'upcoming'
              return (
                <li key={step.status} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < steps.length - 1 ? (
                    <span
                      className={cn(
                        'absolute left-[15px] top-8 h-[calc(100%-16px)] w-0.5',
                        done ? 'bg-[var(--sf-primary)]' : 'bg-stone-200',
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
                      done && 'border-[var(--sf-primary)] bg-[var(--sf-primary)] text-white',
                      current &&
                        'border-[var(--sf-accent)] bg-[var(--sf-accent)] text-white animate-pulse-soft',
                      upcoming && 'border-stone-200 bg-[var(--sf-surface)] text-stone-400',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                  </span>
                  <div className="pt-0.5">
                    <p
                      className={cn(
                        'font-medium',
                        upcoming ? 'text-[var(--sf-text)]/45' : 'text-[var(--sf-text)]',
                      )}
                    >
                      {step.label}
                    </p>
                    {step.at ? (
                      <p className="text-xs text-[var(--sf-text)]/55">
                        {new Date(step.at).toLocaleString()}
                      </p>
                    ) : current && !isTerminal ? (
                      <p className="text-xs text-[var(--sf-accent)]">In progress</p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <section className="rounded-[var(--sf-radius,12px)] border border-stone-200 bg-[var(--sf-surface)] p-5 animate-fade-up">
            <h2 className="mb-3 text-lg font-medium">Fulfillment</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--sf-text)]/55">Type</dt>
                <dd className="font-medium capitalize">{order.fulfillment.type}</dd>
              </div>
              <div>
                <dt className="text-[var(--sf-text)]/55">Customer</dt>
                <dd className="font-medium">{order.customer.name}</dd>
                <dd className="text-[var(--sf-text)]/70">
                  {formatPhone(order.customer.phone)}
                </dd>
              </div>
              {order.fulfillment.address ? (
                <div>
                  <dt className="flex items-center gap-1 text-[var(--sf-text)]/55">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </dt>
                  <dd>
                    {order.fulfillment.address.line1}
                    {order.fulfillment.address.line2
                      ? `, ${order.fulfillment.address.line2}`
                      : ''}
                    <br />
                    {order.fulfillment.address.city}, {order.fulfillment.address.state}{' '}
                    {order.fulfillment.address.postalCode}
                  </dd>
                </div>
              ) : restaurant ? (
                <PickupAddress restaurant={restaurant} />
              ) : null}
              {order.fulfillment.instructions ? (
                <div>
                  <dt className="text-[var(--sf-text)]/55">Instructions</dt>
                  <dd>{order.fulfillment.instructions}</dd>
                </div>
              ) : null}
              {order.estimatedReadyAt ? (
                <div>
                  <dt className="flex items-center gap-1 text-[var(--sf-text)]/55">
                    <Clock3 className="h-3.5 w-3.5" /> Estimated ready
                  </dt>
                  <dd className="font-medium">
                    {new Date(order.estimatedReadyAt).toLocaleTimeString([], {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-[var(--sf-radius,12px)] border border-stone-200 bg-[var(--sf-surface)] p-5 animate-fade-up">
            <h2 className="mb-3 text-lg font-medium">Payment</h2>
            <p className="text-sm text-[var(--sf-text)]/80">{order.payment.message}</p>
            <p className="mt-2 text-xs text-[var(--sf-text)]/55">
              Card ending {order.payment.simulatedCardLast4} · {order.payment.status}
            </p>
            <p className="mt-4 text-2xl font-semibold">
              {formatMoney(order.pricing.totalCents)}
            </p>
          </section>
        </div>

        <section className="mt-6 rounded-[var(--sf-radius,12px)] border border-stone-200 bg-[var(--sf-surface)] p-5 animate-fade-up">
          <h2 className="mb-4 text-lg font-medium">Order summary</h2>
          <ul className="space-y-3">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity}× {item.name}
                  </p>
                  {item.modifiers.length ? (
                    <p className="text-xs text-[var(--sf-text)]/55">
                      {item.modifiers.map((m) => m.optionName).join(', ')}
                    </p>
                  ) : null}
                  {item.comboSelections?.length ? (
                    <p className="text-xs text-[var(--sf-text)]/55">
                      {item.comboSelections.map((c) => c.itemName).join(' · ')}
                    </p>
                  ) : null}
                  {item.specialInstructions ? (
                    <p className="text-xs italic text-[var(--sf-text)]/50">
                      “{item.specialInstructions}”
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0">{formatMoney(item.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-stone-200 pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-[var(--sf-text)]/60">Subtotal</dt>
              <dd>{formatMoney(order.pricing.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--sf-text)]/60">Tax</dt>
              <dd>{formatMoney(order.pricing.taxCents)}</dd>
            </div>
            {order.pricing.deliveryFeeCents > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--sf-text)]/60">Delivery</dt>
                <dd>{formatMoney(order.pricing.deliveryFeeCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-[var(--sf-text)]/60">Tip</dt>
              <dd>{formatMoney(order.pricing.tipCents)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(order.pricing.totalCents)}</dd>
            </div>
          </dl>
        </section>

        {restaurant ? (
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={`/r/${restaurant.slug}`}>
              <Button variant="outline">Order again</Button>
            </Link>
            <Link to="/">
              <Button variant="ghost">MenuShop home</Button>
            </Link>
          </div>
        ) : null}
      </div>
    </StorefrontShell>
  )
}

function PickupAddress({ restaurant }: { restaurant: Restaurant }) {
  if (!restaurant.address.line1) return null
  return (
    <div>
      <dt className="flex items-center gap-1 text-[var(--sf-text)]/55">
        <MapPin className="h-3.5 w-3.5" /> Pickup at
      </dt>
      <dd>
        {restaurant.address.line1}
        <br />
        {restaurant.address.city}, {restaurant.address.state}{' '}
        {restaurant.address.postalCode}
      </dd>
    </div>
  )
}

type StepState = 'done' | 'current' | 'upcoming'

function timelineSteps(order: Order) {
  const statuses =
    order.fulfillment.type === 'delivery'
      ? ([
          'received',
          'confirmed',
          'preparing',
          'out_for_delivery',
          'completed',
        ] as OrderStatus[])
      : ([
          'received',
          'confirmed',
          'preparing',
          'ready',
          'completed',
        ] as OrderStatus[])

  if (order.status === 'cancelled') {
    const historyStatuses = order.statusHistory.map((h) => h.status)
    const reached = statuses.filter((s) => historyStatuses.includes(s))
    return [
      ...reached.map((status) => ({
        status,
        label: statusDisplayFor(status, order.fulfillment.type),
        state: 'done' as StepState,
        at: order.statusHistory.find((h) => h.status === status)?.at,
        icon: iconFor(status),
      })),
      {
        status: 'cancelled' as OrderStatus,
        label: 'Cancelled',
        state: 'current' as StepState,
        at: order.statusHistory.find((h) => h.status === 'cancelled')?.at,
        icon: Package,
      },
    ]
  }

  const currentIdx = statuses.indexOf(order.status)
  return statuses.map((status, index) => {
    let state: StepState = 'upcoming'
    if (index < currentIdx || order.status === 'completed') state = 'done'
    else if (index === currentIdx) state = 'current'
    if (order.status === 'completed' && index === statuses.length - 1) state = 'done'
    return {
      status,
      label: statusDisplayFor(status, order.fulfillment.type),
      state,
      at: order.statusHistory.find((h) => h.status === status)?.at,
      icon: iconFor(status),
    }
  })
}

function statusDisplayLabel(order: Order) {
  return statusDisplayFor(order.status, order.fulfillment.type)
}

function statusDisplayFor(status: OrderStatus, type: Order['fulfillment']['type']) {
  const map: Record<OrderStatus, string> = {
    received: 'Order received',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    ready: type === 'pickup' ? 'Ready for pickup' : 'Ready',
    out_for_delivery: 'Out for delivery',
    completed: type === 'delivery' ? 'Delivered' : 'Picked up',
    cancelled: 'Cancelled',
  }
  return map[status]
}

function iconFor(status: OrderStatus) {
  switch (status) {
    case 'received':
      return Package
    case 'confirmed':
      return CheckCircle2
    case 'preparing':
      return UtensilsCrossed
    case 'ready':
      return Clock3
    case 'out_for_delivery':
      return Truck
    case 'completed':
      return Check
    default:
      return Package
  }
}
