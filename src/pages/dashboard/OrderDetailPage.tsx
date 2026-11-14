import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import { formatMoney, formatPhone } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Field, Textarea } from '@/components/ui/Input'
import * as orderService from '@/services/orderService'
import type { OrderStatus } from '@/types'

export function OrderDetailPage() {
  const { orderId } = useParams()
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const order = db?.orders.find((o) => o.id === orderId && o.restaurantId === current?.id)

  if (!current || !user) return <p className="text-sm text-stone-500">Select a restaurant.</p>
  if (!order) {
    return (
      <div>
        <p>Order not found.</p>
        <Link to="/dashboard/orders" className="text-[var(--color-brand)]">
          Back to orders
        </Link>
      </div>
    )
  }

  const next = orderService.nextStatusesFor(order)

  async function advance(status: OrderStatus) {
    setBusy(true)
    setError('')
    try {
      await orderService.advanceOrderStatus(user!.id, current!.id, order!.id, status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveNote() {
    setBusy(true)
    try {
      await orderService.addInternalNote(user!.id, current!.id, order!.id, note || order!.internalNotes || '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-up">
      <Link to="/dashboard/orders" className="text-sm text-stone-500 hover:text-stone-800">
        ← Orders
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl">Order #{order.orderNumber}</h1>
            <Badge tone="brand">{order.status.replaceAll('_', ' ')}</Badge>
          </div>
          <p className="mt-1 text-stone-500">
            Placed {new Date(order.createdAt).toLocaleString()} · Ref {order.reference}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next.map((status) => (
            <Button
              key={status}
              disabled={busy}
              variant={status === 'cancelled' ? 'danger' : 'primary'}
              onClick={() => void advance(status)}
            >
              {status === 'cancelled'
                ? 'Cancel'
                : status === 'confirmed'
                  ? 'Accept'
                  : `Mark ${status.replaceAll('_', ' ')}`}
            </Button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Items</h2>
            <div className="mt-4 space-y-4">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 border-b border-stone-100 pb-4 last:border-0">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <div className="font-medium">
                        {item.quantity}× {item.name}
                      </div>
                      <div>{formatMoney(item.lineTotalCents)}</div>
                    </div>
                    {item.modifiers.length ? (
                      <ul className="mt-1 text-xs text-stone-500">
                        {item.modifiers.map((m) => (
                          <li key={`${m.groupId}-${m.optionId}`}>
                            {m.groupName}: {m.optionName}
                            {m.priceAdjustmentCents
                              ? ` (${formatMoney(m.priceAdjustmentCents)})`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {item.comboSelections?.length ? (
                      <ul className="mt-1 text-xs text-stone-500">
                        {item.comboSelections.map((c) => (
                          <li key={c.groupId}>
                            {c.groupName}: {c.itemName}
                            {c.upgradeCents ? ` (+${formatMoney(c.upgradeCents)})` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {item.specialInstructions ? (
                      <p className="mt-1 text-xs italic text-stone-600">
                        “{item.specialInstructions}”
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-stone-100 pt-4 text-sm">
              <Row label="Subtotal" value={formatMoney(order.pricing.subtotalCents)} />
              <Row label={`Tax (${order.pricing.taxRatePercent}%)`} value={formatMoney(order.pricing.taxCents)} />
              {order.pricing.deliveryFeeCents ? (
                <Row label="Delivery fee" value={formatMoney(order.pricing.deliveryFeeCents)} />
              ) : null}
              <Row label="Tip" value={formatMoney(order.pricing.tipCents)} />
              <Row label="Total" value={formatMoney(order.pricing.totalCents)} bold />
            </div>
          </section>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Customer</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-stone-500">Name</dt>
                <dd>{order.customer.name}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Phone</dt>
                <dd>{formatPhone(order.customer.phone)}</dd>
              </div>
              {order.customer.email ? (
                <div>
                  <dt className="text-stone-500">Email</dt>
                  <dd>{order.customer.email}</dd>
                </div>
              ) : null}
              <div>
                <dt className="text-stone-500">Fulfillment</dt>
                <dd className="capitalize">{order.fulfillment.type}</dd>
              </div>
              {order.fulfillment.address ? (
                <div>
                  <dt className="text-stone-500">Address</dt>
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
              ) : null}
              {order.fulfillment.instructions ? (
                <div>
                  <dt className="text-stone-500">Instructions</dt>
                  <dd>{order.fulfillment.instructions}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Payment</h2>
            <p className="mt-2 text-sm text-stone-600">{order.payment.message}</p>
            <p className="mt-1 text-sm">
              Card ···· {order.payment.simulatedCardLast4} · {order.payment.status}
            </p>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Timeline</h2>
            <ol className="mt-3 space-y-3">
              {order.statusHistory.map((event, i) => (
                <li key={`${event.status}-${event.at}`} className="flex gap-3 text-sm">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--color-brand)]" />
                  <div>
                    <div className="font-medium capitalize">{event.status.replaceAll('_', ' ')}</div>
                    <div className="text-xs text-stone-500">
                      {new Date(event.at).toLocaleString()}
                      {i === 0 ? ' · received' : ''}
                    </div>
                    {event.note ? <div className="text-xs text-stone-600">{event.note}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4">
              <Link
                to={`/order/${order.reference}`}
                className="text-sm text-[var(--color-brand)] hover:underline"
                target="_blank"
              >
                Open customer tracker
              </Link>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <Field label="Internal notes">
              <Textarea
                value={note || order.internalNotes || ''}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Kitchen notes, allergy reminders…"
              />
            </Field>
            <Button className="mt-3" variant="outline" disabled={busy} onClick={() => void saveNote()}>
              Save notes
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold text-base pt-1' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}
