import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
  wide,
  style,
  shell,
  hideHeader,
  bodyClassName,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  wide?: boolean
  /** Applied to the portal root so CSS variables survive createPortal(document.body). */
  style?: React.CSSProperties
  /** Adds storefront-vars so --sf-* aliases resolve inside the portal. */
  shell?: boolean
  /** Skip the default title bar; caller can place its own close control. */
  hideHeader?: boolean
  bodyClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4',
        shell && 'storefront-vars',
      )}
      style={style}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-stone-900/50 animate-fade-in"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        className={cn(
          'relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl animate-slide-up sm:max-h-[85vh] sm:rounded-2xl sm:animate-fade-up',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
          className,
        )}
      >
        {hideHeader ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 h-10 w-10 shrink-0 rounded-full bg-white/90 shadow-sm backdrop-blur"
          >
            <X className="h-5 w-5" />
          </Button>
        ) : (
          <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 py-4">
            <h2 className="font-display text-xl text-stone-900">
              {title || 'Dialog'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        )}
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto px-5 py-4',
            bodyClassName,
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
