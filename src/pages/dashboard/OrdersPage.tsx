import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Search } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useDb } from '@/hooks/useDb'
import { formatMoney } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import type { OrderStatus } from '@/types'
import { cn } from '@/lib/utils'

const TABS: Array<{ id: 'all' | OrderStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'received', label: 'New' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'out_for_delivery', label: 'Out for delivery' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

export function OrdersPage() {
  const current = useRestaurantStore((s) => s.current())
  const { db } = useDb()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('all')
  const [query, setQuery] = useState('')

  const orders = useMemo(() => {
    if (!db || !current) return []
    return db.orders
      .filter((o) => o.restaurantId === current.id)
      .filter((o) => (tab === 'all' ? true : o.status === tab))
  }, [db, current, tab])

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((order) => {
      const statusLabel = order.status.replaceAll('_', ' ')
      const itemNames = order.items.map((i) => i.name).join(' ')
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.reference.toLowerCase().includes(q) ||
        order.customer.name.toLowerCase().includes(q) ||
        order.customer.phone.toLowerCase().includes(q) ||
        (order.customer.email || '').toLowerCase().includes(q) ||
        statusLabel.includes(q) ||
        order.fulfillment.type.toLowerCase().includes(q) ||
        itemNames.toLowerCase().includes(q)
      )
    })
  }, [orders, query])

  const newCount =
    db && current
      ? db.orders.filter((o) => o.restaurantId === current.id && o.status === 'received').length
      : 0

  if (!current) return <p className="text-sm text-stone-500">Select a restaurant.</p>

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Orders</h1>
          <p className="mt-1 text-stone-500">Accept, prepare, and complete customer orders.</p>
        </div>
        {newCount > 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800 animate-pulse-soft">
            <Bell className="h-4 w-4" />
            {newCount} new order{newCount === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1.5 text-sm',
              tab === t.id
                ? 'bg-[var(--color-brand)] text-white'
                : 'bg-white text-stone-600 border border-stone-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder="Search orders…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="grid gap-3">
        {filteredOrders.map((order) => (
          <Link
            key={order.id}
            to={`/dashboard/orders/${order.id}`}
            className="rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-[var(--color-brand)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-xl">#{order.orderNumber}</span>
                  <Badge
                    tone={
                      order.status === 'received'
                        ? 'accent'
                        : order.status === 'completed'
                          ? 'success'
                          : order.status === 'cancelled'
                            ? 'danger'
                            : 'brand'
                    }
                  >
                    {order.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-stone-600">
                  {order.customer.name} · {order.fulfillment.type} ·{' '}
                  {new Date(order.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </div>
                <div className="mt-1 text-xs text-stone-500">
                  {order.items.reduce((n, i) => n + i.quantity, 0)} items
                  {order.items[0] ? ` · ${order.items[0].name}` : ''}
                  {order.items.length > 1 ? ' + more' : ''}
                </div>
              </div>
              <div className="text-right font-medium">{formatMoney(order.pricing.totalCents)}</div>
            </div>
          </Link>
        ))}
        {filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-10 text-center text-sm text-stone-500">
            {query.trim()
              ? `No orders match “${query.trim()}”.`
              : 'No orders in this view.'}
          </div>
        ) : null}
      </div>
    </div>
  )
}
