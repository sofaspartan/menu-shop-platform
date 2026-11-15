import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Clock3, CreditCard, MapPin } from 'lucide-react'
import type { OrderType, RestaurantBranding } from '@/types'
import { formatMoney, cn } from '@/lib/utils'
import { brandingStyleVars } from '@/lib/brandingCss'

const COUNTDOWN_MS = 8000

export interface PlacingOrderLinePreview {
  id: string
  quantity: number
  name: string
  modifierLabels: string[]
  lineTotalCents: number
}

export function PlacingOrderConfirm({
  open,
  onConfirm,
  onBack,
  orderType,
  estimatedLabel,
  addressLabel,
  cardLast4,
  lines,
  totalCents,
  submitting,
  branding,
}: {
  open: boolean
  onConfirm: () => void
  onBack: () => void
  orderType: OrderType
  estimatedLabel: string
  addressLabel: string
  cardLast4: string
  lines: PlacingOrderLinePreview[]
  totalCents: number
  submitting: boolean
  branding: RestaurantBranding
}) {
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const firedRef = useRef(false)
  const cancelledRef = useRef(false)
  const onConfirmRef = useRef(onConfirm)
  onConfirmRef.current = onConfirm

  useEffect(() => {
    if (!open) return
    setRemainingMs(COUNTDOWN_MS)
    setSummaryOpen(false)
    firedRef.current = false
    cancelledRef.current = false
    const start = Date.now()
    const id = window.setInterval(() => {
      if (firedRef.current || cancelledRef.current) return
      const left = Math.max(0, COUNTDOWN_MS - (Date.now() - start))
      setRemainingMs(left)
      if (left === 0) {
        if (firedRef.current || cancelledRef.current) return
        firedRef.current = true
        onConfirmRef.current()
      }
    }, 40)
    return () => window.clearInterval(id)
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  const secondsLeft = Math.ceil(remainingMs / 1000)
  const progress = 1 - remainingMs / COUNTDOWN_MS
  const title =
    orderType === 'delivery' ? 'Placing delivery order…' : 'Placing pickup order…'

  function confirmNow() {
    if (firedRef.current || cancelledRef.current || submitting) return
    firedRef.current = true
    onConfirmRef.current()
  }

  function goBack() {
    if (submitting) return
    // Cancel before closing so a mid-tick countdown cannot still submit.
    cancelledRef.current = true
    firedRef.current = true
    onBack()
  }

  return createPortal(
    <div
      className="storefront-vars fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4"
      style={brandingStyleVars(branding)}
    >
      <button
        type="button"
        aria-label="Go back"
        className="absolute inset-0 bg-stone-900/45 animate-fade-in"
        onClick={goBack}
        disabled={submitting}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-slide-up sm:max-h-[85vh] sm:rounded-3xl sm:animate-fade-up"
      >
        <div className="overflow-y-auto px-5 pb-3 pt-6 sm:px-6">
          <h2 className="font-display text-2xl text-stone-900 sm:text-[1.7rem]">{title}</h2>
          <p className="mt-1 text-sm text-stone-500">
            Review your items and order details below.
          </p>

          <ul className="mt-6 divide-y divide-stone-100 border-y border-stone-100">
            <li className="flex items-start gap-3 py-4">
              <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
              <p className="text-[15px] text-stone-800">
                {orderType === 'delivery' ? 'Estimated arrival at' : 'Estimated ready by'}{' '}
                <span className="font-semibold">{estimatedLabel}</span>
              </p>
            </li>
            <li className="flex items-start gap-3 py-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
              <p className="text-[15px] text-stone-800">{addressLabel}</p>
            </li>
            <li className="flex items-start gap-3 py-4">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
              <p className="text-[15px] text-stone-800">
                Card ending <span className="font-semibold">{cardLast4}</span>
              </p>
            </li>
          </ul>

          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="mt-2 flex w-full items-center justify-between py-4 text-left"
          >
            <span className="font-semibold text-stone-900">
              Order Summary ({lines.reduce((n, l) => n + l.quantity, 0)})
            </span>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-stone-500 transition-transform',
                summaryOpen && 'rotate-180',
              )}
            />
          </button>
          {summaryOpen ? (
            <ul className="mb-2 space-y-3 border-t border-stone-100 pb-2 pt-3">
              {lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-900">
                      {line.quantity}× {line.name}
                    </p>
                    {line.modifierLabels.length ? (
                      <p className="text-xs text-stone-500">
                        {line.modifierLabels.join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-stone-800">
                    {formatMoney(line.lineTotalCents)}
                  </span>
                </li>
              ))}
              <li className="flex justify-between border-t border-stone-100 pt-3 font-semibold">
                <span>Total</span>
                <span>{formatMoney(totalCents)}</span>
              </li>
            </ul>
          ) : null}
        </div>

        <div className="mt-auto space-y-3 border-t border-stone-100 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={confirmNow}
            disabled={submitting}
            className="relative flex h-14 w-full items-center justify-center overflow-hidden rounded-full text-base font-semibold text-white disabled:opacity-70"
            style={{ backgroundColor: '#3a3a3a' }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-stone-950 transition-[width] duration-75 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
            <span className="relative z-10">
              {submitting
                ? 'Placing order…'
                : `Looks good (0:${String(secondsLeft).padStart(2, '0')})`}
            </span>
          </button>
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="flex h-14 w-full items-center justify-center rounded-full border border-stone-300 bg-white text-base font-semibold text-stone-900 disabled:opacity-60"
          >
            Go back
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
