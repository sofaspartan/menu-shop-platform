import { useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  CheckCircle2,
  CreditCard,
  Minus,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import type { MenuItem, Restaurant } from '@/types'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import { placeOrder } from '@/services/orderService'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { resolveListedPrice } from '@/lib/commerce'
import { calculateOrderPricing } from '@/lib/pricing'
import { brandingStyleVars } from '@/lib/brandingCss'
import { isItemAvailableNow } from '@/lib/scheduling'
import { storeCopy } from '@/lib/storeCopy'
import { createId, formatMoney, cn } from '@/lib/utils'

type PosPhase = 'staff' | 'customer' | 'processing' | 'complete'

type PosLine = {
  id: string
  itemId: string
  name: string
  imageUrl?: string
  unitPriceCents: number
  quantity: number
}

type CatalogEntry = {
  item: MenuItem
  listPriceCents: number
  priceCents: number
  onSale: boolean
  sectionName: string
}

export function PosPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [phase, setPhase] = useState<PosPhase>('staff')
  const [flipping, setFlipping] = useState(false)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<PosLine[]>([])
  const [guestName, setGuestName] = useState('')
  const [tipPreset, setTipPreset] = useState<number | 'custom' | 0>(0)
  const [customTip, setCustomTip] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string
    totalCents: number
    reference: string
  } | null>(null)

  const copy = storeCopy(current?.storeKind)

  const catalog = useMemo(() => {
    if (!db || !current) return [] as CatalogEntry[]
    const sales = db.sales.filter((s) => s.restaurantId === current.id)
    const sectionById = new Map(
      db.sections
        .filter((s) => s.restaurantId === current.id)
        .map((s) => [s.id, s.name]),
    )
    const assignments = db.assignments.filter(
      (a) => a.restaurantId === current.id && a.visible,
    )
    const entries: CatalogEntry[] = []
    const seen = new Set<string>()

    for (const a of assignments) {
      const item = db.items.find((i) => i.id === a.itemId)
      if (!item || seen.has(item.id)) continue
      if (!item.active || !isItemAvailableNow(item)) continue
      seen.add(item.id)
      const list = a.priceOverrideCents ?? item.basePriceCents
      const listed = resolveListedPrice(list, item.id, sales)
      entries.push({
        item,
        listPriceCents: listed.listPriceCents,
        priceCents: listed.priceCents,
        onSale: listed.onSale,
        sectionName: sectionById.get(a.sectionId) || 'General',
      })
    }

    // Include unassigned but active items so POS still works from the library.
    for (const item of db.items.filter((i) => i.restaurantId === current.id)) {
      if (seen.has(item.id)) continue
      if (!item.active || !isItemAvailableNow(item)) continue
      const listed = resolveListedPrice(item.basePriceCents, item.id, sales)
      entries.push({
        item,
        listPriceCents: listed.listPriceCents,
        priceCents: listed.priceCents,
        onSale: listed.onSale,
        sectionName: 'Library',
      })
    }

    return entries.sort((a, b) => a.item.name.localeCompare(b.item.name))
  }, [db, current])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return catalog
    return catalog.filter(
      (e) =>
        e.item.name.toLowerCase().includes(q) ||
        e.sectionName.toLowerCase().includes(q) ||
        e.item.shortDescription.toLowerCase().includes(q),
    )
  }, [catalog, query])

  const sections = useMemo(() => {
    const map = new Map<string, CatalogEntry[]>()
    for (const entry of filtered) {
      const list = map.get(entry.sectionName) || []
      list.push(entry)
      map.set(entry.sectionName, list)
    }
    return [...map.entries()]
  }, [filtered])

  const subtotal = lines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0)

  const tipCents = useMemo(() => {
    if (tipPreset === 'custom') {
      const dollars = Number.parseFloat(customTip)
      if (Number.isNaN(dollars) || dollars < 0) return 0
      return Math.round(dollars * 100)
    }
    if (tipPreset === 0) return 0
    return Math.round(subtotal * (tipPreset / 100))
  }, [tipPreset, customTip, subtotal])

  const pricing = useMemo(() => {
    if (!current) return null
    return calculateOrderPricing(subtotal, current.ordering, 'pickup', tipCents)
  }, [current, subtotal, tipCents])

  if (!current || !user) {
    return (
      <p className="text-sm text-stone-500">
        Select a {copy.storeNoun} to open the POS simulator.
      </p>
    )
  }

  function addItem(entry: CatalogEntry) {
    setError('')
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === entry.item.id)
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          id: createId('pos'),
          itemId: entry.item.id,
          name: entry.item.name,
          imageUrl: entry.item.imageUrl,
          unitPriceCents: entry.priceCents,
          quantity: 1,
        },
      ]
    })
  }

  function setQty(lineId: string, quantity: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.id === lineId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  function clearTicket() {
    setLines([])
    setGuestName('')
    setTipPreset(0)
    setCustomTip('')
    setError('')
    setCompletedOrder(null)
    setPhase('staff')
  }

  function flipToCustomer() {
    if (!lines.length) {
      setError(`Add ${copy.itemNounPlural.toLowerCase()} before taking payment.`)
      return
    }
    setError('')
    setFlipping(true)
    window.setTimeout(() => {
      setPhase('customer')
      setFlipping(false)
    }, 420)
  }

  function flipToStaff() {
    setFlipping(true)
    window.setTimeout(() => {
      setPhase('staff')
      setFlipping(false)
    }, 420)
  }

  async function chargeCard() {
    if (!current || busy || !pricing) return
    setBusy(true)
    setError('')
    setPhase('processing')
    try {
      // Brief pause so the “processing” state is visible.
      await new Promise((r) => window.setTimeout(r, 900))
      const order = await placeOrder({
        restaurantId: current.id,
        customer: {
          name: guestName.trim() || 'Walk-in guest',
          phone: current.phone || '5550000000',
          email: undefined,
        },
        fulfillment: {
          type: 'pickup',
          instructions: 'POS counter sale',
        },
        tipCents,
        simulatedCardLast4: '4242',
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          modifiers: [],
        })),
        clientTotalCents: pricing.totalCents,
      })
      setCompletedOrder({
        orderNumber: order.orderNumber,
        totalCents: order.pricing.totalCents,
        reference: order.reference,
      })
      setPhase('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed.')
      setPhase('customer')
    } finally {
      setBusy(false)
    }
  }

  const tipPresets = current.ordering.tipPresetsPercent

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Point of sale</h1>
          <p className="mt-1 max-w-2xl text-stone-500">
            Simulate a counter tablet like Square or Toast. Ring up {copy.itemNounPlural.toLowerCase()}{' '}
            from your live catalog, flip the screen for the guest to tip and pay, then send the
            order into your Orders queue.
          </p>
        </div>
        <Badge tone="accent">Auto-built from {copy.catalogNoun}</Badge>
      </div>

      <div className="flex justify-center">
        <PosDeviceFrame
          restaurant={current}
          flipping={flipping}
          phase={phase}
        >
          {phase === 'staff' ? (
            <StaffFace
              restaurant={current}
              copy={copy}
              query={query}
              onQuery={setQuery}
              sections={sections}
              lines={lines}
              guestName={guestName}
              onGuestName={setGuestName}
              subtotal={subtotal}
              pricing={pricing}
              error={error}
              onAdd={addItem}
              onSetQty={setQty}
              onClear={clearTicket}
              onFlip={flipToCustomer}
            />
          ) : (
            <CustomerFace
              restaurant={current}
              copy={copy}
              phase={phase}
              lines={lines}
              guestName={guestName}
              tipPreset={tipPreset}
              customTip={customTip}
              tipPresets={tipPresets}
              tipCents={tipCents}
              pricing={pricing}
              error={error}
              busy={busy}
              completedOrder={completedOrder}
              onTipPreset={setTipPreset}
              onCustomTip={setCustomTip}
              onBack={flipToStaff}
              onPay={() => void chargeCard()}
              onNewSale={clearTicket}
            />
          )}
        </PosDeviceFrame>
      </div>
    </div>
  )
}

