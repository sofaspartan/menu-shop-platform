import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Clock3, Users } from 'lucide-react'
import type {
  DiningRoom,
  DiningTable,
  DiningTableShape,
  FloorLabel,
  TableCheck,
  TableServiceStatus,
} from '@/types'
import { normalizeDiningTable } from '@/types'
import {
  computeCheckTotals,
  openCheckForTable,
  serviceStatusForTable,
} from '@/services/floorPlanService'
import { cn, formatMoney } from '@/lib/utils'

export const STATUS_META: Record<
  TableServiceStatus | 'free',
  { label: string; dot: string; ring: string; chip: string }
> = {
  free: {
    label: 'Free',
    dot: 'bg-emerald-500',
    ring: 'border-emerald-300 bg-white',
    chip: 'bg-emerald-50 text-emerald-800',
  },
  seated: {
    label: 'Seated',
    dot: 'bg-sky-500',
    ring: 'border-sky-400 bg-sky-50',
    chip: 'bg-sky-50 text-sky-800',
  },
  ordered: {
    label: 'Ordered',
    dot: 'bg-orange-500',
    ring: 'border-orange-400 bg-orange-50',
    chip: 'bg-orange-50 text-orange-900',
  },
  food_ready: {
    label: 'Food ready',
    dot: 'bg-teal-500',
    ring: 'border-teal-400 bg-teal-50',
    chip: 'bg-teal-50 text-teal-900',
  },
  bill_printed: {
    label: 'Bill printed',
    dot: 'bg-violet-500',
    ring: 'border-violet-400 bg-violet-50',
    chip: 'bg-violet-50 text-violet-900',
  },
}

/** Booths stay rounded rectangles (not pill/circle); others keep their silhouette. */
export function shapeRadius(shape: DiningTableShape): string {
  if (shape === 'round' || shape === 'bar') return '9999px'
  if (shape === 'booth') return '22px'
  if (shape === 'rectangle') return '16px'
  return '14px'
}

const SEAT_PAD = 22
const SEAT_W = 15
const SEAT_H = 10
const BENCH_H = 14
/** Distance from table edge to seat center. */
const SEAT_OUT = 11

type SeatSpot = { left: number; top: number; rotate: number }

function splitRectSeats(n: number): {
  top: number
  right: number
  bottom: number
  left: number
} {
  if (n <= 0) return { top: 0, right: 0, bottom: 0, left: 0 }
  if (n === 1) return { top: 1, right: 0, bottom: 0, left: 0 }
  if (n === 2) return { top: 1, right: 0, bottom: 1, left: 0 }
  if (n === 3) return { top: 1, right: 1, bottom: 1, left: 0 }
  // 4+: one on each short side, rest on long sides (top/bottom).
  const long = n - 2
  return {
    top: Math.ceil(long / 2),
    right: 1,
    bottom: Math.floor(long / 2),
    left: 1,
  }
}

function alongEdge(count: number, length: number, inset: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [length / 2]
  const usable = Math.max(0, length - inset * 2)
  return Array.from({ length: count }, (_, i) => inset + (usable * i) / (count - 1))
}

