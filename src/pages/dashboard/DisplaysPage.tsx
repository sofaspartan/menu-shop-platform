import { useMemo, useState } from 'react'
import { Copy, ExternalLink, MonitorPlay, Plus, Search, Trash2 } from 'lucide-react'
import { IconAction } from '@/components/ui/IconAction'
import type {
  Display,
  DisplayGraphicSlide,
  DisplayItemSlide,
  BrandingLayout,
  DisplayKind,
  FeaturedCatalogScope,
  FeaturedSource,
  GraphicsChrome,
  MenuBoardLayout,
  MenuCatalogScope,
} from '@/types'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as displayService from '@/services/displayService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { displayKindLabel, normalizeDisplay } from '@/lib/normalizeDisplay'
import { storeCopy } from '@/lib/storeCopy'
import { cn, formatMoney } from '@/lib/utils'

const KIND_OPTIONS: Array<{ id: DisplayKind; blurb: string }> = [
  {
    id: 'menu',
    blurb:
      'Above-counter ordering board — sections with offerings, prices, and imagery. Not a slideshow.',
  },
  {
    id: 'branding',
    blurb: 'Logo + title on a background image — a simple brand sign.',
  },
  {
    id: 'graphics',
    blurb: 'Fullscreen or framed slideshow of custom graphics you add.',
  },
  {
    id: 'featured',
    blurb: 'Auto featured items, or hand-built pages with one or many products.',
  },
]

