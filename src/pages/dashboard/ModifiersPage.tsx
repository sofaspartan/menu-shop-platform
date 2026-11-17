import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as menuService from '@/services/menuService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { createId, formatMoney } from '@/lib/utils'
import type { ModifierGroup, ModifierOption, ModifierSelectionMode } from '@/types'

type OptionDraft = {
  id: string
  name: string
  priceDollars: string
  available: boolean
  isDefault: boolean
  sortOrder: number
}

type GroupForm = {
  id?: string
  name: string
  description: string
  required: boolean
  minSelections: number
  maxSelections: number
  selectionMode: ModifierSelectionMode
  options: OptionDraft[]
  assignedItemIds: string[]
}

function emptyOption(sortOrder: number): OptionDraft {
  return {
    id: createId('opt'),
    name: '',
    priceDollars: '0.00',
    available: true,
    isDefault: false,
    sortOrder,
  }
}

function emptyForm(): GroupForm {
  return {
    name: '',
    description: '',
    required: false,
    minSelections: 0,
    maxSelections: 1,
    selectionMode: 'single',
    options: [emptyOption(0)],
    assignedItemIds: [],
  }
}

export function ModifiersPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<GroupForm>(emptyForm())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => {
    if (!db || !current) return []
    return db.modifierGroups.filter((g) => g.restaurantId === current.id)
  }, [db, current])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q) ||
        g.options.some((o) => o.name.toLowerCase().includes(q)),
    )
  }, [groups, query])

  const items = useMemo(() => {
    if (!db || !current) return []
    return db.items
      .filter((i) => i.restaurantId === current.id)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [db, current])

  const itemModifiers = useMemo(() => {
    if (!db || !current) return []
    return db.itemModifiers.filter((m) => m.restaurantId === current.id)
  }, [db, current])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to manage modifiers.</p>
  }

  function openCreate() {
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(group: ModifierGroup) {
    const assignedItemIds = itemModifiers
      .filter((m) => m.modifierGroupId === group.id)
      .map((m) => m.itemId)
    setForm({
      id: group.id,
      name: group.name,
      description: group.description || '',
      required: group.required,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      selectionMode: group.selectionMode,
      options: group.options.map((o) => ({
        id: o.id,
        name: o.name,
        priceDollars: (o.priceAdjustmentCents / 100).toFixed(2),
        available: o.available,
        isDefault: !!o.isDefault,
        sortOrder: o.sortOrder,
      })),
      assignedItemIds,
    })
    setError('')
    setModalOpen(true)
  }

  async function saveGroup() {
    if (!user || !current) return
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    if (form.options.some((o) => !o.name.trim())) {
      setError('Every option needs a name.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const options: ModifierOption[] = form.options.map((o, index) => ({
        id: o.id,
        name: o.name.trim(),
        priceAdjustmentCents: Math.round(Number.parseFloat(o.priceDollars || '0') * 100),
        available: o.available,
        isDefault: o.isDefault,
        sortOrder: index,
      }))
      const saved = await menuService.saveModifierGroup(user.id, current.id, {
        id: form.id ?? undefined,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        required: form.required,
        minSelections: form.minSelections,
        maxSelections: form.maxSelections,
        selectionMode: form.selectionMode,
        options,
      })

      const previouslyAssigned = new Set(
        itemModifiers.filter((m) => m.modifierGroupId === saved.id).map((m) => m.itemId),
      )
      const nextAssigned = new Set(form.assignedItemIds)
      const touched = new Set([...previouslyAssigned, ...nextAssigned])

      for (const itemId of touched) {
        const currentGroups = itemModifiers
          .filter((m) => m.itemId === itemId)
          .map((m) => m.modifierGroupId)
          .filter((gid) => gid !== saved.id)
        if (nextAssigned.has(itemId)) currentGroups.push(saved.id)
        await menuService.setItemModifierGroups(user.id, current.id, itemId, currentGroups)
      }

      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save modifier group')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Modifiers</h1>
          <p className="mt-1 text-stone-500">
            Build reusable option groups and attach them to items in your library.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New group
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder="Search modifiers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <EmptyState
          title={query ? 'No matching modifiers' : 'No modifier groups'}
          description="Create size, add-on, or preparation choices customers can select."
          actionLabel={query ? undefined : 'Create group'}
          onAction={query ? undefined : openCreate}
        />
      ) : (
        <div className="grid gap-3">
          {filteredGroups.map((group) => {
            const assigned = itemModifiers.filter((m) => m.modifierGroupId === group.id)
            return (
              <div key={group.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl">{group.name}</h2>
                      <Badge>{group.selectionMode}</Badge>
                      {group.required ? <Badge tone="accent">Required</Badge> : null}
                      <Badge tone="neutral">
                        {group.minSelections}–{group.maxSelections}
                      </Badge>
                    </div>
                    {group.description ? (
                      <p className="mt-1 text-sm text-stone-600">{group.description}</p>
                    ) : null}
                    <ul className="mt-3 space-y-1 text-sm text-stone-600">
                      {group.options.map((o) => (
                        <li key={o.id}>
                          {o.name}
                          {o.priceAdjustmentCents
                            ? ` (${o.priceAdjustmentCents > 0 ? '+' : ''}${formatMoney(o.priceAdjustmentCents)})`
                            : ''}
                          {o.isDefault ? ' · default' : ''}
                          {!o.available ? ' · unavailable' : ''}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-stone-500">
                      Assigned to {assigned.length} item{assigned.length === 1 ? '' : 's'}
                      {assigned.length
                        ? `: ${assigned
                            .map((a) => items.find((i) => i.id === a.itemId)?.name)
                            .filter(Boolean)
                            .join(', ')}`
                        : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openEdit(group)}>
                    Edit
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'Edit modifier group' : 'Create modifier group'}
        wide
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="mod-name">
              <Input
                id="mod-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
            <Field label="Selection mode" htmlFor="mod-mode">
              <Select
                id="mod-mode"
                value={form.selectionMode}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    selectionMode: e.target.value as ModifierSelectionMode,
                    maxSelections:
                      e.target.value === 'single' ? 1 : Math.max(f.maxSelections, 1),
                  }))
                }
              >
                <option value="single">Single</option>
                <option value="multi">Multi</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description" htmlFor="mod-desc">
                <Textarea
                  id="mod-desc"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Min selections" htmlFor="mod-min">
              <Input
                id="mod-min"
                type="number"
                min={0}
                value={form.minSelections}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minSelections: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="Max selections" htmlFor="mod-max">
              <Input
                id="mod-max"
                type="number"
                min={1}
                value={form.maxSelections}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxSelections: Number(e.target.value) || 1 }))
                }
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.required}
                onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
              />
              Required
            </label>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium">Options</h3>
              <Button
                size="sm"
                variant="soft"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    options: [...f.options, emptyOption(f.options.length)],
                  }))
                }
              >
                Add option
              </Button>
            </div>
            <div className="space-y-3">
              {form.options.map((opt) => (
                <div
                  key={opt.id}
                  className="grid gap-2 rounded-xl border border-stone-200 p-3 sm:grid-cols-[1fr_120px_auto]"
                >
                  <Input
                    placeholder="Option name"
                    value={opt.name}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        options: f.options.map((o) =>
                          o.id === opt.id ? { ...o, name: e.target.value } : o,
                        ),
                      }))
                    }
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={opt.priceDollars}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        options: f.options.map((o) =>
                          o.id === opt.id ? { ...o, priceDollars: e.target.value } : o,
                        ),
                      }))
                    }
                    aria-label="Price adjustment"
                  />
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={opt.isDefault}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            options: f.options.map((o) =>
                              o.id === opt.id
                                ? { ...o, isDefault: e.target.checked }
                                : f.selectionMode === 'single' && e.target.checked
                                  ? { ...o, isDefault: false }
                                  : o,
                            ),
                          }))
                        }
                      />
                      Default
                    </label>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={opt.available}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            options: f.options.map((o) =>
                              o.id === opt.id ? { ...o, available: e.target.checked } : o,
                            ),
                          }))
                        }
                      />
                      Available
                    </label>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={form.options.length === 1}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          options: f.options.filter((o) => o.id !== opt.id),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">Assign to items</p>
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {items.map((item) => {
                const checked = form.assignedItemIds.includes(item.id)
                return (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          assignedItemIds: checked
                            ? f.assignedItemIds.filter((id) => id !== item.id)
                            : [...f.assignedItemIds, item.id],
                        }))
                      }
                    />
                    {item.name}
                  </label>
                )
              })}
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void saveGroup()}>
              {busy ? 'Saving…' : 'Save group'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
