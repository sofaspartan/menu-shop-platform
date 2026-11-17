import { ShoppingBag } from 'lucide-react'
import { storeCopy } from '@/lib/storeCopy'
import { formatMoney, cn } from '@/lib/utils'
import type { StoreKind } from '@/types'

export function RetailBagFab({
  storeKind,
  bagCount,
  bagSubtotal,
  bagPulse,
  bagCatchExpanded,
  onOpen,
}: {
  storeKind: StoreKind
  bagCount: number
  bagSubtotal: number
  bagPulse?: boolean
  bagCatchExpanded?: boolean
  onOpen: () => void
}) {
  const copy = storeCopy(storeKind)
  const pulse = Boolean(bagPulse)

  return (
    <>
      {bagCatchExpanded && bagCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 p-4 sm:hidden">
          <button
            type="button"
            data-bag-target
            onClick={onOpen}
            className={cn(
              'flex w-full items-center justify-between rounded-2xl bg-[var(--sf-button)] px-5 py-4 text-[var(--sf-button-text)] shadow-lg',
              pulse && 'bag-catch-pulse',
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              <ShoppingBag className="h-5 w-5" />
              {copy.viewBag} · {bagCount}
            </span>
            <span className="font-semibold">{formatMoney(bagSubtotal)}</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-bag-target
          onClick={onOpen}
          className={cn(
            'fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-2xl bg-[var(--sf-button)] px-3.5 py-3 text-[var(--sf-button-text)] shadow-lg sm:hidden',
            pulse && 'bag-catch-pulse',
          )}
          aria-label={`Open ${copy.bagNoun}`}
        >
          <ShoppingBag className="h-5 w-5" />
          <span className="font-medium">
            {copy.bagNounTitle}
            {bagCount > 0 ? ` · ${bagCount}` : ''}
          </span>
          {bagCount > 0 ? (
            <span className="text-sm opacity-90">{formatMoney(bagSubtotal)}</span>
          ) : null}
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
        <ShoppingBag className="h-5 w-5" />
        <span className="font-medium">
          {copy.bagNounTitle}
          {bagCount > 0 ? ` · ${bagCount}` : ''}
        </span>
        {bagCount > 0 ? (
          <span className="text-sm opacity-90">{formatMoney(bagSubtotal)}</span>
        ) : null}
      </button>
    </>
  )
}
