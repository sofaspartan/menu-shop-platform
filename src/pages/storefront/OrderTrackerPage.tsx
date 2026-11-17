import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import {
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Phone,
  Truck,
  UtensilsCrossed,
} from 'lucide-react'
import type { Order, OrderStatus, Restaurant } from '@/types'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { Button } from '@/components/ui/Button'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { useDb } from '@/hooks/useDb'
import {
  shortStatusLabel,
  statusHeadlineFor,
  statusSubtitleFor,
  storeCopy,
} from '@/lib/storeCopy'
import { formatMoney, formatPhone, cn } from '@/lib/utils'
import { DEFAULT_BRANDING } from '@/types'

export function OrderTrackerPage() {
  const { reference } = useParams<{ reference: string }>()
  const location = useLocation()
  const { db, loading, revision, lastSyncedAt } = useDb({ pollMs: 2000 })
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
  const kind = restaurant?.storeKind ?? 'restaurant'
  const copy = storeCopy(kind)
  const steps = trackerSteps(order, kind)
  const headline = statusHeadlineFor(order.status, kind, order.fulfillment.type)
  const subtitle = statusSubtitleFor(
    order.status,
    kind,
    order.fulfillment.type,
    restaurant?.name ?? copy.storeNounTitle,
  )
  const StatusIcon = iconFor(order.status)
  const filledCount = steps.filter((s) => s.state === 'done' || s.state === 'current').length
  const isCancelled = order.status === 'cancelled'

  const estimatedLabel = order.estimatedReadyAt
    ? new Date(order.estimatedReadyAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null

  const dayLabel = order.estimatedReadyAt
    ? isSameDay(new Date(order.estimatedReadyAt), new Date())
      ? 'Today'
      : new Date(order.estimatedReadyAt).toLocaleDateString([], {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
    : null

  return (
    <StorefrontShell branding={branding}>
      <div className="mx-auto max-w-lg px-5 py-8 sm:px-6">
        {justPlaced ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 animate-fade-up">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-medium text-emerald-900">Order placed successfully</p>
              <p className="text-sm text-emerald-800/80">
                This page updates live as the kitchen progresses your order — no refresh needed.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mb-4 flex justify-center">
          <LiveIndicator
            label="Live tracking"
            pulseKey={`${revision}-${order.status}-${order.statusHistory.length}-${lastSyncedAt ?? 0}`}
          />
        </div>

        <div className="animate-fade-up text-center">
          <p className="text-sm text-[var(--sf-text)]/55">
            {restaurant?.name ?? 'Your order'} · #{order.orderNumber}
          </p>
          <div
            className={cn(
              'mx-auto mt-6 flex h-20 w-20 items-center justify-center rounded-full',
              isCancelled
                ? 'bg-red-50 text-red-600'
                : 'bg-[color-mix(in_srgb,var(--sf-accent)_14%,white)] text-[var(--sf-accent)]',
            )}
          >
            <StatusIcon className="h-10 w-10" strokeWidth={1.5} />
          </div>
          <h1 className="mt-5 font-display text-3xl tracking-tight text-[var(--sf-text)] sm:text-4xl">
            {headline}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[var(--sf-text)]/65">
            {subtitle}
          </p>

          <div
            className="mt-8 flex gap-1.5"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={filledCount}
            aria-label="Order progress"
          >
            {steps.map((step) => {
              const filled = step.state === 'done' || step.state === 'current'
              return (
                <span
                  key={step.status}
                  title={step.label}
                  className={cn(
                    'h-2.5 flex-1 rounded-full transition-colors duration-500',
                    filled
                      ? isCancelled
                        ? 'bg-red-500'
                        : 'bg-[var(--sf-accent)]'
                      : 'bg-stone-200',
                    step.state === 'current' && !isCancelled && 'animate-pulse-soft',
                  )}
                />
              )
            })}
          </div>
          <div className="mt-3 flex justify-between gap-2 text-[11px] text-[var(--sf-text)]/45">
            {steps.map((step) => (
              <span
                key={`label-${step.status}`}
                className={cn(
                  'min-w-0 flex-1 truncate text-center',
                  (step.state === 'done' || step.state === 'current') &&
                    'font-medium text-[var(--sf-text)]/70',
                )}
              >
                {step.shortLabel}
              </span>
            ))}
          </div>
        </div>

        {(dayLabel || estimatedLabel) && !isCancelled ? (
          <section className="mt-10 border-t border-stone-200 pt-6 animate-fade-up">
            {dayLabel ? (
              <p className="text-xl font-semibold text-[var(--sf-text)]">{dayLabel}</p>
            ) : null}
            {estimatedLabel ? (
              <p className="mt-1 flex items-center gap-2 text-[15px] text-[var(--sf-text)]/65">
                <Clock3 className="h-4 w-4 shrink-0" />
                {`${copy.estimatedEtaPrefix(order.fulfillment.type)} ${estimatedLabel}`}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 border-t border-stone-200 pt-6 animate-fade-up">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-text)]/45" />
            <div className="min-w-0 text-[15px] text-[var(--sf-text)]">
              {order.fulfillment.address ? (
                <>
                  <p className="font-medium">
                    {order.fulfillment.address.line1}
                    {order.fulfillment.address.line2
                      ? `, ${order.fulfillment.address.line2}`
                      : ''}
                  </p>
                  <p className="text-[var(--sf-text)]/65">
                    {order.fulfillment.address.city}, {order.fulfillment.address.state}{' '}
                    {order.fulfillment.address.postalCode}
                  </p>
                </>
              ) : restaurant ? (
                <PickupAddress inline restaurant={restaurant} />
              ) : (
                <p>Pickup</p>
              )}
              {order.fulfillment.instructions ? (
                <p className="mt-2 text-sm text-[var(--sf-text)]/55">
                  {order.fulfillment.instructions}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {restaurant?.phone ? (
          <section className="mt-8 rounded-2xl bg-stone-100/90 p-5 animate-fade-up">
            <p className="font-medium text-[var(--sf-text)]">Need help?</p>
            <p className="mt-1 text-sm text-[var(--sf-text)]/60">
              Contact {restaurant.name} about order #{order.orderNumber}.
            </p>
            <a
              href={`tel:${restaurant.phone}`}
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-full border border-stone-200 bg-white px-5 text-sm font-semibold text-[var(--sf-text)] shadow-sm"
            >
              <Phone className="h-4 w-4" />
              {formatPhone(restaurant.phone)}
            </a>
          </section>
        ) : null}

        <section className="mt-8 rounded-[var(--sf-radius,12px)] border border-stone-200 bg-[var(--sf-surface)] p-5 animate-fade-up">
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
            {(order.pricing.discountCents ?? 0) > 0 ? (
              <div className="flex justify-between text-emerald-700">
                <dt>{order.pricing.discountLabel || 'Discount'}</dt>
                <dd>−{formatMoney(order.pricing.discountCents)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-[var(--sf-text)]/60">Tax</dt>
              <dd>{formatMoney(order.pricing.taxCents)}</dd>
            </div>
            {order.pricing.deliveryFeeCents > 0 ? (
              <div className="flex justify-between">
                <dt className="text-[var(--sf-text)]/60">{copy.shipOrDeliveryFee}</dt>
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
          {order.pricing.loyaltyPointsEarned || order.pricing.loyaltyPointsRedeemed ? (
            <div className="mt-4 rounded-xl bg-[color-mix(in_srgb,var(--sf-primary)_8%,white)] px-3 py-3 text-sm text-[var(--sf-text)]">
              {order.pricing.loyaltyPointsEarned ? (
                <p>
                  You earned{' '}
                  <span className="font-semibold">
                    {order.pricing.loyaltyPointsEarned} points
                  </span>{' '}
                  on this order
                  {order.customer.email ? (
                    <>
                      {' '}
                      for <span className="font-medium">{order.customer.email}</span>
                    </>
                  ) : null}
                  .
                </p>
              ) : null}
              {order.pricing.loyaltyPointsRedeemed ? (
                <p className={order.pricing.loyaltyPointsEarned ? 'mt-1' : undefined}>
                  Redeemed {order.pricing.loyaltyPointsRedeemed} points on a reward.
                </p>
              ) : null}
              {restaurant?.loyalty?.enabled && order.loyaltyAccountId && db ? (
                <LoyaltyBalanceNote
                  accountId={order.loyaltyAccountId}
                  restaurantId={restaurant.id}
                />
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-[var(--sf-text)]/50">
            {order.payment.message} · Card ending {order.payment.simulatedCardLast4}
          </p>
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

function LoyaltyBalanceNote({
  accountId,
  restaurantId,
}: {
  accountId: string
  restaurantId: string
}) {
  const { db } = useDb()
  const account = db?.loyaltyAccounts.find(
    (a) => a.id === accountId && a.restaurantId === restaurantId,
  )
  if (!account) return null
  const restaurant = db?.restaurants.find((r) => r.id === restaurantId)
  const rewards = restaurant?.loyalty?.rewards ?? []
  const next = [...rewards]
    .sort((a, b) => a.pointsCost - b.pointsCost)
    .find((r) => r.pointsCost > account.pointsBalance)
  return (
    <p className="mt-2 text-[var(--sf-text)]/75">
      Balance: <span className="font-semibold">{account.pointsBalance} points</span>
      {next ? (
        <>
          {' '}
          · {next.pointsCost - account.pointsBalance} more to unlock “{next.label}”
        </>
      ) : rewards.length ? (
        <> · You’re ready to redeem a reward next time</>
      ) : null}
    </p>
  )
}

function PickupAddress({
  restaurant,
  inline,
}: {
  restaurant: Restaurant
  inline?: boolean
}) {
  if (!restaurant.address.line1) {
    return inline ? (
      <p className="font-medium">
        Pickup at {storeCopy(restaurant.storeKind).storeNoun}
      </p>
    ) : null
  }
  return (
    <div>
      {!inline ? (
        <dt className="flex items-center gap-1 text-[var(--sf-text)]/55">
          <MapPin className="h-3.5 w-3.5" /> Pickup at
        </dt>
      ) : (
        <p className="text-sm text-[var(--sf-text)]/55">Pickup at</p>
      )}
      <p className="font-medium">{restaurant.address.line1}</p>
      <p className="text-[var(--sf-text)]/65">
        {restaurant.address.city}, {restaurant.address.state}{' '}
        {restaurant.address.postalCode}
      </p>
    </div>
  )
}

type StepState = 'done' | 'current' | 'upcoming'

function trackerSteps(order: Order, kind: Restaurant['storeKind'] = 'restaurant') {
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
        label: statusHeadlineFor(status, kind, order.fulfillment.type),
        shortLabel: shortStatusLabel(status, kind, order.fulfillment.type),
        state: 'done' as StepState,
      })),
      {
        status: 'cancelled' as OrderStatus,
        label: 'Cancelled',
        shortLabel: 'Cancelled',
        state: 'current' as StepState,
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
      label: statusHeadlineFor(status, kind, order.fulfillment.type),
      shortLabel: shortStatusLabel(status, kind, order.fulfillment.type),
      state,
    }
  })
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
      return CheckCircle2
    default:
      return Package
  }
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}
