import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  CreditCard,
  Gift,
  Minus,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import type {
  AppDatabase,
  ComboConfig,
  MenuItem,
  ModifierGroup,
  OrderType,
  Restaurant,
} from '@/types'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import { advanceOrderStatus, placeOrder } from '@/services/orderService'
import * as employeeService from '@/services/employeeService'
import {
  PosClockView,
  PosDineInSeatView,
  PosHomeHubFixed,
  PosPickUpView,
  PosRecallView,
  seatTableForPos,
  type PosHubView,
} from '@/components/pos/PosHubViews'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { pointsEarnedForSubtotal, resolveListedPrice } from '@/lib/commerce'
import {
  calculateLineUnitPrice,
  calculateOrderPricing,
  validateModifierSelections,
  type BagComboSelection,
  type BagModifierSelection,
} from '@/lib/pricing'
import { brandingStyleVars } from '@/lib/brandingCss'
import { isItemAvailableNow } from '@/lib/scheduling'
import { storeCopy } from '@/lib/storeCopy'
import {
  createId,
  formatMoney,
  formatPhone,
  normalizePhoneKey,
  cn,
} from '@/lib/utils'
import { normalizeLoyaltySettings } from '@/types'

type PosPhase = 'staff' | 'customer' | 'processing' | 'complete'
type CustomerWizardStep = 'loyalty' | 'tip' | 'pay'
type OrderingContext = {
  orderType: Extract<OrderType, 'pickup' | 'dine_in'>
  tableId?: string
  tableName?: string
  guestName?: string
}

type PosLine = {
  id: string
  itemId: string
  name: string
  imageUrl?: string
  unitPriceCents: number
  quantity: number
  modifiers: BagModifierSelection[]
  comboSelections?: BagComboSelection[]
  modifierLabels: string[]
}

type CatalogEntry = {
  item: MenuItem
  listPriceCents: number
  priceCents: number
  onSale: boolean
  sectionName: string
  needsCustomization: boolean
}

