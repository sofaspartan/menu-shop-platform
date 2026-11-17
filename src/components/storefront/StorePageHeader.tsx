import type { PageHeaderStyle } from '@/types'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'
import type { StorefrontWidth } from '@/types'

export function StorePageHeader({
  title,
  subtitle,
  headerStyle,
  heroImageUrl,
  storefrontWidth,
}: {
  title: string
  subtitle?: string
  headerStyle: PageHeaderStyle
  heroImageUrl?: string
  storefrontWidth?: StorefrontWidth | null
}) {
  const contentClass = storefrontContentClass(storefrontWidth)
  const useCover = headerStyle === 'cover' && Boolean(heroImageUrl?.trim())

  if (useCover) {
    return (
      <div className="relative aspect-[21/9] min-h-[240px] max-h-[440px] w-full overflow-hidden">
        <img
          src={heroImageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/75 via-black/35 to-transparent" />
        <div className={cn(contentClass, 'absolute inset-x-0 bottom-0 pb-8 pt-16')}>
          <h1 className="max-w-3xl font-display text-4xl text-white drop-shadow sm:text-5xl">
            {title}
          </h1>
          {subtitle?.trim() ? (
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
              {subtitle.trim()}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className={cn(contentClass, 'pt-10')}>
      <div className="max-w-3xl">
        <h1 className="font-display text-4xl text-[var(--sf-text)] sm:text-5xl">{title}</h1>
        {subtitle?.trim() ? (
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-[var(--sf-text)]/70">
            {subtitle.trim()}
          </p>
        ) : null}
      </div>
    </div>
  )
}
