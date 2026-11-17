import { Link } from 'react-router-dom'
import { ArrowUpRight, ClipboardList, DollarSign, ShoppingBag, Utensils } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useDb } from '@/hooks/useDb'
import { formatMoney } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { shortStatusLabel, storeCopy } from '@/lib/storeCopy'

export function OverviewPage() {
  const current = useRestaurantStore((s) => s.current())
  const restaurants = useRestaurantStore((s) => s.restaurants)
  const { db, loading } = useDb()
  const copy = storeCopy(current?.storeKind)

  if (!loading && restaurants.length === 0) {
    return (
      <EmptyState
        title={`Create your first ${copy.storeNoun}`}
        description={`Set up a branded storefront, ${copy.catalogNounPlural.toLowerCase()}, and ordering in a few minutes.`}
        actionLabel={copy.newStoreCta.replace(/^\+\s*/, '')}
        onAction={() => {
          window.location.href = '/dashboard/restaurants/new'
        }}
      />
    )
  }

  if (!current || !db) {
    return <div className="text-sm text-stone-500">Loading dashboard…</div>
  }

  const orders = db.orders.filter((o) => o.restaurantId === current.id)
  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter((o) => o.createdAt.startsWith(today) && o.status !== 'cancelled')
  const sales = todayOrders.reduce((s, o) => s + o.pricing.totalCents, 0)
  const openOrders = orders.filter((o) =>
    ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status),
  )
  const menuCount = db.menus.filter((m) => m.restaurantId === current.id).length
  const itemCount = db.items.filter((i) => i.restaurantId === current.id).length
  const kind = current.storeKind ?? 'restaurant'

  return (
    <div className="space-y-8 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900">{current.name}</h1>
          <p className="mt-1 text-stone-500">{copy.overviewToday}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={current.ordering.acceptingOrders ? 'success' : 'warning'}>
            {current.ordering.acceptingOrders ? 'Accepting orders' : 'Orders paused'}
          </Badge>
          <Link
            to={`/r/${current.slug}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand)]"
          >
            Open storefront <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Today’s orders', value: String(todayOrders.length), icon: ShoppingBag },
          { label: 'Today’s sales', value: formatMoney(sales), icon: DollarSign },
          { label: 'Open tickets', value: String(openOrders.length), icon: ClipboardList },
          {
            label: `${copy.catalogNounPlural} / ${copy.itemNounPlural.toLowerCase()}`,
            value: `${menuCount} / ${itemCount}`,
            icon: Utensils,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-stone-500">{card.label}</span>
              <card.icon className="h-4 w-4 text-stone-400" />
            </div>
            <div className="mt-3 font-display text-3xl">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Incoming orders</h2>
            <Link to="/dashboard/orders" className="text-sm text-[var(--color-brand)]">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {openOrders.slice(0, 5).map((order) => (
              <Link
                key={order.id}
                to={`/dashboard/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-3 hover:bg-stone-50"
              >
                <div>
                  <div className="font-medium">#{order.orderNumber} · {order.customer.name}</div>
                  <div className="text-xs text-stone-500">
                    {order.fulfillment.type === 'delivery'
                      ? copy.shipOrDeliveryLabel
                      : copy.pickupLabel}{' '}
                    · {order.items.length} {copy.itemNoun}
                    {order.items.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="text-right">
                  <Badge
                    tone={
                      order.status === 'received'
                        ? 'accent'
                        : order.status === 'ready'
                          ? 'success'
                          : 'brand'
                    }
                  >
                    {shortStatusLabel(order.status, kind, order.fulfillment.type)}
                  </Badge>
                  <div className="mt-1 text-sm font-medium">
                    {formatMoney(order.pricing.totalCents)}
                  </div>
                </div>
              </Link>
            ))}
            {openOrders.length === 0 ? (
              <p className="text-sm text-stone-500">No open orders right now.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <h2 className="mb-4 font-display text-xl">Quick actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { to: '/dashboard/menus', label: `Edit ${copy.catalogNounPlural.toLowerCase()}` },
              { to: '/dashboard/items', label: copy.itemLibrary },
              { to: '/dashboard/branding', label: 'Customize branding' },
              { to: '/dashboard/qr', label: 'Create QR code' },
              { to: '/dashboard/analytics', label: 'View analytics' },
              { to: '/dashboard/preview', label: 'Preview storefront' },
            ].map((a) => (
              <Link
                key={a.to}
                to={a.to}
                className="rounded-xl border border-stone-200 px-4 py-3 text-sm font-medium hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
