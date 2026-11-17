import { ShoppingBag } from 'lucide-react'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'
import type { StoreKind } from '@/types'

export function RetailBagFab({
  storeKind,
  bagCount,
  bagPulse,
  bagCatchExpanded,
  onOpen,
}: {
  storeKind: StoreKind
  bagCount: number
  bagPulse?: boolean
  bagCatchExpanded?: boolean
  onOpen: () => void
}) {
  const copy = storeCopy(storeKind)
  const pulse = Boolean(bagPulse)

  const label = (
    <>
      <ShoppingBag className="h-5 w-5" />
      <span className="font-medium">{copy.viewBag}</span>
      {bagCount > 0 ? (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--sf-button-text)]/20 px-1.5 text-sm font-semibold">
          {bagCount}
        </span>
      ) : null}
    </>
  )

  return (
    <>
      {bagCatchExpanded && bagCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4 sm:hidden">
          <button
            type="button"
            data-bag-target
            onClick={onOpen}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--sf-button)] px-5 py-4 text-[var(--sf-button-text)] shadow-lg',
              pulse && 'bag-catch-pulse',
            )}
          >
            {label}
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-bag-target
          onClick={onOpen}
          className={cn(
            'fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-2xl bg-[var(--sf-button)] px-4 py-3 text-[var(--sf-button-text)] shadow-lg sm:hidden',
            pulse && 'bag-catch-pulse',
          )}
          aria-label={`Open ${copy.bagNoun}`}
        >
          {label}
        </button>
      )}

      <button
        type="button"
        data-bag-target
        onClick={onOpen}
        className={cn(
          'fixed bottom-6 right-6 z-30 hidden items-center gap-2 rounded-2xl bg-[var(--sf-button)] px-4 py-3 text-[var(--sf-button-text)] shadow-lg transition-transform hover:-translate-y-0.5 sm:inline-flex',
          pulse && 'bag-catch-pulse',
        )}
        aria-label={`Open ${copy.bagNoun}`}
      >
        {label}
      </button>
    </>
  )
}
