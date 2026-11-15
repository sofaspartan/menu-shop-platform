import { useEffect, useState } from 'react'
import { Check, Pencil, Save, Trash2 } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as restaurantService from '@/services/restaurantService'
import { PRESET_BRAND_THEMES } from '@/data/brandThemes'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { brandingStyleVars } from '@/lib/brandingCss'
import { cn } from '@/lib/utils'
import { FONT_OPTIONS, type BrandTheme, type RestaurantBranding } from '@/types'

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
  const { db } = useDb()
  const [branding, setBranding] = useState<RestaurantBranding | null>(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [themeName, setThemeName] = useState('')
  const [themeDescription, setThemeDescription] = useState('')
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null)
  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  const customThemes =
    db && current
      ? (db.brandThemes || [])
          .filter((t) => t.restaurantId === current.id)
          .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
      : []

  useEffect(() => {
    if (!current) {
      setBranding(null)
      return
    }
    setBranding({ ...current.branding })
    setLogoUrl(current.logoUrl || '')
    setCoverImageUrl(current.coverImageUrl || '')
    setActivePresetId(null)
  }, [current])

  if (!current || !user || !branding) {
    return <p className="text-sm text-stone-500">Select a restaurant to edit branding.</p>
  }

  function patch<K extends keyof RestaurantBranding>(key: K, value: RestaurantBranding[K]) {
    setBranding((b) => (b ? { ...b, [key]: value } : b))
    setActivePresetId(null)
  }

  function applyBranding(next: RestaurantBranding, presetId?: string | null) {
    setBranding({ ...next })
    setActivePresetId(presetId ?? null)
    setMessage(presetId ? 'Theme applied — save branding to keep it live.' : 'Custom look applied — save branding to keep it live.')
    setError('')
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

  function openSaveCustom(theme?: BrandTheme) {
    if (theme) {
      setEditingThemeId(theme.id)
      setThemeName(theme.name)
      setThemeDescription(theme.description || '')
    } else {
      setEditingThemeId(null)
      setThemeName('')
      setThemeDescription('')
    }
    setSaveOpen(true)
  }

  async function saveCustomLook() {
    if (!user || !current || !branding) return
    setBusy(true)
    setError('')
    try {
      const existing = editingThemeId
        ? customThemes.find((t) => t.id === editingThemeId)
        : undefined
      await restaurantService.saveBrandTheme(user.id, current.id, {
        id: editingThemeId || undefined,
        name: themeName,
        description: themeDescription,
        // Rename keeps the stored style; "Update" on a card overwrites from current.
        branding: existing?.branding ?? branding,
      })
      setSaveOpen(false)
      setMessage(
        editingThemeId
          ? 'Custom look details saved.'
          : 'Custom look saved. You can reapply it anytime.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save custom look')
    } finally {
      setBusy(false)
    }
  }

  async function overwriteCustomLook(theme: BrandTheme) {
    if (!user || !current || !branding) return
    setBusy(true)
    setError('')
    try {
      await restaurantService.saveBrandTheme(user.id, current.id, {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        branding,
      })
      setMessage(`“${theme.name}” updated from your current look.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update custom look')
    } finally {
      setBusy(false)
    }
  }

  async function removeCustomLook(theme: BrandTheme) {
    if (!user || !current) return
    if (!window.confirm(`Delete custom look “${theme.name}”?`)) return
    setBusy(true)
    setError('')
    try {
      await restaurantService.deleteBrandTheme(user.id, current.id, theme.id)
      setMessage(`Deleted “${theme.name}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete custom look')
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
            Start from a theme, tune the details, and save custom looks you can reuse.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => openSaveCustom()}>
            <Save className="h-4 w-4" />
            Save as custom look
          </Button>
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save branding'}
          </Button>
        </div>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Menu themes</h2>
        <p className="mt-1 text-sm text-stone-500">
          Apply a simple starting look, then customize colors and type below.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PRESET_BRAND_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              name={theme.name}
              description={theme.description}
              branding={theme.branding}
              active={activePresetId === theme.id}
              actionLabel="Apply"
              onApply={() => applyBranding(theme.branding, theme.id)}
            />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Your custom looks</h2>
            <p className="mt-1 text-sm text-stone-500">
              Reapply a saved look, overwrite it with your current settings, or edit its name.
            </p>
          </div>
          <Button variant="soft" size="sm" disabled={busy} onClick={() => openSaveCustom()}>
            <Save className="h-4 w-4" />
            Save current
          </Button>
        </div>

        {customThemes.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
            No custom looks yet. Tune your branding, then save it for later.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                name={theme.name}
                description={theme.description || 'Saved custom look'}
                branding={theme.branding}
                actionLabel="Apply"
                onApply={() => applyBranding(theme.branding, null)}
                footer={
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void overwriteCustomLook(theme)}
                    >
                      Update
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => openSaveCustom(theme)}
                      aria-label={`Rename ${theme.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => void removeCustomLook(theme)}
                      aria-label={`Delete ${theme.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

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
                      background: 'var(--brand-button)',
                      color: 'var(--brand-button-text)',
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

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title={editingThemeId ? 'Edit custom look' : 'Save custom look'}
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="theme-name">
            <Input
              id="theme-name"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder="Weekend special look"
              required
            />
          </Field>
          <Field label="Description (optional)" htmlFor="theme-desc">
            <Input
              id="theme-desc"
              value={themeDescription}
              onChange={(e) => setThemeDescription(e.target.value)}
              placeholder="What this look is for"
            />
          </Field>
          {!editingThemeId ? (
            <p className="text-xs text-stone-500">
              This saves your current color, type, and style settings so you can reapply them later.
            </p>
          ) : (
            <p className="text-xs text-stone-500">
              Renaming keeps the saved style values. Use Update on a card to overwrite a look with
              your current settings.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !themeName.trim()} onClick={() => void saveCustomLook()}>
              {editingThemeId ? 'Save changes' : 'Save look'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ThemeCard({
  name,
  description,
  branding,
  active,
  actionLabel,
  onApply,
  footer,
}: {
  name: string
  description: string
  branding: RestaurantBranding
  active?: boolean
  actionLabel: string
  onApply: () => void
  footer?: React.ReactNode
}) {
  const previewStyle = brandingStyleVars(branding)
  const radius =
    branding.borderRadius === 'none'
      ? '0px'
      : branding.borderRadius === 'sm'
        ? '6px'
        : branding.borderRadius === 'lg'
          ? '14px'
          : branding.borderRadius === 'xl'
            ? '18px'
            : '10px'

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border transition-colors',
        active ? 'border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/20' : 'border-stone-200',
      )}
    >
      <div
        className="p-4"
        style={{
          ...previewStyle,
          background: 'var(--brand-bg)',
          color: 'var(--brand-text)',
          fontFamily: 'var(--brand-body)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div
              className="truncate text-lg font-semibold leading-tight"
              style={{ fontFamily: 'var(--brand-heading)' }}
            >
              {name}
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-70">{description}</p>
          </div>
          {active ? (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium"
              style={{
                background: 'color-mix(in srgb, var(--brand-primary) 16%, white)',
                color: 'var(--brand-primary)',
              }}
            >
              <Check className="h-3 w-3" /> Selected
            </span>
          ) : null}
        </div>

        <div
          className="mt-3 p-3"
          style={{
            background: 'var(--brand-surface)',
            borderRadius: radius,
            border:
              branding.cardStyle === 'bordered'
                ? '1px solid color-mix(in srgb, var(--brand-text) 12%, transparent)'
                : undefined,
            boxShadow:
              branding.cardStyle === 'elevated' ? '0 8px 18px rgba(0,0,0,0.08)' : undefined,
          }}
        >
          <div className="text-sm font-semibold" style={{ fontFamily: 'var(--brand-heading)' }}>
            Tonight’s special
          </div>
          <p className="mt-1 text-xs opacity-70">Sample menu text in this theme’s type and color.</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--brand-accent)' }}>
              $18.00
            </span>
            <span
              className="px-2.5 py-1 text-[11px] font-semibold"
              style={{
                borderRadius: radius,
                background: 'var(--brand-button)',
                color: 'var(--brand-button-text)',
              }}
            >
              Add
            </span>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[
            branding.primaryColor,
            branding.secondaryColor,
            branding.accentColor,
            branding.backgroundColor,
            branding.surfaceColor,
            branding.buttonColor,
          ].map((color, i) => (
            <span
              key={`${color}-${i}`}
              className="h-5 w-5 rounded-full border border-black/10"
              style={{ background: color }}
              title={color}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] opacity-65">
            {branding.headingFont} · {branding.bodyFont}
          </span>
          <button
            type="button"
            onClick={onApply}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{
              borderRadius: radius,
              background: 'var(--brand-button)',
              color: 'var(--brand-button-text)',
            }}
          >
            {actionLabel}
          </button>
        </div>
      </div>
      {footer ? <div className="border-t border-stone-200 bg-white px-4 py-3">{footer}</div> : null}
    </div>
  )
}
