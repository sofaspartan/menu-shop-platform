import { useState } from 'react'
import { Package, UtensilsCrossed } from 'lucide-react'
import type { StoreKind } from '@/types'
import { cn } from '@/lib/utils'

export function MenuItemImage({
  src,
  alt = '',
  className,
  fallbackClassName,
  storeKind = 'restaurant',
}: {
  src?: string
  alt?: string
  className?: string
  fallbackClassName?: string
  /** Retail uses a product placeholder; restaurant keeps utensils. */
  storeKind?: StoreKind
}) {
  const [failed, setFailed] = useState(false)
  const Icon = storeKind === 'retail' ? Package : UtensilsCrossed

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-[color-mix(in_srgb,var(--sf-primary,var(--brand-primary))_10%,white)] text-[var(--sf-primary,var(--brand-primary))]/50',
          fallbackClassName || className,
        )}
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        <Icon className="h-[28%] w-[28%] max-h-12 max-w-12 min-h-7 min-w-7" />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  )
}
