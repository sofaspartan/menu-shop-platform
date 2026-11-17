import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { IconAction } from '@/components/ui/IconAction'
import { storeCopy } from '@/lib/storeCopy'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import { useDb } from '@/hooks/useDb'
import * as menuService from '@/services/menuService'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal, ModalTabs, useModalTab } from '@/components/ui/Modal'
import { createId, formatMoney } from '@/lib/utils'
import type { ComboComponentGroup, ComboConfig, MenuItem } from '@/types'

type GroupDraft = {
  id: string
  name: string
  description: string
  required: boolean
  minQuantity: number
  maxQuantity: number
  allowedItemIds: string[]
  includedItemId: string
  upgrades: Array<{ itemId: string; dollars: string }>
}

function emptyGroup(): GroupDraft {
  return {
    id: createId('cg'),
    name: '',
    description: '',
    required: true,
    minQuantity: 1,
    maxQuantity: 1,
    allowedItemIds: [],
    includedItemId: '',
    upgrades: [],
  }
}

function draftFromCombo(combo: ComboConfig): GroupDraft[] {
  return combo.componentGroups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description || '',
    required: g.required,
    minQuantity: g.minQuantity,
    maxQuantity: g.maxQuantity,
    allowedItemIds: [...g.allowedItemIds],
    includedItemId: g.includedItemId || '',
    upgrades: Object.entries(g.upgradeChargesCents).map(([itemId, cents]) => ({
      itemId,
      dollars: (cents / 100).toFixed(2),
    })),
  }))
}

