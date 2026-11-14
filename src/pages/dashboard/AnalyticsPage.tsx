import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useRestaurantStore } from '@/stores/restaurantStore'
import {
  getAnalyticsSummary,
  rangeFromPreset,
  type DateRange,
} from '@/services/analyticsService'
import { formatMoney } from '@/lib/utils'
import { Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

const PRESETS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
]

type Summary = Awaited<ReturnType<typeof getAnalyticsSummary>>

export function AnalyticsPage() {
  const current = useRestaurantStore((s) => s.current())
  const [preset, setPreset] = useState('7d')
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!current) {
      setSummary(null)
      return
    }
    let alive = true
    setLoading(true)
    const range: DateRange = rangeFromPreset(preset)
    getAnalyticsSummary(current.id, range)
      .then((data) => {
        if (alive) setSummary(data)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [current, preset])

  if (!current) {
    return <p className="text-sm text-stone-500">Select a restaurant to view analytics.</p>
  }

  const metrics = summary
    ? [
        { label: 'Orders', value: String(summary.totalOrders) },
        { label: 'Sales', value: formatMoney(summary.totalSales) },
        { label: 'Avg order value', value: formatMoney(summary.avgOrder) },
        { label: 'Avg items / order', value: String(summary.avgItems) },
        { label: 'Conversion', value: `${summary.conversion}%` },
      ]
    : []

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Analytics</h1>
          <p className="mt-1 text-stone-500">
            Orders, popular items, QR scans, and guest conversion for {current.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            className="w-40"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            aria-label="Date range"
          >
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
          <Select
            className="w-32"
            value={chartType}
            onChange={(e) => setChartType(e.target.value as 'bar' | 'line')}
            aria-label="Chart type"
          >
            <option value="bar">Bar chart</option>
            <option value="line">Line chart</option>
          </Select>
        </div>
      </div>

      {loading && !summary ? (
        <p className="text-sm text-stone-500">Loading analytics…</p>
      ) : null}

      {summary ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-stone-200 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]"
              >
                <div className="text-sm text-stone-500">{m.label}</div>
                <div className="mt-2 font-display text-3xl">{m.value}</div>
              </div>
            ))}
          </div>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Order volume</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={summary.volumeByDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="var(--color-brand)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <LineChart data={summary.volumeByDay}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="orders" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="sales" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      yAxisId="orders"
                      type="monotone"
                      dataKey="orders"
                      stroke="var(--color-brand)"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="sales"
                      type="monotone"
                      dataKey="sales"
                      stroke="var(--color-accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-xl">Popular items</h2>
              <ul className="mt-4 space-y-3">
                {summary.popularItems.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="text-stone-500">
                      {item.qty} sold · {formatMoney(item.revenue)}
                    </span>
                  </li>
                ))}
                {summary.popularItems.length === 0 ? (
                  <li className="text-sm text-stone-500">No item sales in this range.</li>
                ) : null}
              </ul>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-xl">Pickup vs delivery</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <div className="rounded-xl bg-stone-50 px-4 py-3">
                  <div className="text-xs text-stone-500">Pickup</div>
                  <div className="font-display text-2xl">{summary.pickup}</div>
                </div>
                <div className="rounded-xl bg-stone-50 px-4 py-3">
                  <div className="text-xs text-stone-500">Delivery</div>
                  <div className="font-display text-2xl">{summary.delivery}</div>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
                {summary.pickup + summary.delivery > 0 ? (
                  <div
                    className="h-full bg-[var(--color-brand)]"
                    style={{
                      width: `${(summary.pickup / (summary.pickup + summary.delivery)) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-xl">QR scans</h2>
              <ul className="mt-4 space-y-3">
                {summary.qrScans.map((qr) => (
                  <li
                    key={qr.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <div>
                      <div className="font-medium">{qr.name}</div>
                      {qr.campaign ? (
                        <div className="text-xs text-stone-500">{qr.campaign}</div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <Badge tone="brand">{qr.scans} in range</Badge>
                      <div className="mt-1 text-xs text-stone-500">
                        {qr.lifetimeScans} lifetime
                      </div>
                    </div>
                  </li>
                ))}
                {summary.qrScans.length === 0 ? (
                  <li className="text-sm text-stone-500">No QR codes yet.</li>
                ) : null}
              </ul>
            </section>

            <section className="rounded-2xl border border-stone-200 bg-white p-5">
              <h2 className="font-display text-xl">Top modifiers</h2>
              <ul className="mt-4 space-y-3">
                {summary.topModifiers.map((mod) => (
                  <li
                    key={mod.name}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-medium">{mod.name}</span>
                    <span className="text-stone-500">{mod.count}</span>
                  </li>
                ))}
                {summary.topModifiers.length === 0 ? (
                  <li className="text-sm text-stone-500">No modifier selections in this range.</li>
                ) : null}
              </ul>
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
