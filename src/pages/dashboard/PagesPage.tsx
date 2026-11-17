import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import * as restaurantService from '@/services/restaurantService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import type {
  CoverHeroAlign,
  CoverHeroHeight,
  HomeAboutLayout,
  HomeFeaturedLayout,
  HomeSection,
  HomeSplashLayout,
  PageHeaderStyle,
  StorefrontLayout,
  StorefrontWidth,
  StorePages,
} from '@/types'
import {
  defaultHomeSectionsFor,
  defaultStorePagesFor,
  normalizeAboutPage,
  normalizeContactPage,
  normalizeCoverIntro,
  normalizeHomeSection,
  normalizePageHero,
  normalizeStoreFooter,
  normalizeStoreHome,
} from '@/types'
import { cn } from '@/lib/utils'

const HOME_KIND_LABEL: Record<HomeSection['kind'], string> = {
  splash: 'Splash hero',
  aboutTeaser: 'About teaser',
  featured: 'Featured items',
  catalog: 'Shop link (legacy)',
}

function HeroLayoutControls({
  hero,
  onChange,
  idPrefix,
}: {
  hero: StorePages['about']['hero']
  onChange: (hero: StorePages['about']['hero']) => void
  idPrefix: string
}) {
  const options = normalizePageHero(hero)
  return (
    <div className="space-y-4 rounded-xl border border-stone-100 bg-stone-50/80 p-4">
      <p className="text-sm font-medium text-stone-700">Hero layout</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ['short', 'Short', 'Same compact height as the shop cover.'],
            ['tall', 'Tall', 'Taller hero matching the shop tall option.'],
          ] as Array<[CoverHeroHeight, string, string]>
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(normalizePageHero({ ...options, height: value }))}
            className={cn(
              'rounded-2xl border px-4 py-3 text-left',
              options.height === value
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                : 'border-stone-200 bg-white hover:bg-stone-50',
            )}
          >
            <div className="font-medium">{label}</div>
            <p className="mt-1 text-xs text-stone-500">{hint}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['left', 'Left', 'Bottom-left overlay.'],
            ['centerBottom', 'Centered bottom', 'Centered on the bottom.'],
            ['centerMiddle', 'Centered middle', 'True vertical + horizontal center.'],
          ] as Array<[CoverHeroAlign, string, string]>
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(normalizePageHero({ ...options, align: value }))}
            className={cn(
              'rounded-2xl border px-4 py-3 text-left',
              options.align === value
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                : 'border-stone-200 bg-white hover:bg-stone-50',
            )}
          >
            <div className="font-medium">{label}</div>
            <p className="mt-1 text-xs text-stone-500">{hint}</p>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {(
          [
            ['showTitle', 'Show title'],
            ['showSubtitle', 'Show subtitle'],
            ['showButton', 'Show button'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(options[key])}
              onChange={(e) =>
                onChange(normalizePageHero({ ...options, [key]: e.target.checked }))
              }
            />
            {label}
          </label>
        ))}
      </div>
      <Field label="Button label" htmlFor={`${idPrefix}-btn-label`}>
        <Input
          id={`${idPrefix}-btn-label`}
          value={options.buttonLabel ?? ''}
          onChange={(e) =>
            onChange(normalizePageHero({ ...options, buttonLabel: e.target.value }))
          }
          placeholder="e.g. Shop the collection"
        />
      </Field>
      <Field label="Button link" htmlFor={`${idPrefix}-btn-href`}>
        <Input
          id={`${idPrefix}-btn-href`}
          value={options.buttonHref ?? ''}
          onChange={(e) =>
            onChange(normalizePageHero({ ...options, buttonHref: e.target.value }))
          }
          placeholder="#section-featured, /r/slug, or https://…"
        />
      </Field>
    </div>
  )
}

