import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  ChevronDown,
  Plus,
  Printer,
  Split,
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  Trash2,
  Users,
  Clock3,
} from 'lucide-react'
import type {
  DiningRoom,
  DiningTable,
  DiningTableShape,
  FloorLabel,
  Reservation,
  TableCheck,
  TableLineItemStatus,
} from '@/types'
import { normalizeDiningTable } from '@/types'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useDb } from '@/hooks/useDb'
import * as floorPlanService from '@/services/floorPlanService'
import * as reservationService from '@/services/reservationService'
import { FloorCanvas, STATUS_META } from '@/components/floor/FloorCanvas'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Modal, ModalTabs } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { cn, formatMoney } from '@/lib/utils'

export type FloorPlanMode = 'live' | 'design'

const SHAPES: Array<{ id: DiningTableShape; label: string }> = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'booth', label: 'Booth (benches)' },
  { id: 'bar', label: 'Bar' },
]

const LINE_STATUSES: TableLineItemStatus[] = [
  'queued',
  'preparing',
  'ready',
  'served',
  'held',
]

function lineTone(status: TableLineItemStatus): string {
  switch (status) {
    case 'served':
      return 'bg-emerald-50 text-emerald-800'
    case 'preparing':
      return 'bg-orange-50 text-orange-800'
    case 'ready':
      return 'bg-teal-50 text-teal-800'
    case 'held':
      return 'bg-red-50 text-red-800'
    default:
      return 'bg-stone-100 text-stone-700'
  }
}

function lineLabel(status: TableLineItemStatus): string {
  if (status === 'preparing') return 'On grill'
  if (status === 'queued') return 'Queued'
  if (status === 'ready') return 'Ready'
  if (status === 'served') return 'Served'
  return 'Held'
}

