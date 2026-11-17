import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CreditCard } from 'lucide-react'
import type { OrderType } from '@/types'
import { normalizeLoyaltySettings } from '@/types'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { PlacingOrderConfirm } from '@/components/storefront/PlacingOrderConfirm'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { useDb } from '@/hooks/useDb'
import { useBagStore } from '@/stores/bagStore'
import {
  computeCouponDiscount,
  computeLoyaltyDiscount,
  isCouponActive,
  nextRewardProgress,
  normalizeCouponCode,
  pointsEarnedForSubtotal,
} from '@/lib/commerce'
import { calculateOrderPricing } from '@/lib/pricing'
import { storeCopy } from '@/lib/storeCopy'
import { formatMoney, cn } from '@/lib/utils'
import { placeOrder } from '@/services/orderService'
import { trackEvent } from '@/services/analyticsService'

export function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { db, loading } = useDb()
  const linesFor = useBagStore((s) => s.linesFor)
  const subtotalFor = useBagStore((s) => s.subtotalFor)
  const clearRestaurant = useBagStore((s) => s.clearRestaurant)

  const restaurant = useMemo(
    () => db?.restaurants.find((r) => r.slug === slug) ?? null,
    [db, slug],
  )

  const lines = restaurant ? linesFor(restaurant.id) : []
  const subtotal = restaurant ? subtotalFor(restaurant.id) : 0

  const [orderType, setOrderType] = useState<OrderType>('pickup')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [instructions, setInstructions] = useState('')
  const [requestedTime, setRequestedTime] = useState('')
  const [tipPreset, setTipPreset] = useState<number | 'custom' | 0>(0)
  const [customTip, setCustomTip] = useState('')
  const [cardNumber, setCardNumber] = useState('4242424242424242')
  const [expiry, setExpiry] = useState('12/30')
  const [cvc, setCvc] = useState('123')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [couponApplied, setCouponApplied] = useState('')
  const [loyaltyRewardId, setLoyaltyRewardId] = useState('')
  /** Cleared on Go back so a late countdown tick cannot still place the order. */
  const confirmAllowedRef = useRef(false)

  const checkoutTracked = useRef(false)
  useEffect(() => {
    if (!restaurant) return
    if (!checkoutTracked.current) {
      checkoutTracked.current = true
      void trackEvent({
        restaurantId: restaurant.id,
        type: 'checkout_start',
      })
    }
    // Retail defaults to shipping (delivery); restaurants default to pickup.
    if (restaurant.storeKind === 'retail' && restaurant.ordering.deliveryEnabled) {
      setOrderType('delivery')
    } else if (restaurant.ordering.pickupEnabled) {
      setOrderType('pickup')
    } else if (restaurant.ordering.deliveryEnabled) {
      setOrderType('delivery')
    }
  }, [restaurant])

  const loyalty = useMemo(
    () => normalizeLoyaltySettings(restaurant?.loyalty),
    [restaurant],
  )

  const loyaltyAccount = useMemo(() => {
    if (!db || !restaurant || !email.trim()) return null
    const normalized = email.trim().toLowerCase()
    return (
      db.loyaltyAccounts.find(
        (a) => a.restaurantId === restaurant.id && a.email === normalized,
      ) ?? null
    )
  }, [db, restaurant, email])

  const discountPreview = useMemo(() => {
    if (!db || !restaurant) {
      return { discountCents: 0, label: undefined as string | undefined, couponError: '' }
    }
    let discountCents = 0
    let label: string | undefined
    let couponError = ''

    if (couponApplied) {
      const coupon = db.coupons.find(
        (c) =>
          c.restaurantId === restaurant.id &&
          c.code === normalizeCouponCode(couponApplied),
      )
      if (!coupon || !isCouponActive(coupon)) {
        couponError = 'Coupon is invalid or expired.'
      } else {
        const result = computeCouponDiscount(
          coupon,
          lines.map((l) => ({
            itemId: l.itemId,
            lineTotalCents: l.unitPriceCents * l.quantity,
          })),
        )
        if ('error' in result) couponError = result.error
        else {
          discountCents += result.discountCents
          label = result.label
        }
      }
    }

    if (loyaltyRewardId && loyalty.enabled) {
      const reward = loyalty.rewards.find((r) => r.id === loyaltyRewardId)
      if (reward) {
        const freeLine =
          reward.type === 'free_item' && reward.itemId
            ? lines.find((l) => l.itemId === reward.itemId)
            : undefined
        const result = computeLoyaltyDiscount(
          reward,
          Math.max(0, subtotal - discountCents),
          freeLine ? freeLine.unitPriceCents * freeLine.quantity : undefined,
        )
        if (!('error' in result)) {
          discountCents += result.discountCents
          label = label ? `${label} + ${result.label}` : result.label
        }
      }
    }

    return { discountCents, label, couponError }
  }, [db, restaurant, couponApplied, loyaltyRewardId, loyalty, lines, subtotal])

  const tipCents = useMemo(() => {
    const tipBase = Math.max(0, subtotal - discountPreview.discountCents)
    if (tipPreset === 'custom') {
      const dollars = Number.parseFloat(customTip)
      if (Number.isNaN(dollars) || dollars < 0) return 0
      return Math.round(dollars * 100)
    }
    if (tipPreset === 0) return 0
    return Math.round(tipBase * (tipPreset / 100))
  }, [tipPreset, customTip, subtotal, discountPreview.discountCents])

  const pricing = useMemo(() => {
    if (!restaurant) return null
    const taxable = Math.max(0, subtotal - discountPreview.discountCents)
    const earned =
      loyalty.enabled && email.trim()
        ? pointsEarnedForSubtotal(loyalty, taxable)
        : 0
    return calculateOrderPricing(
      subtotal,
      restaurant.ordering,
      orderType,
      tipCents,
      {
        discountCents: discountPreview.discountCents,
        discountLabel: discountPreview.label,
        couponCode: couponApplied || undefined,
        loyaltyPointsEarned: earned || undefined,
        loyaltyRewardId: loyaltyRewardId || undefined,
      },
    )
  }, [
    restaurant,
    subtotal,
    orderType,
    tipCents,
    discountPreview,
    loyalty,
    email,
    couponApplied,
    loyaltyRewardId,
  ])

  const progress = useMemo(() => {
    if (!loyalty.enabled) return null
    const balance = loyaltyAccount?.pointsBalance ?? 0
    return nextRewardProgress(loyalty, balance)
  }, [loyalty, loyaltyAccount])

  function validateCheckout(): string | null {
    if (!restaurant) return 'Restaurant not found.'
    if (!lines.length) return storeCopy(restaurant.storeKind).emptyBag + '.'
    if (!name.trim() || !phone.trim()) return 'Name and phone are required.'
    if (orderType === 'delivery') {
      if (!line1.trim() || !city.trim() || !state.trim() || !postalCode.trim()) {
        return storeCopy(restaurant.storeKind).completeAddressError
      }
      if (subtotal < restaurant.ordering.minimumDeliveryCents) {
        return storeCopy(restaurant.storeKind).shipOrDeliveryMinimumError(
          formatMoney(restaurant.ordering.minimumDeliveryCents),
        )
      }
    }
    const digits = cardNumber.replace(/\D/g, '')
    if (digits.length < 4) return 'Enter a simulated card number.'
    return null
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validateCheckout()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    confirmAllowedRef.current = true
    setConfirmOpen(true)
  }

  async function placeConfirmedOrder() {
    if (!restaurant || submitting || !confirmAllowedRef.current) return
    const validationError = validateCheckout()
    if (validationError) {
      confirmAllowedRef.current = false
      setConfirmOpen(false)
      setError(validationError)
      return
    }

    const digits = cardNumber.replace(/\D/g, '')
    setSubmitting(true)
    try {
      const order = await placeOrder({
        restaurantId: restaurant.id,
        customer: {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
        },
        fulfillment: {
          type: orderType,
          instructions: instructions.trim() || undefined,
          requestedTime: requestedTime
            ? new Date(requestedTime).toISOString()
            : undefined,
          address:
            orderType === 'delivery'
              ? {
                  line1: line1.trim(),
                  line2: line2.trim() || undefined,
                  city: city.trim(),
                  state: state.trim(),
                  postalCode: postalCode.trim(),
                }
              : undefined,
        },
        tipCents,
        simulatedCardLast4: digits.slice(-4),
        couponCode: couponApplied || undefined,
        loyaltyRewardId: loyaltyRewardId || undefined,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          modifiers: l.modifiers,
          comboSelections: l.comboSelections,
          specialInstructions: l.specialInstructions,
        })),
        clientTotalCents: pricing?.totalCents,
      })
      clearRestaurant(restaurant.id)
      navigate(`/order/${order.reference}`, {
        state: { justPlaced: true, restaurantSlug: restaurant.slug },
      })
    } catch (err) {
      confirmAllowedRef.current = false
      setConfirmOpen(false)
      setError(err instanceof Error ? err.message : 'Unable to place order.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse-soft text-stone-500">Loading checkout…</p>
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl">Store not found</h1>
        <Link to="/" className="mt-4">
          <Button>Home</Button>
        </Link>
      </div>
    )
  }

  const copy = storeCopy(restaurant.storeKind)
  const presets = restaurant.ordering.tipPresetsPercent
  const pickupOk = restaurant.ordering.pickupEnabled
  const deliveryOk = restaurant.ordering.deliveryEnabled
  const cardLast4 = cardNumber.replace(/\D/g, '').slice(-4) || '••••'
  const estimatedAt = new Date(
    Date.now() + restaurant.ordering.estimatedPrepMinutes * 60_000,
  ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const addressLabel =
    orderType === 'delivery'
      ? [line1.trim(), line2.trim(), `${city.trim()}, ${state.trim()} ${postalCode.trim()}`]
          .filter(Boolean)
          .join(', ')
      : [
          restaurant.address.line1,
          `${restaurant.address.city}, ${restaurant.address.state} ${restaurant.address.postalCode}`,
        ]
          .filter(Boolean)
          .join(', ') || `Pickup at ${copy.storeNoun}`

  return (
    <StorefrontShell branding={restaurant.branding}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link
          to={`/r/${restaurant.slug}`}
          className="inline-flex items-center gap-1 text-sm text-[var(--sf-text)]/70 hover:text-[var(--sf-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to menu
        </Link>
        <h1 className="mt-4 text-3xl sm:text-4xl">Checkout</h1>
        <p className="mt-1 text-sm text-[var(--sf-text)]/60">{restaurant.name}</p>

        {!lines.length ? (
          <div className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-[var(--sf-surface)] p-10 text-center">
            <p className="font-medium">{copy.emptyBag}</p>
            <Link to={`/r/${restaurant.slug}`} className="mt-4 inline-block">
              <Button>{copy.browseCta}</Button>
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
          >
            <div className="space-y-8">
              {(pickupOk || deliveryOk) && (
                <section>
                  <h2 className="mb-3 text-lg font-medium">Fulfillment</h2>
                  <div className="flex gap-2">
                    {pickupOk ? (
                      <button
                        type="button"
                        onClick={() => setOrderType('pickup')}
                        className={cn(
                          'flex-1 rounded-[var(--sf-radius,12px)] border px-4 py-3 text-sm font-medium',
                          orderType === 'pickup'
                            ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                            : 'border-stone-200',
                        )}
                      >
                        {copy.pickupLabel}
                      </button>
                    ) : null}
                    {deliveryOk ? (
                      <button
                        type="button"
                        onClick={() => setOrderType('delivery')}
                        className={cn(
                          'flex-1 rounded-[var(--sf-radius,12px)] border px-4 py-3 text-sm font-medium',
                          orderType === 'delivery'
                            ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                            : 'border-stone-200',
                        )}
                      >
                        {copy.shipOrDeliveryLabel}
                      </button>
                    ) : null}
                  </div>
                  {orderType === 'delivery' ? (
                    <p className="mt-2 text-xs text-[var(--sf-text)]/55">
                      Minimum {formatMoney(restaurant.ordering.minimumDeliveryCents)} ·{' '}
                      {copy.shipOrDeliveryFee}{' '}
                      {formatMoney(restaurant.ordering.deliveryFeeCents)}
                      {copy.isRetail
                        ? ' · Simulated carrier shipping (not same-day courier)'
                        : ''}
                    </p>
                  ) : null}
                </section>
              )}

              <section className="space-y-3">
                <h2 className="text-lg font-medium">Your details</h2>
                <Field label="Name" htmlFor="name">
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    autoComplete="tel"
                  />
                </Field>
                <Field
                  label={loyalty.enabled ? 'Email (for loyalty points)' : 'Email (optional)'}
                  htmlFor="email"
                  hint={
                    loyalty.enabled
                      ? 'Use the same email next time to keep earning and redeeming points.'
                      : undefined
                  }
                >
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                {loyalty.enabled && email.trim() ? (
                  <div className="rounded-xl border border-stone-200 bg-[var(--sf-surface)] px-3 py-2 text-sm">
                    {loyaltyAccount ? (
                      <p>
                        You have{' '}
                        <span className="font-semibold">{loyaltyAccount.pointsBalance} points</span>
                        {progress?.next ? (
                          <>
                            {' '}
                            · {progress.pointsNeeded > 0
                              ? `${progress.pointsNeeded} more to unlock “${progress.next.label}”`
                              : `ready to redeem “${progress.next.label}”`}
                          </>
                        ) : null}
                      </p>
                    ) : (
                      <p className="text-[var(--sf-text)]/70">
                        New loyalty account — you’ll earn points on this order.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-medium">Coupon</h2>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    placeholder="Enter code"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCouponApplied(normalizeCouponCode(couponCode))
                      setError('')
                    }}
                  >
                    Apply
                  </Button>
                </div>
                {couponApplied ? (
                  <p className="text-xs text-[var(--sf-text)]/60">
                    Applied: <span className="font-mono font-medium">{couponApplied}</span>{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setCouponApplied('')
                        setCouponCode('')
                      }}
                    >
                      Remove
                    </button>
                  </p>
                ) : null}
                {discountPreview.couponError ? (
                  <p className="text-xs text-red-600">{discountPreview.couponError}</p>
                ) : null}
              </section>

              {loyalty.enabled && loyalty.rewards.length > 0 ? (
                <section className="space-y-3">
                  <h2 className="text-lg font-medium">Redeem loyalty</h2>
                  <Field label="Reward" htmlFor="loyalty-reward">
                    <Select
                      id="loyalty-reward"
                      value={loyaltyRewardId}
                      onChange={(e) => setLoyaltyRewardId(e.target.value)}
                    >
                      <option value="">No reward</option>
                      {loyalty.rewards.map((reward) => {
                        const affordable =
                          (loyaltyAccount?.pointsBalance ?? 0) >= reward.pointsCost
                        return (
                          <option
                            key={reward.id}
                            value={reward.id}
                            disabled={!affordable || !email.trim()}
                          >
                            {reward.label} · {reward.pointsCost} pts
                            {!affordable ? ' (need more points)' : ''}
                          </option>
                        )
                      })}
                    </Select>
                  </Field>
                </section>
              ) : null}

              {orderType === 'delivery' ? (
                <section className="space-y-3">
                  <h2 className="text-lg font-medium">{copy.shipOrDeliveryAddress}</h2>
                  <Field label="Street address" htmlFor="line1">
                    <Input
                      id="line1"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      required
                      autoComplete="address-line1"
                    />
                  </Field>
                  <Field label="Apt / suite (optional)" htmlFor="line2">
                    <Input
                      id="line2"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      autoComplete="address-line2"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="City" htmlFor="city">
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                        autoComplete="address-level2"
                      />
                    </Field>
                    <Field label="State" htmlFor="state">
                      <Input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        required
                        autoComplete="address-level1"
                      />
                    </Field>
                    <Field label="ZIP" htmlFor="postal">
                      <Input
                        id="postal"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        required
                        autoComplete="postal-code"
                      />
                    </Field>
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <h2 className="text-lg font-medium">Preferences</h2>
                <Field label="Order instructions (optional)" htmlFor="instructions">
                  <Textarea
                    id="instructions"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder={
                      orderType === 'delivery'
                        ? copy.isRetail
                          ? 'Apartment, building access, gift note…'
                          : 'Gate code, leave at door…'
                        : 'Name for pickup…'
                    }
                  />
                </Field>
                <Field label="Requested time (optional)" htmlFor="requested">
                  <Input
                    id="requested"
                    type="datetime-local"
                    value={requestedTime}
                    onChange={(e) => setRequestedTime(e.target.value)}
                  />
                </Field>
              </section>

              <section className="space-y-3">
                <h2 className="text-lg font-medium">Tip</h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTipPreset(0)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm',
                      tipPreset === 0
                        ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                        : 'border-stone-200',
                    )}
                  >
                    No tip
                  </button>
                  {presets.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTipPreset(p)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm',
                        tipPreset === p
                          ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                          : 'border-stone-200',
                      )}
                    >
                      {p}%
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTipPreset('custom')}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm',
                      tipPreset === 'custom'
                        ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                        : 'border-stone-200',
                    )}
                  >
                    Custom
                  </button>
                </div>
                {tipPreset === 'custom' ? (
                  <Field label="Custom tip ($)" htmlFor="custom-tip">
                    <Input
                      id="custom-tip"
                      type="number"
                      min="0"
                      step="0.01"
                      value={customTip}
                      onChange={(e) => setCustomTip(e.target.value)}
                    />
                  </Field>
                ) : null}
              </section>

              <section className="space-y-3 rounded-[var(--sf-radius,12px)] border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-amber-800" />
                  <h2 className="text-lg font-medium text-amber-950">
                    Simulated payment — no real charge
                  </h2>
                </div>
                <p className="text-xs text-amber-900/70">
                  This is a demo checkout. Enter any card details; nothing will be charged.
                </p>
                <Field label="Card number" htmlFor="card">
                  <Input
                    id="card"
                    inputMode="numeric"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4242 4242 4242 4242"
                    autoComplete="off"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expiry" htmlFor="expiry">
                    <Input
                      id="expiry"
                      value={expiry}
                      onChange={(e) => setExpiry(e.target.value)}
                      placeholder="MM/YY"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="CVC" htmlFor="cvc">
                    <Input
                      id="cvc"
                      value={cvc}
                      onChange={(e) => setCvc(e.target.value)}
                      placeholder="123"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </section>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <Button
                type="submit"
                size="lg"
                className="w-full border-0 hover:opacity-90 sm:w-auto"
                style={{
                  backgroundColor: restaurant.branding.buttonColor,
                  color: restaurant.branding.buttonTextColor,
                }}
                disabled={submitting || confirmOpen}
              >
                {`Place order · ${formatMoney(pricing?.totalCents ?? 0)}`}
              </Button>
            </div>

            <aside className="h-fit rounded-[var(--sf-radius,12px)] border border-stone-200 bg-[var(--sf-surface)] p-5 lg:sticky lg:top-6">
              <h2 className="text-lg font-medium">Order summary</h2>
              <ul className="mt-4 space-y-3">
                {lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {line.quantity}× {line.name}
                      </p>
                      {line.modifierLabels.length ? (
                        <p className="text-xs text-[var(--sf-text)]/55">
                          {line.modifierLabels.join(', ')}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0">
                      {formatMoney(line.unitPriceCents * line.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              {pricing ? (
                <dl className="mt-5 space-y-2 border-t border-stone-200 pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-[var(--sf-text)]/60">Subtotal</dt>
                    <dd>{formatMoney(pricing.subtotalCents)}</dd>
                  </div>
                  {pricing.discountCents > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <dt>{pricing.discountLabel || 'Discount'}</dt>
                      <dd>−{formatMoney(pricing.discountCents)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-[var(--sf-text)]/60">
                      Tax ({pricing.taxRatePercent}%)
                    </dt>
                    <dd>{formatMoney(pricing.taxCents)}</dd>
                  </div>
                  {pricing.deliveryFeeCents > 0 ? (
                    <div className="flex justify-between">
                      <dt className="text-[var(--sf-text)]/60">{copy.shipOrDeliveryFee}</dt>
                      <dd>{formatMoney(pricing.deliveryFeeCents)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-[var(--sf-text)]/60">Tip</dt>
                    <dd>{formatMoney(pricing.tipCents)}</dd>
                  </div>
                  {pricing.loyaltyPointsEarned ? (
                    <div className="flex justify-between text-[var(--sf-primary)]">
                      <dt>Points you’ll earn</dt>
                      <dd>+{pricing.loyaltyPointsEarned}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between text-base font-semibold">
                    <dt>Total</dt>
                    <dd>{formatMoney(pricing.totalCents)}</dd>
                  </div>
                </dl>
              ) : null}
              <p className="mt-4 text-xs text-[var(--sf-text)]/50">
                Final total is calculated on the server when you place the order.
              </p>
            </aside>
          </form>
        )}
      </div>

      <PlacingOrderConfirm
        open={confirmOpen}
        onConfirm={() => void placeConfirmedOrder()}
        onBack={() => {
          if (submitting) return
          confirmAllowedRef.current = false
          setConfirmOpen(false)
        }}
        orderType={orderType}
        storeKind={restaurant.storeKind}
        estimatedLabel={estimatedAt}
        addressLabel={addressLabel}
        cardLast4={cardLast4}
        lines={lines.map((l) => ({
          id: l.id,
          quantity: l.quantity,
          name: l.name,
          modifierLabels: l.modifierLabels,
          lineTotalCents: l.unitPriceCents * l.quantity,
        }))}
        totalCents={pricing?.totalCents ?? 0}
        submitting={submitting}
        branding={restaurant.branding}
      />
    </StorefrontShell>
  )
}
