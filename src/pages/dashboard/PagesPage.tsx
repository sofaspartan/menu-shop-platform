import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import * as restaurantService from '@/services/restaurantService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import type { StorefrontLayout, StorefrontWidth, StorePages } from '@/types'
import { defaultStorePagesFor } from '@/types'
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
            about: { ...current.pages.about },
            contact: { ...current.pages.contact },
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

      <section className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">About page</h2>
            <p className="mt-1 text-sm text-stone-500">Hero image on top, story text below.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.about.enabled}
              onChange={(e) =>
                setPages((p) => ({ ...p, about: { ...p.about, enabled: e.target.checked } }))
              }
            />
            Enabled
          </label>
        </div>
        <Field label="Title" htmlFor="about-title">
          <Input
            id="about-title"
            value={pages.about.title}
            onChange={(e) =>
              setPages((p) => ({ ...p, about: { ...p.about, title: e.target.value } }))
            }
          />
        </Field>
        <Field label="Hero image URL" htmlFor="about-hero">
          <Input
            id="about-hero"
            value={pages.about.heroImageUrl ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                about: { ...p.about, heroImageUrl: e.target.value || undefined },
              }))
            }
            placeholder="https://…"
          />
        </Field>
        <Field label="Body" htmlFor="about-body">
          <Textarea
            id="about-body"
            rows={8}
            value={pages.about.body}
            onChange={(e) =>
              setPages((p) => ({ ...p, about: { ...p.about, body: e.target.value } }))
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
              Uses your store profile details; toggle each field on or off.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pages.contact.enabled}
              onChange={(e) =>
                setPages((p) => ({
                  ...p,
                  contact: { ...p.contact, enabled: e.target.checked },
                }))
              }
            />
            Enabled
          </label>
        </div>
        <Field label="Title" htmlFor="contact-title">
          <Input
            id="contact-title"
            value={pages.contact.title}
            onChange={(e) =>
              setPages((p) => ({ ...p, contact: { ...p.contact, title: e.target.value } }))
            }
          />
        </Field>
        <Field label="Intro" htmlFor="contact-intro">
          <Textarea
            id="contact-intro"
            rows={3}
            value={pages.contact.intro ?? ''}
            onChange={(e) =>
              setPages((p) => ({
                ...p,
                contact: { ...p.contact, intro: e.target.value },
              }))
            }
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
                contact: { ...p.contact, phoneOverride: e.target.value || undefined },
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
                contact: { ...p.contact, emailOverride: e.target.value || undefined },
              }))
            }
            placeholder="Uses store email if blank"
          />
        </Field>
      </section>

      <Button size="lg" disabled={busy} onClick={() => void save()}>
        {busy ? 'Saving…' : 'Save pages & layout'}
      </Button>
    </div>
  )
}