export function DisplaysPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const copy = storeCopy(current?.storeKind)

  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<DisplayKind>('menu')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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

  const sections = useMemo(() => {
    if (!db || !current) return []
    return db.sections
      .filter((s) => s.restaurantId === current.id && !s.hidden)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }, [db, current])

  const catalogItems = useMemo(() => {
    if (!db || !current) return []
    return db.items
      .filter((i) => i.restaurantId === current.id && i.active)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current])

  const displays = useMemo(() => {
    if (!db || !current) return [] as Display[]
    return (db.displays ?? [])
      .filter((d) => d.restaurantId === current.id)
      .map(normalizeDisplay)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current])

  const filteredDisplays = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return displays
    return displays.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.slug.toLowerCase().includes(q) ||
        displayKindLabel(d.kind).toLowerCase().includes(q) ||
        (d.headline || '').toLowerCase().includes(q) ||
        (d.tagline || '').toLowerCase().includes(q),
    )
  }, [displays, query])

  const selected =
    filteredDisplays.find((d) => d.id === selectedId) ??
    displays.find((d) => d.id === selectedId) ??
    filteredDisplays[0] ??
    displays[0] ??
    null

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
        kind: createKind,
        headline: createKind === 'menu' ? 'Menu' : current.name,
        tagline:
          createKind === 'branding'
            ? `Welcome to ${current.name}`
            : createKind === 'featured'
              ? `Featured ${copy.itemNounPlural.toLowerCase()}`
              : undefined,
        backgroundImageUrl: current.coverImageUrl,
      })
      setSelectedId(created.id)
      setCreateOpen(false)
      setName('')
      setCreateKind('menu')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create display.')
    } finally {
      setBusy(false)
    }
  }

  async function patchSelected(patch: displayService.DisplayPatch) {
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
    const nextMenuIds = has
      ? selected.menuIds.filter((id) => id !== menuId)
      : [...selected.menuIds, menuId]
    // Drop section picks that no longer belong to the selected menus.
    const allowedSectionIds = new Set(
      sections
        .filter(
          (s) =>
            nextMenuIds.length === 0 || nextMenuIds.includes(s.menuId),
        )
        .map((s) => s.id),
    )
    const nextSectionIds = selected.sectionIds.filter((id) =>
      allowedSectionIds.has(id),
    )
    void patchSelected({
      menuIds: nextMenuIds,
      sectionIds: nextSectionIds,
    })
  }

  function toggleSection(sectionId: string) {
    if (!selected) return
    const has = selected.sectionIds.includes(sectionId)
    void patchSelected({
      sectionIds: has
        ? selected.sectionIds.filter((id) => id !== sectionId)
        : [...selected.sectionIds, sectionId],
    })
  }

  function addGraphicSlide() {
    if (!selected) return
    const slide = displayService.createGraphicSlide({
      title: '',
      sortOrder: selected.graphicSlides.length,
    })
    void patchSelected({ graphicSlides: [...selected.graphicSlides, slide] })
  }

  function updateGraphicSlide(slideId: string, patch: Partial<DisplayGraphicSlide>) {
    if (!selected) return
    void patchSelected({
      graphicSlides: selected.graphicSlides.map((s) =>
        s.id === slideId ? { ...s, ...patch } : s,
      ),
    })
  }

  function removeGraphicSlide(slideId: string) {
    if (!selected) return
    void patchSelected({
      graphicSlides: selected.graphicSlides.filter((s) => s.id !== slideId),
    })
  }

  function addItemSlide() {
    if (!selected) return
    const slide = displayService.createItemSlide({
      title: `Page ${selected.itemSlides.length + 1}`,
      itemIds: [],
      sortOrder: selected.itemSlides.length,
    })
    void patchSelected({ itemSlides: [...selected.itemSlides, slide] })
  }

  function updateItemSlide(slideId: string, patch: Partial<DisplayItemSlide>) {
    if (!selected) return
    void patchSelected({
      itemSlides: selected.itemSlides.map((s) =>
        s.id === slideId ? { ...s, ...patch } : s,
      ),
    })
  }

  function removeItemSlide(slideId: string) {
    if (!selected) return
    void patchSelected({
      itemSlides: selected.itemSlides.filter((s) => s.id !== slideId),
    })
  }

  function toggleItemOnSlide(slide: DisplayItemSlide, itemId: string) {
    const has = slide.itemIds.includes(itemId)
    updateItemSlide(slide.id, {
      itemIds: has
        ? slide.itemIds.filter((id) => id !== itemId)
        : [...slide.itemIds, itemId],
    })
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{copy.displayNounPlural}</h1>
          <p className="mt-1 max-w-2xl text-stone-500">
            Create ordering boards, branding signs, graphic slideshows, or featured{' '}
            {copy.itemNoun} boards. Each gets a public URL for a TV — updates live with your
            catalog and availability.
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
          description="Pick a board type, then open its link on a TV or tablet."
          actionLabel="Create display"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <>
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              className="pl-9"
              placeholder={`Search ${copy.displayNounPlural.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {filteredDisplays.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-6 text-sm text-stone-500">
                No matches for “{query.trim()}”.
              </p>
            ) : null}
            {filteredDisplays.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  'w-full rounded-2xl border px-4 py-3 text-left',
                  (selected?.id ?? '') === d.id
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                    : 'border-stone-200 bg-white hover:border-stone-300',
                )}
              >
                <div className="font-medium">{d.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
                  <span>{displayKindLabel(d.kind)}</span>
                  <span>· /{d.slug}</span>
                </div>
                <div className="mt-2">
                  <Badge tone={d.active ? 'success' : 'neutral'}>
                    {d.active ? 'On' : 'Off'}
                  </Badge>
                </div>
              </button>
            ))}
          </div>

          {selected ? (
            <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl">{selected.name}</h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {displayKindLabel(selected.kind)} · /{selected.slug}
                  </p>
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
                  <IconAction
                    label={`Delete ${copy.displayNoun.toLowerCase()}`}
                    danger
                    onClick={() => void removeSelected()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconAction>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
                  Public display URL
                </p>
                <p className="mt-1 break-all font-mono text-sm text-stone-700">{publicUrl}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="disp-name">
                  <Input
                    id="disp-name"
                    value={selected.name}
                    onChange={(e) => void patchSelected({ name: e.target.value })}
                  />
                </Field>
                <Field label="Board type" htmlFor="disp-kind">
                  <Select
                    id="disp-kind"
                    value={selected.kind}
                    onChange={(e) =>
                      void patchSelected({ kind: e.target.value as DisplayKind })
                    }
                  >
                    {KIND_OPTIONS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {displayKindLabel(k.id)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={
                    selected.kind === 'menu'
                      ? 'Board title'
                      : 'Headline'
                  }
                  htmlFor="disp-headline"
                >
                  <Input
                    id="disp-headline"
                    value={selected.headline ?? ''}
                    onChange={(e) => void patchSelected({ headline: e.target.value })}
                    placeholder={
                      selected.kind === 'menu' ? 'Menu' : current.name
                    }
                  />
                </Field>
                <Field label="Tagline" htmlFor="disp-tagline">
                  <Input
                    id="disp-tagline"
                    value={selected.tagline ?? ''}
                    onChange={(e) => void patchSelected({ tagline: e.target.value })}
                  />
                </Field>
                {selected.kind !== 'branding' && selected.kind !== 'menu' ? (
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
                ) : null}
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
                      checked={selected.showLogo}
                      onChange={(e) => void patchSelected({ showLogo: e.target.checked })}
                    />
                    Show logo
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selected.showStoreName}
                      onChange={(e) =>
                        void patchSelected({ showStoreName: e.target.checked })
                      }
                    />
                    Show store name
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      checked={selected.showDate}
                      onChange={(e) =>
                        void patchSelected({ showDate: e.target.checked })
                      }
                    />
                    Show date
                  </label>
                </div>
              </div>

              {selected.kind === 'menu' ? (
                <div className="space-y-4 rounded-xl border border-stone-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">
                      Ordering {copy.catalogNoun.toLowerCase()} board
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Static above-counter board (no scrolling). Use visual cards when you
                      have room, or a dense columned list for longer menus. Store name stays
                      in the header — board title defaults to “Menu”.
                    </p>
                  </div>

                  <Field label="Layout" htmlFor="disp-menu-layout">
                    <Select
                      id="disp-menu-layout"
                      value={selected.menuLayout}
                      onChange={(e) =>
                        void patchSelected({
                          menuLayout: e.target.value as MenuBoardLayout,
                        })
                      }
                    >
                      <option value="cards">
                        Visual cards — imagery-friendly section panels
                      </option>
                      <option value="columns">
                        Traditional columns — dense listed categories (no cards)
                      </option>
                    </Select>
                  </Field>

                  <div className="flex flex-wrap gap-4">
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
                    {selected.menuLayout === 'cards' ? (
                      <label className="flex items-center gap-2 text-sm text-stone-700">
                        <input
                          type="checkbox"
                          checked={selected.showItemImages}
                          onChange={(e) =>
                            void patchSelected({ showItemImages: e.target.checked })
                          }
                        />
                        Show imagery
                      </label>
                    ) : null}
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

                  <Field label="What to show" htmlFor="disp-menu-scope">
                    <Select
                      id="disp-menu-scope"
                      value={selected.menuCatalogScope}
                      onChange={(e) =>
                        void patchSelected({
                          menuCatalogScope: e.target.value as MenuCatalogScope,
                          ...(e.target.value === 'daypart'
                            ? { menuIds: [], sectionIds: [] }
                            : {}),
                        })
                      }
                    >
                      <option value="daypart">
                        Time of day — sections from {copy.catalogNounPlural.toLowerCase()}{' '}
                        currently serving
                      </option>
                      <option value="custom">
                        Custom — pick {copy.catalogNounPlural.toLowerCase()} and sections
                      </option>
                    </Select>
                  </Field>

                  {selected.menuCatalogScope === 'daypart' ? (
                    <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                      This board updates with whatever {copy.catalogNounPlural.toLowerCase()}{' '}
                      are live right now based on their schedules (breakfast, lunch,
                      dinner…).
                    </p>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                          {copy.catalogNounPlural}
                        </h4>
                        <p className="mt-1 text-xs text-stone-500">
                          Optional filter. Leave none selected to include every active{' '}
                          {copy.catalogNoun.toLowerCase()}.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {menus.map((menu) => {
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
                                    : selected.menuIds.length === 0
                                      ? 'border-stone-200 bg-stone-50 text-stone-600'
                                      : 'border-stone-200 text-stone-400',
                                )}
                              >
                                {menu.name}
                                {selected.menuIds.length === 0 ? ' · all' : ''}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                          Sections
                        </h4>
                        <p className="mt-1 text-xs text-stone-500">
                          Leave none selected to show every section on the{' '}
                          {copy.catalogNounPlural.toLowerCase()} above. Pick one or more
                          (e.g. mains + drinks) to pin exactly what’s on the board.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sections
                            .filter(
                              (s) =>
                                selected.menuIds.length === 0 ||
                                selected.menuIds.includes(s.menuId),
                            )
                            .map((section) => {
                              const forced = selected.sectionIds.includes(section.id)
                              const menuName =
                                menus.find((m) => m.id === section.menuId)?.name ?? ''
                              return (
                                <button
                                  key={section.id}
                                  type="button"
                                  onClick={() => toggleSection(section.id)}
                                  className={cn(
                                    'rounded-lg border px-3 py-1.5 text-sm',
                                    forced
                                      ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                                      : selected.sectionIds.length === 0
                                        ? 'border-stone-200 bg-stone-50 text-stone-600'
                                        : 'border-stone-200 text-stone-400',
                                  )}
                                >
                                  {section.name}
                                  {menuName ? (
                                    <span className="opacity-60"> · {menuName}</span>
                                  ) : null}
                                  {selected.sectionIds.length === 0 ? ' · all' : ''}
                                </button>
                              )
                            })}
                          {sections.length === 0 ? (
                            <p className="text-sm text-stone-400">
                              No sections yet — add them under {copy.catalogNounPlural}.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {selected.kind === 'branding' ? (
                <div className="space-y-4 rounded-xl border border-stone-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">Branding sign</h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Full-bleed centered logo and title, or the framed card look with the
                      header chrome. Leave the image blank to use the store cover photo.
                    </p>
                  </div>
                  <Field label="Layout" htmlFor="disp-branding-layout">
                    <Select
                      id="disp-branding-layout"
                      value={selected.brandingLayout}
                      onChange={(e) =>
                        void patchSelected({
                          brandingLayout: e.target.value as BrandingLayout,
                        })
                      }
                    >
                      <option value="fullbleed">
                        Full bleed — logo + title centered on the image
                      </option>
                      <option value="card">
                        Card — framed panel with title toward the bottom
                      </option>
                    </Select>
                  </Field>
                  <Field label="Background image URL" htmlFor="disp-bg">
                    <Textarea
                      id="disp-bg"
                      rows={2}
                      value={selected.backgroundImageUrl ?? ''}
                      onChange={(e) =>
                        void patchSelected({ backgroundImageUrl: e.target.value })
                      }
                      placeholder={current.coverImageUrl || 'https://…'}
                    />
                  </Field>
                </div>
              ) : null}

              {selected.kind === 'graphics' ? (
                <div className="space-y-4 rounded-xl border border-stone-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800">
                        Graphics slideshow
                      </h3>
                      <p className="mt-1 text-xs text-stone-500">
                        Add one or more image URLs. They rotate full-screen or inside a
                        framed layout with header and footer pills.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addGraphicSlide}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add graphic
                    </Button>
                  </div>
                  <Field label="Layout" htmlFor="disp-chrome">
                    <Select
                      id="disp-chrome"
                      value={selected.graphicsChrome}
                      onChange={(e) =>
                        void patchSelected({
                          graphicsChrome: e.target.value as GraphicsChrome,
                        })
                      }
                    >
                      <option value="fullscreen">Full screen slideshow</option>
                      <option value="framed">
                        Header (logo + name + date) + footer pills
                      </option>
                    </Select>
                  </Field>
                  <div className="space-y-3">
                    {selected.graphicSlides.length === 0 ? (
                      <p className="text-sm text-stone-400">No graphics yet.</p>
                    ) : (
                      selected.graphicSlides.map((slide, index) => (
                        <div
                          key={slide.id}
                          className="space-y-2 rounded-xl border border-stone-200 p-3"
                        >
                          <p className="text-xs font-medium text-stone-400">
                            Slide {index + 1}
                          </p>
                          <Textarea
                            value={slide.imageUrl}
                            onChange={(e) =>
                              updateGraphicSlide(slide.id, { imageUrl: e.target.value })
                            }
                            placeholder="Image URL (https://…)"
                            rows={2}
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input
                              value={slide.title ?? ''}
                              onChange={(e) =>
                                updateGraphicSlide(slide.id, { title: e.target.value })
                              }
                              placeholder="Optional title"
                            />
                            <Input
                              value={slide.subtitle ?? ''}
                              onChange={(e) =>
                                updateGraphicSlide(slide.id, {
                                  subtitle: e.target.value,
                                })
                              }
                              placeholder="Optional subtitle"
                            />
                          </div>
                          <IconAction
                            label="Remove slide"
                            danger
                            onClick={() => removeGraphicSlide(slide.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconAction>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}

              {selected.kind === 'featured' ? (
                <div className="space-y-4 rounded-xl border border-stone-200 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">
                      Featured {copy.itemNounPlural.toLowerCase()}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500">
                      Auto-fill from featured catalog items, or build each page yourself
                      with one or multiple {copy.itemNounPlural.toLowerCase()}.
                    </p>
                  </div>

                  <Field label="Content source" htmlFor="disp-source">
                    <Select
                      id="disp-source"
                      value={selected.featuredSource}
                      onChange={(e) =>
                        void patchSelected({
                          featuredSource: e.target.value as FeaturedSource,
                        })
                      }
                    >
                      <option value="auto">
                        Auto — featured {copy.itemNounPlural.toLowerCase()} from catalog
                      </option>
                      <option value="manual">
                        Manual — create / edit / delete slides yourself
                      </option>
                    </Select>
                  </Field>

                  <div className="flex flex-wrap gap-4">
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

                  {selected.featuredSource === 'auto' ? (
                    <>
                      <Field label="Items per slide" htmlFor="disp-per">
                        <Input
                          id="disp-per"
                          type="number"
                          min={1}
                          max={8}
                          value={selected.itemsPerAutoSlide}
                          onChange={(e) =>
                            void patchSelected({
                              itemsPerAutoSlide: Number(e.target.value) || 4,
                            })
                          }
                        />
                      </Field>
                      <p className="text-xs text-stone-500">
                        Set to 1 for a full-bleed image + details layout. Slide titles become
                        “Featured drink”, “Featured product”, etc. from the section or{' '}
                        {copy.catalogNoun}.
                      </p>

                      <Field label="Pull featured from" htmlFor="disp-catalog-scope">
                        <Select
                          id="disp-catalog-scope"
                          value={selected.featuredCatalogScope}
                          onChange={(e) =>
                            void patchSelected({
                              featuredCatalogScope: e.target
                                .value as FeaturedCatalogScope,
                              ...(e.target.value === 'daypart' ? { menuIds: [] } : {}),
                            })
                          }
                        >
                          <option value="daypart">
                            Currently serving — follow today’s schedule (breakfast / lunch /
                            dinner…)
                          </option>
                          <option value="menus">
                            Selected {copy.catalogNounPlural.toLowerCase()} — pick breakfast,
                            lunch, dinner, etc.
                          </option>
                        </Select>
                      </Field>

                      {selected.featuredCatalogScope === 'daypart' ? (
                        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-600">
                          This board updates with whatever {copy.catalogNounPlural.toLowerCase()}{' '}
                          are live right now based on their schedules.
                        </p>
                      ) : (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                            {copy.catalogNounPlural}
                          </h4>
                          <p className="mt-1 text-xs text-stone-500">
                            Pick one or more (e.g. Breakfast + Drinks). Leave none selected to
                            include every active {copy.catalogNoun.toLowerCase()}.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {menus.map((menu) => {
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
                                      : selected.menuIds.length === 0
                                        ? 'border-stone-200 bg-stone-50 text-stone-600'
                                        : 'border-stone-200 text-stone-400',
                                  )}
                                >
                                  {menu.name}
                                  {selected.menuIds.length === 0 ? ' · all' : ''}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-stone-800">Manual slides</h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addItemSlide}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add slide
                        </Button>
                      </div>
                      {selected.itemSlides.length === 0 ? (
                        <p className="text-sm text-stone-400">
                          No slides yet — add a page, then pick {copy.itemNounPlural.toLowerCase()}.
                        </p>
                      ) : (
                        selected.itemSlides.map((slide, index) => (
                          <div
                            key={slide.id}
                            className="space-y-3 rounded-xl border border-stone-200 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-medium text-stone-400">
                                Slide {index + 1}
                              </p>
                              <IconAction
                                label="Delete slide"
                                danger
                                onClick={() => removeItemSlide(slide.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconAction>
                            </div>
                            <Input
                              value={slide.title ?? ''}
                              onChange={(e) =>
                                updateItemSlide(slide.id, { title: e.target.value })
                              }
                              placeholder="Slide title (blank = Featured drink / Featured entree…)"
                            />
                            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-100 p-2">
                              {catalogItems.map((item) => {
                                const on = slide.itemIds.includes(item.id)
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => toggleItemOnSlide(slide, item.id)}
                                    className={cn(
                                      'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm',
                                      on
                                        ? 'bg-[var(--color-brand-soft)] text-[var(--color-brand)]'
                                        : 'hover:bg-stone-50 text-stone-700',
                                    )}
                                  >
                                    <span className="truncate">{item.name}</span>
                                    <span className="shrink-0 text-xs opacity-70">
                                      {formatMoney(item.basePriceCents)}
                                      {on ? ' · on' : ''}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                            <p className="text-xs text-stone-500">
                              {slide.itemIds.length}{' '}
                              {slide.itemIds.length === 1
                                ? copy.itemNoun.toLowerCase()
                                : copy.itemNounPlural.toLowerCase()}{' '}
                              on this page
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        </>
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
          <div className="space-y-2">
            <p className="text-sm font-medium text-stone-800">Board type</p>
            {KIND_OPTIONS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setCreateKind(k.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-3 text-left',
                  createKind === k.id
                    ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                    : 'border-stone-200 hover:border-stone-300',
                )}
              >
                <p className="text-sm font-semibold text-stone-900">
                  {displayKindLabel(k.id)}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">{k.blurb}</p>
              </button>
            ))}
          </div>
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
