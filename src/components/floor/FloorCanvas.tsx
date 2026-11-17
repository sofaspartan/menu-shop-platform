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

const SEAT_PAD = 20
const SEAT_W = 16
const SEAT_H = 11
const BENCH_H = 14

type SeatSpot = { left: number; top: number; rotate: number }

/** Chair markers for non-booth tables (capacity around the perimeter). */
export function seatSpotsForTable(table: DiningTable): SeatSpot[] {
  if (table.shape === 'booth') return []

  const seats = Math.max(1, Math.min(16, Math.round(table.seats) || 1))
  const w = table.width
  const h = table.height
  const spots: SeatSpot[] = []

  if (table.shape === 'round' || table.shape === 'bar') {
    const rx = w / 2 + 10
    const ry = h / 2 + 10
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

  // Square / rectangle: distribute around the perimeter, starting at top.
  const perim = 2 * (w + h)
  for (let i = 0; i < seats; i++) {
    const d = ((i + 0.5) / seats) * perim
    let x = 0
    let y = 0
    let rotate = 0
    if (d < w) {
      x = d
      y = -8
      rotate = 0
    } else if (d < w + h) {
      x = w + 8
      y = d - w
      rotate = 90
    } else if (d < 2 * w + h) {
      x = w - (d - w - h)
      y = h + 8
      rotate = 180
    } else {
      x = -8
      y = h - (d - 2 * w - h)
      rotate = -90
    }
    spots.push({
      left: x - SEAT_W / 2,
      top: y - SEAT_H / 2,
      rotate,
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
              borderRadius: '999px 999px 6px 6px',
              transform: `rotate(${spot.rotate}deg)`,
            }}
            title={`Seat ${i + 1}`}
          />
        )
      })}
    </>
  )
}

export function FloorCanvas({
  room,
  tables,
  labels,
  checks,
  selectedTableId,
  onSelectTable,
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
  designMode?: boolean
  onMoveTable?: (tableId: string, x: number, y: number) => void
  selectedLabelId?: string | null
  onSelectLabel?: (label: FloorLabel) => void
  onMoveLabel?: (labelId: string, x: number, y: number) => void
  className?: string
}) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

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
  ) {
    if (!designMode) return
    e.preventDefault()
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const startClientX = e.clientX
    const startClientY = e.clientY

    function onMove(ev: PointerEvent) {
      const dx = (ev.clientX - startClientX) / scale
      const dy = (ev.clientY - startClientY) / scale
      const x = Math.max(0, Math.round(originX + dx))
      const y = Math.max(0, Math.round(originY + dy))
      if (kind === 'table') onMoveTable?.(id, x, y)
      else onMoveLabel?.(id, x, y)
    }
    function onUp(ev: PointerEvent) {
      try {
        target.releasePointerCapture(ev.pointerId)
      } catch {
        /* ignore */
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
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
                onSelectLabel?.(label)
              }}
              onPointerDown={(e) => startDrag(e, 'label', label.id, label.x, label.y)}
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
                if (designMode) startDrag(e, 'table', table.id, table.x, table.y)
              }}
            >
              <TableSeatMarkers table={table} occupied={occupiedSeats} />

              <button
                type="button"
                className={cn(
                  'absolute flex flex-col items-stretch border-2 p-2 text-left shadow-sm transition',
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
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectTable?.(table)
                }}
              >
                {selected ? (
                  <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white shadow">
                    <Check className="h-3 w-3" />
                  </span>
                ) : null}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold text-stone-900">{table.name}</span>
                  {status === 'food_ready' ? (
                    <Bell className="h-3.5 w-3.5 text-teal-600" />
                  ) : (
                    <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                  )}
                </div>
                {!designMode ? (
                  <>
                    <span
                      className={cn(
                        'mt-1 w-fit rounded px-1.5 py-0.5 text-[10px] font-medium',
                        meta.chip,
                      )}
                    >
                      {meta.label}
                    </span>
                    {check ? (
                      <div className="mt-auto space-y-0.5 pt-1 text-[10px] text-stone-600">
                        {totals && totals.totalCents > 0 ? (
                          <p className="font-semibold text-stone-800">
                            {formatMoney(totals.totalCents)}
                          </p>
                        ) : check.notes ? (
                          <p className="truncate italic">{check.notes}</p>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {check.partySize}/{table.seats}
                          </span>
                          {mins != null ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Clock3 className="h-3 w-3" />
                              {mins}m
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-auto text-[10px] text-stone-400">
                        {table.seats} seats
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-auto text-[10px] text-stone-500">
                    {table.shape} · {table.seats}
                  </p>
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