export function FloorPlanWorkspace({
  mode,
  onModeChange,
  fullscreen = false,
  showModeTabs = true,
  showHeader = true,
}: {
  /** Controlled floor mode. When omitted, the workspace manages its own live/design toggle. */
  mode?: FloorPlanMode
  onModeChange?: (mode: FloorPlanMode) => void
  fullscreen?: boolean
  showModeTabs?: boolean
  showHeader?: boolean
}) {
  const user = useAuthStore((s) => s.user)
  const current = useRestaurantStore((s) => s.current())
  const { db, revision } = useDb({ pollMs: 2500 })
  const [internalMode, setInternalMode] = useState<FloorPlanMode>('live')
  const tab = mode ?? internalMode
  const setTab = (next: FloorPlanMode) => {
    onModeChange?.(next)
    if (mode === undefined) setInternalMode(next)
  }
  const [roomId, setRoomId] = useState<string | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [seatName, setSeatName] = useState('')
  const [seatParty, setSeatParty] = useState(2)
  const [newRoomName, setNewRoomName] = useState('')
  const [newTableName, setNewTableName] = useState('')
  const [newTableSeats, setNewTableSeats] = useState(4)
  const [newTableShape, setNewTableShape] = useState<DiningTableShape>('square')
  const [newLabelText, setNewLabelText] = useState('KITCHEN PASS')
  const [roomMenuOpen, setRoomMenuOpen] = useState(false)
  const [addTableOpen, setAddTableOpen] = useState(false)
  const roomMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roomMenuOpen) return
    function onDoc(e: MouseEvent) {
      if (!roomMenuRef.current?.contains(e.target as Node)) setRoomMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [roomMenuOpen])

  const rooms = useMemo(() => {
    if (!db || !current) return [] as DiningRoom[]
    return (db.diningRooms ?? [])
      .filter((r) => r.restaurantId === current.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current, revision])

  const tables = useMemo(() => {
    if (!db || !current) return [] as DiningTable[]
    return (db.diningTables ?? [])
      .filter((t) => t.restaurantId === current.id)
      .map((t) => normalizeDiningTable(t))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current, revision])

  const labels = useMemo(() => {
    if (!db || !current) return [] as FloorLabel[]
    return (db.floorLabels ?? []).filter((l) => l.restaurantId === current.id)
  }, [db, current, revision])

  const checks = useMemo(() => {
    if (!db || !current) return [] as TableCheck[]
    return (db.tableChecks ?? []).filter(
      (c) => c.restaurantId === current.id && !c.closedAt,
    )
  }, [db, current, revision])

  const waitlist = useMemo(() => {
    if (!db || !current) return [] as Reservation[]
    const now = Date.now()
    return (db.reservations ?? []).filter((r) => {
      if (r.restaurantId !== current.id || r.status !== 'booked') return false
      const start = new Date(r.startAt).getTime()
      return start <= now + 3 * 60 * 60_000
    })
  }, [db, current, revision])

  const activeRoom = rooms.find((r) => r.id === roomId) ?? rooms[0] ?? null
  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null
  const selectedCheck = selectedTable
    ? floorPlanService.openCheckForTable(checks, selectedTable.id)
    : undefined
  const selectedLabel = labels.find((l) => l.id === selectedLabelId) ?? null

  const covers = checks.reduce((s, c) => s + c.partySize, 0)
  const openCents = checks.reduce(
    (s, c) => s + floorPlanService.computeCheckTotals(c).totalCents,
    0,
  )

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to manage tables.</p>
  }

  if (current.storeKind === 'retail') {
    return (
      <div className="space-y-3">
        <p className="max-w-xl text-stone-500">
          Floor plans and table service are for restaurant storefronts.
        </p>
      </div>
    )
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        fullscreen && 'h-full min-h-0 gap-3',
      )}
    >
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn('font-display text-stone-900', fullscreen ? 'text-2xl' : 'text-xl')}>
              {tab === 'design' ? 'Design layout' : 'Live floor'}
            </h2>
            <Badge tone="success">Online</Badge>
          </div>
          {fullscreen ? (
            <Link
              to="/dashboard/dining"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              <Minimize2 className="h-4 w-4" />
              Exit full screen
            </Link>
          ) : (
            <Link
              to="/dining/floor"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-medium text-stone-800 hover:bg-stone-50"
            >
              <Maximize2 className="h-4 w-4" />
              Full screen
            </Link>
          )}
        </div>
      ) : null}

      {showModeTabs ? (
        <ModalTabs
          tabs={[
            { id: 'live' as const, label: 'Live feed' },
            { id: 'design' as const, label: 'Design layout' },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      {!activeRoom ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-stone-600">No rooms yet. Add a room in Design layout.</p>
          <Button className="mt-4" onClick={() => setTab('design')}>
            Open designer
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {rooms.map((room) => {
              const count = tables.filter((t) => t.roomId === room.id && t.active).length
              const active = (activeRoom?.id ?? '') === room.id
              return (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    setRoomId(room.id)
                    setSelectedTableId(null)
                    setSelectedLabelId(null)
                  }}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    active
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400',
                  )}
                >
                  {room.name} ({count})
                </button>
              )
            })}

            {tab === 'design' ? (
              <>
                <div className="relative" ref={roomMenuRef}>
                  <button
                    type="button"
                    onClick={() => setRoomMenuOpen((o) => !o)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:border-stone-400"
                  >
                    Rooms
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {roomMenuOpen ? (
                    <div className="absolute left-0 top-full z-40 mt-2 w-72 rounded-2xl border border-stone-200 bg-white p-3 shadow-lg">
                      <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                        Manage rooms
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Input
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          placeholder="Room name"
                        />
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              const room = await floorPlanService.createRoom(
                                user.id,
                                current.id,
                                { name: newRoomName || 'New room' },
                              )
                              setNewRoomName('')
                              setRoomId(room.id)
                              setRoomMenuOpen(false)
                              setMessage(`Added room ${room.name}.`)
                            })
                          }
                        >
                          Add
                        </Button>
                      </div>
                      {activeRoom ? (
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <p className="mb-2 text-xs text-stone-500">Current room</p>
                          <div className="flex gap-2">
                            <Input
                              key={activeRoom.id}
                              defaultValue={activeRoom.name}
                              onBlur={(e) => {
                                const name = e.target.value.trim()
                                if (name && name !== activeRoom.name) {
                                  void run(async () => {
                                    await floorPlanService.updateRoom(
                                      user.id,
                                      current.id,
                                      activeRoom.id,
                                      { name },
                                    )
                                  })
                                }
                              }}
                            />
                            <Button
                              variant="secondary"
                              disabled={busy || rooms.length <= 1}
                              title="Delete room"
                              onClick={() =>
                                void run(async () => {
                                  await floorPlanService.deleteRoom(
                                    user.id,
                                    current.id,
                                    activeRoom.id,
                                  )
                                  setRoomId(null)
                                  setRoomMenuOpen(false)
                                  setMessage('Room removed.')
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <Button size="sm" onClick={() => setAddTableOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add table
                </Button>
              </>
            ) : null}

            <div className="ml-auto flex flex-wrap items-center gap-3 text-sm text-stone-600">
              <span>
                Covers <strong className="text-stone-900">{covers}</strong>
              </span>
              <span>
                Open <strong className="text-stone-900">{formatMoney(openCents)}</strong>
              </span>
            </div>
          </div>

          {tab === 'live' ? (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((key) => (
                <span
                  key={key}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                    STATUS_META[key].chip,
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', STATUS_META[key].dot)} />
                  {STATUS_META[key].label}
                </span>
              ))}
            </div>
          ) : null}

          <div
            className={cn(
              'grid min-h-0 gap-4',
              fullscreen && 'flex-1',
              tab === 'live'
                ? 'xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.85fr)]'
                : 'xl:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.75fr)]',
            )}
          >
            <FloorCanvas
              room={activeRoom}
              tables={tables}
              labels={labels}
              checks={checks}
              selectedTableId={selectedTableId}
              selectedLabelId={selectedLabelId}
              designMode={tab === 'design'}
              className={fullscreen ? 'h-full min-h-[420px]' : undefined}
              onSelectTable={(t) => {
                setSelectedTableId(t.id)
                setSelectedLabelId(null)
                setSeatParty(Math.min(t.seats, seatParty || 2))
              }}
              onClearSelection={() => {
                setSelectedTableId(null)
                setSelectedLabelId(null)
              }}
              onSelectLabel={(l) => {
                setSelectedLabelId(l.id)
                setSelectedTableId(null)
              }}
              onMoveTable={(id, x, y) => {
                void floorPlanService.updateLayoutTable(user.id, current.id, id, { x, y })
              }}
              onMoveLabel={(id, x, y) => {
                void floorPlanService.updateFloorLabel(user.id, current.id, id, { x, y })
              }}
            />

            {tab === 'live' ? (
              <TableSidePanel
                table={selectedTable}
                check={selectedCheck}
                room={activeRoom}
                waitlist={waitlist}
                busy={busy}
                seatName={seatName}
                seatParty={seatParty}
                onSeatName={setSeatName}
                onSeatParty={setSeatParty}
                onSeat={() =>
                  run(async () => {
                    if (!selectedTable) return
                    await floorPlanService.seatWalkInAtTable(user.id, current.id, {
                      tableId: selectedTable.id,
                      guestName: seatName || 'Walk-in',
                      partySize: seatParty,
                      serverName: 'Host stand',
                    })
                    setSeatName('')
                    setMessage(`Seated ${seatName || 'Walk-in'} at ${selectedTable.name}.`)
                  })
                }
                onSeatReservation={(reservationId, guestName, partySize) =>
                  run(async () => {
                    if (!selectedTable) return
                    await floorPlanService.seatWalkInAtTable(user.id, current.id, {
                      tableId: selectedTable.id,
                      guestName,
                      partySize,
                      reservationId,
                      serverName: 'Host stand',
                    })
                    setMessage(`Seated booking for ${guestName}.`)
                  })
                }
                onPrintBill={() =>
                  run(async () => {
                    if (!selectedCheck) return
                    await floorPlanService.printTableBill(
                      user.id,
                      current.id,
                      selectedCheck.id,
                    )
                    setMessage('Bill printed (simulated).')
                  })
                }
                onPay={() =>
                  run(async () => {
                    if (!selectedCheck) return
                    await floorPlanService.closeTableCheck(
                      user.id,
                      current.id,
                      selectedCheck.id,
                    )
                    setMessage(`Closed check #${selectedCheck.orderNumber}.`)
                  })
                }
                onLineStatus={(lineId, status) =>
                  run(async () => {
                    if (!selectedCheck) return
                    await floorPlanService.updateCheckLineStatus(
                      user.id,
                      current.id,
                      selectedCheck.id,
                      lineId,
                      status,
                    )
                  })
                }
              />
            ) : (
              <DesignSidePanel
                table={selectedTable}
                label={selectedLabel}
                busy={busy}
                newLabelText={newLabelText}
                onNewLabelText={setNewLabelText}
                onUpdateTable={(patch) =>
                  run(async () => {
                    if (!selectedTable) return
                    await floorPlanService.updateLayoutTable(
                      user.id,
                      current.id,
                      selectedTable.id,
                      patch,
                    )
                  })
                }
                onDeleteTable={() =>
                  run(async () => {
                    if (!selectedTable) return
                    await reservationService.deleteTable(
                      user.id,
                      current.id,
                      selectedTable.id,
                    )
                    setSelectedTableId(null)
                    setMessage('Table removed.')
                  })
                }
                onAddLabel={() =>
                  run(async () => {
                    const label = await floorPlanService.createFloorLabel(
                      user.id,
                      current.id,
                      {
                        roomId: activeRoom.id,
                        text: newLabelText,
                        x: 48,
                        y: 40,
                      },
                    )
                    setSelectedLabelId(label.id)
                  })
                }
                onUpdateLabel={(patch) =>
                  run(async () => {
                    if (!selectedLabel) return
                    await floorPlanService.updateFloorLabel(
                      user.id,
                      current.id,
                      selectedLabel.id,
                      patch,
                    )
                  })
                }
                onDeleteLabel={() =>
                  run(async () => {
                    if (!selectedLabel) return
                    await floorPlanService.deleteFloorLabel(
                      user.id,
                      current.id,
                      selectedLabel.id,
                    )
                    setSelectedLabelId(null)
                  })
                }
              />
            )}
          </div>

          <Modal
            open={addTableOpen}
            onClose={() => setAddTableOpen(false)}
            title="Add table"
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setAddTableOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={busy || !activeRoom}
                  onClick={() =>
                    void run(async () => {
                      if (!activeRoom) return
                      const table = await floorPlanService.createLayoutTable(
                        user.id,
                        current.id,
                        {
                          roomId: activeRoom.id,
                          name: newTableName || 'T',
                          seats: newTableSeats,
                          shape: newTableShape,
                          x:
                            80 +
                            tables.filter((t) => t.roomId === activeRoom.id).length * 24,
                          y: 120,
                        },
                      )
                      setSelectedTableId(table.id)
                      setNewTableName('')
                      setAddTableOpen(false)
                      setMessage(`Added ${table.name}.`)
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Place on canvas
                </Button>
              </div>
            }
          >
            <div className="grid gap-3">
              <Field label="Name">
                <Input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="T9"
                  autoFocus
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Seats">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    value={newTableSeats}
                    onChange={(e) => setNewTableSeats(Number(e.target.value) || 1)}
                  />
                </Field>
                <Field label="Shape">
                  <Select
                    value={newTableShape}
                    onChange={(e) => {
                      const shape = e.target.value as DiningTableShape
                      setNewTableShape(shape)
                      if (shape === 'booth') setNewTableSeats(4)
                    }}
                  >
                    {SHAPES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <p className="text-xs text-stone-500">
                Places into {activeRoom?.name ?? 'the current room'}. Drag to reposition on
                the canvas.
              </p>
            </div>
          </Modal>
        </>
      )}
    </div>
  )
}

function TableSidePanel({
  table,
  check,
  room,
  waitlist,
  busy,
  seatName,
  seatParty,
  onSeatName,
  onSeatParty,
  onSeat,
  onSeatReservation,
  onPrintBill,
  onPay,
  onLineStatus,
}: {
  table: DiningTable | null
  check: TableCheck | undefined
  room: DiningRoom
  waitlist: Reservation[]
  busy: boolean
  seatName: string
  seatParty: number
  onSeatName: (v: string) => void
  onSeatParty: (v: number) => void
  onSeat: () => void
  onSeatReservation: (id: string, name: string, party: number) => void
  onPrintBill: () => void
  onPay: () => void
  onLineStatus: (lineId: string, status: TableLineItemStatus) => void
}) {
  if (!table) {
    return (
      <aside className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-500">
        Select a table on the floor to seat guests or review an open check.
      </aside>
    )
  }

  const status = check?.status ?? 'free'
  const meta = STATUS_META[status]
  const totals = check ? floorPlanService.computeCheckTotals(check) : null
  const mins = check
    ? Math.max(0, Math.round((Date.now() - new Date(check.seatedAt).getTime()) / 60_000))
    : null

  return (
    <aside className="flex max-h-[min(82vh,860px)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm xl:max-h-none">
      <div className="border-b border-stone-100 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl text-stone-900">{table.name}</h2>
              {check ? (
                <span className="text-sm text-stone-500">#{check.orderNumber}</span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              {room.name} · Dine-in
              {check?.serverName ? ` · ${check.serverName}` : ''}
            </p>
          </div>
          <span className={cn('rounded-md px-2 py-1 text-xs font-medium', meta.chip)}>
            {meta.label}
          </span>
        </div>

        {check ? (
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-stone-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Guests</p>
              <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-sm font-semibold">
                <Users className="h-3.5 w-3.5" />
                {check.partySize}
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Seated</p>
              <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-sm font-semibold">
                <Clock3 className="h-3.5 w-3.5" />
                {mins}m
              </p>
            </div>
            <div className="rounded-xl bg-stone-50 px-2 py-2">
              <p className="text-[10px] uppercase tracking-wide text-stone-400">Guest</p>
              <p className="mt-0.5 truncate text-sm font-semibold">{check.guestName}</p>
            </div>
          </div>
        ) : null}
      </div>

      {!check ? (
        <div className="space-y-4 overflow-y-auto p-4">
          <div>
            <p className="text-sm font-medium text-stone-800">Seat walk-in</p>
            <div className="mt-2 grid gap-2">
              <Field label="Guest name">
                <Input
                  value={seatName}
                  onChange={(e) => onSeatName(e.target.value)}
                  placeholder="Walk-in guest"
                />
              </Field>
              <Field label="Party size">
                <Input
                  type="number"
                  min={1}
                  max={table.seats}
                  value={seatParty}
                  onChange={(e) => onSeatParty(Number(e.target.value) || 1)}
                />
              </Field>
              <Button disabled={busy} onClick={onSeat}>
                Seat at {table.name}
              </Button>
            </div>
          </div>
          {waitlist.length ? (
            <div>
              <p className="text-sm font-medium text-stone-800">Upcoming bookings</p>
              <ul className="mt-2 space-y-2">
                {waitlist.slice(0, 5).map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-stone-100 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{r.guestName}</p>
                      <p className="text-xs text-stone-500">
                        Party of {r.partySize} ·{' '}
                        {new Date(r.startAt).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy || r.partySize > table.seats}
                      onClick={() => onSeatReservation(r.id, r.guestName, r.partySize)}
                    >
                      Seat
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          {totals && totals.itemCount > 0 ? (
            <div className="border-b border-stone-100 px-4 py-2">
              <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
                <span>
                  {totals.servedCount} of {totals.itemCount} served
                </span>
              </div>
              <div className="flex h-2 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="bg-emerald-500"
                  style={{
                    width: `${Math.round((totals.servedCount / Math.max(1, totals.itemCount)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {check.items.length === 0 ? (
              <li className="rounded-xl border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500">
                No items yet — use the server handheld to fire the first course.
              </li>
            ) : (
              check.items.map((line) => (
                <li
                  key={line.id}
                  className="flex gap-3 rounded-xl border border-stone-100 p-2"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    <MenuItemImage
                      src={line.imageUrl}
                      alt={line.name}
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-stone-900">
                        {line.quantity}× {line.name}
                      </p>
                      <p className="text-sm font-semibold tabular-nums">
                        {formatMoney(line.lineTotalCents)}
                      </p>
                    </div>
                    {line.modifiersNote ? (
                      <p className="text-xs text-stone-500">{line.modifiersNote}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {LINE_STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => onLineStatus(line.id, s)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-medium',
                            line.status === s
                              ? lineTone(s)
                              : 'bg-stone-50 text-stone-400 hover:text-stone-700',
                          )}
                        >
                          {lineLabel(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>

          {totals ? (
            <div className="space-y-1 border-t border-stone-100 px-4 py-3 text-sm">
              <div className="flex justify-between text-stone-500">
                <span>Subtotal</span>
                <span>{formatMoney(totals.subtotalCents)}</span>
              </div>
              {totals.discountCents > 0 ? (
                <div className="flex justify-between text-emerald-700">
                  <span>{check.discountLabel || 'Discount'}</span>
                  <span>-{formatMoney(totals.discountCents)}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-stone-500">
                <span>Tax ({check.taxRatePercent}%)</span>
                <span>{formatMoney(totals.taxCents)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatMoney(totals.totalCents)}</span>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-4 gap-2 border-t border-stone-100 px-3 py-3">
            <Link
              to={`/dashboard/server?table=${table.id}`}
              className="col-span-1 inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[var(--color-accent)] px-2 text-sm font-medium text-white hover:bg-[#bf5524]"
            >
              <Plus className="h-4 w-4" />
              Add
            </Link>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={onPrintBill}
              title="Print bill"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" disabled title="Transfer (soon)">
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" disabled title="Split (soon)">
              <Split className="h-4 w-4" />
            </Button>
          </div>
          <div className="px-3 pb-3">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={busy || !totals || totals.itemCount === 0}
              onClick={onPay}
            >
              <Banknote className="h-4 w-4" />
              Pay table {table.name}
              {totals ? ` · ${formatMoney(totals.totalCents)}` : ''}
            </Button>
          </div>
        </>
      )}
    </aside>
  )
}

function DesignSidePanel({
  table,
  label,
  busy,
  newLabelText,
  onNewLabelText,
  onUpdateTable,
  onDeleteTable,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
}: {
  table: DiningTable | null
  label: FloorLabel | null
  busy: boolean
  newLabelText: string
  onNewLabelText: (v: string) => void
  onUpdateTable: (patch: Partial<DiningTable>) => void
  onDeleteTable: () => void
  onAddLabel: () => void
  onUpdateLabel: (patch: Partial<FloorLabel>) => void
  onDeleteLabel: () => void
}) {
  return (
    <aside className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      {table ? (
        <div>
          <p className="text-sm font-semibold text-stone-900">Selected · {table.name}</p>
          <p className="text-xs text-stone-500">Edits update the live floor immediately.</p>
          <div className="mt-2 grid gap-2">
            <Field label="Name">
              <Input
                value={table.name}
                onChange={(e) => onUpdateTable({ name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Seats">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={table.seats}
                  onChange={(e) =>
                    onUpdateTable({ seats: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </Field>
              <Field label="Shape">
                <Select
                  value={table.shape}
                  onChange={(e) => {
                    const shape = e.target.value as DiningTableShape
                    onUpdateTable(
                      shape === 'booth'
                        ? { shape, seats: Math.max(4, table.seats) }
                        : { shape },
                    )
                  }}
                >
                  {SHAPES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button variant="secondary" disabled={busy} onClick={onDeleteTable}>
              <Trash2 className="h-4 w-4" />
              Remove table
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-semibold text-stone-900">Canvas</p>
          <p className="mt-1 text-sm text-stone-500">
            Click a table to edit, or use Add table above to place a new one.
          </p>
        </div>
      )}

      <div className="border-t border-stone-100 pt-3">
        <p className="text-sm font-semibold text-stone-900">Floor labels</p>
        <div className="mt-2 flex gap-2">
          <Input
            value={newLabelText}
            onChange={(e) => onNewLabelText(e.target.value)}
            placeholder="BAR"
          />
          <Button disabled={busy} onClick={onAddLabel}>
            Add
          </Button>
        </div>
        {label ? (
          <div className="mt-2 flex gap-2">
            <Input
              key={label.id}
              defaultValue={label.text}
              onBlur={(e) => onUpdateLabel({ text: e.target.value })}
            />
            <Button variant="secondary" disabled={busy} onClick={onDeleteLabel}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-stone-500">Click a label on the canvas to edit.</p>
        )}
      </div>
    </aside>
  )
}
