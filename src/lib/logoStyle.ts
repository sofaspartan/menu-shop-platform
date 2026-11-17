import { cn } from '@/lib/utils'

/** How logos render on displays and homepage heroes. */
export type LogoStyle = 'roundedSquare' | 'natural'

export function normalizeLogoStyle(raw?: string | null): LogoStyle {
  return raw === 'natural' ? 'natural' : 'roundedSquare'
}

/** Classes for a logo image given style + size preset. */
export function logoImageClass(
  style: LogoStyle,
  size: 'header' | 'brandingCard' | 'brandingHero' | 'splash' | 'footer' | 'about',
): string {
  if (style === 'natural') {
    // Transparent / wide logos: cap height, free width, contain.
    const heights: Record<typeof size, string> = {
      header: 'h-10 max-w-[11rem] sm:h-12 sm:max-w-[14rem]',
      brandingCard: 'h-14 max-w-[16rem] sm:h-16',
      brandingHero: 'h-20 max-w-[22rem] sm:h-28 sm:max-w-[28rem]',
      splash: 'h-24 max-w-[min(90vw,28rem)] sm:h-32 sm:max-w-[36rem]',
      footer: 'h-8 max-w-[10rem]',
      about: 'h-12 max-w-[14rem]',
    }
    return cn(heights[size], 'w-auto object-contain')
  }

  const boxes: Record<typeof size, string> = {
    header: 'h-12 w-12 rounded-xl object-cover shadow-sm',
    brandingCard: 'h-16 w-16 rounded-2xl object-cover shadow-lg ring-1 ring-white/20',
    brandingHero:
      'mb-0 h-28 w-28 rounded-[1.75rem] object-cover shadow-2xl ring-1 ring-white/25 sm:h-36 sm:w-36',
    splash:
      'h-28 w-28 rounded-[1.75rem] object-cover shadow-2xl ring-1 ring-white/25 sm:h-36 sm:w-36',
    footer: 'h-10 w-10 rounded-xl object-cover',
    about: 'h-14 w-14 rounded-2xl object-cover',
  }
  return boxes[size]
}
