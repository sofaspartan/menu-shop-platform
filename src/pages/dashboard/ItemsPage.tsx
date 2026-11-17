import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as menuService from '@/services/menuService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { formatMoney } from '@/lib/utils'
import type { ItemAvailability, MenuItem } from '@/types'

type ItemForm = {
  name: string
  shortDescription: string
  fullDescription: string
  basePriceDollars: string
  itemType: MenuItem['itemType']
  dietaryLabelIds: string[]
  allergens: string
  availability: ItemAvailability
  featured: boolean
  active: boolean
  imageUrl: string
  /** One URL per line; extras beyond the primary cover. */
  imageUrls: string
  isCombo: boolean
  trackInventory: boolean
  stockQty: string
}

const emptyForm = (): ItemForm => ({
  name: '',
  shortDescription: '',
  fullDescription: '',
  basePriceDollars: '0.00',
  itemType: 'food',
  dietaryLabelIds: [],
  allergens: '',
  availability: 'available',
  featured: false,
  active: true,
  imageUrl: '',
  imageUrls: '',
  isCombo: false,
  trackInventory: false,
  stockQty: '',
})

function parseImageUrls(raw: string): string[] | undefined {
  const urls = raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
  return urls.length ? urls : undefined
}

function formFromItem(item: MenuItem): ItemForm {
  return {
    name: item.name,
    shortDescription: item.shortDescription,
    fullDescription: item.fullDescription || '',
    basePriceDollars: (item.basePriceCents / 100).toFixed(2),
    itemType: item.itemType,
    dietaryLabelIds: [...item.dietaryLabelIds],
    allergens: item.allergens.join(', '),
    availability: item.availability,
    featured: item.featured,
    active: item.active,
    imageUrl: item.imageUrl || '',
    imageUrls: (item.imageUrls ?? []).join('\n'),
    isCombo: item.isCombo,
    trackInventory: Boolean(item.trackInventory),
    stockQty: item.trackInventory ? String(item.stockQty ?? 0) : '',
  }
}

