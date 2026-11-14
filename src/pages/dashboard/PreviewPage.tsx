import { useMemo } from 'react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useDb } from '@/hooks/useDb'
import { getAvailableMenus, isAcceptingOrders, isRestaurantOpen } from '@/lib/scheduling'
import { formatScheduleSummary } from '@/lib/scheduling'
import { Field, Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

function toLocalInputValue(date: Date): { date: string; time: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

export function PreviewPage() {
  const current = useRestaurantStore((s) => s.current())
  const { db } = useDb()
  const device = usePreviewStore((s) => s.device)
  const enabled = usePreviewStore((s) => s.enabled)
  const simulatedAt = usePreviewStore((s) => s.simulatedAt)
  const setDevice = usePreviewStore((s) => s.setDevice)
  const setSimulatedAt = usePreviewStore((s) => s.setSimulatedAt)
  const setEnabled = usePreviewStore((s) => s.setEnabled)
  const clock = usePreviewStore((s) => s.clock)

  const previewClock = clock()
  const local = toLocalInputValue(simulatedAt ?? previewClock)

  const menus = useMemo(() => {
    if (!db || !current) return []
    return db.menus.filter((m) => m.restaurantId === current.id)
  }, [db, current])

  const availableMenus = useMemo(() => {
    if (!current) return []
    return getAvailableMenus(menus, current, previewClock)
  }, [menus, current, previewClock])

  if (!current) {
    return <p className="text-sm text-stone-500">Select a restaurant to preview.</p>
  }

  function applyDateTime(date: string, time: string) {
    if (!date || !time) return
    const next = new Date(`${date}T${time}:00`)
    if (Number.isNaN(next.getTime())) return
    setSimulatedAt(next)
  }

  const iframeSrc = `/r/${current.slug}?preview=1`

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Storefront preview</h1>
          <p className="mt-1 text-stone-500">
            Simulate date and time to verify which menus guests will see. Preview clock is kept in
            the local preview store (and can sync via localStorage on the storefront).
          </p>
        </div>
        <a
          href={`/r/${current.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center rounded-xl border border-stone-300 px-4 text-sm font-medium hover:bg-stone-50"
        >
          Open live storefront
        </a>
      </div>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Preview controls</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date">
            <Input
              type="date"
              value={local.date}
              onChange={(e) => applyDateTime(e.target.value, local.time)}
            />
          </Field>
          <Field label="Time">
            <Input
              type="time"
              value={local.time}
              onChange={(e) => applyDateTime(local.date, e.target.value)}
            />
          </Field>
          <Field label="Device">
            <Select
              value={device}
              onChange={(e) => setDevice(e.target.value as 'mobile' | 'desktop')}
            >
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <label className="flex h-10 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSimulatedAt(simulatedAt ?? new Date())
                  } else {
                    setEnabled(false)
                    setSimulatedAt(null)
                  }
                }}
              />
              Use simulated clock
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEnabled(false)
                setSimulatedAt(null)
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Badge tone={isRestaurantOpen(current, previewClock) ? 'success' : 'warning'}>
            {isRestaurantOpen(current, previewClock) ? 'Restaurant open' : 'Restaurant closed'}
          </Badge>
          <Badge tone={isAcceptingOrders(current, previewClock) ? 'success' : 'danger'}>
            {isAcceptingOrders(current, previewClock)
              ? 'Accepting orders'
              : 'Not accepting orders'}
          </Badge>
          <Badge>
            Clock: {previewClock.toLocaleString()}
            {enabled ? ' (simulated)' : ' (now)'}
          </Badge>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Menus available at this clock</h2>
        <ul className="mt-4 space-y-2">
          {availableMenus.map((menu) => (
            <li
              key={menu.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 px-3 py-2 text-sm"
            >
              <span className="font-medium">{menu.name}</span>
              <span className="text-stone-500">{formatScheduleSummary(menu.schedule)}</span>
            </li>
          ))}
          {availableMenus.length === 0 ? (
            <li className="text-sm text-stone-500">No menus available at the selected time.</li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Embedded storefront</h2>
          <Badge>{device}</Badge>
        </div>
        <div
          className={`mx-auto overflow-hidden rounded-2xl border border-stone-300 bg-stone-100 ${
            device === 'mobile' ? 'max-w-[390px]' : 'w-full'
          }`}
        >
          <iframe
            title={`${current.name} preview`}
            src={iframeSrc}
            className={`w-full bg-white ${device === 'mobile' ? 'h-[720px]' : 'h-[780px]'}`}
          />
        </div>
        <p className="mt-3 text-xs text-stone-500">
          The iframe loads <code>{iframeSrc}</code>. If the storefront reads the preview store /
          localStorage clock, it will reflect the simulated time above.
        </p>
      </section>
    </div>
  )
}
