import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb } from '@/hooks/useDb'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { brandingStyleVars } from '@/lib/brandingCss'
import { buildDisplaySlides, type BoardSlide } from '@/lib/displayBoard'
import { normalizeDisplay } from '@/lib/normalizeDisplay'
import { storeCopy } from '@/lib/storeCopy'
import { cn, formatMoney } from '@/lib/utils'

export function DisplayBoardPage() {
  const { slug, displaySlug } = useParams<{ slug: string; displaySlug: string }>()
  const { db, loading, revision, lastSyncedAt } = useDb({ pollMs: 2000 })
  const [now, setNow] = useState(() => new Date())
  const [slideIndex, setSlideIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // TV boards are fixed to the viewport — never scroll.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [])

  const restaurant = useMemo(() => {
    if (!db || !slug) return null
    return db.restaurants.find((r) => r.slug === slug) ?? null
  }, [db, slug])

  const display = useMemo(() => {
    if (!db || !restaurant || !displaySlug) return null
    const raw = (db.displays ?? []).find(
      (d) =>
        d.restaurantId === restaurant.id &&
        d.slug === displaySlug &&
        d.active,
    )
    return raw ? normalizeDisplay(raw) : null
  }, [db, restaurant, displaySlug])

  const slides = useMemo(() => {
    if (!db || !restaurant || !display) return [] as BoardSlide[]
    return buildDisplaySlides(db, restaurant, display, now)
  }, [db, restaurant, display, now, revision])

  const durationMs = Math.max(3, display?.slideDurationSec ?? 8) * 1000
  const isMenuBoard = display?.kind === 'menu'
  const framedGraphics =
    display?.kind === 'graphics' && display.graphicsChrome === 'framed'
  const brandingFullBleed =
    display?.kind === 'branding' && display.brandingLayout === 'fullbleed'
  const showChrome =
    (display?.kind === 'branding' && !brandingFullBleed) ||
    display?.kind === 'featured' ||
    display?.kind === 'menu' ||
    framedGraphics

  useEffect(() => {
    setSlideIndex(0)
  }, [display?.id, slides.length])

  useEffect(() => {
    // Ordering menu boards are static — no slideshow rotation.
    if (isMenuBoard || slides.length <= 1) return
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length)
    }, durationMs)
    return () => window.clearInterval(id)
  }, [slides.length, durationMs, revision, isMenuBoard])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center overflow-hidden bg-stone-900 text-stone-300">
        Loading display…
      </div>
    )
  }

  if (!restaurant || !display) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 overflow-hidden bg-stone-900 px-6 text-center text-stone-200">
        <h1 className="font-display text-3xl">Display unavailable</h1>
        <p className="max-w-md text-stone-400">
          This board link is inactive or doesn’t exist. Check the URL in the dashboard
          under Store displays / Menu boards.
        </p>
      </div>
    )
  }

  const copy = storeCopy(restaurant.storeKind)
  const style = brandingStyleVars(restaurant.branding)
  const slide = slides[Math.min(slideIndex, Math.max(slides.length - 1, 0))]
  const dateLabel = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div
      className="relative flex h-screen max-h-screen flex-col overflow-hidden text-[var(--brand-text)]"
      style={{
        ...style,
        background:
          display.kind === 'graphics' && display.graphicsChrome === 'fullscreen'
            ? '#000'
            : brandingFullBleed
              ? '#000'
              : restaurant.branding.backgroundColor,
        fontFamily: 'var(--brand-body)',
      }}
    >
      {brandingFullBleed ? (
        <div className="absolute right-5 top-5 z-20 flex items-center gap-3">
          <LiveIndicator
            pulseKey={`${revision}-${lastSyncedAt ?? 0}`}
            className="!text-white"
          />
        </div>
      ) : null}
      {showChrome ? (
        <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 px-8 py-4">
          <div className="flex min-w-0 items-center gap-4">
            {display.showLogo && restaurant.logoUrl ? (
              <img
                src={restaurant.logoUrl}
                alt=""
                className="h-12 w-12 rounded-xl object-cover shadow-sm"
              />
            ) : null}
            {display.showStoreName ? (
              <div className="min-w-0">
                <p
                  className="truncate text-xl font-semibold tracking-tight"
                  style={{ fontFamily: 'var(--brand-heading)' }}
                >
                  {restaurant.name}
                </p>
                <p className="text-sm opacity-60">{dateLabel}</p>
              </div>
            ) : (
              <p className="text-sm opacity-60">{dateLabel}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <LiveIndicator
              pulseKey={`${revision}-${lastSyncedAt ?? 0}-${slideIndex}`}
              className="!text-[var(--brand-primary)]"
            />
            <p className="text-sm font-medium tabular-nums opacity-60">
              {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </p>
          </div>
        </header>
      ) : null}

      <main
        className={cn(
          'relative z-10 flex min-h-0 flex-1 items-stretch overflow-hidden',
          showChrome
            ? framedGraphics
              ? 'px-8 pb-3'
              : 'px-8 pb-6'
            : '',
        )}
      >
        {slide ? (
          <SlideView
            key={slide.id + String(slideIndex)}
            slide={slide}
            showPrices={display.showPrices}
            showItemImages={display.showItemImages}
            menuLayout={display.menuLayout}
            brandingLayout={display.brandingLayout}
            showLogo={display.showLogo}
            logoUrl={restaurant.logoUrl}
            surface={restaurant.branding.surfaceColor}
            fullscreenGraphic={!showChrome || brandingFullBleed}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-3xl bg-[var(--brand-surface)]/80 text-lg opacity-70">
            {display.kind === 'graphics'
              ? 'Add graphic slides in the dashboard to fill this board.'
              : display.kind === 'featured'
                ? `No ${copy.itemNounPlural.toLowerCase()} available on this board right now.`
                : display.kind === 'menu'
                  ? `No ${copy.catalogNoun.toLowerCase()} sections to show right now.`
                  : 'Configure this branding board in the dashboard.'}
          </div>
        )}
      </main>

      {framedGraphics && slides.length > 0 ? (
        <footer className="relative z-10 flex flex-wrap items-center justify-center gap-2 px-8 pb-5 pt-2">
          {slides.map((s, i) => {
            const label =
              s.kind === 'graphic'
                ? s.title || `Slide ${i + 1}`
                : s.kind === 'items'
                  ? s.title
                  : s.kind === 'menu'
                    ? s.title
                    : s.headline
            return (
              <span
                key={s.id}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  i === slideIndex
                    ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-[var(--brand-button-text)]'
                    : 'border-[var(--brand-text)]/15 bg-[var(--brand-surface)]/80 text-[var(--brand-text)]/70',
                )}
              >
                {label}
              </span>
            )
          })}
        </footer>
      ) : null}

      {!framedGraphics && !isMenuBoard && slides.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === slideIndex
                  ? 'w-6 bg-[var(--brand-primary)]'
                  : showChrome
                    ? 'w-1.5 bg-[var(--brand-text)]/25'
                    : 'w-1.5 bg-white/40',
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SlideView({
  slide,
  showPrices,
  showItemImages,
  menuLayout,
  brandingLayout,
  showLogo,
  logoUrl,
  surface,
  fullscreenGraphic,
}: {
  slide: BoardSlide
  showPrices: boolean
  showItemImages: boolean
  menuLayout: 'cards' | 'columns'
  brandingLayout: 'card' | 'fullbleed'
  showLogo: boolean
  logoUrl?: string
  surface: string
  fullscreenGraphic: boolean
}) {
  if (slide.kind === 'menu') {
    return (
      <MenuBoardView
        slide={slide}
        showPrices={showPrices}
        showItemImages={showItemImages}
        menuLayout={menuLayout}
        surface={surface}
      />
    )
  }

  if (slide.kind === 'branding') {
    return (
      <BrandingSignView
        slide={slide}
        layout={brandingLayout}
        showLogo={showLogo}
        logoUrl={logoUrl}
      />
    )
  }

  if (slide.kind === 'graphic') {
    const imageUrl = slide.imageUrl
    const headline = slide.title
    const tagline = slide.subtitle
    return (
      <section
        className={cn(
          'relative flex flex-1 overflow-hidden animate-fade-up',
          fullscreenGraphic ? 'min-h-0 rounded-none' : 'rounded-[2rem]',
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 88%, black), color-mix(in srgb, var(--brand-accent) 70%, var(--brand-primary)))',
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
        <div
          className={cn(
            'relative z-10 flex flex-1 flex-col justify-end text-white',
            fullscreenGraphic ? 'p-12 sm:p-16' : 'p-10 sm:p-14',
          )}
        >
          {headline ? (
            <h1
              className={cn(
                'max-w-4xl font-semibold leading-tight tracking-tight',
                fullscreenGraphic ? 'text-6xl sm:text-8xl' : 'text-5xl sm:text-7xl',
              )}
              style={{ fontFamily: 'var(--brand-heading)' }}
            >
              {headline}
            </h1>
          ) : null}
          {tagline ? (
            <p className="mt-4 max-w-2xl text-xl text-white/85 sm:text-2xl">{tagline}</p>
          ) : null}
        </div>
      </section>
    )
  }

  // Single featured item: image left column, content right.
  if (slide.items.length === 1) {
    const item = slide.items[0]!
    return (
      <section
        className="flex flex-1 flex-col overflow-hidden rounded-[2rem] p-6 animate-fade-up sm:p-8"
        style={{ backgroundColor: surface }}
      >
        <h2
          className="mb-5 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--brand-heading)', color: 'var(--brand-primary)' }}
        >
          {slide.title}
        </h2>
        <article
          className={cn(
            'grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-black/5 bg-[var(--brand-bg)] lg:grid-cols-2',
            item.soldOut && 'opacity-55',
          )}
        >
          <MenuItemImage
            src={item.imageUrl}
            alt=""
            className="h-56 w-full object-cover sm:h-72 lg:h-full lg:min-h-[22rem]"
            fallbackClassName="h-56 w-full sm:h-72 lg:h-full lg:min-h-[22rem]"
          />
          <div className="flex flex-col justify-center gap-3 p-6 sm:p-8 lg:p-10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3
                className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
                style={{ fontFamily: 'var(--brand-heading)' }}
              >
                {item.name}
              </h3>
              {showPrices ? (
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-semibold text-[var(--brand-primary)] sm:text-3xl">
                    {formatMoney(item.priceCents)}
                  </p>
                  {item.onSale ? (
                    <p className="text-sm opacity-50 line-through">
                      {formatMoney(item.listPriceCents)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {item.description ? (
              <p className="max-w-xl text-base opacity-70 sm:text-lg lg:text-xl">
                {item.description}
              </p>
            ) : null}
            {item.soldOut ? (
              <p className="pt-2 text-sm font-semibold uppercase tracking-wider text-red-700">
                Sold out
              </p>
            ) : item.onSale ? (
              <p className="pt-2 text-sm font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                On sale
              </p>
            ) : null}
          </div>
        </article>
      </section>
    )
  }

  const cols =
    slide.items.length <= 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : slide.items.length <= 4
        ? 'grid-cols-2 lg:grid-cols-4'
        : 'grid-cols-2 lg:grid-cols-3'

  return (
    <section
      className="flex flex-1 flex-col overflow-hidden rounded-[2rem] p-6 animate-fade-up sm:p-8"
      style={{ backgroundColor: surface }}
    >
      <h2
        className="mb-5 text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ fontFamily: 'var(--brand-heading)', color: 'var(--brand-primary)' }}
      >
        {slide.title}
      </h2>
      <div className={cn('grid flex-1 gap-4', cols)}>
        {slide.items.map((item) => (
          <article
            key={item.id}
            className={cn(
              'flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/5 bg-[var(--brand-bg)]',
              item.soldOut && 'opacity-55',
            )}
          >
            <MenuItemImage
              src={item.imageUrl}
              alt=""
              className="aspect-[16/10] w-full object-cover"
              fallbackClassName="aspect-[16/10] w-full"
            />
            <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-semibold leading-snug sm:text-xl">
                  {item.name}
                </h3>
                {showPrices ? (
                  <div className="shrink-0 text-right">
                    <p className="text-lg font-semibold text-[var(--brand-primary)]">
                      {formatMoney(item.priceCents)}
                    </p>
                    {item.onSale ? (
                      <p className="text-xs opacity-50 line-through">
                        {formatMoney(item.listPriceCents)}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {item.description ? (
                <p className="line-clamp-2 text-sm opacity-65">{item.description}</p>
              ) : null}
              {item.soldOut ? (
                <p className="mt-auto pt-2 text-xs font-semibold uppercase tracking-wider text-red-700">
                  Sold out
                </p>
              ) : item.onSale ? (
                <p className="mt-auto pt-2 text-xs font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                  On sale
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/** Branding sign — framed card or full-bleed centered logo/title. */
function BrandingSignView({
  slide,
  layout,
  showLogo,
  logoUrl,
}: {
  slide: Extract<BoardSlide, { kind: 'branding' }>
  layout: 'card' | 'fullbleed'
  showLogo: boolean
  logoUrl?: string
}) {
  const imageUrl = slide.imageUrl
  const backdrop = imageUrl ? (
    <img
      src={imageUrl}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : (
    <div
      className="absolute inset-0"
      style={{
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--brand-primary) 88%, black), color-mix(in srgb, var(--brand-accent) 70%, var(--brand-primary)))',
      }}
    />
  )

  if (layout === 'fullbleed') {
    return (
      <section className="relative flex min-h-0 flex-1 overflow-hidden animate-fade-up">
        {backdrop}
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center text-white">
          {showLogo && logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="mb-8 h-28 w-28 rounded-[1.75rem] object-cover shadow-2xl ring-1 ring-white/25 sm:h-36 sm:w-36"
            />
          ) : null}
          {slide.headline ? (
            <h1
              className="max-w-5xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl lg:text-8xl"
              style={{ fontFamily: 'var(--brand-heading)' }}
            >
              {slide.headline}
            </h1>
          ) : null}
          {slide.tagline ? (
            <p className="mt-5 max-w-2xl text-lg text-white/85 sm:text-2xl">
              {slide.tagline}
            </p>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="relative flex min-h-0 flex-1 overflow-hidden rounded-[2rem] animate-fade-up">
      {backdrop}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/10" />
      <div className="relative z-10 flex flex-1 flex-col justify-end p-10 text-white sm:p-14">
        {showLogo && logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            className="mb-5 h-16 w-16 rounded-2xl object-cover shadow-lg ring-1 ring-white/20"
          />
        ) : null}
        {slide.headline ? (
          <h1
            className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl"
            style={{ fontFamily: 'var(--brand-heading)' }}
          >
            {slide.headline}
          </h1>
        ) : null}
        {slide.tagline ? (
          <p className="mt-4 max-w-2xl text-xl text-white/85 sm:text-2xl">
            {slide.tagline}
          </p>
        ) : null}
      </div>
    </section>
  )
}

/** Above-counter ordering board — visual cards or dense traditional columns. */
function MenuBoardView({
  slide,
  showPrices,
  showItemImages,
  menuLayout,
  surface,
}: {
  slide: Extract<BoardSlide, { kind: 'menu' }>
  showPrices: boolean
  showItemImages: boolean
  menuLayout: 'cards' | 'columns'
  surface: string
}) {
  const sectionCount = slide.sections.length
  const itemCount = slide.sections.reduce((n, s) => n + s.items.length, 0)
  const dense = menuLayout === 'columns' || itemCount > 18
  const cols =
    sectionCount <= 1
      ? 'grid-cols-1 max-w-3xl mx-auto'
      : sectionCount === 2
        ? 'grid-cols-2'
        : sectionCount === 3
          ? 'grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'

  if (menuLayout === 'columns') {
    return (
      <section
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.5rem] px-5 py-4 animate-fade-up sm:px-7 sm:py-5"
        style={{ backgroundColor: surface }}
      >
        {slide.title ? (
          <h2
            className="mb-3 shrink-0 text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{
              fontFamily: 'var(--brand-heading)',
              color: 'var(--brand-primary)',
            }}
          >
            {slide.title}
          </h2>
        ) : null}
        <div
          className={cn(
            'grid min-h-0 flex-1 content-start gap-x-8 gap-y-5 overflow-hidden',
            cols,
          )}
        >
          {slide.sections.map((section) => (
            <div key={section.id} className="min-w-0 overflow-hidden">
              <h3
                className="mb-2 border-b pb-1.5 text-sm font-semibold uppercase tracking-[0.14em]"
                style={{
                  fontFamily: 'var(--brand-heading)',
                  borderColor:
                    'color-mix(in srgb, var(--brand-primary) 45%, transparent)',
                  color: 'var(--brand-primary)',
                }}
              >
                {section.name}
              </h3>
              <ul className="space-y-1.5">
                {section.items.map((item) => (
                  <li
                    key={item.id}
                    className={cn('min-w-0', item.soldOut && 'opacity-45')}
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="shrink-0 text-[15px] font-medium leading-snug">
                        {item.name}
                      </span>
                      <span
                        className="min-w-[1.5rem] flex-1 border-b border-dotted opacity-30"
                        style={{
                          borderColor: 'var(--brand-text)',
                          marginBottom: '0.35rem',
                        }}
                        aria-hidden
                      />
                      {showPrices ? (
                        <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--brand-primary)]">
                          {formatMoney(item.priceCents)}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-1 text-xs leading-snug opacity-55">
                        {item.description}
                      </p>
                    ) : null}
                    {item.soldOut ? (
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-700">
                        Sold out
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] p-5 animate-fade-up sm:p-6"
      style={{ backgroundColor: surface }}
    >
      {slide.title ? (
        <h2
          className="mb-4 shrink-0 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--brand-heading)', color: 'var(--brand-primary)' }}
        >
          {slide.title}
        </h2>
      ) : null}
      <div
        className={cn(
          'grid min-h-0 flex-1 content-start gap-4 overflow-hidden',
          cols,
        )}
      >
        {slide.sections.map((section) => (
          <div
            key={section.id}
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/5 bg-[var(--brand-bg)]"
          >
            <div
              className="shrink-0 border-b border-black/5 px-4 py-2.5"
              style={{
                background:
                  'color-mix(in srgb, var(--brand-primary) 10%, var(--brand-bg))',
              }}
            >
              <h3
                className="text-lg font-semibold tracking-tight sm:text-xl"
                style={{ fontFamily: 'var(--brand-heading)' }}
              >
                {section.name}
              </h3>
            </div>
            <ul className="flex min-h-0 flex-1 flex-col divide-y divide-black/5 overflow-hidden">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex min-h-0 items-center gap-3 px-3 py-2 sm:px-4',
                    dense ? 'py-1.5' : 'py-2.5',
                    item.soldOut && 'opacity-50',
                  )}
                >
                  {showItemImages && !dense ? (
                    <MenuItemImage
                      src={item.imageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14"
                      fallbackClassName="h-12 w-12 shrink-0 rounded-xl sm:h-14 sm:w-14"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p
                        className={cn(
                          'truncate font-semibold',
                          dense ? 'text-sm sm:text-base' : 'text-base sm:text-lg',
                        )}
                      >
                        {item.name}
                      </p>
                      {showPrices ? (
                        <div className="shrink-0 text-right">
                          <p
                            className={cn(
                              'font-semibold tabular-nums text-[var(--brand-primary)]',
                              dense ? 'text-sm sm:text-base' : 'text-base sm:text-lg',
                            )}
                          >
                            {formatMoney(item.priceCents)}
                          </p>
                          {item.onSale ? (
                            <p className="text-[11px] opacity-50 line-through">
                              {formatMoney(item.listPriceCents)}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    {item.description && !dense ? (
                      <p className="mt-0.5 line-clamp-1 text-sm opacity-60">
                        {item.description}
                      </p>
                    ) : null}
                    {item.soldOut ? (
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-red-700">
                        Sold out
                      </p>
                    ) : item.onSale && !dense ? (
                      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
                        On sale
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