export function ItemsPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ItemForm>(emptyForm())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const items = useMemo(() => {
    if (!db || !current) return []
    return db.items
      .filter((i) => i.restaurantId === current.id)
      .filter((i) => {
        const q = query.trim().toLowerCase()
        if (!q) return true
        return (
          i.name.toLowerCase().includes(q) ||
          i.shortDescription.toLowerCase().includes(q) ||
          i.itemType.includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current, query])

  const dietaryLabels = useMemo(() => {
    if (!db || !current) return []
    return db.dietaryLabels.filter((l) => l.restaurantId === current.id)
  }, [db, current])

  const assignmentIndex = useMemo(() => {
    if (!db || !current) return new Map<string, string[]>()
    const menus = new Map(db.menus.filter((m) => m.restaurantId === current.id).map((m) => [m.id, m]))
    const sections = new Map(
      db.sections.filter((s) => s.restaurantId === current.id).map((s) => [s.id, s]),
    )
    const map = new Map<string, string[]>()
    for (const a of db.assignments.filter((x) => x.restaurantId === current.id)) {
      const menu = menus.get(a.menuId)
      const section = sections.get(a.sectionId)
      if (!menu || !section) continue
      const label = `${menu.name} → ${section.name}`
      const list = map.get(a.itemId) || []
      list.push(label)
      map.set(a.itemId, list)
    }
    return map
  }, [db, current])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to manage items.</p>
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: MenuItem) {
    setEditingId(item.id)
    setForm(formFromItem(item))
    setError('')
    setModalOpen(true)
  }

  async function saveItem() {
    if (!user || !current || !form.name.trim()) return
    const dollars = Number.parseFloat(form.basePriceDollars)
    if (Number.isNaN(dollars) || dollars < 0) {
      setError('Enter a valid price.')
      return
    }
    setBusy(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      shortDescription: form.shortDescription.trim(),
      fullDescription: form.fullDescription.trim() || undefined,
      basePriceCents: Math.round(dollars * 100),
      itemType: form.isCombo ? ('combo' as const) : form.itemType,
      dietaryLabelIds: form.dietaryLabelIds,
      allergens: form.allergens
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      availability:
        form.trackInventory &&
        Math.max(0, Math.floor(Number.parseInt(form.stockQty, 10) || 0)) <= 0
          ? ('sold_out' as const)
          : form.availability,
      featured: form.featured,
      active: form.active,
      imageUrl: form.imageUrl.trim() || undefined,
      imageUrls: parseImageUrls(form.imageUrls),
      isCombo: form.isCombo,
      trackInventory: form.trackInventory,
      stockQty: form.trackInventory
        ? Math.max(0, Math.floor(Number.parseInt(form.stockQty, 10) || 0))
        : undefined,
    }
    try {
      if (editingId) {
        await menuService.updateItem(user.id, current.id, editingId, payload)
      } else {
        await menuService.createItem(user.id, current.id, payload)
      }
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save item')
    } finally {
      setBusy(false)
    }
  }

  async function quickAvailability(itemId: string, availability: ItemAvailability) {
    if (!user || !current) return
    await menuService.updateItemAvailability(user.id, current.id, itemId, availability)
  }

  async function removeItem(itemId: string) {
    if (!user || !current) return
    if (!window.confirm('Delete this item from the library? Assignments will be removed.')) return
    await menuService.deleteItem(user.id, current.id, itemId)
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Item library</h1>
          <p className="mt-1 text-stone-500">
            Maintain a single catalog of items, then assign them to menu sections.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/dashboard/combos"
            className="inline-flex h-10 items-center rounded-xl border border-stone-300 px-4 text-sm font-medium hover:bg-stone-50"
          >
            Manage combos
          </Link>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New item
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={query ? 'No matching items' : 'No items yet'}
          description="Create food, drinks, and combos for your menus."
          actionLabel={query ? undefined : 'Create item'}
          onAction={query ? undefined : openCreate}
        />
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const placements = assignmentIndex.get(item.id) || []
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl">{item.name}</h2>
                      <Badge>{item.itemType}</Badge>
                      {item.featured ? <Badge tone="accent">Featured</Badge> : null}
                      {item.isCombo ? <Badge tone="brand">Combo</Badge> : null}
                      <Badge
                        tone={
                          item.availability === 'available'
                            ? 'success'
                            : item.availability === 'sold_out'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {item.availability.replaceAll('_', ' ')}
                      </Badge>
                      {!item.active ? <Badge tone="warning">Inactive</Badge> : null}
                      {item.trackInventory ? (
                        <Badge tone={(item.stockQty ?? 0) <= 0 ? 'danger' : 'neutral'}>
                          Stock {item.stockQty ?? 0}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-600">{item.shortDescription}</p>
                    <p className="mt-1 font-medium">{formatMoney(item.basePriceCents)}</p>
                    <p className="mt-2 text-xs text-stone-500">
                      {placements.length > 0
                        ? `On: ${placements.join(' · ')}`
                        : 'Not assigned to any menu section'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.availability === 'sold_out' ? (
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => void quickAvailability(item.id, 'available')}
                      >
                        Mark available
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void quickAvailability(item.id, 'sold_out')}
                      >
                        Mark sold out
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void removeItem(item.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit item' : 'Create item'}
        wide
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="item-name">
            <Input
              id="item-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </Field>
          <Field label="Base price (USD)" htmlFor="item-price">
            <Input
              id="item-price"
              type="number"
              min="0"
              step="0.01"
              value={form.basePriceDollars}
              onChange={(e) => setForm((f) => ({ ...f, basePriceDollars: e.target.value }))}
            />
          </Field>
          <Field label="Short description" htmlFor="item-short">
            <Input
              id="item-short"
              value={form.shortDescription}
              onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
            />
          </Field>
          <Field label="Item type" htmlFor="item-type">
            <Select
              id="item-type"
              value={form.itemType}
              disabled={form.isCombo}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  itemType: e.target.value as MenuItem['itemType'],
                }))
              }
            >
              <option value="food">Food</option>
              <option value="drink">Drink</option>
              <option value="product">Product</option>
              <option value="combo">Combo</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Full description" htmlFor="item-full">
              <Textarea
                id="item-full"
                value={form.fullDescription}
                onChange={(e) => setForm((f) => ({ ...f, fullDescription: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Cover image URL" htmlFor="item-image">
            <Input
              id="item-image"
              value={form.imageUrl}
              onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
              placeholder="https://"
            />
          </Field>
          <Field label="Availability" htmlFor="item-avail">
            <Select
              id="item-avail"
              value={form.availability}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  availability: e.target.value as ItemAvailability,
                }))
              }
            >
              <option value="available">Available</option>
              <option value="temporarily_unavailable">Temporarily unavailable</option>
              <option value="sold_out">Sold out</option>
              <option value="hidden">Hidden</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Gallery image URLs"
              htmlFor="item-gallery"
              hint="One URL per line. Shown as thumbnails under the cover in the product modal."
            >
              <Textarea
                id="item-gallery"
                value={form.imageUrls}
                onChange={(e) => setForm((f) => ({ ...f, imageUrls: e.target.value }))}
                placeholder={'https://…\nhttps://…'}
                rows={3}
              />
            </Field>
          </div>
          <div className="sm:col-span-2 space-y-3 rounded-xl border border-stone-200 bg-stone-50/80 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={form.trackInventory}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    trackInventory: e.target.checked,
                    stockQty: e.target.checked ? f.stockQty || '0' : '',
                  }))
                }
                className="h-4 w-4 rounded border-stone-300"
              />
              Track inventory
            </label>
            <p className="text-xs text-stone-500">
              Retail: units on hand. Restaurant: prepared portions / servings. When stock hits
              zero the item is marked sold out on the storefront automatically.
            </p>
            {form.trackInventory ? (
              <Field label="Stock quantity" htmlFor="item-stock">
                <Input
                  id="item-stock"
                  type="number"
                  min={0}
                  value={form.stockQty}
                  onChange={(e) => setForm((f) => ({ ...f, stockQty: e.target.value }))}
                />
              </Field>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <Field label="Allergens (comma-separated)" htmlFor="item-allergens">
              <Input
                id="item-allergens"
                value={form.allergens}
                onChange={(e) => setForm((f) => ({ ...f, allergens: e.target.value }))}
                placeholder="gluten, dairy, nuts"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-stone-700">Dietary labels</p>
            <div className="flex flex-wrap gap-3">
              {dietaryLabels.map((label) => {
                const checked = form.dietaryLabelIds.includes(label.id)
                return (
                  <label key={label.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          dietaryLabelIds: checked
                            ? f.dietaryLabelIds.filter((id) => id !== label.id)
                            : [...f.dietaryLabelIds, label.id],
                        }))
                      }
                    />
                    {label.name}
                  </label>
                )
              })}
              {dietaryLabels.length === 0 ? (
                <span className="text-sm text-stone-500">No dietary labels configured.</span>
              ) : null}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
            />
            Featured
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isCombo}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  isCombo: e.target.checked,
                  itemType: e.target.checked ? 'combo' : f.itemType === 'combo' ? 'food' : f.itemType,
                }))
              }
            />
            This is a combo (configure components on the Combos page)
          </label>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !form.name.trim()} onClick={() => void saveItem()}>
            {busy ? 'Saving…' : 'Save item'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
