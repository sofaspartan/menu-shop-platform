import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

export function MenuItemImage({
  src,
  alt = '',
  className,
  fallbackClassName,
}: {
  src?: string
  alt?: string
  className?: string
  fallbackClassName?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-[color-mix(in_srgb,var(--sf-primary)_10%,white)] text-[var(--sf-primary)]/50',
          fallbackClassName || className,
        )}
        aria-hidden={alt ? undefined : true}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        <UtensilsCrossed className="h-7 w-7" />
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
