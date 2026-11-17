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
  const showChrome =
    display?.kind === 'branding' ||
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
      <div className="flex min-h-screen items-center justify-center bg-stone-900 text-stone-300">
        Loading display…
      </div>
    )
  }

  if (!restaurant || !display) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-stone-900 px-6 text-center text-stone-200">
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
      className="relative min-h-screen overflow-hidden text-[var(--brand-text)]"
      style={{
        ...style,
        background:
          display.kind === 'graphics' && display.graphicsChrome === 'fullscreen'
            ? '#000'
            : restaurant.branding.backgroundColor,
        fontFamily: 'var(--brand-body)',
      }}
    >
      {showChrome ? (
        <header className="relative z-10 flex items-center justify-between gap-4 px-8 py-5">
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
          'relative z-10 flex items-stretch',
          showChrome
            ? framedGraphics
              ? 'min-h-[calc(100vh-8.5rem)] px-8 pb-3'
              : 'min-h-[calc(100vh-6.5rem)] px-8 pb-8'
            : 'min-h-screen',
        )}
      >
        {slide ? (
          <SlideView
            key={slide.id + String(slideIndex)}
            slide={slide}
            showPrices={display.showPrices}
            showItemImages={display.showItemImages}
            surface={restaurant.branding.surfaceColor}
            fullscreenGraphic={!showChrome}
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
  surface,
  fullscreenGraphic,
}: {
  slide: BoardSlide
  showPrices: boolean
  showItemImages: boolean
  surface: string
  fullscreenGraphic: boolean
}) {
  if (slide.kind === 'menu') {
    return (
      <MenuBoardView
        slide={slide}
        showPrices={showPrices}
        showItemImages={showItemImages}
        surface={surface}
      />
    )
  }

  if (slide.kind === 'branding' || slide.kind === 'graphic') {
    const imageUrl = slide.kind === 'branding' ? slide.imageUrl : slide.imageUrl
    const headline = slide.kind === 'branding' ? slide.headline : slide.title
    const tagline = slide.kind === 'branding' ? slide.tagline : slide.subtitle
    return (
      <section
        className={cn(
          'relative flex flex-1 overflow-hidden animate-fade-up',
          fullscreenGraphic ? 'min-h-screen rounded-none' : 'rounded-[2rem]',
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

/** Above-counter ordering board — sections with offerings, prices, and imagery. */
function MenuBoardView({
  slide,
  showPrices,
  showItemImages,
  surface,
}: {
  slide: Extract<BoardSlide, { kind: 'menu' }>
  showPrices: boolean
  showItemImages: boolean
  surface: string
}) {
  const sectionCount = slide.sections.length
  const cols =
    sectionCount <= 1
      ? 'grid-cols-1 max-w-3xl mx-auto'
      : sectionCount === 2
        ? 'grid-cols-1 lg:grid-cols-2'
        : sectionCount === 3
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'

  return (
    <section
      className="flex flex-1 flex-col overflow-hidden rounded-[2rem] p-5 animate-fade-up sm:p-7"
      style={{ backgroundColor: surface }}
    >
      {slide.title ? (
        <h2
          className="mb-5 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ fontFamily: 'var(--brand-heading)', color: 'var(--brand-primary)' }}
        >
          {slide.title}
        </h2>
      ) : null}
      <div className={cn('grid flex-1 gap-5 content-start', cols)}>
        {slide.sections.map((section) => (
          <div
            key={section.id}
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/5 bg-[var(--brand-bg)]"
          >
            <div
              className="border-b border-black/5 px-4 py-3"
              style={{
                background:
                  'color-mix(in srgb, var(--brand-primary) 10%, var(--brand-bg))',
              }}
            >
              <h3
                className="text-xl font-semibold tracking-tight sm:text-2xl"
                style={{ fontFamily: 'var(--brand-heading)' }}
              >
                {section.name}
              </h3>
            </div>
            <ul className="flex flex-1 flex-col divide-y divide-black/5 overflow-y-auto">
              {section.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3',
                    item.soldOut && 'opacity-50',
                  )}
                >
                  {showItemImages ? (
                    <MenuItemImage
                      src={item.imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover sm:h-16 sm:w-16"
                      fallbackClassName="h-14 w-14 shrink-0 rounded-xl sm:h-16 sm:w-16"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-base font-semibold sm:text-lg">
                        {item.name}
                      </p>
                      {showPrices ? (
                        <div className="shrink-0 text-right">
                          <p className="text-base font-semibold tabular-nums text-[var(--brand-primary)] sm:text-lg">
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
                    {item.description ? (
                      <p className="mt-0.5 line-clamp-1 text-sm opacity-60">
                        {item.description}
                      </p>
                    ) : null}
                    {item.soldOut ? (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-red-700">
                        Sold out
                      </p>
                    ) : item.onSale ? (
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-accent)]">
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