function PosDeviceFrame({
  restaurant,
  flipping,
  phase,
  children,
}: {
  restaurant: Restaurant
  flipping: boolean
  phase: PosPhase
  children: React.ReactNode
}) {
  const style = brandingStyleVars(restaurant.branding)
  return (
    <div className="w-full max-w-5xl">
      <div className="mx-auto rounded-[2rem] border border-stone-300 bg-stone-900 p-3 shadow-2xl sm:p-4">
        <div className="mb-3 flex items-center justify-between px-2 text-stone-400">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {restaurant.name} POS
          </div>
          <div className="text-[11px] capitalize text-stone-500">
            {phase === 'staff'
              ? 'Staff view'
              : phase === 'customer'
                ? 'Customer view'
                : phase === 'processing'
                  ? 'Processing…'
                  : 'Complete'}
          </div>
        </div>
        <div
          className={cn(
            'overflow-hidden rounded-[1.35rem] bg-white transition-all duration-300',
            flipping && 'scale-[0.97] opacity-70',
          )}
          style={{
            ...style,
            transform: flipping ? 'perspective(1200px) rotateY(82deg)' : undefined,
          }}
        >
          <div className="min-h-[640px] sm:min-h-[700px]">{children}</div>
        </div>
        <div className="mx-auto mt-3 h-1.5 w-28 rounded-full bg-stone-700" />
      </div>
      <p className="mt-4 text-center text-xs text-stone-500">
        Tip: add items on the staff side, then flip for tip + simulated card payment.
      </p>
    </div>
  )
}