/** Chair markers for non-booth tables (capacity around the perimeter). */
export function seatSpotsForTable(table: DiningTable): SeatSpot[] {
  if (table.shape === 'booth') return []

  const seats = Math.max(1, Math.min(16, Math.round(table.seats) || 1))
  const w = table.width
  const h = table.height
  const spots: SeatSpot[] = []

  if (table.shape === 'round' || table.shape === 'bar') {
    const rx = w / 2 + SEAT_OUT
    const ry = h / 2 + SEAT_OUT
    for (let i = 0; i < seats; i++) {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / seats
      const cx = w / 2 + Math.cos(angle) * rx
      const cy = h / 2 + Math.sin(angle) * ry
      spots.push({
        left: cx - SEAT_W / 2,
        top: cy - SEAT_H / 2,
        rotate: (angle * 180) / Math.PI + 90,
      })
    }
    return spots
  }

  const sides = splitRectSeats(seats)
  const insetX = Math.min(w * 0.22, Math.max(18, w / (Math.max(sides.top, sides.bottom, 2) + 1)))
  const insetY = Math.min(h * 0.22, Math.max(16, h / (Math.max(sides.left, sides.right, 2) + 1)))

  for (const x of alongEdge(sides.top, w, insetX)) {
    spots.push({
      left: x - SEAT_W / 2,
      top: -SEAT_OUT - SEAT_H / 2,
      rotate: 0,
    })
  }
  for (const y of alongEdge(sides.right, h, insetY)) {
    spots.push({
      left: w + SEAT_OUT - SEAT_W / 2,
      top: y - SEAT_H / 2,
      rotate: 90,
    })
  }
  for (const x of alongEdge(sides.bottom, w, insetX)) {
    spots.push({
      left: x - SEAT_W / 2,
      top: h + SEAT_OUT - SEAT_H / 2,
      rotate: 180,
    })
  }
  for (const y of alongEdge(sides.left, h, insetY)) {
    spots.push({
      left: -SEAT_OUT - SEAT_W / 2,
      top: y - SEAT_H / 2,
      rotate: -90,
    })
  }
  return spots
}

/** Booth = two long banquettes (top + bottom), typically 2+2. */
function boothBenchMeta(table: DiningTable) {
  const seats = Math.max(2, Math.min(12, Math.round(table.seats) || 4))
  const topCap = Math.ceil(seats / 2)
  const bottomCap = Math.floor(seats / 2)
  return { seats, topCap, bottomCap }
}

function seatedMinutes(check: TableCheck | undefined): number | null {
  if (!check) return null
  return Math.max(0, Math.round((Date.now() - new Date(check.seatedAt).getTime()) / 60_000))
}

function BoothBenches({
  table,
  occupied,
}: {
  table: DiningTable
  occupied: number
}) {
  const { topCap, bottomCap } = boothBenchMeta(table)
  const topFilled = Math.min(topCap, occupied)
  const bottomFilled = Math.min(bottomCap, Math.max(0, occupied - topCap))
  const benchWidth = Math.max(48, table.width - 8)

  function Bench({
    side,
    capacity,
    filled,
  }: {
    side: 'top' | 'bottom'
    capacity: number
    filled: number
  }) {
    const active = filled > 0
    return (
      <span
        aria-hidden
        title={`${side} bench · ${filled}/${capacity}`}
        className={cn(
          'pointer-events-none absolute z-10 flex items-center justify-center border shadow-sm',
          active
            ? 'border-stone-500 bg-stone-500 text-white'
            : 'border-stone-400 bg-[#cfcbc7] text-stone-600',
        )}
        style={{
          left: SEAT_PAD + (table.width - benchWidth) / 2,
          top:
            side === 'top'
              ? SEAT_PAD - BENCH_H - 3
              : SEAT_PAD + table.height + 3,
          width: benchWidth,
          height: BENCH_H,
          borderRadius: side === 'top' ? '10px 10px 4px 4px' : '4px 4px 10px 10px',
        }}
      >
        <span className="text-[9px] font-semibold tabular-nums leading-none">
          {capacity}
        </span>
      </span>
    )
  }

  return (
    <>
      <Bench side="top" capacity={topCap} filled={topFilled} />
      <Bench side="bottom" capacity={bottomCap} filled={bottomFilled} />
    </>
  )
}

