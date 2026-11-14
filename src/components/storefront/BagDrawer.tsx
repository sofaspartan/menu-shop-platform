import { Link } from 'react-router-dom'
import { Copy, Minus, Plus, Pencil, ShoppingBag, Trash2, X } from 'lucide-react'
import type { Restaurant } from '@/types'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { useBagStore, type BagLine } from '@/stores/bagStore'
import { formatMoney, cn } from '@/lib/utils'
import { trackEvent } from '@/services/analyticsService'

export function BagDrawer({
  open,
  onClose,
  restaurant,
  onEditLine,
}: {
  open: boolean
  onClose: () => void
  restaurant: Restaurant
  onEditLine: (line: BagLine) => void
}) {
  const lines = useBagStore((s) => s.linesFor(restaurant.id))
  const subtotal = useBagStore((s) => s.subtotalFor(restaurant.id))
  const setQuantity = useBagStore((s) => s.setQuantity)
  const removeLine = useBagStore((s) => s.removeLine)
  const duplicateLine = useBagStore((s) => s.duplicateLine)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close bag"
        className="absolute inset-0 bg-stone-900/40 animate-fade-in"
        onClick={onClose}
      />
      <aside
        className={cn(
          'relative z-10 flex h-full w-full max-w-md flex-col bg-[var(--sf-surface,#fff)] shadow-2xl animate-slide-up sm:animate-fade-up',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Your bag"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl text-[var(--sf-text)]">Your bag</h2>
            <p className="text-xs text-[var(--sf-text)]/60">
              {lines.length} {lines.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <EmptyState
              title="Your bag is empty"
              description="Browse the menu and add something delicious."
              icon={<ShoppingBag className="h-10 w-10" />}
              actionLabel="Keep browsing"
              onAction={onClose}
            />
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li
                  key={line.id}
                  className="flex gap-3 border-b border-stone-100 pb-4 last:border-0"
                >
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-[var(--sf-radius,12px)] object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--sf-radius,12px)] bg-stone-100 text-stone-400">
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--sf-text)]">
                          {line.name}
                        </p>
                        {line.modifierLabels.length ? (
                          <p className="mt-0.5 text-xs text-[var(--sf-text)]/55">
                            {line.modifierLabels.join(', ')}
                          </p>
                        ) : null}
                        {line.specialInstructions ? (
                          <p className="mt-0.5 text-xs italic text-[var(--sf-text)]/50">
                            “{line.specialInstructions}”
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 text-sm font-semibold">
                        {formatMoney(line.unitPriceCents * line.quantity)}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <div className="flex items-center gap-1 rounded-lg border border-stone-200">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center text-stone-600 hover:bg-stone-50"
                          aria-label="Decrease quantity"
                          onClick={() => setQuantity(line.id, line.quantity - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center text-stone-600 hover:bg-stone-50"
                          aria-label="Increase quantity"
                          onClick={() => setQuantity(line.id, line.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditLine(line)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => duplicateLine(line.id)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                        onClick={() => {
                          removeLine(line.id)
                          void trackEvent({
                            restaurantId: restaurant.id,
                            type: 'item_remove_from_bag',
                            itemId: line.itemId,
                          })
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.length > 0 ? (
          <div className="border-t border-stone-200 px-5 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-[var(--sf-text)]/70">Subtotal</span>
              <span className="text-lg font-semibold">{formatMoney(subtotal)}</span>
            </div>
            <Link to={`/r/${restaurant.slug}/checkout`} onClick={onClose}>
              <Button
                size="lg"
                className="w-full bg-[var(--sf-button)] text-[var(--sf-button-text)] hover:opacity-90"
              >
                Checkout
              </Button>
            </Link>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
