import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Users } from 'lucide-react'
import { DEFAULT_BRANDING, normalizeReservationSettings } from '@/types'
import { useDb } from '@/hooks/useDb'
import * as reservationService from '@/services/reservationService'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontNav } from '@/components/storefront/StorefrontNav'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

function todayInputValue(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ReservePage() {
  const { slug } = useParams<{ slug: string }>()
  const { db, loading } = useDb()
  const restaurant = useMemo(
    () => db?.restaurants.find((r) => r.slug === slug) ?? null,
    [db, slug],
  )

  const settings = normalizeReservationSettings(restaurant?.reservations)
  const [partySize, setPartySize] = useState(2)
  const [day, setDay] = useState(todayInputValue(1))
  const [slots, setSlots] = useState<Array<{ startAt: string; endAt: string; tables: number }>>(
    [],
  )
  const [selectedStart, setSelectedStart] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<{
    code: string
    startAt: string
    partySize: number
  } | null>(null)

  useEffect(() => {
    if (!restaurant || !settings.enabled) {
      setSlots([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const next = await reservationService.listOpenSlots(restaurant.id, day, partySize)
        if (!cancelled) {
          setSlots(next)
          setSelectedStart((prev) =>
            next.some((s) => s.startAt === prev) ? prev : next[0]?.startAt || '',
          )
        }
      } catch {
        if (!cancelled) setSlots([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [restaurant, day, partySize, settings.enabled])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone-500">Loading…</div>
    )
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-display text-3xl">Restaurant not found</h1>
        <Link to="/">
          <Button>Back to home</Button>
        </Link>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!restaurant || !selectedStart) return
    setBusy(true)
    setError('')
    try {
      const reservation = await reservationService.createReservation(restaurant.id, {
        guestName,
        guestEmail,
        guestPhone,
        partySize,
        startAt: selectedStart,
        notes,
        source: 'online',
      })
      setConfirmation({
        code: reservation.confirmationCode,
        startAt: reservation.startAt,
        partySize: reservation.partySize,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book that table.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <StorefrontShell branding={restaurant.branding ?? DEFAULT_BRANDING}>
      <div className="flex min-h-screen flex-col bg-[var(--sf-bg)]">
        <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
            <StorefrontNav restaurant={restaurant} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-[var(--sf-text)]/50">
            Reservations
          </p>
          <h1 className="mt-2 font-display text-4xl text-[var(--sf-text)] sm:text-5xl">
            Book a table
          </h1>
          <p className="mt-3 text-base text-[var(--sf-text)]/65">
            Prefer takeout instead?{' '}
            <Link className="underline underline-offset-2" to={`/r/${restaurant.slug}/shop`}>
              Order online
            </Link>
            .
          </p>

          {!settings.enabled ? (
            <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-6 text-stone-600">
              Online reservations are not available right now. Call{' '}
              {restaurant.phone || 'the restaurant'} to book, or{' '}
              <Link className="underline" to={`/r/${restaurant.slug}/shop`}>
                place a takeout order
              </Link>
              .
            </div>
          ) : confirmation ? (
            <div className="mt-10 rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-950">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              <h2 className="mt-3 font-display text-2xl">You’re booked</h2>
              <p className="mt-2 text-sm leading-relaxed">
                Confirmation <span className="font-semibold">{confirmation.code}</span> for{' '}
                {confirmation.partySize} guests on{' '}
                {new Date(confirmation.startAt).toLocaleString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                .
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link to={`/r/${restaurant.slug}`}>
                  <Button>Back to home</Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmation(null)
                    setGuestName('')
                    setNotes('')
                  }}
                >
                  Book another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-10 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Guests" htmlFor="party">
                  <div className="relative">
                    <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      id="party"
                      className="pl-9"
                      type="number"
                      min={1}
                      max={settings.maxPartySize}
                      value={partySize}
                      onChange={(e) => setPartySize(Number(e.target.value) || 1)}
                      required
                    />
                  </div>
                </Field>
                <Field label="Date" htmlFor="day">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                    <Input
                      id="day"
                      className="pl-9"
                      type="date"
                      min={todayInputValue(0)}
                      max={todayInputValue(settings.maxDaysAhead)}
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      required
                    />
                  </div>
                </Field>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-stone-700">Available times</p>
                {slots.length === 0 ? (
                  <p className="text-sm text-stone-500">
                    No open tables for that party size on this day. Try another date or fewer guests.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot.startAt}
                        type="button"
                        onClick={() => setSelectedStart(slot.startAt)}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-sm font-medium transition',
                          selectedStart === slot.startAt
                            ? 'border-[var(--sf-button)] bg-[var(--sf-button)] text-[var(--sf-button-text)]'
                            : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50',
                        )}
                      >
                        {formatSlot(slot.startAt)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="name">
                  <Input
                    id="name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                  />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                  />
                </Field>
                <Field label="Notes" htmlFor="notes">
                  <Textarea
                    id="notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Occasion, accessibility, seating preference…"
                  />
                </Field>
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button size="lg" disabled={busy || !selectedStart} type="submit">
                {busy ? 'Booking…' : 'Confirm reservation'}
              </Button>
            </form>
          )}
        </div>

        <StorefrontFooter restaurant={restaurant} />
      </div>
    </StorefrontShell>
  )
}