function TableSeatMarkers({
  table,
  occupied,
}: {
  table: DiningTable
  occupied: number
}) {
  if (table.shape === 'booth') {
    return <BoothBenches table={table} occupied={occupied} />
  }

  const spots = seatSpotsForTable(table)
  return (
    <>
      {spots.map((spot, i) => {
        const filled = i < occupied
        return (
          <span
            key={`${table.id}-seat-${i}`}
            aria-hidden
            className={cn(
              'pointer-events-none absolute z-10 block border shadow-sm',
              filled
                ? 'border-stone-500 bg-stone-500'
                : 'border-stone-400 bg-[#d6d3d1]',
            )}
            style={{
              left: SEAT_PAD + spot.left,
              top: SEAT_PAD + spot.top,
              width: SEAT_W,
              height: SEAT_H,
              borderRadius: '999px 999px 5px 5px',
              transform: `rotate(${spot.rotate}deg)`,
            }}
            title={`Seat ${i + 1}`}
          />
        )
      })}
    </>
  )
}

function TableCardContent({
  table,
  designMode,
  status,
  meta,
  check,
  totals,
  mins,
}: {
  table: DiningTable
  designMode: boolean
  status: TableServiceStatus | 'free'
  meta: (typeof STATUS_META)[TableServiceStatus | 'free']
  check: TableCheck | undefined
  totals: ReturnType<typeof computeCheckTotals> | null
  mins: number | null
}) {
  const compact = table.width < 110 || table.height < 88

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-0.5 overflow-hidden px-1.5 py-1 text-center">
      <div className="flex max-w-full items-center justify-center gap-1">
        <span className="truncate text-[11px] font-bold leading-tight text-stone-900 sm:text-xs">
          {table.name}
        </span>
        {status === 'food_ready' ? (
          <Bell className="h-3 w-3 shrink-0 text-teal-600" />
        ) : (
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
        )}
      </div>

      {designMode ? (
        <p className="truncate text-[10px] leading-tight text-stone-500">
          {table.seats} seats
        </p>
      ) : (
        <>
          {!compact ? (
            <span
              className={cn(
                'max-w-full truncate rounded px-1.5 py-0.5 text-[9px] font-medium leading-none',
                meta.chip,
              )}
            >
              {meta.label}
            </span>
          ) : null}
          {check ? (
            <div className="mt-0.5 max-w-full space-y-0.5 text-[9px] leading-tight text-stone-600">
              {totals && totals.totalCents > 0 ? (
                <p className="truncate font-semibold text-stone-800">
                  {formatMoney(totals.totalCents)}
                </p>
              ) : check.notes ? (
                <p className="truncate italic">{check.notes}</p>
              ) : null}
              <div className="flex items-center justify-center gap-1.5">
                <span className="inline-flex items-center gap-0.5">
                  <Users className="h-2.5 w-2.5" />
                  {check.partySize}/{table.seats}
                </span>
                {mins != null ? (
                  <span className="inline-flex items-center gap-0.5">
                    <Clock3 className="h-2.5 w-2.5" />
                    {mins}m
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="truncate text-[9px] leading-tight text-stone-400">
              {compact ? meta.label : `${table.seats} seats`}
            </p>
          )}
        </>
      )}
    </div>
  )
}

export function FloorCanvas({
  room,
  tables,
  labels,
  checks,
  selectedTableId,
  onSelectTable,
  onClearSelection,
  designMode = false,
  onMoveTable,
  selectedLabelId,
  onSelectLabel,
  onMoveLabel,
  className,
}: {
  room: DiningRoom
  tables: DiningTable[]
  labels: FloorLabel[]
  checks: TableCheck[]
  selectedTableId?: string | null
  onSelectTable?: (table: DiningTable) => void
  onClearSelection?: () => void
  designMode?: boolean
  onMoveTable?: (tableId: string, x: number, y: number) => void
  selectedLabelId?: string | null
  onSelectLabel?: (label: FloorLabel) => void
  onMoveLabel?: (labelId: string, x: number, y: number) => void
  className?: string
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const dragMoved = useRef(false)

  useEffect(() => {
    const el = shellRef.current
    if (!el) return
    const apply = () => setScale(el.clientWidth / room.canvasWidth)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [room.canvasWidth, room.id])

  const roomTables = tables
    .filter((t) => t.roomId === room.id && t.active !== false)
    .map((t) => normalizeDiningTable(t))

  function startDrag(
    e: React.PointerEvent,
    kind: 'table' | 'label',
    id: string,
    originX: number,
    originY: number,
    onSelect?: () => void,
  ) {
    if (!designMode) return
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    const startClientX = e.clientX
    const startClientY = e.clientY
    dragMoved.current = false
    let dragging = false

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startClientX) / scale
      const dy = (ev.clientY - startClientY) / scale
      if (!dragging) {
        if (Math.hypot(dx, dy) < 4) return
        dragging = true
        dragMoved.current = true
        try {
          target.setPointerCapture(pointerId)
        } catch {
          /* ignore */
        }
      }
      const x = Math.max(0, Math.round(originX + dx))
      const y = Math.max(0, Math.round(originY + dy))
      if (kind === 'table') onMoveTable?.(id, x, y)
      else onMoveLabel?.(id, x, y)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      try {
        target.releasePointerCapture(pointerId)
      } catch {
        /* ignore */
      }
      if (!dragMoved.current) onSelect?.()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      ref={shellRef}
      data-floor-canvas
      className={cn(
        'relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-[#f3f4f6]',
        className,
      )}
      style={{
        aspectRatio: `${room.canvasWidth} / ${room.canvasHeight}`,
        backgroundImage: 'radial-gradient(circle, #d6d3d1 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
      onClick={() => onClearSelection?.()}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: room.canvasWidth,
          height: room.canvasHeight,
          transform: `scale(${scale})`,
        }}
      >
        {labels
          .filter((l) => l.roomId === room.id)
          .map((label) => (
            <button
              key={label.id}
              type="button"
              className={cn(
                'absolute z-10 rounded-md border border-dashed border-stone-300 bg-white/70 px-2 py-1 text-[10px] font-semibold tracking-[0.14em] text-stone-500 uppercase',
                designMode && 'cursor-grab active:cursor-grabbing',
                selectedLabelId === label.id && 'border-orange-400 ring-2 ring-orange-300',
              )}
              style={{ left: label.x, top: label.y }}
              onClick={(e) => {
                e.stopPropagation()
                if (!designMode || !dragMoved.current) onSelectLabel?.(label)
              }}
              onPointerDown={(e) =>
                startDrag(e, 'label', label.id, label.x, label.y, () => onSelectLabel?.(label))
              }
            >
              {label.text}
            </button>
          ))}

        {roomTables.map((table) => {
          const status = serviceStatusForTable(checks, table.id)
          const meta = STATUS_META[status]
          const check = openCheckForTable(checks, table.id)
          const totals = check ? computeCheckTotals(check) : null
          const mins = seatedMinutes(check)
          const selected = selectedTableId === table.id
          const occupiedSeats = check?.partySize ?? 0

          return (
            <div
              key={table.id}
              className={cn(
                'absolute z-20',
                selected && 'z-30',
                designMode && 'cursor-grab active:cursor-grabbing',
              )}
              style={{
                left: table.x - SEAT_PAD,
                top: table.y - SEAT_PAD,
                width: table.width + SEAT_PAD * 2,
                height: table.height + SEAT_PAD * 2,
                transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
              }}
              onPointerDown={(e) => {
                if (!designMode) return
                startDrag(e, 'table', table.id, table.x, table.y, () => onSelectTable?.(table))
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (designMode) return
                onSelectTable?.(table)
              }}
            >
              <TableSeatMarkers table={table} occupied={occupiedSeats} />

              <div
                className={cn(
                  'absolute border-2 shadow-sm transition',
                  meta.ring,
                  selected && 'border-orange-500 ring-4 ring-orange-300',
                )}
                style={{
                  left: SEAT_PAD,
                  top: SEAT_PAD,
                  width: table.width,
                  height: table.height,
                  borderRadius: shapeRadius(table.shape),
                }}
              >
                {selected ? (
                  <span className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
                <TableCardContent
                  table={table}
                  designMode={designMode}
                  status={status}
                  meta={meta}
                  check={check}
                  totals={totals}
                  mins={mins}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