function StaffFace({
  restaurant,
  copy,
  query,
  onQuery,
  sections,
  lines,
  guestName,
  onGuestName,
  subtotal,
  pricing,
  error,
  onAdd,
  onSetQty,
  onClear,
  onFlip,
}: {
  restaurant: Restaurant
  copy: ReturnType<typeof storeCopy>
  query: string
  onQuery: (v: string) => void
  sections: Array<[string, CatalogEntry[]]>
  lines: PosLine[]
  guestName: string
  onGuestName: (v: string) => void
  subtotal: number
  pricing: ReturnType<typeof calculateOrderPricing> | null
  error: string
  onAdd: (entry: CatalogEntry) => void
  onSetQty: (id: string, qty: number) => void
  onClear: () => void
  onFlip: () => void
}) {
  return (
    <div className="grid h-full min-h-[640px] grid-cols-1 lg:grid-cols-[1.35fr_0.9fr]">
      <div className="flex min-h-0 flex-col border-b border-stone-200 lg:border-b-0 lg:border-r">
        <div className="border-b border-stone-100 px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={`Search ${copy.itemNounPlural.toLowerCase()}…`}
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          {sections.length === 0 ? (
            <p className="text-sm text-stone-500">
              No available {copy.itemNounPlural.toLowerCase()} in the catalog.
            </p>
          ) : (
            sections.map(([section, items]) => (
              <div key={section}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                  {section}
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((entry) => (
                    <button
                      key={entry.item.id}
                      type="button"
                      onClick={() => onAdd(entry)}
                      className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50 text-left transition hover:border-stone-300 hover:bg-white"
                    >
                      <MenuItemImage
                        src={entry.item.imageUrl}
                        alt=""
                        className="aspect-[4/3] w-full object-cover"
                        fallbackClassName="aspect-[4/3] w-full"
                      />
                      <div className="space-y-0.5 p-2.5">
                        <p className="line-clamp-2 text-sm font-medium leading-snug text-stone-900">
                          {entry.item.name}
                        </p>
                        <p className="text-sm font-semibold text-[var(--brand-primary)]">
                          {formatMoney(entry.priceCents)}
                          {entry.onSale ? (
                            <span className="ml-1 text-xs font-normal text-stone-400 line-through">
                              {formatMoney(entry.listPriceCents)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col bg-[var(--brand-bg,#fafaf9)]">
        <div className="border-b border-stone-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-stone-900">Current ticket</h2>
            <button
              type="button"
              onClick={onClear}
              className="text-xs font-medium text-stone-500 hover:text-stone-800"
            >
              Clear
            </button>
          </div>
          <Field label="Guest name (optional)" htmlFor="pos-guest">
            <Input
              id="pos-guest"
              value={guestName}
              onChange={(e) => onGuestName(e.target.value)}
              placeholder="Walk-in guest"
              className="mt-2"
            />
          </Field>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
          {lines.length === 0 ? (
            <li className="py-10 text-center text-sm text-stone-500">
              Tap {copy.itemNounPlural.toLowerCase()} to add them to the ticket.
            </li>
          ) : (
            lines.map((line) => (
              <li
                key={line.id}
                className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{line.name}</p>
                  <p className="text-xs text-stone-500">
                    {formatMoney(line.unitPriceCents)} each
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded-lg border border-stone-200 p-1 hover:bg-stone-50"
                    onClick={() => onSetQty(line.id, line.quantity - 1)}
                    aria-label="Decrease"
                  >
                    {line.quantity === 1 ? (
                      <Trash2 className="h-3.5 w-3.5 text-stone-500" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{line.quantity}</span>
                  <button
                    type="button"
                    className="rounded-lg border border-stone-200 p-1 hover:bg-stone-50"
                    onClick={() => onSetQty(line.id, line.quantity + 1)}
                    aria-label="Increase"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="w-16 text-right text-sm font-semibold">
                  {formatMoney(line.unitPriceCents * line.quantity)}
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="space-y-3 border-t border-stone-200 bg-white px-4 py-4">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {pricing ? (
            <div className="flex justify-between text-sm">
              <span className="text-stone-500">Tax est.</span>
              <span>{formatMoney(pricing.taxCents)}</span>
            </div>
          ) : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            type="button"
            size="lg"
            className="w-full border-0"
            style={{
              backgroundColor: restaurant.branding.buttonColor,
              color: restaurant.branding.buttonTextColor,
            }}
            onClick={onFlip}
            disabled={!lines.length}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Flip for payment
          </Button>
        </div>
      </div>
    </div>
  )
}

function CustomerFace({
  restaurant,
  copy,
  phase,
  lines,
  guestName,
  tipPreset,
  customTip,
  tipPresets,
  tipCents,
  pricing,
  error,
  busy,
  completedOrder,
  onTipPreset,
  onCustomTip,
  onBack,
  onPay,
  onNewSale,
}: {
  restaurant: Restaurant
  copy: ReturnType<typeof storeCopy>
  phase: PosPhase
  lines: PosLine[]
  guestName: string
  tipPreset: number | 'custom' | 0
  customTip: string
  tipPresets: number[]
  tipCents: number
  pricing: ReturnType<typeof calculateOrderPricing> | null
  error: string
  busy: boolean
  completedOrder: { orderNumber: string; totalCents: number; reference: string } | null
  onTipPreset: (v: number | 'custom' | 0) => void
  onCustomTip: (v: string) => void
  onBack: () => void
  onPay: () => void
  onNewSale: () => void
}) {
  if (phase === 'processing') {
    return (
      <div className="flex min-h-[640px] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-14 w-14 animate-pulse rounded-full bg-[var(--brand-primary)]/15" />
        <h2 className="font-display text-2xl text-stone-900">Processing payment…</h2>
        <p className="text-sm text-stone-500">Simulated card authorization — no real charge.</p>
      </div>
    )
  }

  if (phase === 'complete' && completedOrder) {
    return (
      <div className="flex min-h-[640px] flex-col items-center justify-center gap-4 px-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
        <h2 className="font-display text-3xl text-stone-900">You’re all set</h2>
        <p className="text-stone-600">
          Order #{completedOrder.orderNumber} · {formatMoney(completedOrder.totalCents)}
        </p>
        <p className="max-w-sm text-sm text-stone-500">
          This sale is in your Orders queue as an in-store {copy.pickupLabel.toLowerCase()}.
        </p>
        <Button type="button" size="lg" onClick={onNewSale} className="mt-2">
          Start new sale
        </Button>
        <a
          href={`/order/${completedOrder.reference}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-stone-500 underline"
        >
          View order tracker
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-h-[640px] flex-col">
      <div className="border-b border-stone-200 px-5 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-3 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          ← Back to staff
        </button>
        <h2 className="font-display text-2xl text-stone-900">Your order</h2>
        <p className="text-sm text-stone-500">
          {guestName.trim() || 'Guest'} · {restaurant.name}
        </p>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3 text-sm">
            <span>
              {line.quantity}× {line.name}
            </span>
            <span className="font-medium">
              {formatMoney(line.unitPriceCents * line.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <div className="space-y-4 border-t border-stone-200 px-5 py-5">
        <div>
          <p className="mb-2 text-sm font-medium text-stone-800">Add a tip</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onTipPreset(0)}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                tipPreset === 0
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-stone-200',
              )}
            >
              No tip
            </button>
            {tipPresets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onTipPreset(p)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  tipPreset === p
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                    : 'border-stone-200',
                )}
              >
                {p}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => onTipPreset('custom')}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm',
                tipPreset === 'custom'
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                  : 'border-stone-200',
              )}
            >
              Custom
            </button>
          </div>
          {tipPreset === 'custom' ? (
            <Input
              className="mt-2"
              type="number"
              min={0}
              step={0.01}
              value={customTip}
              onChange={(e) => onCustomTip(e.target.value)}
              placeholder="Tip amount ($)"
            />
          ) : null}
        </div>

        {pricing ? (
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-stone-500">Subtotal</dt>
              <dd>{formatMoney(pricing.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Tax</dt>
              <dd>{formatMoney(pricing.taxCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-stone-500">Tip</dt>
              <dd>{formatMoney(tipCents)}</dd>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd>{formatMoney(pricing.totalCents)}</dd>
            </div>
          </dl>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="button"
          size="lg"
          className="w-full border-0"
          style={{
            backgroundColor: restaurant.branding.buttonColor,
            color: restaurant.branding.buttonTextColor,
          }}
          disabled={busy}
          onClick={onPay}
        >
          <CreditCard className="h-4 w-4" />
          Tap or insert card · {formatMoney(pricing?.totalCents ?? 0)}
        </Button>
        <p className="text-center text-xs text-stone-500">
          Simulated payment — demo card ending 4242
        </p>
      </div>
    </div>
  )
}
