import { Button } from '@/components/ui/Button'

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-16 text-center">
      {icon ? <div className="mb-4 text-stone-400">{icon}</div> : null}
      <h3 className="font-display text-xl text-stone-900">{title}</h3>
      {description ? (
        <p className="mt-2 max-w-md text-sm text-stone-500">{description}</p>
      ) : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
