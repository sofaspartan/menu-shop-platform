import { useEffect, useMemo, useState } from 'react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as restaurantService from '@/services/restaurantService'
import * as menuService from '@/services/menuService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { createId } from '@/lib/utils'
import { storeCopy } from '@/lib/storeCopy'
import { formatScheduleSummary } from '@/lib/scheduling'
import type {
  BusinessHoursDay,
  DayOfWeek,
  Menu,
  OrderingSettings,
  ScheduleRule,
} from '@/types'

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function SchedulingPage() {
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()

  const [hours, setHours] = useState<BusinessHoursDay[]>([])
  const [ordering, setOrdering] = useState<OrderingSettings | null>(null)
  const [menuDrafts, setMenuDrafts] = useState<
    Record<string, { schedule: ScheduleRule; showWhenUnavailable: boolean }>
  >({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const copy = storeCopy(current?.storeKind)
  const menus = useMemo(() => {
    if (!db || !current) return []
    return db.menus
      .filter((m) => m.restaurantId === current.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current])

  useEffect(() => {
    if (!current) return
    setHours(current.businessHours.map((h) => ({ ...h })))
    setOrdering({ ...current.ordering })
  }, [current])

  useEffect(() => {
    const drafts: Record<string, { schedule: ScheduleRule; showWhenUnavailable: boolean }> = {}
    for (const menu of menus) {
      drafts[menu.id] = {
        schedule: menu.schedule
          ? { ...menu.schedule, daysOfWeek: [...menu.schedule.daysOfWeek] }
          : defaultSchedule(),
        showWhenUnavailable: menu.showWhenUnavailable,
      }
    }
    setMenuDrafts(drafts)
  }, [menus])

  if (!current || !user || !ordering) {
    return <p className="text-sm text-stone-500">Select a restaurant to edit scheduling.</p>
  }

  function updateHour(day: DayOfWeek, patch: Partial<BusinessHoursDay>) {
    setHours((list) => list.map((h) => (h.day === day ? { ...h, ...patch } : h)))
  }

  function updateMenuDraft(
    menuId: string,
    patch: Partial<{ schedule: ScheduleRule; showWhenUnavailable: boolean }>,
  ) {
    setMenuDrafts((d) => ({
      ...d,
      [menuId]: {
        schedule: patch.schedule ?? d[menuId]?.schedule ?? defaultSchedule(),
        showWhenUnavailable:
          patch.showWhenUnavailable ?? d[menuId]?.showWhenUnavailable ?? true,
      },
    }))
  }

  async function save() {
    if (!user || !current || !ordering) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await restaurantService.updateRestaurant(user.id, current.id, {
        businessHours: hours,
      })
      await restaurantService.updateOrderingSettings(user.id, current.id, {
        acceptingOrders: ordering.acceptingOrders,
        temporarilyClosed: ordering.temporarilyClosed,
        temporaryClosureMessage: ordering.temporaryClosureMessage,
        estimatedPrepMinutes: ordering.estimatedPrepMinutes,
        orderCutoffMinutesBeforeClose: ordering.orderCutoffMinutesBeforeClose,
        pickupEnabled: ordering.pickupEnabled,
        deliveryEnabled: ordering.deliveryEnabled,
        deliveryFeeCents: ordering.deliveryFeeCents,
        taxRatePercent: ordering.taxRatePercent,
        minimumDeliveryCents: ordering.minimumDeliveryCents,
      })
      for (const menu of menus) {
        const draft = menuDrafts[menu.id]
        if (!draft) continue
        await menuService.updateMenu(user.id, current.id, menu.id, {
          schedule: draft.schedule.enabled ? draft.schedule : undefined,
          showWhenUnavailable: draft.showWhenUnavailable,
        })
      }
      await load(user.id)
      setMessage('Scheduling settings saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save scheduling')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Scheduling</h1>
          <p className="mt-1 text-stone-500">
            Business hours, ordering windows, and when each menu appears.
          </p>
        </div>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Business hours</h2>
        <div className="mt-4 space-y-3">
          {hours
            .slice()
            .sort((a, b) => a.day - b.day)
            .map((day) => (
              <div
                key={day.day}
                className="grid items-center gap-3 rounded-xl border border-stone-100 px-3 py-3 sm:grid-cols-[140px_auto_1fr_1fr]"
              >
                <div className="font-medium">{DAY_LABELS[day.day]}</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(e) => updateHour(day.day, { closed: e.target.checked })}
                  />
                  Closed
                </label>
                <Field label="Open">
                  <Input
                    type="time"
                    disabled={day.closed}
                    value={day.open}
                    onChange={(e) => updateHour(day.day, { open: e.target.value })}
                  />
                </Field>
                <Field label="Close">
                  <Input
                    type="time"
                    disabled={day.closed}
                    value={day.close}
                    onChange={(e) => updateHour(day.day, { close: e.target.value })}
                  />
                </Field>
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Ordering settings</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordering.acceptingOrders}
              onChange={(e) =>
                setOrdering((o) => (o ? { ...o, acceptingOrders: e.target.checked } : o))
              }
            />
            Accepting orders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordering.temporarilyClosed}
              onChange={(e) =>
                setOrdering((o) => (o ? { ...o, temporarilyClosed: e.target.checked } : o))
              }
            />
            Temporarily closed
          </label>
          <div className="sm:col-span-2">
            <Field label="Closure message">
              <Textarea
                value={ordering.temporaryClosureMessage || ''}
                onChange={(e) =>
                  setOrdering((o) =>
                    o ? { ...o, temporaryClosureMessage: e.target.value } : o,
                  )
                }
                placeholder="We’ll be back shortly"
              />
            </Field>
          </div>
          <Field label={copy.estimatedPrepLabel}>
            <Input
              type="number"
              min={0}
              value={ordering.estimatedPrepMinutes}
              onChange={(e) =>
                setOrdering((o) =>
                  o
                    ? { ...o, estimatedPrepMinutes: Number(e.target.value) || 0 }
                    : o,
                )
              }
            />
          </Field>
          <Field label="Order cutoff before close (minutes)">
            <Input
              type="number"
              min={0}
              value={ordering.orderCutoffMinutesBeforeClose}
              onChange={(e) =>
                setOrdering((o) =>
                  o
                    ? {
                        ...o,
                        orderCutoffMinutesBeforeClose: Number(e.target.value) || 0,
                      }
                    : o,
                )
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordering.pickupEnabled}
              onChange={(e) =>
                setOrdering((o) => (o ? { ...o, pickupEnabled: e.target.checked } : o))
              }
            />
            {copy.pickupLabel} enabled
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ordering.deliveryEnabled}
              onChange={(e) =>
                setOrdering((o) => (o ? { ...o, deliveryEnabled: e.target.checked } : o))
              }
            />
            {copy.shipOrDeliveryEnabled}
          </label>
          <Field label={`${copy.shipOrDeliveryFee} (USD)`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={(ordering.deliveryFeeCents / 100).toFixed(2)}
              onChange={(e) =>
                setOrdering((o) =>
                  o
                    ? {
                        ...o,
                        deliveryFeeCents: Math.round(
                          (Number.parseFloat(e.target.value) || 0) * 100,
                        ),
                      }
                    : o,
                )
              }
            />
          </Field>
          <Field label="Tax rate (%)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={ordering.taxRatePercent}
              onChange={(e) =>
                setOrdering((o) =>
                  o
                    ? { ...o, taxRatePercent: Number.parseFloat(e.target.value) || 0 }
                    : o,
                )
              }
            />
          </Field>
          <Field label={`${copy.shipOrDeliveryMinimum} (USD)`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={(ordering.minimumDeliveryCents / 100).toFixed(2)}
              onChange={(e) =>
                setOrdering((o) =>
                  o
                    ? {
                        ...o,
                        minimumDeliveryCents: Math.round(
                          (Number.parseFloat(e.target.value) || 0) * 100,
                        ),
                      }
                    : o,
                )
              }
            />
          </Field>
          {copy.isRetail ? (
            <p className="text-xs text-stone-500">
              For retail, “shipping” uses the same address + fee fields as restaurant delivery —
              presented to shoppers as carrier shipping rather than same-day courier delivery.
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Per-menu schedules</h2>
        <p className="mt-1 text-sm text-stone-500">
          Disable a schedule to keep the menu always available when the restaurant is open.
        </p>
        <div className="mt-4 space-y-4">
          {menus.map((menu) => (
            <MenuScheduleEditor
              key={menu.id}
              menu={menu}
              draft={menuDrafts[menu.id]}
              onChange={(patch) => updateMenuDraft(menu.id, patch)}
            />
          ))}
          {menus.length === 0 ? (
            <p className="text-sm text-stone-500">Create a menu first to add schedules.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function defaultSchedule(): ScheduleRule {
  return {
    id: createId('sched'),
    daysOfWeek: [1, 2, 3, 4, 5],
    startTime: '11:00',
    endTime: '14:00',
    enabled: false,
  }
}

function MenuScheduleEditor({
  menu,
  draft,
  onChange,
}: {
  menu: Menu
  draft?: { schedule: ScheduleRule; showWhenUnavailable: boolean }
  onChange: (patch: Partial<{ schedule: ScheduleRule; showWhenUnavailable: boolean }>) => void
}) {
  if (!draft) return null
  const schedule = draft.schedule

  function toggleDay(day: DayOfWeek) {
    const has = schedule.daysOfWeek.includes(day)
    onChange({
      schedule: {
        ...schedule,
        daysOfWeek: has
          ? schedule.daysOfWeek.filter((d) => d !== day)
          : [...schedule.daysOfWeek, day].sort((a, b) => a - b),
      },
    })
  }

  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-lg">{menu.name}</h3>
          <p className="text-xs text-stone-500">
            {formatScheduleSummary(schedule.enabled ? schedule : undefined)}
          </p>
        </div>
        <Badge tone={menu.active ? 'success' : 'warning'}>
          {menu.active ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={schedule.enabled}
            onChange={(e) =>
              onChange({ schedule: { ...schedule, enabled: e.target.checked } })
            }
          />
          Schedule enabled
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.showWhenUnavailable}
            onChange={(e) => onChange({ showWhenUnavailable: e.target.checked })}
          />
          Show when unavailable
        </label>
        <Field label="Start time">
          <Input
            type="time"
            disabled={!schedule.enabled}
            value={schedule.startTime}
            onChange={(e) =>
              onChange({ schedule: { ...schedule, startTime: e.target.value } })
            }
          />
        </Field>
        <Field label="End time">
          <Input
            type="time"
            disabled={!schedule.enabled}
            value={schedule.endTime}
            onChange={(e) =>
              onChange({ schedule: { ...schedule, endTime: e.target.value } })
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-sm font-medium text-stone-700">Days</p>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, index) => {
              const day = index as DayOfWeek
              const checked = schedule.daysOfWeek.includes(day)
              return (
                <label
                  key={label}
                  className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                    checked
                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                      : 'border-stone-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-1.5"
                    disabled={!schedule.enabled}
                    checked={checked}
                    onChange={() => toggleDay(day)}
                  />
                  {label.slice(0, 3)}
                </label>
              )
            })}
          </div>
        </div>
        <Field label="Priority (overlap)">
          <Select
            value={String(menu.priority)}
            disabled
            onChange={() => undefined}
          >
            <option value={String(menu.priority)}>{menu.priority}</option>
          </Select>
        </Field>
      </div>
    </div>
  )
}
