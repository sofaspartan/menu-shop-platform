import { useEffect, useState } from 'react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import * as restaurantService from '@/services/restaurantService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { brandingStyleVars } from '@/lib/brandingCss'
import { FONT_OPTIONS, type RestaurantBranding } from '@/types'

const COLOR_FIELDS: Array<{ key: keyof RestaurantBranding; label: string }> = [
  { key: 'primaryColor', label: 'Primary' },
  { key: 'secondaryColor', label: 'Secondary' },
  { key: 'accentColor', label: 'Accent' },
  { key: 'backgroundColor', label: 'Background' },
  { key: 'surfaceColor', label: 'Surface' },
  { key: 'textColor', label: 'Text' },
  { key: 'buttonColor', label: 'Button' },
  { key: 'buttonTextColor', label: 'Button text' },
]

export function BrandingPage() {
  const current = useRestaurantStore((s) => s.current())
  const load = useRestaurantStore((s) => s.load)
  const user = useAuthStore((s) => s.user)
  const [branding, setBranding] = useState<RestaurantBranding | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) {
      setBranding(null)
      return
    }
    setBranding({ ...current.branding })
    setLogoUrl(current.logoUrl || '')
    setCoverImageUrl(current.coverImageUrl || '')
  }, [current])

  if (!current || !user || !branding) {
    return <p className="text-sm text-stone-500">Select a restaurant to edit branding.</p>
  }

  function patch<K extends keyof RestaurantBranding>(key: K, value: RestaurantBranding[K]) {
    setBranding((b) => (b ? { ...b, [key]: value } : b))
  }

  async function save() {
    if (!user || !current || !branding) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await restaurantService.updateBranding(user.id, current.id, branding)
      await restaurantService.updateRestaurant(user.id, current.id, {
        logoUrl: logoUrl.trim() || undefined,
        coverImageUrl: coverImageUrl.trim() || undefined,
      })
      await load(user.id)
      setMessage('Branding saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save branding')
    } finally {
      setBusy(false)
    }
  }

  const previewStyle = brandingStyleVars(branding)

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Branding</h1>
          <p className="mt-1 text-stone-500">
            Colors, fonts, and layout that guests see on your storefront.
          </p>
        </div>
        <Button disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save branding'}
        </Button>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Colors</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {COLOR_FIELDS.map((field) => (
                <Field key={field.key} label={field.label}>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      className="h-10 w-12 cursor-pointer rounded-lg border border-stone-300 bg-white p-1"
                      value={String(branding[field.key])}
                      onChange={(e) => patch(field.key, e.target.value as never)}
                    />
                    <Input
                      value={String(branding[field.key])}
                      onChange={(e) => patch(field.key, e.target.value as never)}
                    />
                  </div>
                </Field>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Typography & style</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Heading font">
                <Select
                  value={branding.headingFont}
                  onChange={(e) => patch('headingFont', e.target.value)}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Body font">
                <Select
                  value={branding.bodyFont}
                  onChange={(e) => patch('bodyFont', e.target.value)}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Border radius">
                <Select
                  value={branding.borderRadius}
                  onChange={(e) =>
                    patch('borderRadius', e.target.value as RestaurantBranding['borderRadius'])
                  }
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra large</option>
                </Select>
              </Field>
              <Field label="Card style">
                <Select
                  value={branding.cardStyle}
                  onChange={(e) =>
                    patch('cardStyle', e.target.value as RestaurantBranding['cardStyle'])
                  }
                >
                  <option value="flat">Flat</option>
                  <option value="bordered">Bordered</option>
                  <option value="elevated">Elevated</option>
                </Select>
              </Field>
              <Field label="Button style">
                <Select
                  value={branding.buttonStyle}
                  onChange={(e) =>
                    patch('buttonStyle', e.target.value as RestaurantBranding['buttonStyle'])
                  }
                >
                  <option value="solid">Solid</option>
                  <option value="outline">Outline</option>
                  <option value="soft">Soft</option>
                </Select>
              </Field>
              <Field label="Logo placement">
                <Select
                  value={branding.logoPlacement}
                  onChange={(e) =>
                    patch('logoPlacement', e.target.value as RestaurantBranding['logoPlacement'])
                  }
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                </Select>
              </Field>
              <Field label="Cover display">
                <Select
                  value={branding.coverDisplay}
                  onChange={(e) =>
                    patch('coverDisplay', e.target.value as RestaurantBranding['coverDisplay'])
                  }
                >
                  <option value="full">Full</option>
                  <option value="banner">Banner</option>
                  <option value="none">None</option>
                </Select>
              </Field>
              <Field label="Appearance">
                <Select
                  value={branding.appearance}
                  onChange={(e) =>
                    patch('appearance', e.target.value as RestaurantBranding['appearance'])
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </Select>
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5">
            <h2 className="font-display text-xl">Images</h2>
            <div className="mt-4 grid gap-4">
              <Field label="Logo URL" htmlFor="logo-url">
                <Input
                  id="logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://"
                />
              </Field>
              <Field label="Cover image URL" htmlFor="cover-url">
                <Input
                  id="cover-url"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder="https://"
                />
              </Field>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 xl:sticky xl:top-24 xl:self-start">
          <h2 className="font-display text-xl">Live preview</h2>
          <p className="mt-1 text-sm text-stone-500">Mini storefront using your branding tokens.</p>
          <div
            className="mt-4 overflow-hidden border border-stone-200"
            style={{
              ...previewStyle,
              borderRadius: 'var(--brand-radius)',
              background: 'var(--brand-bg)',
              color: 'var(--brand-text)',
              fontFamily: 'var(--brand-body)',
            }}
          >
            {branding.coverDisplay !== 'none' ? (
              <div
                className={branding.coverDisplay === 'full' ? 'h-28' : 'h-16'}
                style={{
                  background: coverImageUrl
                    ? `center/cover url(${coverImageUrl})`
                    : `linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))`,
                }}
              />
            ) : null}
            <div
              className={`flex items-center gap-3 px-4 py-3 ${
                branding.logoPlacement === 'center' ? 'justify-center' : 'justify-start'
              }`}
              style={{ background: 'var(--brand-surface)' }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-9 w-9 items-center justify-center text-xs font-semibold text-white"
                  style={{
                    background: 'var(--brand-primary)',
                    borderRadius: 'var(--brand-radius)',
                  }}
                >
                  {current.name.slice(0, 1)}
                </div>
              )}
              <div
                style={{
                  fontFamily: 'var(--brand-heading)',
                  textAlign: branding.logoPlacement === 'center' ? 'center' : 'left',
                }}
              >
                <div className="text-lg font-semibold">{current.name}</div>
                <div className="text-xs opacity-70">Order online</div>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div
                className="p-3"
                style={{
                  background: 'var(--brand-surface)',
                  borderRadius: 'var(--brand-radius)',
                  boxShadow:
                    branding.cardStyle === 'elevated'
                      ? '0 8px 24px rgba(0,0,0,0.08)'
                      : undefined,
                  border:
                    branding.cardStyle === 'bordered'
                      ? '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)'
                      : undefined,
                }}
              >
                <div style={{ fontFamily: 'var(--brand-heading)' }} className="font-semibold">
                  Signature dish
                </div>
                <p className="mt-1 text-sm opacity-70">A sample menu card with your styles.</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: 'var(--brand-accent)' }}>
                    $14.00
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm font-medium"
                    style={{
                      borderRadius: 'var(--brand-radius)',
                      background:
                        branding.buttonStyle === 'soft'
                          ? 'color-mix(in srgb, var(--brand-button) 18%, white)'
                          : branding.buttonStyle === 'outline'
                            ? 'transparent'
                            : 'var(--brand-button)',
                      color:
                        branding.buttonStyle === 'solid'
                          ? 'var(--brand-button-text)'
                          : 'var(--brand-button)',
                      border:
                        branding.buttonStyle === 'outline'
                          ? '1px solid var(--brand-button)'
                          : undefined,
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