function getModifierGroupsForItem(db: AppDatabase, itemId: string): ModifierGroup[] {
  return db.itemModifiers
    .filter((m) => m.itemId === itemId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((a) => db.modifierGroups.find((g) => g.id === a.modifierGroupId))
    .filter((g): g is ModifierGroup => Boolean(g))
}

function getComboForItem(db: AppDatabase, item: MenuItem): ComboConfig | undefined {
  if (!item.isCombo) return undefined
  return db.combos.find((c) => c.itemId === item.id)
}

function itemNeedsCustomization(
  db: AppDatabase,
  item: MenuItem,
): boolean {
  if (getModifierGroupsForItem(db, item.id).length > 0) return true
  return Boolean(getComboForItem(db, item))
}

function lineConfigKey(
  itemId: string,
  modifiers: BagModifierSelection[],
  comboSelections?: BagComboSelection[],
): string {
  const mods = [...modifiers]
    .map((m) => ({ groupId: m.groupId, optionIds: [...m.optionIds].sort() }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
  const combos = [...(comboSelections ?? [])]
    .map((c) => ({
      groupId: c.groupId,
      itemId: c.itemId,
      modifiers: [...c.modifiers]
        .map((m) => ({ groupId: m.groupId, optionIds: [...m.optionIds].sort() }))
        .sort((a, b) => a.groupId.localeCompare(b.groupId)),
    }))
    .sort((a, b) => a.groupId.localeCompare(b.groupId))
  return JSON.stringify({ itemId, mods, combos })
}

export function PosPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db, revision } = useDb({ pollMs: 3000 })
  const [hub, setHub] = useState<PosHubView>('home')
  const [ordering, setOrdering] = useState<OrderingContext | null>(null)
  const [drawerFlash, setDrawerFlash] = useState(false)
  const [phase, setPhase] = useState<PosPhase>('staff')
  const [flipping, setFlipping] = useState(false)
  const [query, setQuery] = useState('')
  const [lines, setLines] = useState<PosLine[]>([])
  const [guestName, setGuestName] = useState('')
  const [tipPreset, setTipPreset] = useState<number | 'custom' | 0>(0)
  const [customTip, setCustomTip] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [customizing, setCustomizing] = useState<CatalogEntry | null>(null)
  const [loyaltyPhone, setLoyaltyPhone] = useState('')
  const [loyaltySkipped, setLoyaltySkipped] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<{
    orderNumber: string
    totalCents: number
    reference: string
    loyaltyPointsEarned?: number
    loyaltyPhone?: string
  } | null>(null)

  const copy = storeCopy(current?.storeKind)
  const loyalty = normalizeLoyaltySettings(current?.loyalty)
  const loyaltyPhoneKey = normalizePhoneKey(loyaltyPhone)
  const loyaltyPhoneReady = loyaltyPhoneKey.length >= 10

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
      const listed = resolveListedPrice(list, item.id, sales, undefined, item.salePriceCents)
      entries.push({
        item,
        listPriceCents: listed.listPriceCents,
        priceCents: listed.priceCents,
        onSale: listed.onSale,
        sectionName: sectionById.get(a.sectionId) || 'General',
        needsCustomization: itemNeedsCustomization(db, item),
      })
    }

    // Include unassigned but active items so POS still works from the library.
    for (const item of db.items.filter((i) => i.restaurantId === current.id)) {
      if (seen.has(item.id)) continue
      if (!item.active || !isItemAvailableNow(item)) continue
      const listed = resolveListedPrice(
        item.basePriceCents,
        item.id,
        sales,
        undefined,
        item.salePriceCents,
      )
      entries.push({
        item,
        listPriceCents: listed.listPriceCents,
        priceCents: listed.priceCents,
        onSale: listed.onSale,
        sectionName: 'Library',
        needsCustomization: itemNeedsCustomization(db, item),
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
    const order = new Map(
      (db?.sections ?? [])
        .filter((s) => s.restaurantId === current?.id)
        .map((s) => [s.name, s.sortOrder] as const),
    )
    return [...map.entries()].sort((a, b) => {
      const ao = a[0] === 'Library' ? Number.MAX_SAFE_INTEGER : (order.get(a[0]) ?? 9999)
      const bo = b[0] === 'Library' ? Number.MAX_SAFE_INTEGER : (order.get(b[0]) ?? 9999)
      if (ao !== bo) return ao - bo
      return a[0].localeCompare(b[0])
    })
  }, [filtered, db, current?.id])

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

  const activeOrderType = ordering?.orderType ?? 'pickup'
  const pricing = useMemo(() => {
    if (!current) return null
    return calculateOrderPricing(subtotal, current.ordering, activeOrderType, tipCents)
  }, [current, subtotal, tipCents, activeOrderType])

  const tables = useMemo(() => {
    if (!db || !current) return []
    return (db.diningTables ?? [])
      .filter((t) => t.restaurantId === current.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current, revision])

  const reservations = useMemo(() => {
    if (!db || !current) return []
    return (db.reservations ?? []).filter((r) => r.restaurantId === current.id)
  }, [db, current, revision])

  const employees = useMemo(() => {
    if (!db || !current) return []
    return (db.employees ?? []).filter((e) => e.restaurantId === current.id)
  }, [db, current, revision])

  const openClocks = useMemo(() => {
    if (!db || !current) return []
    return (db.timeClockEntries ?? []).filter(
      (e) => e.restaurantId === current.id && !e.clockOutAt,
    )
  }, [db, current, revision])

  const storeOrders = useMemo(() => {
    if (!db || !current) return []
    return db.orders.filter((o) => o.restaurantId === current.id)
  }, [db, current, revision])

  const estimatedLoyaltyPoints =
    loyalty.enabled && loyaltyPhoneReady && !loyaltySkipped
      ? pointsEarnedForSubtotal(loyalty, pricing?.subtotalCents ?? subtotal)
      : 0

  if (!current || !user) {
    return (
      <p className="text-sm text-stone-500">
        Select a {copy.storeNoun} to open the POS simulator.
      </p>
    )
  }

  function addItem(entry: CatalogEntry) {
    setError('')
    if (!db) return
    if (itemNeedsCustomization(db, entry.item)) {
      setCustomizing(entry)
      return
    }
    commitLine({
      itemId: entry.item.id,
      name: entry.item.name,
      imageUrl: entry.item.imageUrl,
      unitPriceCents: entry.priceCents,
      quantity: 1,
      modifiers: [],
      modifierLabels: [],
    })
  }

  function commitLine(line: Omit<PosLine, 'id'>) {
    const key = lineConfigKey(line.itemId, line.modifiers, line.comboSelections)
    setLines((prev) => {
      const existing = prev.find(
        (l) => lineConfigKey(l.itemId, l.modifiers, l.comboSelections) === key,
      )
      if (existing) {
        return prev.map((l) =>
          l.id === existing.id
            ? { ...l, quantity: l.quantity + line.quantity }
            : l,
        )
      }
      return [...prev, { ...line, id: createId('pos') }]
    })
  }

  function setQty(lineId: string, quantity: number) {
    setLines((prev) =>
      prev
        .map((l) => (l.id === lineId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    )
  }

  function clearTicket(opts?: { goHome?: boolean }) {
    setLines([])
    setGuestName('')
    setTipPreset(0)
    setCustomTip('')
    setError('')
    setCustomizing(null)
    setLoyaltyPhone('')
    setLoyaltySkipped(false)
    setCompletedOrder(null)
    setPhase('staff')
    if (opts?.goHome) {
      setOrdering(null)
      setHub('home')
    }
  }

  function startOrdering(ctx: OrderingContext) {
    setOrdering(ctx)
    setGuestName(ctx.guestName ?? '')
    setLines([])
    setTipPreset(0)
    setCustomTip('')
    setError('')
    setCustomizing(null)
    setLoyaltyPhone('')
    setLoyaltySkipped(false)
    setCompletedOrder(null)
    setPhase('staff')
    setHub('ordering')
  }

  function goHome() {
    clearTicket({ goHome: true })
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
    const accrueLoyalty =
      loyalty.enabled && !loyaltySkipped && loyaltyPhoneReady
    if (loyalty.enabled && !loyaltySkipped && loyaltyPhone.trim() && !loyaltyPhoneReady) {
      setError('Enter a valid 10-digit phone number, or skip loyalty.')
      return
    }
    setBusy(true)
    setError('')
    setPhase('processing')
    try {
      // Brief pause so the “processing” state is visible.
      await new Promise((r) => window.setTimeout(r, 900))
      const guestPhone = accrueLoyalty
        ? loyaltyPhoneKey
        : current.phone || '5550000000'
      const order = await placeOrder({
        restaurantId: current.id,
        customer: {
          name: guestName.trim() || `Walk-in ${copy.guestNoun}`,
          phone: guestPhone,
          email: undefined,
        },
        fulfillment: {
          type: activeOrderType,
          instructions:
            activeOrderType === 'dine_in'
              ? `POS dine-in${ordering?.tableName ? ` · ${ordering.tableName}` : ''}`
              : 'POS to-go / counter sale',
          tableId: ordering?.tableId,
          tableName: ordering?.tableName,
        },
        tipCents,
        simulatedCardLast4: '4242',
        loyaltyByPhone: accrueLoyalty,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          modifiers: l.modifiers,
          comboSelections: l.comboSelections,
        })),
        clientTotalCents: pricing.totalCents,
      })
      setCompletedOrder({
        orderNumber: order.orderNumber,
        totalCents: order.pricing.totalCents,
        reference: order.reference,
        loyaltyPointsEarned: order.pricing.loyaltyPointsEarned,
        loyaltyPhone: accrueLoyalty ? formatPhone(loyaltyPhoneKey) : undefined,
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
  const restaurant = current
  const actor = user

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Point of sale</h1>
          <p className="mt-1 max-w-2xl text-stone-500">
            Counter tablet hub — dine in, to go, pickup handoff, employee clock, and cash drawer —
            powered by your live {copy.catalogNoun.toLowerCase()}.
          </p>
        </div>
        <Badge tone="accent">Auto-built from {copy.catalogNoun}</Badge>
      </div>

      <div className="flex justify-center">
        <PosDeviceFrame
          restaurant={current}
          flipping={flipping && hub === 'ordering'}
          phase={hub === 'ordering' ? phase : 'staff'}
        >
          {hub === 'home' ? (
            <PosHomeHubFixed
              restaurant={restaurant}
              isRetail={copy.isRetail}
              onDineIn={() => setHub('dine_in')}
              onToGo={() => startOrdering({ orderType: 'pickup' })}
              onPickUp={() => setHub('pick_up')}
              onClock={() => setHub('clock')}
              onRecall={() => setHub('recall')}
              drawerFlash={drawerFlash}
              onOpenDrawer={() => {
                void employeeService.openCashDrawer(restaurant.id, undefined, 'POS home')
                setDrawerFlash(true)
                window.setTimeout(() => setDrawerFlash(false), 2200)
              }}
            />
          ) : null}

          {hub === 'dine_in' ? (
            <PosDineInSeatView
              tables={tables}
              reservations={reservations}
              onBack={() => setHub('home')}
              onSeatAndOrder={async (table, name, partySize) => {
                await seatTableForPos(
                  restaurant.id,
                  actor.id,
                  table,
                  name,
                  partySize,
                )
                startOrdering({
                  orderType: 'dine_in',
                  tableId: table.id,
                  tableName: table.name,
                  guestName: name,
                })
              }}
            />
          ) : null}

          {hub === 'clock' ? (
            <PosClockView
              restaurantId={restaurant.id}
              employees={employees}
              openClocks={openClocks}
              onBack={() => setHub('home')}
              onChanged={() => {
                /* useDb poll refreshes */
              }}
            />
          ) : null}

          {hub === 'pick_up' ? (
            <PosPickUpView
              orders={storeOrders}
              onBack={() => setHub('home')}
              onAdvance={async (order, status) => {
                await advanceOrderStatus(actor.id, restaurant.id, order.id, status)
              }}
            />
          ) : null}

          {hub === 'recall' ? (
            <PosRecallView orders={storeOrders} onBack={() => setHub('home')} />
          ) : null}

          {hub === 'ordering' ? (
            <>
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
                  onClear={() => clearTicket({ goHome: true })}
                  onFlip={flipToCustomer}
                  orderLabel={
                    ordering?.orderType === 'dine_in'
                      ? `Dine in${ordering.tableName ? ` · ${ordering.tableName}` : ''}`
                      : copy.isRetail
                        ? 'Sale'
                        : 'To go'
                  }
                  onHome={goHome}
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
                  loyaltyEnabled={loyalty.enabled}
                  loyaltyPhone={loyaltyPhone}
                  loyaltySkipped={loyaltySkipped}
                  estimatedLoyaltyPoints={estimatedLoyaltyPoints}
                  pointsPerDollar={loyalty.pointsPerDollar}
                  onLoyaltyPhone={(v) => {
                    setLoyaltySkipped(false)
                    setLoyaltyPhone(v)
                  }}
                  onSkipLoyalty={() => {
                    setLoyaltyPhone('')
                    setLoyaltySkipped(true)
                  }}
                  onTipPreset={setTipPreset}
                  onCustomTip={setCustomTip}
                  onBack={flipToStaff}
                  onPay={() => void chargeCard()}
                  onNewSale={() => clearTicket({ goHome: true })}
                />
              )}

              {customizing && db && phase === 'staff' ? (
                <PosCustomizePanel
                  db={db}
                  restaurant={current}
                  entry={customizing}
                  onClose={() => setCustomizing(null)}
                  onConfirm={(line) => {
                    commitLine(line)
                    setCustomizing(null)
                  }}
                />
              ) : null}
            </>
          ) : null}
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
          <div className="relative h-[min(78vh,720px)] overflow-hidden">{children}</div>
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
  orderLabel,
  onHome,
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
  orderLabel: string
  onHome: () => void
}) {
  const [activeSection, setActiveSection] = useState<string>('all')
  const sectionNames = useMemo(() => sections.map(([name]) => name), [sections])

  useEffect(() => {
    if (activeSection === 'all') return
    if (!sectionNames.includes(activeSection)) setActiveSection('all')
  }, [activeSection, sectionNames])

  const visibleSections = useMemo(() => {
    if (activeSection === 'all') return sections
    return sections.filter(([name]) => name === activeSection)
  }, [sections, activeSection])

  const totalItems = sections.reduce((sum, [, items]) => sum + items.length, 0)

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[1.35fr_0.9fr]">
      <div className="flex min-h-0 flex-col overflow-hidden border-b border-stone-200 lg:border-b-0 lg:border-r">
        <div className="shrink-0 space-y-3 border-b border-stone-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onHome}
              className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Home
            </button>
            <Badge tone="neutral">{orderLabel}</Badge>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={`Search ${copy.itemNounPlural.toLowerCase()}…`}
            />
          </div>
          {sections.length > 0 ? (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              <button
                type="button"
                onClick={() => setActiveSection('all')}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                  activeSection === 'all'
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
                )}
              >
                All ({totalItems})
              </button>
              {sections.map(([name, items]) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveSection(name)}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                    activeSection === name
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300',
                  )}
                >
                  {name} ({items.length})
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4">
          {visibleSections.length === 0 ? (
            <p className="text-sm text-stone-500">
              No available {copy.itemNounPlural.toLowerCase()} in the catalog.
            </p>
          ) : (
            visibleSections.map(([section, items]) => (
              <div key={section}>
                {activeSection === 'all' ? (
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-400">
                    {section}
                  </h3>
                ) : null}
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
                        storeKind={restaurant.storeKind}
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
                        {entry.needsCustomization ? (
                          <p className="text-[11px] font-medium text-stone-400">
                            Options…
                          </p>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-col overflow-hidden bg-[var(--brand-bg,#fafaf9)]">
        <div className="shrink-0 border-b border-stone-200 px-4 py-3">
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
          <Field label={`${copy.guestNounTitle} name (optional)`} htmlFor="pos-guest">
            <Input
              id="pos-guest"
              value={guestName}
              onChange={(e) => onGuestName(e.target.value)}
              placeholder={`Walk-in ${copy.guestNoun}`}
              className="mt-2"
            />
          </Field>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
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
                  {line.modifierLabels.length ? (
                    <p className="truncate text-xs text-stone-500">
                      {line.modifierLabels.join(', ')}
                    </p>
                  ) : null}
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

        <div className="shrink-0 space-y-3 border-t border-stone-200 bg-white px-4 py-4">
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
  loyaltyEnabled,
  loyaltyPhone,
  loyaltySkipped,
  estimatedLoyaltyPoints,
  pointsPerDollar,
  onLoyaltyPhone,
  onSkipLoyalty,
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
  completedOrder: {
    orderNumber: string
    totalCents: number
    reference: string
    loyaltyPointsEarned?: number
    loyaltyPhone?: string
  } | null
  loyaltyEnabled: boolean
  loyaltyPhone: string
  loyaltySkipped: boolean
  estimatedLoyaltyPoints: number
  pointsPerDollar: number
  onLoyaltyPhone: (v: string) => void
  onSkipLoyalty: () => void
  onTipPreset: (v: number | 'custom' | 0) => void
  onCustomTip: (v: string) => void
  onBack: () => void
  onPay: () => void
  onNewSale: () => void
}) {
  const wizardSteps = useMemo(() => {
    const steps: Array<{ id: CustomerWizardStep; label: string }> = []
    if (loyaltyEnabled) steps.push({ id: 'loyalty', label: 'Loyalty' })
    steps.push({ id: 'tip', label: 'Tip' }, { id: 'pay', label: 'Pay' })
    return steps
  }, [loyaltyEnabled])

  const [wizardStep, setWizardStep] = useState<CustomerWizardStep>(
    loyaltyEnabled ? 'loyalty' : 'tip',
  )

  useEffect(() => {
    if (phase === 'customer') {
      setWizardStep(loyaltyEnabled ? 'loyalty' : 'tip')
    }
  }, [phase, loyaltyEnabled])

  const stepIndex = Math.max(
    0,
    wizardSteps.findIndex((s) => s.id === wizardStep),
  )

  if (phase === 'processing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="h-14 w-14 animate-pulse rounded-full bg-[var(--brand-primary)]/15" />
        <h2 className="font-display text-2xl text-stone-900">Processing payment…</h2>
        <p className="text-sm text-stone-500">Simulated card authorization — no real charge.</p>
        {pricing ? (
          <p className="text-lg font-semibold text-stone-800">
            {formatMoney(pricing.totalCents)}
          </p>
        ) : null}
      </div>
    )
  }

  if (phase === 'complete' && completedOrder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto px-6 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-600" />
        <h2 className="font-display text-3xl text-stone-900">You’re all set</h2>
        <p className="text-stone-600">
          Order #{completedOrder.orderNumber} · {formatMoney(completedOrder.totalCents)}
        </p>
        {completedOrder.loyaltyPointsEarned && completedOrder.loyaltyPointsEarned > 0 ? (
          <div className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-emerald-950">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Gift className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-emerald-900">
              +{completedOrder.loyaltyPointsEarned}
            </p>
            <p className="mt-1 text-sm font-medium text-emerald-800">
              {completedOrder.loyaltyPointsEarned === 1
                ? 'loyalty point earned'
                : 'loyalty points earned'}
            </p>
            {completedOrder.loyaltyPhone ? (
              <p className="mt-2 text-sm leading-relaxed text-emerald-800/75">
                Saved to {completedOrder.loyaltyPhone}. They’ll show up next time this
                number is used.
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-emerald-800/75">
                Added to this {copy.guestNoun}’s loyalty balance.
              </p>
            )}
          </div>
        ) : loyaltyEnabled ? (
          <p className="max-w-sm text-sm text-stone-500">
            No loyalty phone was entered — points were not added this time.
          </p>
        ) : null}
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

  const brandButton = {
    backgroundColor: restaurant.branding.buttonColor,
    color: restaurant.branding.buttonTextColor,
  }

  const phoneReady = normalizePhoneKey(loyaltyPhone).length >= 10

  function goNextFromLoyalty(skip: boolean) {
    if (skip) onSkipLoyalty()
    setWizardStep('tip')
  }

  function goBackInWizard() {
    if (wizardStep === 'pay') {
      setWizardStep('tip')
      return
    }
    if (wizardStep === 'tip') {
      if (loyaltyEnabled) setWizardStep('loyalty')
      else onBack()
      return
    }
    onBack()
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-stone-200 px-5 py-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goBackInWizard}
            className="text-xs font-medium text-stone-500 hover:text-stone-800"
          >
            ← {wizardStep === 'loyalty' || (!loyaltyEnabled && wizardStep === 'tip')
              ? 'Staff'
              : 'Back'}
          </button>
          <p className="text-xs text-stone-400">
            {guestName.trim() || copy.guestNounTitle} · {restaurant.name}
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {wizardSteps.map((step, index) => {
            const active = index === stepIndex
            const done = index < stepIndex
            return (
              <div key={step.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'h-1.5 w-full rounded-full transition-colors',
                    active || done
                      ? 'bg-[var(--brand-primary)]'
                      : 'bg-stone-200',
                  )}
                />
                <span
                  className={cn(
                    'text-[11px] font-medium',
                    active
                      ? 'text-[var(--brand-primary)]'
                      : done
                        ? 'text-stone-600'
                        : 'text-stone-400',
                  )}
                >
                  {index + 1}. {step.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
        {wizardStep === 'loyalty' ? (
          <div className="mx-auto flex h-full max-w-md flex-col justify-center text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
              <Gift className="h-7 w-7" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 font-display text-3xl text-stone-900">
              Join the loyalty program?
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Earn {pointsPerDollar} point{pointsPerDollar === 1 ? '' : 's'} per $1 spent.
              Enter your phone to save points, or skip for now.
            </p>
            <div className="mt-6 text-left">
              <Field label="Mobile number" htmlFor="pos-loyalty-phone">
                <Input
                  id="pos-loyalty-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(555) 555-5555"
                  value={loyaltyPhone}
                  onChange={(e) => onLoyaltyPhone(e.target.value)}
                  className="mt-1.5 text-center text-lg tracking-wide"
                />
              </Field>
              {estimatedLoyaltyPoints > 0 ? (
                <p className="mt-2 text-center text-sm font-medium text-[var(--brand-primary)]">
                  You’ll earn {estimatedLoyaltyPoints} points on this order
                </p>
              ) : loyaltyPhone.trim() && !phoneReady ? (
                <p className="mt-2 text-center text-xs text-stone-500">
                  Enter a 10-digit mobile number to continue
                </p>
              ) : null}
            </div>
            <div className="mt-6 space-y-2">
              <Button
                type="button"
                size="lg"
                className="w-full border-0"
                style={brandButton}
                disabled={!phoneReady}
                onClick={() => goNextFromLoyalty(false)}
              >
                Continue with points
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                className="w-full"
                onClick={() => goNextFromLoyalty(true)}
              >
                Skip for now
              </Button>
            </div>
          </div>
        ) : null}

        {wizardStep === 'tip' ? (
          <div className="mx-auto flex h-full max-w-md flex-col justify-center text-center">
            <h2 className="font-display text-3xl text-stone-900">Add a tip?</h2>
            <p className="mt-2 text-sm text-stone-500">
              Optional — tap an amount, then continue to payment.
            </p>
            <p className="mt-4 text-sm text-stone-500">
              Subtotal {formatMoney(pricing?.subtotalCents ?? 0)}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onTipPreset(0)}
                className={cn(
                  'rounded-xl border px-3 py-4 text-base font-medium transition',
                  tipPreset === 0
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--brand-primary)]'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-stone-300',
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
                    'rounded-xl border px-3 py-4 text-base font-medium transition',
                    tipPreset === p
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--brand-primary)]'
                      : 'border-stone-200 bg-white text-stone-800 hover:border-stone-300',
                  )}
                >
                  <span className="block text-lg font-semibold">{p}%</span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    {formatMoney(
                      Math.round((pricing?.subtotalCents ?? 0) * (p / 100)),
                    )}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => onTipPreset('custom')}
                className={cn(
                  'rounded-xl border px-3 py-4 text-base font-medium transition',
                  tipPreset === 'custom'
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 text-[var(--brand-primary)]'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-stone-300',
                )}
              >
                Custom
              </button>
            </div>
            {tipPreset === 'custom' ? (
              <Input
                className="mt-3 text-center text-lg"
                type="number"
                min={0}
                step={0.01}
                value={customTip}
                onChange={(e) => onCustomTip(e.target.value)}
                placeholder="Tip amount ($)"
              />
            ) : null}
            <p className="mt-4 text-sm font-medium text-stone-700">
              Tip {formatMoney(tipCents)}
            </p>
            <Button
              type="button"
              size="lg"
              className="mt-6 w-full border-0"
              style={brandButton}
              onClick={() => setWizardStep('pay')}
            >
              Continue to payment
            </Button>
          </div>
        ) : null}

        {wizardStep === 'pay' ? (
          <div className="mx-auto flex h-full max-w-md flex-col">
            <div className="text-center">
              <h2 className="font-display text-3xl text-stone-900">Ready to pay</h2>
              <p className="mt-2 text-sm text-stone-500">
                Review your total, then tap or insert card.
              </p>
            </div>

            <ul className="mt-5 max-h-40 space-y-2 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 text-left text-sm">
              {lines.map((line) => (
                <li key={line.id} className="flex justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-medium">
                      {line.quantity}× {line.name}
                    </span>
                    {line.modifierLabels.length ? (
                      <span className="block text-xs text-stone-500">
                        {line.modifierLabels.join(', ')}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium">
                    {formatMoney(line.unitPriceCents * line.quantity)}
                  </span>
                </li>
              ))}
            </ul>

            {pricing ? (
              <dl className="mt-4 space-y-1.5 text-sm">
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
                {loyaltyEnabled && !loyaltySkipped && phoneReady ? (
                  <div className="flex justify-between text-[var(--brand-primary)]">
                    <dt>Loyalty</dt>
                    <dd>+{estimatedLoyaltyPoints} pts</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-semibold">
                  <dt>Total</dt>
                  <dd>{formatMoney(pricing.totalCents)}</dd>
                </div>
              </dl>
            ) : null}

            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

            <div className="mt-auto space-y-2 pt-6">
              <Button
                type="button"
                size="lg"
                className="w-full border-0"
                style={brandButton}
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
        ) : null}
      </div>
    </div>
  )
}

function PosCustomizePanel({
  db,
  restaurant,
  entry,
  onClose,
  onConfirm,
}: {
  db: AppDatabase
  restaurant: Restaurant
  entry: CatalogEntry
  onClose: () => void
  onConfirm: (line: Omit<PosLine, 'id'>) => void
}) {
  const item = entry.item
  const groups = useMemo(
    () => getModifierGroupsForItem(db, item.id),
    [db, item.id],
  )
  const combo = useMemo(() => getComboForItem(db, item), [db, item])
  const catalogItems = useMemo(
    () => db.items.filter((i) => i.restaurantId === restaurant.id),
    [db, restaurant.id],
  )

  const [quantity, setQuantity] = useState(1)
  const [modifiers, setModifiers] = useState<BagModifierSelection[]>([])
  const [comboSelections, setComboSelections] = useState<BagComboSelection[]>([])
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    setQuantity(1)
    setErrors([])
    setModifiers(
      groups.map((g) => ({
        groupId: g.id,
        optionIds: g.options.filter((o) => o.isDefault && o.available).map((o) => o.id),
      })),
    )
    if (combo) {
      setComboSelections(
        combo.componentGroups.map((cg) => ({
          groupId: cg.id,
          itemId: cg.includedItemId ?? cg.allowedItemIds[0] ?? '',
          modifiers: [],
        })),
      )
    } else {
      setComboSelections([])
    }
  }, [item.id, groups, combo])

  const priced = useMemo(() => {
    return calculateLineUnitPrice(
      {
        item,
        quantity,
        modifiers,
        comboSelections: item.isCombo ? comboSelections : undefined,
        priceOverrideCents: entry.priceCents,
      },
      groups,
      combo,
      catalogItems,
    )
  }, [item, quantity, modifiers, comboSelections, entry.priceCents, groups, combo, catalogItems])

  function toggleOption(group: ModifierGroup, optionId: string) {
    setModifiers((prev) => {
      const existing = prev.find((m) => m.groupId === group.id)
      const current = existing?.optionIds ?? []
      let next: string[]
      if (group.selectionMode === 'single') {
        next = current.includes(optionId) && !group.required ? [] : [optionId]
      } else if (current.includes(optionId)) {
        next = current.filter((id) => id !== optionId)
      } else if (current.length >= group.maxSelections) {
        next = [...current.slice(1), optionId]
      } else {
        next = [...current, optionId]
      }
      const others = prev.filter((m) => m.groupId !== group.id)
      return [...others, { groupId: group.id, optionIds: next }]
    })
  }

  function setComboItem(groupId: string, itemId: string) {
    setComboSelections((prev) => {
      const others = prev.filter((s) => s.groupId !== groupId)
      return [...others, { groupId, itemId, modifiers: [] }]
    })
  }

  function toggleComboModifier(
    comboGroupId: string,
    group: ModifierGroup,
    optionId: string,
  ) {
    setComboSelections((prev) =>
      prev.map((sel) => {
        if (sel.groupId !== comboGroupId) return sel
        const existing = sel.modifiers.find((m) => m.groupId === group.id)
        const current = existing?.optionIds ?? []
        let next: string[]
        if (group.selectionMode === 'single') {
          next = current.includes(optionId) && !group.required ? [] : [optionId]
        } else if (current.includes(optionId)) {
          next = current.filter((id) => id !== optionId)
        } else if (current.length >= group.maxSelections) {
          next = [...current.slice(1), optionId]
        } else {
          next = [...current, optionId]
        }
        const otherMods = sel.modifiers.filter((m) => m.groupId !== group.id)
        return {
          ...sel,
          modifiers: [...otherMods, { groupId: group.id, optionIds: next }],
        }
      }),
    )
  }

  function validateCombo(): string[] {
    if (!combo) return []
    const errs: string[] = []
    for (const cg of combo.componentGroups) {
      const sel = comboSelections.find((s) => s.groupId === cg.id)
      if (cg.required && (!sel || !sel.itemId)) {
        errs.push(`Please select “${cg.name}”.`)
        continue
      }
      if (sel && sel.itemId && !cg.allowedItemIds.includes(sel.itemId)) {
        errs.push(`Invalid selection for “${cg.name}”.`)
      }
      if (sel?.itemId) {
        const componentGroups = getModifierGroupsForItem(db, sel.itemId)
        errs.push(...validateModifierSelections(componentGroups, sel.modifiers))
      }
    }
    return errs
  }

  function handleAdd() {
    const modErrors = validateModifierSelections(groups, modifiers)
    const comboErrors = validateCombo()
    const all = [...modErrors, ...comboErrors]
    if (all.length) {
      setErrors(all)
      return
    }
    const labels = [
      ...priced.modifiers.map((m) => m.optionName),
      ...(priced.comboSelections?.map((c) => c.itemName) ?? []),
    ]
    onConfirm({
      itemId: item.id,
      name: item.name,
      imageUrl: item.imageUrl,
      unitPriceCents: priced.unitPriceCents,
      quantity,
      modifiers,
      comboSelections: item.isCombo ? comboSelections : undefined,
      modifierLabels: labels,
    })
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white/95 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
            Customize
          </p>
          <h3 className="truncate text-lg font-semibold text-stone-900">{item.name}</h3>
          <p className="text-sm text-[var(--brand-primary)]">
            {formatMoney(entry.priceCents)}
            {entry.onSale ? (
              <span className="ml-1 text-xs text-stone-400 line-through">
                {formatMoney(entry.listPriceCents)}
              </span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-stone-200 p-2 text-stone-500 hover:bg-stone-50"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {groups.map((group) => {
          const selected = modifiers.find((m) => m.groupId === group.id)?.optionIds ?? []
          return (
            <PosModifierGroupBlock
              key={group.id}
              group={group}
              selected={selected}
              onToggle={(optionId) => toggleOption(group, optionId)}
            />
          )
        })}

        {combo
          ? combo.componentGroups.map((cg) => {
              const sel = comboSelections.find((s) => s.groupId === cg.id)
              const componentMods = sel?.itemId
                ? getModifierGroupsForItem(db, sel.itemId)
                : []
              return (
                <div key={cg.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-stone-900">{cg.name}</h4>
                    <Badge tone={cg.required ? 'accent' : 'neutral'}>
                      {cg.required ? 'Required' : 'Optional'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {cg.allowedItemIds.map((allowedId) => {
                      const allowed = catalogItems.find((i) => i.id === allowedId)
                      if (!allowed) return null
                      const upgrade = cg.upgradeChargesCents[allowedId] ?? 0
                      const active = sel?.itemId === allowedId
                      return (
                        <button
                          key={allowedId}
                          type="button"
                          onClick={() => setComboItem(cg.id, allowedId)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm',
                            active
                              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                              : 'border-stone-200 bg-stone-50 hover:border-stone-300',
                          )}
                        >
                          <span>{allowed.name}</span>
                          {upgrade > 0 ? (
                            <span className="text-stone-500">+{formatMoney(upgrade)}</span>
                          ) : (
                            <span className="text-stone-400">Included</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {sel?.itemId && componentMods.length > 0 ? (
                    <div className="ml-2 space-y-4 border-l-2 border-stone-200 pl-3">
                      {componentMods.map((group) => {
                        const selected =
                          sel.modifiers.find((m) => m.groupId === group.id)?.optionIds ??
                          []
                        return (
                          <PosModifierGroupBlock
                            key={group.id}
                            group={group}
                            selected={selected}
                            onToggle={(optionId) =>
                              toggleComboModifier(cg.id, group, optionId)
                            }
                          />
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })
          : null}

        {errors.length ? (
          <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-stone-200 bg-white px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-lg border border-stone-200 p-2"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            className="rounded-lg border border-stone-200 p-2"
            onClick={() => setQuantity((q) => q + 1)}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <Button
          type="button"
          size="lg"
          className="flex-1 border-0"
          style={{
            backgroundColor: restaurant.branding.buttonColor,
            color: restaurant.branding.buttonTextColor,
          }}
          onClick={handleAdd}
        >
          Add to ticket · {formatMoney(priced.unitPriceCents * quantity)}
        </Button>
      </div>
    </div>
  )
}

function PosModifierGroupBlock({
  group,
  selected,
  onToggle,
}: {
  group: ModifierGroup
  selected: string[]
  onToggle: (optionId: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium text-stone-900">{group.name}</h4>
        <Badge tone={group.required ? 'accent' : 'neutral'}>
          {group.required ? 'Required' : 'Optional'}
        </Badge>
        {group.selectionMode === 'multi' ? (
          <span className="text-xs text-stone-400">
            Choose {group.minSelections}–{group.maxSelections}
          </span>
        ) : null}
      </div>
      {group.description ? (
        <p className="text-xs text-stone-500">{group.description}</p>
      ) : null}
      <div className="space-y-2">
        {group.options
          .filter((o) => o.available)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((option) => {
            const active = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm',
                  active
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                    : 'border-stone-200 bg-stone-50 hover:border-stone-300',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center border',
                      group.selectionMode === 'single' ? 'rounded-full' : 'rounded',
                      active
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]'
                        : 'border-stone-300',
                    )}
                  >
                    {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                  {option.name}
                </span>
                {option.priceAdjustmentCents !== 0 ? (
                  <span className="text-stone-500">
                    {option.priceAdjustmentCents > 0 ? '+' : ''}
                    {formatMoney(option.priceAdjustmentCents)}
                  </span>
                ) : null}
              </button>
            )
          })}
      </div>
    </div>
  )
}
