import type { StorefrontWidth } from '@/types'
import { cn } from '@/lib/utils'

export function resolveStorefrontWidth(
  width?: StorefrontWidth | null,
): StorefrontWidth {
  return width === 'full' ? 'full' : 'margined'
}

/** Outer content column for retail chrome / shop grids. */
export function storefrontContentClass(width?: StorefrontWidth | null) {
  const resolved = resolveStorefrontWidth(width)
  return cn(
    'w-full px-4 sm:px-6 lg:px-8',
    resolved === 'margined' ? 'mx-auto max-w-6xl' : 'mx-auto max-w-[1600px]',
  )
}