export function CombosPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()
  const copy = storeCopy(current?.storeKind)
  const [modalOpen, setModalOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [basePriceDollars, setBasePriceDollars] = useState('0.00')
  const [salePriceDollars, setSalePriceDollars] = useState('')
  const [groups, setGroups] = useState<GroupDraft[]>([emptyGroup()])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [modalTab, setModalTab] = useModalTab<'pricing' | 'components'>(
    'pricing',
    modalOpen,
  )

  const items = useMemo(() => {
    if (!db || !current) return []
    return db.items.filter((i) => i.restaurantId === current.id)
  }, [db, current])

  const comboItems = useMemo(
    () => items.filter((i) => i.isCombo || i.itemType === 'combo'),
    [items],
  )

  const filteredComboItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return comboItems
    return comboItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.shortDescription || '').toLowerCase().includes(q) ||
        (i.fullDescription || '').toLowerCase().includes(q),
    )
  }, [comboItems, query])

  const combos = useMemo(() => {
    if (!db || !current) return []
    return db.combos.filter((c) => c.restaurantId === current.id)
  }, [db, current])

  const componentChoices = items.filter((i) => !i.isCombo)

  if (!current || !user) {
    return (
      <p className="text-sm text-stone-500">
        {copy.selectStoreToManage(copy.comboNounPlural.toLowerCase())}
      </p>
    )
  }

  function openCreate() {
    setSelectedItemId('')
    setBasePriceDollars('12.00')
    setSalePriceDollars('')
    setGroups([emptyGroup()])
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: MenuItem) {
    const combo = combos.find((c) => c.itemId === item.id)
    setSelectedItemId(item.id)
    setBasePriceDollars(((combo?.basePriceCents ?? item.basePriceCents) / 100).toFixed(2))
    const saleCents = combo?.salePriceCents ?? item.salePriceCents
    setSalePriceDollars(
      saleCents != null ? (saleCents / 100).toFixed(2) : '',
    )
    setGroups(combo ? draftFromCombo(combo) : [emptyGroup()])
    setError('')
    setModalOpen(true)
  }

  async function removeCombo(item: MenuItem) {
    if (!user || !current) return
    if (
      !window.confirm(
        `Delete “${item.name}”? This removes the ${copy.comboNoun} and its catalog item.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await menuService.deleteCombo(user.id, current.id, item.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not delete ${copy.comboNoun}`)
    } finally {
      setBusy(false)
    }
  }

  async function ensureComboItem(): Promise<string> {
    if (!user || !current) throw new Error('Not signed in')
    if (selectedItemId) return selectedItemId
    const created = await menuService.createItem(user.id, current.id, {
      name: `New ${copy.comboNoun}`,
      shortDescription: `Build-your-own ${copy.comboNoun}`,
      basePriceCents: Math.round(Number.parseFloat(basePriceDollars || '0') * 100),
      itemType: 'combo',
      isCombo: true,
    })
    return created.id
  }

  async function saveCombo() {
    if (!user || !current) return
    const dollars = Number.parseFloat(basePriceDollars)
    if (Number.isNaN(dollars) || dollars < 0) {
      setError('Enter a valid base price.')
      return
    }
    const saleTrim = salePriceDollars.trim()
    let salePriceCents: number | undefined
    if (saleTrim) {
      const saleDollars = Number.parseFloat(saleTrim)
      if (Number.isNaN(saleDollars) || saleDollars < 0) {
        setError('Enter a valid sale price, or leave it blank.')
        return
      }
      salePriceCents = Math.round(saleDollars * 100)
      if (salePriceCents >= Math.round(dollars * 100)) {
        setError('Sale price must be lower than the base price.')
        return
      }
    }
    if (groups.some((g) => !g.name.trim() || g.allowedItemIds.length === 0)) {
      setError('Each component group needs a name and at least one allowed item.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const itemId = await ensureComboItem()
      const componentGroups: ComboComponentGroup[] = groups.map((g) => {
        const upgradeChargesCents: Record<string, number> = {}
        for (const u of g.upgrades) {
          const cents = Math.round(Number.parseFloat(u.dollars || '0') * 100)
          if (u.itemId && !Number.isNaN(cents)) upgradeChargesCents[u.itemId] = cents
        }
        return {
          id: g.id,
          name: g.name.trim(),
          description: g.description.trim() || undefined,
          required: g.required,
          minQuantity: g.minQuantity,
          maxQuantity: g.maxQuantity,
          allowedItemIds: g.allowedItemIds,
          includedItemId: g.includedItemId || undefined,
          upgradeChargesCents,
        }
      })
      const combo: ComboConfig = {
        itemId,
        restaurantId: current.id,
        basePriceCents: Math.round(dollars * 100),
        salePriceCents,
        componentGroups,
      }
      await menuService.saveCombo(user.id, current.id, combo)
      if (selectedItemId) {
        await menuService.updateItem(user.id, current.id, itemId, {
          isCombo: true,
          itemType: 'combo',
          basePriceCents: combo.basePriceCents,
          salePriceCents,
        })
      }
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not save ${copy.comboNoun}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">{copy.comboNounPlural}</h1>
          <p className="mt-1 text-stone-500">
            Configure component groups, included {copy.itemNounPlural.toLowerCase()}, and upgrade
            charges for {copy.comboNounPlural.toLowerCase()}.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New {copy.comboNoun} config
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder={`Search ${copy.comboNounPlural.toLowerCase()}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filteredComboItems.length === 0 ? (
        <EmptyState
          title={
            query
              ? `No matching ${copy.comboNounPlural.toLowerCase()}`
              : `No ${copy.comboNounPlural.toLowerCase()} yet`
          }
          description={`Mark an item as a ${copy.comboNoun} in the library, or create a ${copy.comboNoun} config here.`}
          actionLabel={query ? undefined : `Create ${copy.comboNoun}`}
          onAction={query ? undefined : openCreate}
        />
      ) : (
        <div className="grid gap-3">
          {filteredComboItems.map((item) => {
            const combo = combos.find((c) => c.itemId === item.id)
            return (
              <div key={item.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-xl">{item.name}</h2>
                      <Badge tone="brand">Combo</Badge>
                    </div>
                    <p className="mt-1 text-sm text-stone-600">
                      Base {formatMoney(combo?.basePriceCents ?? item.basePriceCents)}
                      {(combo?.salePriceCents ?? item.salePriceCents) != null ? (
                        <>
                          {' '}
                          · Sale{' '}
                          {formatMoney(
                            (combo?.salePriceCents ?? item.salePriceCents) as number,
                          )}
                        </>
                      ) : null}{' '}
                      · {combo?.componentGroups.length ?? 0} component group(s)
                    </p>
                    {combo ? (
                      <ul className="mt-2 space-y-1 text-xs text-stone-500">
                        {combo.componentGroups.map((g) => (
                          <li key={g.id}>
                            {g.name}: {g.allowedItemIds.length} choices
                            {g.includedItemId ? ' · includes default' : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-amber-700">
                        Marked as combo but missing component configuration.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <IconAction
                      label={`Edit ${copy.comboNoun}`}
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </IconAction>
                    <IconAction
                      label={`Delete ${copy.comboNoun}`}
                      danger
                      disabled={busy}
                      onClick={() => void removeCombo(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconAction>
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
        title={`${copy.comboNounTitle} configuration`}
        wide
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void saveCombo()}>
              {busy ? 'Saving…' : `Save ${copy.comboNoun}`}
            </Button>
          </div>
        }
      >
        <ModalTabs
          tabs={[
            { id: 'pricing', label: 'Pricing' },
            { id: 'components', label: 'Components' },
          ]}
          value={modalTab}
          onChange={setModalTab}
        />
        <div className="space-y-5">
          {modalTab === 'pricing' ? (
            <div className="space-y-4">
          <Field label={`${copy.comboNounTitle} item`} htmlFor="combo-item">
            <Select
              id="combo-item"
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
            >
              <option value="">Create a new {copy.comboNoun} item</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                  {i.isCombo ? ` (${copy.comboNoun})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Base price (USD)" htmlFor="combo-price">
            <Input
              id="combo-price"
              type="number"
              min="0"
              step="0.01"
              value={basePriceDollars}
              onChange={(e) => setBasePriceDollars(e.target.value)}
            />
          </Field>
          <Field
            label="Sale price (USD, optional)"
            htmlFor="combo-sale"
            hint="When set below base, this bundle shows on sale on the storefront."
          >
            <Input
              id="combo-sale"
              type="number"
              min="0"
              step="0.01"
              value={salePriceDollars}
              onChange={(e) => setSalePriceDollars(e.target.value)}
              placeholder="Leave blank for no sale"
            />
          </Field>
          </div>
            </div>
          ) : null}

          {modalTab === 'components' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Component groups</h3>
              <Button
                size="sm"
                variant="soft"
                onClick={() => setGroups((g) => [...g, emptyGroup()])}
              >
                Add group
              </Button>
            </div>
            {groups.map((group, index) => (
              <div key={group.id} className="rounded-xl border border-stone-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">Group {index + 1}</span>
                  <IconAction
                    label="Remove group"
                    danger
                    onClick={() => setGroups((gs) => gs.filter((g) => g.id !== group.id))}
                    disabled={groups.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconAction>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <Input
                      value={group.name}
                      onChange={(e) =>
                        setGroups((gs) =>
                          gs.map((g) =>
                            g.id === group.id ? { ...g, name: e.target.value } : g,
                          ),
                        )
                      }
                      placeholder="Choose a main"
                    />
                  </Field>
                  <Field label="Included item (optional)">
                    <Select
                      value={group.includedItemId}
                      onChange={(e) =>
                        setGroups((gs) =>
                          gs.map((g) =>
                            g.id === group.id
                              ? { ...g, includedItemId: e.target.value }
                              : g,
                          ),
                        )
                      }
                    >
                      <option value="">None</option>
                      {componentChoices.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Description">
                      <Textarea
                        value={group.description}
                        onChange={(e) =>
                          setGroups((gs) =>
                            gs.map((g) =>
                              g.id === group.id
                                ? { ...g, description: e.target.value }
                                : g,
                            ),
                          )
                        }
                      />
                    </Field>
                  </div>
                  <Field label="Min quantity">
                    <Input
                      type="number"
                      min={0}
                      value={group.minQuantity}
                      onChange={(e) =>
                        setGroups((gs) =>
                          gs.map((g) =>
                            g.id === group.id
                              ? { ...g, minQuantity: Number(e.target.value) || 0 }
                              : g,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label="Max quantity">
                    <Input
                      type="number"
                      min={1}
                      value={group.maxQuantity}
                      onChange={(e) =>
                        setGroups((gs) =>
                          gs.map((g) =>
                            g.id === group.id
                              ? { ...g, maxQuantity: Number(e.target.value) || 1 }
                              : g,
                          ),
                        )
                      }
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={group.required}
                      onChange={(e) =>
                        setGroups((gs) =>
                          gs.map((g) =>
                            g.id === group.id
                              ? { ...g, required: e.target.checked }
                              : g,
                          ),
                        )
                      }
                    />
                    Required
                  </label>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-sm font-medium text-stone-700">Allowed items</p>
                    <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">
                      {componentChoices.map((item) => {
                        const checked = group.allowedItemIds.includes(item.id)
                        return (
                          <label key={item.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setGroups((gs) =>
                                  gs.map((g) => {
                                    if (g.id !== group.id) return g
                                    return {
                                      ...g,
                                      allowedItemIds: checked
                                        ? g.allowedItemIds.filter((id) => id !== item.id)
                                        : [...g.allowedItemIds, item.id],
                                    }
                                  }),
                                )
                              }
                            />
                            {item.name}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium text-stone-700">Upgrade charges</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setGroups((gs) =>
                            gs.map((g) =>
                              g.id === group.id
                                ? {
                                    ...g,
                                    upgrades: [
                                      ...g.upgrades,
                                      { itemId: g.allowedItemIds[0] || '', dollars: '1.00' },
                                    ],
                                  }
                                : g,
                            ),
                          )
                        }
                      >
                        Add upgrade
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {group.upgrades.map((u, ui) => (
                        <div key={`${group.id}-up-${ui}`} className="flex gap-2">
                          <Select
                            value={u.itemId}
                            onChange={(e) =>
                              setGroups((gs) =>
                                gs.map((g) =>
                                  g.id === group.id
                                    ? {
                                        ...g,
                                        upgrades: g.upgrades.map((x, i) =>
                                          i === ui ? { ...x, itemId: e.target.value } : x,
                                        ),
                                      }
                                    : g,
                                ),
                              )
                            }
                          >
                            <option value="">Item…</option>
                            {group.allowedItemIds.map((id) => {
                              const item = componentChoices.find((c) => c.id === id)
                              return (
                                <option key={id} value={id}>
                                  {item?.name || id}
                                </option>
                              )
                            })}
                          </Select>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            className="max-w-28"
                            value={u.dollars}
                            onChange={(e) =>
                              setGroups((gs) =>
                                gs.map((g) =>
                                  g.id === group.id
                                    ? {
                                        ...g,
                                        upgrades: g.upgrades.map((x, i) =>
                                          i === ui ? { ...x, dollars: e.target.value } : x,
                                        ),
                                      }
                                    : g,
                                ),
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </Modal>
    </div>
  )
}
