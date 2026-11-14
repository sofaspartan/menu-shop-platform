import type { RestaurantBranding } from '@/types'
import { FONT_OPTIONS } from '@/types'

const radiusMap = {
  none: '0px',
  sm: '6px',
  md: '12px',
  lg: '16px',
  xl: '24px',
} as const

export function brandingStyleVars(branding: RestaurantBranding): React.CSSProperties {
  const heading =
    FONT_OPTIONS.find((f) => f.id === branding.headingFont)?.stack || FONT_OPTIONS[0].stack
  const body =
    FONT_OPTIONS.find((f) => f.id === branding.bodyFont)?.stack || FONT_OPTIONS[3].stack

  return {
    ['--brand-primary' as string]: branding.primaryColor,
    ['--brand-secondary' as string]: branding.secondaryColor,
    ['--brand-accent' as string]: branding.accentColor,
    ['--brand-bg' as string]: branding.backgroundColor,
    ['--brand-surface' as string]: branding.surfaceColor,
    ['--brand-text' as string]: branding.textColor,
    ['--brand-button' as string]: branding.buttonColor,
    ['--brand-button-text' as string]: branding.buttonTextColor,
    ['--brand-heading' as string]: heading,
    ['--brand-body' as string]: body,
    ['--brand-radius' as string]: radiusMap[branding.borderRadius],
  }
}
