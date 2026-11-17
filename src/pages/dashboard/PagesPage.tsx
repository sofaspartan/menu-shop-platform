import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import * as restaurantService from '@/services/restaurantService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import type {
  CoverHeroAlign,
  CoverHeroHeight,
  PageHeaderStyle,
  StorefrontLayout,
  StorefrontWidth,
  StorePages,
} from '@/types'
import {
  defaultStorePagesFor,
  normalizeAboutPage,
  normalizeContactPage,
  normalizeCoverIntro,
  normalizeStoreFooter,
} from '@/types'
import { cn } from '@/lib/utils'

export function PagesPage() {
  const user = useAuthStore((s) => s.user)
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)

  const [layout, setLayout] = useState<StorefrontLayout>('restaurant')
  const [width, setWidth] = useState<StorefrontWidth>('margined')
  const [pages, setPages] = useState<StorePages>(defaultStorePagesFor('restaurant'))
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    setLayout(current.storefrontLayout ?? (current.storeKind === 'retail' ? 'retail' : 'restaurant'))
    setWidth(current.storefrontWidth === 'full' ? 'full' : 'margined')
    setPages(
      current.pages
        ? {
            about: normalizeAboutPage(current.pages.about),
            contact: normalizeContactPage(current.pages.contact),
            coverIntro: normalizeCoverIntro(current.pages.coverIntro),
            featuredEnabled: current.pages.featuredEnabled !== false,
            footer: normalizeStoreFooter(current.pages.footer),
          }
        : defaultStorePagesFor(current.storeKind),
    )
  }, [current])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a store to edit pages and layout.</p>
  }

  async function save() {
    if (!user || !current) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await restaurantService.updateRestaurant(user.id, current.id, {
        storefrontLayout: layout,
        storefrontWidth: width,
        pages,
      })
      await load(user.id)
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

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-up">
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
            <h2 className="font-display text-xl">Cover / hero</h2>
            <p className="mt-1 text-sm text-stone-500">
              Control the cover image band, overlay copy, and alignment on the retail shop.
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
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {(
              [
                ['left', 'Left', 'Left-aligned title, description, and button.'],
                ['center', 'Centered', 'Horizontally centered overlay content.'],
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
          Show Shop / About / Contact links
        </label>
      </section>

      <Button size="lg" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save pages & layout'}
      </Button>
    </div>
  )
}
