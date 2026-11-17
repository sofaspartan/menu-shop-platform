import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useDb } from '@/hooks/useDb'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { brandingStyleVars } from '@/lib/brandingCss'
import { buildDisplaySlides, type BoardSlide } from '@/lib/displayBoard'
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
    return (
      (db.displays ?? []).find(
        (d) =>
          d.restaurantId === restaurant.id &&
          d.slug === displaySlug &&
          d.active,
      ) ?? null
    )
  }, [db, restaurant, displaySlug])

  const slides = useMemo(() => {
    if (!db || !restaurant || !display) return [] as BoardSlide[]
    return buildDisplaySlides(db, restaurant, display, now)
  }, [db, restaurant, display, now, revision])

  const durationMs = Math.max(3, display?.slideDurationSec ?? 8) * 1000

  useEffect(() => {
    setSlideIndex(0)
  }, [display?.id, slides.length])

  useEffect(() => {
    if (slides.length <= 1) return
    const id = window.setInterval(() => {
      setSlideIndex((i) => (i + 1) % slides.length)
    }, durationMs)
    return () => window.clearInterval(id)
  }, [slides.length, durationMs, revision])

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
  const showPrices = display.showPrices

  return (
    <div
      className="relative min-h-screen overflow-hidden text-[var(--brand-text)]"
      style={{
        ...style,
        background: restaurant.branding.backgroundColor,
        fontFamily: 'var(--brand-body)',
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, var(--brand-primary), transparent 45%), radial-gradient(circle at 80% 0%, var(--brand-accent), transparent 40%)',
        }}
      />

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
              <p className="text-sm opacity-60">{copy.displayBoardLabel}</p>
            </div>
          ) : null}
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

      <main className="relative z-10 flex min-h-[calc(100vh-6.5rem)] items-stretch px-8 pb-8">
        {slide ? (
          <SlideView
            key={slide.id + String(slideIndex)}
            slide={slide}
            showPrices={showPrices}
            surface={restaurant.branding.surfaceColor}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-3xl bg-[var(--brand-surface)]/80 text-lg opacity-70">
            No items available on this board right now.
          </div>
        )}
      </main>

      {slides.length > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === slideIndex
                  ? 'w-6 bg-[var(--brand-primary)]'
                  : 'w-1.5 bg-[var(--brand-text)]/25',
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
  surface,
}: {
  slide: BoardSlide
  showPrices: boolean
  surface: string
}) {
  if (slide.kind === 'branding') {
    return (
      <section className="relative flex flex-1 overflow-hidden rounded-[2rem] animate-fade-up">
        {slide.imageUrl ? (
          <img
            src={slide.imageUrl}
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-black/10" />
        <div className="relative z-10 flex flex-1 flex-col justify-end p-10 text-white sm:p-14">
          <h1
            className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl"
            style={{ fontFamily: 'var(--brand-heading)' }}
          >
            {slide.headline}
          </h1>
          {slide.tagline ? (
            <p className="mt-4 max-w-2xl text-xl text-white/85 sm:text-2xl">{slide.tagline}</p>
          ) : null}
        </div>
      </section>
    )
  }

  if (slide.kind === 'custom') {
    return (
      <section className="relative flex flex-1 overflow-hidden rounded-[2rem] animate-fade-up">
        {slide.imageUrl ? (
          <img
            src={slide.imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[var(--brand-primary)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="relative z-10 flex flex-1 flex-col justify-end p-10 text-white sm:p-14">
          {slide.title ? (
            <h2
              className="text-5xl font-semibold tracking-tight sm:text-6xl"
              style={{ fontFamily: 'var(--brand-heading)' }}
            >
              {slide.title}
            </h2>
          ) : null}
          {slide.subtitle ? (
            <p className="mt-3 max-w-2xl text-xl text-white/85">{slide.subtitle}</p>
          ) : null}
        </div>
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
                <h3 className="text-lg font-semibold leading-snug sm:text-xl">{item.name}</h3>
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
