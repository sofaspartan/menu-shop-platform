import { cn } from '@/lib/utils'

export function LiveIndicator({
  label = 'Live',
  className,
  pulseKey,
}: {
  label?: string
  className?: string
  /** Change this when data refreshes to flash the indicator. */
  pulseKey?: string | number
}) {
  return (
    <span
      key={pulseKey}
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700',
        className,
      )}
      title="Updates automatically across open screens"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
    </span>
  )
}
