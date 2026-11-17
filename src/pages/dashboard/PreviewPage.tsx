import { useMemo } from 'react'
import { Monitor, Smartphone } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useDb } from '@/hooks/useDb'
import { getAvailableMenus, isAcceptingOrders, isRestaurantOpen } from '@/lib/scheduling'
import { formatScheduleSummary } from '@/lib/scheduling'
import { Field, Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'

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
  const copy = storeCopy(current?.storeKind)
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
    return (
      <p className="text-sm text-stone-500">
        {copy.selectStoreToManage('preview').replace('manage ', '')}
      </p>
    )
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
            Simulate date and time to verify which {copy.catalogNounPlural.toLowerCase()}{' '}
            {copy.guestNoun}s will see. Preview clock is kept in the local preview store (and can
            sync via localStorage on the storefront).
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
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            {isRestaurantOpen(current, previewClock)
              ? `${copy.storeNounTitle} open`
              : `${copy.storeNounTitle} closed`}
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
        <h2 className="font-display text-xl">
          {copy.catalogNounPlural} available at this clock
        </h2>
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
            <li className="text-sm text-stone-500">
              No {copy.catalogNounPlural.toLowerCase()} available at the selected time.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Embedded storefront</h2>
            <p className="mt-0.5 text-sm text-stone-500">
              Switch viewport to check mobile vs desktop layout.
            </p>
          </div>
          <div
            className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1"
            role="group"
            aria-label="Preview viewport"
          >
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              aria-pressed={device === 'mobile'}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                device === 'mobile'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800',
              )}
            >
              <Smartphone className="h-4 w-4" />
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              aria-pressed={device === 'desktop'}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                device === 'desktop'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800',
              )}
            >
              <Monitor className="h-4 w-4" />
              Desktop
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-stone-100 p-3 sm:p-5">
          <div
            className={cn(
              'mx-auto overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-sm transition-[max-width] duration-300',
              device === 'mobile' ? 'max-w-[390px]' : 'max-w-6xl w-full',
            )}
          >
            <div className="flex items-center gap-1.5 border-b border-stone-200 bg-stone-50 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
              <span className="ml-2 truncate text-xs text-stone-400">
                {device === 'mobile' ? '390 × 844' : 'Desktop'} · /r/{current.slug}
              </span>
            </div>
            <iframe
              title={`${current.name} preview`}
              src={iframeSrc}
              className={cn(
                'w-full bg-white',
                device === 'mobile' ? 'h-[760px]' : 'h-[820px]',
              )}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-stone-500">
          The iframe width drives responsive layout, so desktop mode shows the wide storefront
          chrome and mobile mode shows the narrow phone layout.
        </p>
      </section>
    </div>
  )
}
