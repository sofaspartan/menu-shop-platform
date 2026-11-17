import { useMemo, useState } from 'react'
import { Copy, ExternalLink, MonitorPlay, Plus, Trash2 } from 'lucide-react'
import type { Display, DisplayMode } from '@/types'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as displayService from '@/services/displayService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { storeCopy } from '@/lib/storeCopy'
import { cn } from '@/lib/utils'

export function DisplaysPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const copy = storeCopy(current?.storeKind)

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const menus = useMemo(() => {
    if (!db || !current) return []
    return db.menus
      .filter((m) => m.restaurantId === current.id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }, [db, current])

  const displays = useMemo(() => {
    if (!db || !current) return [] as Display[]
    return (db.displays ?? [])
      .filter((d) => d.restaurantId === current.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current])

  const selected = displays.find((d) => d.id === selectedId) ?? displays[0] ?? null

  const publicUrl =
    current && selected
      ? displayService.buildDisplayUrl(
          window.location.origin,
          current.slug,
          selected.slug,
        )
      : ''

  if (!current || !user) {
    return (
      <p className="text-sm text-stone-500">
        Select a {copy.storeNoun} to manage {copy.displayNounPlural.toLowerCase()}.
      </p>
    )
  }

  async function createDisplay() {
    if (!user || !current || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const created = await displayService.createDisplay(user.id, current.id, {
        name: name.trim(),
        mode: 'mixed',
        headline: current.name,
        tagline: `Today’s ${copy.catalogNoun}`,
      })
      setSelectedId(created.id)
      setCreateOpen(false)
      setName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create display.')
    } finally {
      setBusy(false)
    }
  }

  async function patchSelected(
    patch: Parameters<typeof displayService.updateDisplay>[3],
  ) {
    if (!user || !current || !selected) return
    setError('')
    try {
      await displayService.updateDisplay(user.id, current.id, selected.id, patch)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save display.')
    }
  }

  async function removeSelected() {
    if (!user || !current || !selected) return
    if (!window.confirm(`Delete “${selected.name}”?`)) return
    await displayService.deleteDisplay(user.id, current.id, selected.id)
    setSelectedId(null)
  }

  async function copyUrl() {
    if (!publicUrl) return
    await navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  function toggleMenu(menuId: string) {
    if (!selected) return
    const has = selected.menuIds.includes(menuId)
    const next = has
      ? selected.menuIds.filter((id) => id !== menuId)
      : [...selected.menuIds, menuId]
    void patchSelected({ menuIds: next })
  }

  function addCustomSlide() {
    if (!selected) return
    const slide = displayService.createCustomSlide({
      title: 'Promo',
      subtitle: 'Add a headline or image URL',
      sortOrder: selected.customSlides.length,
    })
    void patchSelected({ customSlides: [...selected.customSlides, slide] })
  }

  function updateCustomSlide(
    slideId: string,
    patch: Partial<{ title: string; subtitle: string; imageUrl: string }>,
  ) {
    if (!selected) return
    void patchSelected({
      customSlides: selected.customSlides.map((s) =>
        s.id === slideId ? { ...s, ...patch } : s,
      ),
    })
  }

  function removeCustomSlide(slideId: string) {
    if (!selected) return
    void patchSelected({
      customSlides: selected.customSlides.filter((s) => s.id !== slideId),
    })
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{copy.displayNounPlural}</h1>
          <p className="mt-1 max-w-2xl text-stone-500">
            Build TV-ready boards with your branding, featured {copy.itemNounPlural.toLowerCase()},
            and custom graphics. Open the URL on a display — it updates live with
            availability and schedule changes.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New {copy.displayNoun.toLowerCase()}
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {displays.length === 0 ? (
        <EmptyState
          title={`No ${copy.displayNounPlural.toLowerCase()} yet`}
          description={`Create a ${copy.displayBoardLabel.toLowerCase()} and open its link on a TV or tablet.`}
          actionLabel="Create display"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="space-y-1">
            {displays.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm',
                  (selected?.id ?? '') === d.id
                    ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                    : 'hover:bg-stone-50 text-stone-700',
                )}
              >
                <span className="truncate font-medium">{d.name}</span>
                <Badge tone={d.active ? 'success' : 'neutral'}>
                  {d.active ? 'On' : 'Off'}
                </Badge>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{selected.name}</h2>
                  <p className="mt-1 text-sm text-stone-500">/{selected.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void copyUrl()}>
                    <Copy className="h-4 w-4" />
                    {copied ? 'Copied' : 'Copy URL'}
                  </Button>
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline">
                      <ExternalLink className="h-4 w-4" />
                      Open
                    </Button>
                  </a>
                  <Button type="button" variant="danger" onClick={() => void removeSelected()}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                  Public display URL
                </p>
                <p className="mt-1 break-all font-mono text-sm text-stone-700">{publicUrl}</p>
                <p className="mt-2 text-xs text-stone-500">
                  Navigate to this link on the TV browser. Keep the tab open — the board stays live.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="disp-name">
                  <Input
                    id="disp-name"
                    value={selected.name}
                    onChange={(e) => void patchSelected({ name: e.target.value })}
                  />
                </Field>
                <Field label="Mode" htmlFor="disp-mode">
                  <Select
                    id="disp-mode"
                    value={selected.mode}
                    onChange={(e) =>
                      void patchSelected({ mode: e.target.value as DisplayMode })
                    }
                  >
                    <option value="mixed">Branding + featured + full catalog</option>
                    <option value="featured">Branding + featured only</option>
                    <option value="catalog">Branding + full catalog</option>
                  </Select>
                </Field>
                <Field label="Headline" htmlFor="disp-headline">
                  <Input
                    id="disp-headline"
                    value={selected.headline ?? ''}
                    onChange={(e) => void patchSelected({ headline: e.target.value })}
                    placeholder={current.name}
                  />
                </Field>
                <Field label="Tagline" htmlFor="disp-tagline">
                  <Input
                    id="disp-tagline"
                    value={selected.tagline ?? ''}
                    onChange={(e) => void patchSelected({ tagline: e.target.value })}
                    placeholder={`Today’s ${copy.catalogNoun}`}
                  />
                </Field>
                <Field label="Seconds per slide" htmlFor="disp-duration">
                  <Input
                    id="disp-duration"
                    type="number"
                    min={3}
                    max={60}
                    value={selected.slideDurationSec}
                    onChange={(e) =>
                      void patchSelected({
                        slideDurationSec: Number(e.target.value) || 8,
                      })
                    }
                  />
                </Field>
                <div className="flex flex-col justify-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selected.active}
                      onChange={(e) => void patchSelected({ active: e.target.checked })}
                    />
                    Display active
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selected.showPrices}
                      onChange={(e) =>
                        void patchSelected({ showPrices: e.target.checked })
                      }
                    />
                    Show prices
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selected.showSoldOut}
                      onChange={(e) =>
                        void patchSelected({ showSoldOut: e.target.checked })
                      }
                    />
                    Show sold-out items
                  </label>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-stone-800">
                  {copy.catalogNounPlural} on this board
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Leave none selected to auto-include every currently available{' '}
                  {copy.catalogNoun}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {menus.map((menu) => {
                    const on =
                      selected.menuIds.length === 0 ||
                      selected.menuIds.includes(menu.id)
                    const forced = selected.menuIds.includes(menu.id)
                    return (
                      <button
                        key={menu.id}
                        type="button"
                        onClick={() => toggleMenu(menu.id)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-sm',
                          forced
                            ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                            : on
                              ? 'border-stone-200 bg-stone-50 text-stone-600'
                              : 'border-stone-200 text-stone-400',
                        )}
                      >
                        {menu.name}
                        {selected.menuIds.length === 0 ? ' · auto' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">Custom slides</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Optional promo graphics — paste an image URL and optional copy.
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addCustomSlide}>
                    <Plus className="h-3.5 w-3.5" />
                    Add slide
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {selected.customSlides.length === 0 ? (
                    <p className="text-sm text-stone-400">No custom slides yet.</p>
                  ) : (
                    selected.customSlides.map((slide) => (
                      <div
                        key={slide.id}
                        className="space-y-2 rounded-xl border border-stone-200 p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={slide.title ?? ''}
                            onChange={(e) =>
                              updateCustomSlide(slide.id, { title: e.target.value })
                            }
                            placeholder="Title"
                          />
                          <Input
                            value={slide.subtitle ?? ''}
                            onChange={(e) =>
                              updateCustomSlide(slide.id, { subtitle: e.target.value })
                            }
                            placeholder="Subtitle"
                          />
                        </div>
                        <Textarea
                          value={slide.imageUrl ?? ''}
                          onChange={(e) =>
                            updateCustomSlide(slide.id, { imageUrl: e.target.value })
                          }
                          placeholder="Image URL (https://…)"
                          rows={2}
                        />
                        <button
                          type="button"
                          className="text-xs font-medium text-red-600"
                          onClick={() => removeCustomSlide(slide.id)}
                        >
                          Remove slide
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`New ${copy.displayNoun.toLowerCase()}`}
      >
        <div className="space-y-4">
          <Field label="Name" htmlFor="new-disp-name">
            <Input
              id="new-disp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`Front counter ${copy.displayBoardLabel.toLowerCase()}`}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() => void createDisplay()}
            >
              <MonitorPlay className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