export function PagesPage() {
  const user = useAuthStore((s) => s.user)
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)

  const [layout, setLayout] = useState<StorefrontLayout>('restaurant')
  const [width, setWidth] = useState<StorefrontWidth>('margined')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [pages, setPages] = useState<StorePages>(defaultStorePagesFor('restaurant'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    setLayout(current.storefrontLayout ?? (current.storeKind === 'retail' ? 'retail' : 'restaurant'))
    setWidth(current.storefrontWidth === 'full' ? 'full' : 'margined')
    setCoverImageUrl(current.coverImageUrl ?? '')
    setPages(
      current.pages
        ? {
            about: normalizeAboutPage(current.pages.about),
            contact: normalizeContactPage(current.pages.contact),
            coverIntro: normalizeCoverIntro(current.pages.coverIntro),
            featuredEnabled: current.pages.featuredEnabled !== false,
            footer: normalizeStoreFooter(current.pages.footer),
            home: normalizeStoreHome(current.pages.home, current.storeKind),
          }
        : defaultStorePagesFor(current.storeKind),
    )
  }, [current])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a store to edit pages and layout.</p>
  }

  const store = current
  const account = user

  async function save() {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await restaurantService.updateRestaurant(account.id, store.id, {
        storefrontLayout: layout,
        storefrontWidth: width,
        coverImageUrl: coverImageUrl.trim() || undefined,
        pages,
      })
      await load(account.id)
      setMessage('Storefront layout and pages saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  function toggleContact(key: keyof StorePages['contact'], value: boolean) {
    setPages((p) => ({ ...p, contact: { ...p.contact, [key]: value } }))
  }

  const home = normalizeStoreHome(pages.home, store.storeKind)
  const homeSections = [...home.sections].sort((a, b) => a.sortOrder - b.sortOrder)

  function setHome(next: Partial<NonNullable<StorePages['home']>>) {
    setPages((p) => ({
      ...p,
      home: normalizeStoreHome(
        {
          ...normalizeStoreHome(p.home, store.storeKind),
          ...next,
        },
        store.storeKind,
      ),
    }))
  }

  function updateHomeSection(id: string, patch: Partial<HomeSection>) {
    setHome({
      sections: homeSections.map((s, i) =>
        s.id === id
          ? normalizeHomeSection({ ...s, ...patch, id: s.id, kind: s.kind }, i)
          : s,
      ),
    })
  }

  function moveHomeSection(id: string, dir: -1 | 1) {
    const idx = homeSections.findIndex((s) => s.id === id)
    const swap = idx + dir
    if (idx < 0 || swap < 0 || swap >= homeSections.length) return
    const next = [...homeSections]
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setHome({
      sections: next.map((s, i) => normalizeHomeSection({ ...s, sortOrder: i }, i)),
    })
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl">Pages & layout</h1>
        <p className="mt-1 text-stone-500">
          Choose how the catalog looks, and publish About / Contact pages for your storefront.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Catalog layout</h2>
        <p className="mt-1 text-sm text-stone-500">
          Restaurant keeps the classic menu list. Retail uses a merch-style square product grid.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setLayout('restaurant')}
            className={cn(
              'rounded-2xl border px-4 py-4 text-left',
              layout === 'restaurant'
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                : 'border-stone-200 hover:bg-stone-50',
            )}
          >
            <div className="font-medium">Restaurant</div>
            <p className="mt-1 text-xs text-stone-500">
              Horizontal item rows with description — feels like a digital menu.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setLayout('retail')}
            className={cn(
              'rounded-2xl border px-4 py-4 text-left',
              layout === 'retail'
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                : 'border-stone-200 hover:bg-stone-50',
            )}
          >
            <div className="font-medium">Retail</div>
            <p className="mt-1 text-xs text-stone-500">
              Square product tiles in a grid — feels like a merch shop.
            </p>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Storefront width</h2>
        <p className="mt-1 text-sm text-stone-500">
          Choose a centered content column or a wider, near full-bleed layout.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setWidth('margined')}
            className={cn(
              'rounded-2xl border px-4 py-4 text-left',
              width === 'margined'
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                : 'border-stone-200 hover:bg-stone-50',
            )}
          >
            <div className="font-medium">Margined</div>
            <p className="mt-1 text-xs text-stone-500">
              Centered column with comfortable side margins (default).
            </p>
          </button>
          <button
            type="button"
            onClick={() => setWidth('full')}
            className={cn(
              'rounded-2xl border px-4 py-4 text-left',
              width === 'full'
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                : 'border-stone-200 hover:bg-stone-50',
            )}
          >
            <div className="font-medium">Full width</div>
            <p className="mt-1 text-xs text-stone-500">
              Wider content that uses more of the screen on large displays.
            </p>
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Homepage</h2>
            <p className="mt-1 text-sm text-stone-500">
              Separate from Shop: splash, about teaser, and featured items on{' '}
              <code className="text-xs">/r/…</code>. Shop/Menu lives at{' '}
              <code className="text-xs">/r/…/shop</code>. Reorder sections and pick layouts.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={home.enabled}
              onChange={(e) => {
                if (e.target.checked && !pages.home?.sections?.length) {
                  setHome({
                    enabled: true,
                    sections: defaultHomeSectionsFor(store.storeKind),
                  })
                } else {
                  setHome({ enabled: e.target.checked })
                }
              }}
            />
            Enabled
          </label>
        </div>

        {home.enabled ? (
          <div className="space-y-4">
            {homeSections.map((section, index) => (
              <div
                key={section.id}
                className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                      {index + 1}
                    </span>
                    <p className="font-medium text-stone-800">
                      {HOME_KIND_LABEL[section.kind]}
                    </p>
                    <label className="flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={section.enabled}
                        onChange={(e) =>
                          updateHomeSection(section.id, { enabled: e.target.checked })
                        }
                      />
                      On
                    </label>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="rounded-lg border border-stone-200 bg-white p-1.5 hover:bg-stone-50 disabled:opacity-40"
                      disabled={index === 0}
                      onClick={() => moveHomeSection(section.id, -1)}
                      aria-label="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-stone-200 bg-white p-1.5 hover:bg-stone-50 disabled:opacity-40"
                      disabled={index === homeSections.length - 1}
                      onClick={() => moveHomeSection(section.id, 1)}
                      aria-label="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {section.kind === 'splash' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Layout" htmlFor={`splash-layout-${section.id}`}>
                      <Select
                        id={`splash-layout-${section.id}`}
                        value={section.splashLayout ?? 'fullBleedCenter'}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            splashLayout: e.target.value as HomeSplashLayout,
                          })
                        }
                      >
                        <option value="fullBleedCenter">Full-bleed centered</option>
                        <option value="fullBleedBottom">Full-bleed bottom-left</option>
                      </Select>
                    </Field>
                    <Field label="Logo style" htmlFor={`splash-logo-${section.id}`}>
                      <Select
                        id={`splash-logo-${section.id}`}
                        value={section.logoStyle ?? 'natural'}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            logoStyle:
                              e.target.value === 'roundedSquare'
                                ? 'roundedSquare'
                                : 'natural',
                          })
                        }
                      >
                        <option value="natural">
                          Natural / transparent (height capped)
                        </option>
                        <option value="roundedSquare">Rounded square</option>
                      </Select>
                    </Field>
                    {(
                      [
                        ['showLogo', 'Show logo'],
                        ['showTitle', 'Show title'],
                        ['showSubtitle', 'Show subtitle'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={section[key] !== false}
                          onChange={(e) =>
                            updateHomeSection(section.id, { [key]: e.target.checked })
                          }
                        />
                        {label}
                      </label>
                    ))}
                    <Field label="Title" htmlFor={`splash-title-${section.id}`}>
                      <Input
                        id={`splash-title-${section.id}`}
                        value={section.title ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, { title: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Subtitle" htmlFor={`splash-sub-${section.id}`}>
                      <Input
                        id={`splash-sub-${section.id}`}
                        value={section.subtitle ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, { subtitle: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Primary button" htmlFor={`splash-pbtn-${section.id}`}>
                      <Input
                        id={`splash-pbtn-${section.id}`}
                        value={section.primaryButtonLabel ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            primaryButtonLabel: e.target.value,
                          })
                        }
                        placeholder="View menu"
                      />
                    </Field>
                    <Field label="Primary link" htmlFor={`splash-phref-${section.id}`}>
                      <Input
                        id={`splash-phref-${section.id}`}
                        value={section.primaryButtonHref ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            primaryButtonHref: e.target.value,
                          })
                        }
                        placeholder="shop, about, or https://…"
                      />
                    </Field>
                    <Field label="Secondary button" htmlFor={`splash-sbtn-${section.id}`}>
                      <Input
                        id={`splash-sbtn-${section.id}`}
                        value={section.secondaryButtonLabel ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            secondaryButtonLabel: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Secondary link" htmlFor={`splash-shref-${section.id}`}>
                      <Input
                        id={`splash-shref-${section.id}`}
                        value={section.secondaryButtonHref ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            secondaryButtonHref: e.target.value,
                          })
                        }
                      />
                    </Field>
                  </div>
                ) : null}

                {section.kind === 'aboutTeaser' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Layout" htmlFor={`about-layout-${section.id}`}>
                      <Select
                        id={`about-layout-${section.id}`}
                        value={section.aboutLayout ?? 'splitImageRight'}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            aboutLayout: e.target.value as HomeAboutLayout,
                          })
                        }
                      >
                        <option value="splitImageRight">Image left, copy right</option>
                        <option value="splitImageLeft">Copy left, image right</option>
                        <option value="stacked">Stacked (image above)</option>
                      </Select>
                    </Field>
                    <Field label="Title" htmlFor={`about-t-${section.id}`}>
                      <Input
                        id={`about-t-${section.id}`}
                        value={section.aboutTitle ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, { aboutTitle: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Body" htmlFor={`about-b-${section.id}`}>
                      <Textarea
                        id={`about-b-${section.id}`}
                        rows={3}
                        value={section.aboutBody ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, { aboutBody: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Button label" htmlFor={`about-btn-${section.id}`}>
                      <Input
                        id={`about-btn-${section.id}`}
                        value={section.aboutButtonLabel ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            aboutButtonLabel: e.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Image URL (optional)" htmlFor={`about-img-${section.id}`}>
                      <Input
                        id={`about-img-${section.id}`}
                        value={section.aboutImageUrl ?? ''}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            aboutImageUrl: e.target.value || undefined,
                          })
                        }
                        placeholder="Falls back to About hero or cover"
                      />
                    </Field>
                  </div>
                ) : null}

                {section.kind === 'featured' ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Layout" htmlFor={`feat-layout-${section.id}`}>
                      <Select
                        id={`feat-layout-${section.id}`}
                        value={section.featuredLayout ?? 'carousel'}
                        onChange={(e) =>
                          updateHomeSection(section.id, {
                            featuredLayout: e.target.value as HomeFeaturedLayout,
                          })
                        }
                      >
                        <option value="carousel">Carousel (one at a time)</option>
                        <option value="grid">Grid (several)</option>
                      </Select>
                    </Field>
                    {section.featuredLayout === 'grid' ? (
                      <Field label="Items to show" htmlFor={`feat-count-${section.id}`}>
                        <Input
                          id={`feat-count-${section.id}`}
                          type="number"
                          min={1}
                          max={8}
                          value={section.featuredCount ?? 4}
                          onChange={(e) =>
                            updateHomeSection(section.id, {
                              featuredCount: Number(e.target.value) || 4,
                            })
                          }
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}

                {section.kind === 'catalog' ? (
                  <p className="text-sm text-stone-500">
                    Catalog sections are no longer part of the homepage — use the Shop /
                    Menu nav link instead. This block will be ignored.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-stone-500">
            When off, the storefront uses the classic cover / featured layout below.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Cover / hero</h2>
            <p className="mt-1 text-sm text-stone-500">
              Classic cover band when Homepage is off (retail-friendly overlay copy).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.coverIntro?.enabled !== false}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  coverIntro: normalizeCoverIntro({ ...p.coverIntro, enabled: e.target.checked }),
                }))
              }
            />
            Enabled
          </label>
        </div>

        <div>
          <p className="text-sm font-medium text-stone-700">Hero height</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['short', 'Short', 'Current compact cover band.'],
                ['tall', 'Tall', 'Taller hero for a more dramatic first impression.'],
              ] as Array<[CoverHeroHeight, string, string]>
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setPages((p) => ({
                    ...p,
                    coverIntro: normalizeCoverIntro({ ...p.coverIntro, height: value }),
                  }))
                }
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left',
                  (pages.coverIntro?.height ?? 'short') === value
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                    : 'border-stone-200 hover:bg-stone-50',
                )}
              >
                <div className="font-medium">{label}</div>
                <p className="mt-1 text-xs text-stone-500">{hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-stone-700">Overlay alignment</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {(
              [
                ['left', 'Left', 'Left-aligned along the bottom of the cover.'],
                [
                  'centerBottom',
                  'Centered bottom',
                  'Horizontally centered, still anchored to the bottom.',
                ],
                [
                  'centerMiddle',
                  'Centered middle',
                  'Centered horizontally and vertically in the hero.',
                ],
              ] as Array<[CoverHeroAlign, string, string]>
            ).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setPages((p) => ({
                    ...p,
                    coverIntro: normalizeCoverIntro({ ...p.coverIntro, align: value }),
                  }))
                }
                className={cn(
                  'rounded-2xl border px-4 py-3 text-left',
                  (pages.coverIntro?.align ?? 'left') === value
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                    : 'border-stone-200 hover:bg-stone-50',
                )}
              >
                <div className="font-medium">{label}</div>
                <p className="mt-1 text-xs text-stone-500">{hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['showTitle', 'Show title'],
              ['showDescription', 'Show description'],
              ['showButton', 'Show button'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(pages.coverIntro?.[key] ?? true)}
                onChange={(e) =>
                  setPages((p) => ({
                    ...p,
                    coverIntro: normalizeCoverIntro({
                      ...p.coverIntro,
                      [key]: e.target.checked,
                    }),
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>

        <Field label="Cover image URL" htmlFor="shop-cover-url">
          <Input
            id="shop-cover-url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://… — shop home hero background"
          />
        </Field>
        <Field label="Title" htmlFor="cover-title">
          <Input
            id="cover-title"
            value={pages.coverIntro?.title ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                coverIntro: normalizeCoverIntro({ ...p.coverIntro, title: e.target.value }),
              }))
            }
            placeholder="e.g. Leather goods, made to last"
          />
        </Field>
        <Field label="Button label" htmlFor="cover-btn-label">
          <Input
            id="cover-btn-label"
            value={pages.coverIntro?.buttonLabel ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                coverIntro: normalizeCoverIntro({
                  ...p.coverIntro,
                  buttonLabel: e.target.value,
                }),
              }))
            }
            placeholder="e.g. Shop featured"
          />
        </Field>
        <Field label="Button link" htmlFor="cover-btn-href">
          <Input
            id="cover-btn-href"
            value={pages.coverIntro?.buttonHref ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                coverIntro: normalizeCoverIntro({
                  ...p.coverIntro,
                  buttonHref: e.target.value,
                }),
              }))
            }
            placeholder="#section-featured, /r/your-slug/about, or https://…"
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Featured section</h2>
            <p className="mt-1 text-sm text-stone-500">
              Large hero product at the top of the retail catalog (uses your featured items).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.featuredEnabled !== false}
              onChange={(e) =>
                setPages((p) => ({ ...p, featuredEnabled: e.target.checked }))
              }
            />
            Enabled
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">About page</h2>
            <p className="mt-1 text-sm text-stone-500">
              Choose a cover image header or a simple title + subtitle.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.about.enabled}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  about: normalizeAboutPage({ ...p.about, enabled: e.target.checked }),
                }))
              }
            />
            Enabled
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['cover', 'Cover image', 'Title over a hero image (current About look).'],
              ['simple', 'Title only', 'Title + subtitle with no image (like Contact).'],
            ] as Array<[PageHeaderStyle, string, string]>
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setPages((p) => ({
                  ...p,
                  about: normalizeAboutPage({ ...p.about, headerStyle: value }),
                }))
              }
              className={cn(
                'rounded-2xl border px-4 py-3 text-left',
                pages.about.headerStyle === value
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-stone-200 hover:bg-stone-50',
              )}
            >
              <div className="font-medium">{label}</div>
              <p className="mt-1 text-xs text-stone-500">{hint}</p>
            </button>
          ))}
        </div>
        <Field label="Title" htmlFor="about-title">
          <Input
            id="about-title"
            value={pages.about.title}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                about: normalizeAboutPage({ ...p.about, title: e.target.value }),
              }))
            }
          />
        </Field>
        <Field label="Subtitle" htmlFor="about-subtitle">
          <Input
            id="about-subtitle"
            value={pages.about.subtitle ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                about: normalizeAboutPage({ ...p.about, subtitle: e.target.value }),
              }))
            }
            placeholder="Short supporting line"
          />
        </Field>
        <Field label="Cover image URL" htmlFor="about-hero">
          <Input
            id="about-hero"
            value={pages.about.heroImageUrl ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                about: normalizeAboutPage({
                  ...p.about,
                  heroImageUrl: e.target.value || undefined,
                }),
              }))
            }
            placeholder="Required when using Cover image style"
          />
        </Field>
        <HeroLayoutControls
          idPrefix="about"
          hero={pages.about.hero}
          onChange={(hero) =>
            setPages((p) => ({
              ...p,
              about: normalizeAboutPage({ ...p.about, hero }),
            }))
          }
        />
        <Field label="Body" htmlFor="about-body">
          <Textarea
            id="about-body"
            rows={8}
            value={pages.about.body}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                about: normalizeAboutPage({ ...p.about, body: e.target.value }),
              }))
            }
            placeholder="Separate paragraphs with a blank line."
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Contact page</h2>
            <p className="mt-1 text-sm text-stone-500">
              Same header choices as About, plus toggles for each contact field.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.contact.enabled}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  contact: normalizeContactPage({ ...p.contact, enabled: e.target.checked }),
                }))
              }
            />
            Enabled
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['cover', 'Cover image', 'Title over a hero image.'],
              ['simple', 'Title only', 'Title + intro with no image (current Contact look).'],
            ] as Array<[PageHeaderStyle, string, string]>
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() =>
                setPages((p) => ({
                  ...p,
                  contact: normalizeContactPage({ ...p.contact, headerStyle: value }),
                }))
              }
              className={cn(
                'rounded-2xl border px-4 py-3 text-left',
                pages.contact.headerStyle === value
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-stone-200 hover:bg-stone-50',
              )}
            >
              <div className="font-medium">{label}</div>
              <p className="mt-1 text-xs text-stone-500">{hint}</p>
            </button>
          ))}
        </div>
        <Field label="Title" htmlFor="contact-title">
          <Input
            id="contact-title"
            value={pages.contact.title}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                contact: normalizeContactPage({ ...p.contact, title: e.target.value }),
              }))
            }
          />
        </Field>
        <Field label="Intro / subtitle" htmlFor="contact-intro">
          <Textarea
            id="contact-intro"
            rows={3}
            value={pages.contact.intro ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                contact: normalizeContactPage({ ...p.contact, intro: e.target.value }),
              }))
            }
          />
        </Field>
        <Field label="Cover image URL" htmlFor="contact-hero">
          <Input
            id="contact-hero"
            value={pages.contact.heroImageUrl ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                contact: normalizeContactPage({
                  ...p.contact,
                  heroImageUrl: e.target.value || undefined,
                }),
              }))
            }
            placeholder="Used when Cover image style is selected"
          />
        </Field>
        <HeroLayoutControls
          idPrefix="contact"
          hero={pages.contact.hero}
          onChange={(hero) =>
            setPages((p) => ({
              ...p,
              contact: normalizeContactPage({ ...p.contact, hero }),
            }))
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['showPhone', 'Phone'],
              ['showEmail', 'Email'],
              ['showAddress', 'Address'],
              ['showHours', 'Hours'],
              ['showWebsite', 'Website'],
              ['showInstagram', 'Instagram'],
              ['showFacebook', 'Facebook'],
              ['showTwitter', 'X / Twitter'],
              ['showTiktok', 'TikTok'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(pages.contact[key])}
                onChange={(e) => toggleContact(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <Field label="Phone override (optional)" htmlFor="phone-override">
          <Input
            id="phone-override"
            value={pages.contact.phoneOverride ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                contact: normalizeContactPage({
                  ...p.contact,
                  phoneOverride: e.target.value || undefined,
                }),
              }))
            }
            placeholder="Uses store phone if blank"
          />
        </Field>
        <Field label="Email override (optional)" htmlFor="email-override">
          <Input
            id="email-override"
            value={pages.contact.emailOverride ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                contact: normalizeContactPage({
                  ...p.contact,
                  emailOverride: e.target.value || undefined,
                }),
              }))
            }
            placeholder="Uses store email if blank"
          />
        </Field>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Footer</h2>
            <p className="mt-1 text-sm text-stone-500">
              Centered company name, copyright, and site page links on Shop / About / Contact.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.footer?.enabled !== false}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  footer: normalizeStoreFooter({ ...p.footer, enabled: e.target.checked }),
                }))
              }
            />
            Enabled
          </label>
        </div>
        <Field label="Company name" htmlFor="footer-company">
          <Input
            id="footer-company"
            value={pages.footer?.companyName ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                footer: normalizeStoreFooter({ ...p.footer, companyName: e.target.value }),
              }))
            }
            placeholder="Defaults to store name"
          />
        </Field>
        <Field label="Copyright line" htmlFor="footer-copy">
          <Input
            id="footer-copy"
            value={pages.footer?.copyright ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                footer: normalizeStoreFooter({ ...p.footer, copyright: e.target.value }),
              }))
            }
            placeholder="Defaults to © {year} {company}. All rights reserved."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.footer?.showPageLinks !== false}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  footer: normalizeStoreFooter({
                    ...p.footer,
                    showPageLinks: e.target.checked,
                  }),
                }))
              }
            />
            Show page links
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.footer?.showLogo !== false}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  footer: normalizeStoreFooter({
                    ...p.footer,
                    showLogo: e.target.checked,
                  }),
                }))
              }
            />
            Show logo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.footer?.showPoweredBy !== false}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  footer: normalizeStoreFooter({
                    ...p.footer,
                    showPoweredBy: e.target.checked,
                  }),
                }))
              }
            />
            Powered by Counter
          </label>
        </div>
      </section>

      <Button size="lg" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save pages & layout'}
      </Button>
    </div>
  )
}
