import type {
  CoverHeroAlign,
  CoverHeroHeight,
  PageHeaderStyle,
  PageHeroOptions,
  StorefrontWidth,
} from '@/types'
import { normalizePageHero } from '@/types'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'

export function StorePageHeader({
  title,
  subtitle,
  headerStyle,
  heroImageUrl,
  hero,
  storefrontWidth,
}: {
  title: string
  subtitle?: string
  headerStyle: PageHeaderStyle
  heroImageUrl?: string
  hero?: Partial<PageHeroOptions> | null
  storefrontWidth?: StorefrontWidth | null
}) {
  const contentClass = storefrontContentClass(storefrontWidth)
  const options = normalizePageHero(hero)
  const useCover = headerStyle === 'cover' && Boolean(heroImageUrl?.trim())

  const showTitle = options.showTitle && Boolean(title?.trim())
  const showSubtitle = options.showSubtitle && Boolean(subtitle?.trim())
  const showButton =
    options.showButton &&
    Boolean(options.buttonLabel?.trim()) &&
    Boolean(options.buttonHref?.trim())
  const href = showButton ? options.buttonHref!.trim() : undefined
  const external = Boolean(href && /^https?:\/\//i.test(href))

  const copy = (
    <HeroCopy
      title={showTitle ? title : undefined}
      subtitle={showSubtitle ? subtitle : undefined}
      buttonLabel={showButton ? options.buttonLabel : undefined}
      buttonHref={href}
      external={external}
      align={options.align}
      onLight={!useCover}
    />
  )

  if (useCover) {
    return (
      <div className="relative w-full overflow-hidden">
        <div
          className={cn(
            'relative w-full',
            heightClass(options.height),
          )}
        >
          <img
            src={heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {options.align === 'centerMiddle' ? (
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/35 to-black/20" />
          ) : (
            <div className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          )}
          <div
            className={cn(
              contentClass,
              options.align === 'centerMiddle'
                ? 'absolute inset-0 flex items-center justify-center py-10 text-center'
                : cn(
                    'absolute inset-x-0 bottom-0 pb-8 pt-16 sm:pb-10',
                    options.align === 'centerBottom' && 'flex justify-center text-center',
                  ),
            )}
          >
            {copy}
          </div>
        </div>
      </div>
    )
  }

  if (!showTitle && !showSubtitle && !showButton) return null

  return (
    <div
      className={cn(
        contentClass,
        'pt-10',
        (options.align === 'centerBottom' || options.align === 'centerMiddle') &&
          'flex justify-center text-center',
      )}
    >
      {copy}
    </div>
  )
}

function heightClass(height: CoverHeroHeight) {
  return height === 'tall'
    ? 'aspect-[16/11] min-h-[320px] max-h-[640px] sm:min-h-[420px] sm:aspect-[21/10]'
    : 'aspect-[21/9] min-h-[200px] max-h-[360px] sm:min-h-[260px]'
}

function HeroCopy({
  title,
  subtitle,
  buttonLabel,
  buttonHref,
  external,
  align,
  onLight,
}: {
  title?: string
  subtitle?: string
  buttonLabel?: string
  buttonHref?: string
  external?: boolean
  align: CoverHeroAlign
  onLight?: boolean
}) {
  if (!title && !subtitle && !buttonLabel) return null

  const ctaClass = cn(
    'mt-5 inline-flex items-center rounded-2xl px-5 py-2.5 text-base font-medium transition-transform hover:-translate-y-0.5',
    onLight ? 'bg-[var(--sf-button)] text-[var(--sf-button-text)]' : 'bg-white text-stone-900',
  )

  return (
    <div
      className={cn(
        'max-w-2xl',
        (align === 'centerBottom' || align === 'centerMiddle') && 'mx-auto',
      )}
    >
      {title ? (
        <h1
          className={cn(
            'font-display text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl',
            onLight ? 'text-[var(--sf-text)]' : 'text-white',
          )}
        >
          {title}
        </h1>
      ) : null}
      {subtitle ? (
        <p
          className={cn(
            'text-base leading-relaxed sm:text-lg',
            title ? 'mt-3' : '',
            onLight ? 'text-[var(--sf-text)]/70' : 'text-white/95',
          )}
        >
          {subtitle}
        </p>
      ) : null}
      {buttonLabel && buttonHref ? (
        external ? (
          <a href={buttonHref} target="_blank" rel="noreferrer" className={ctaClass}>
            {buttonLabel}
          </a>
        ) : (
          <a href={buttonHref} className={ctaClass}>
            {buttonLabel}
          </a>
        )
      ) : null}
    </div>
  )
}
