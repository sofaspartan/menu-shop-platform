import { formatMoney, cn } from '@/lib/utils'

/** List + sale price with strikethrough when discounted. */
export function PriceDisplay({
  listPriceCents,
  priceCents,
  onSale,
  className,
  size = 'md',
}: {
  listPriceCents: number
  priceCents: number
  onSale?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sale = onSale ?? priceCents < listPriceCents
  const currentClass =
    size === 'lg'
      ? 'text-xl'
      : size === 'sm'
        ? 'text-sm'
        : 'text-base'
  const listClass =
    size === 'lg'
      ? 'text-base'
      : size === 'sm'
        ? 'text-xs'
        : 'text-sm'

  if (!sale) {
    return (
      <span className={cn(currentClass, 'text-[var(--sf-text)]', className)}>
        {formatMoney(priceCents)}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', className)}>
      <span className={cn(currentClass, 'font-semibold text-[var(--sf-primary)]')}>
        {formatMoney(priceCents)}
      </span>
      <span
        className={cn(
          listClass,
          'text-[var(--sf-text)]/45 line-through decoration-[var(--sf-text)]/40',
        )}
      >
        {formatMoney(listPriceCents)}
      </span>
    </span>
  )
}
