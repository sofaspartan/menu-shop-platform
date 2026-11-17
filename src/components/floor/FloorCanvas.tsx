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

export function shapeRadius(shape: DiningTableShape): string {
  if (shape === 'round' || shape === 'bar') return '9999px'
  if (shape === 'booth') return '18px 18px 10px 10px'
  return '14px'
}

function seatedMinutes(check: TableCheck | undefined): number | null {
  if (!check) return null
  return Math.max(0, Math.round((Date.now() - new Date(check.seatedAt).getTime()) / 60_000))
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

          return (
            <button
              key={table.id}
              type="button"
              className={cn(
                'absolute z-20 flex flex-col items-stretch border-2 p-2 text-left shadow-sm transition',
                meta.ring,
                designMode && 'cursor-grab active:cursor-grabbing',
                selected && 'z-30 border-orange-500 ring-4 ring-orange-300',
              )}
              style={{
                left: table.x,
                top: table.y,
                width: table.width,
                height: table.height,
                borderRadius: shapeRadius(table.shape),
                transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectTable?.(table)
              }}
              onPointerDown={(e) => {
                if (designMode) startDrag(e, 'table', table.id, table.x, table.y)
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
                          {check.partySize}
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
                    <p className="mt-auto text-[10px] text-stone-400">{table.seats} seats</p>
                  )}
                </>
              ) : (
                <p className="mt-auto text-[10px] text-stone-500">
                  {table.shape} · {table.seats}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
