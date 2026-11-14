import type { RestaurantBranding } from '@/types'
import { brandingStyleVars } from '@/lib/brandingCss'
import { cn } from '@/lib/utils'

export function StorefrontShell({
  branding,
  children,
  className,
}: {
  branding: RestaurantBranding
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('storefront-shell min-h-screen', className)}
      style={brandingStyleVars(branding)}
    >
      {children}
    </div>
  )
}
