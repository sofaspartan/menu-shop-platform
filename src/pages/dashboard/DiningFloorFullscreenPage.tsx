import { FloorPlanWorkspace } from '@/components/dining/FloorPlanWorkspace'
import { PLATFORM_NAME } from '@/lib/platformBrand'
import { useRestaurantStore } from '@/stores/restaurantStore'

/** Host-stand / seating screen — floor plan without the dashboard chrome. */
export function DiningFloorFullscreenPage() {
  const current = useRestaurantStore((s) => s.current())

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[#eceae6]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-300/80 bg-white px-4 py-2.5 sm:px-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.16em] text-stone-400 uppercase">
            {PLATFORM_NAME} · Floor
          </p>
          <p className="truncate font-display text-lg text-stone-900">
            {current?.name ?? 'Dining floor'}
          </p>
        </div>
        <p className="hidden text-xs text-stone-500 sm:block">
          Full-screen seating map for the host stand
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
        <FloorPlanWorkspace fullscreen showModeTabs showHeader />
      </div>
    </div>
  )
}
