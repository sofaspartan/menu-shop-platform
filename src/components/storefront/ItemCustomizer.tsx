import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { ComboConfig, MenuItem, ModifierGroup, Restaurant } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Textarea, Field } from '@/components/ui/Input'
import { MenuItemImage } from '@/components/storefront/MenuItemImage'
import { useDb } from '@/hooks/useDb'
import { useBagStore, type BagLine } from '@/stores/bagStore'
import { useBagAnimationStore } from '@/stores/bagAnimationStore'
import {
  calculateLineUnitPrice,
  validateModifierSelections,
  type BagComboSelection,
  type BagModifierSelection,
} from '@/lib/pricing'
import { brandingStyleVars } from '@/lib/brandingCss'
import { resolveItemImages } from '@/lib/itemImages'
import { storeCopy } from '@/lib/storeCopy'
import { formatMoney, cn } from '@/lib/utils'
import { trackEvent } from '@/services/analyticsService'

export function ItemCustomizer({
  open,
  onClose,
  restaurant,
  item,
  priceOverrideCents,
  editingLine,
}: {
  open: boolean
  onClose: () => void
  restaurant: Restaurant
  item: MenuItem | null
  priceOverrideCents?: number
  editingLine?: BagLine | null
}) {
  const { db } = useDb()
  const addLine = useBagStore((s) => s.addLine)
  const updateLine = useBagStore((s) => s.updateLine)
  const startFlight = useBagAnimationStore((s) => s.startFlight)
  const bumpPulse = useBagAnimationStore((s) => s.bumpPulse)
  const imageRef = useRef<HTMLDivElement>(null)

  const [quantity, setQuantity] = useState(1)
  const [modifiers, setModifiers] = useState<BagModifierSelection[]>([])
  const [comboSelections, setComboSelections] = useState<BagComboSelection[]>([])
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [activeImage, setActiveImage] = useState(0)

  const groups: ModifierGroup[] = useMemo(() => {
    if (!db || !item) return []
    const assignments = db.itemModifiers
      .filter((m) => m.itemId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    return assignments
      .map((a) => db.modifierGroups.find((g) => g.id === a.modifierGroupId))
      .filter((g): g is ModifierGroup => Boolean(g))
  }, [db, item])

  const combo: ComboConfig | undefined = useMemo(() => {
    if (!db || !item?.isCombo) return undefined
    return db.combos.find((c) => c.itemId === item.id)
  }, [db, item])

  const catalogItems = useMemo(
    () => (db ? db.items.filter((i) => i.restaurantId === restaurant.id) : []),
    [db, restaurant.id],
  )

  const images = useMemo(
    () => (item ? resolveItemImages(item) : []),
    [item],
  )

  const groupsKey = groups.map((g) => g.id).join(',')
  const comboKey = combo?.itemId ?? ''

  useEffect(() => {
    if (!open || !item) return
    void trackEvent({
      restaurantId: restaurant.id,
      type: 'item_view',
      itemId: item.id,
    })
    // Track once per open/item; avoid re-firing when unrelated db snapshots refresh.
  }, [open, item?.id, restaurant.id])

  useEffect(() => {
    if (!open || !item) return

    setActiveImage(0)

    if (editingLine) {
      setQuantity(editingLine.quantity)
      setModifiers(editingLine.modifiers)
      setComboSelections(editingLine.comboSelections ?? [])
      setNotes(editingLine.specialInstructions ?? '')
      setErrors([])
      return
    }

    setQuantity(1)
    setNotes('')
    setErrors([])
    setModifiers(
      groups.map((g) => ({
        groupId: g.id,
        optionIds: g.options.filter((o) => o.isDefault && o.available).map((o) => o.id),
      })),
    )
    if (combo) {
      setComboSelections(
        combo.componentGroups.map((cg) => ({
          groupId: cg.id,
          itemId: cg.includedItemId ?? cg.allowedItemIds[0] ?? '',
          modifiers: [],
        })),
      )
    } else {
      setComboSelections([])
    }
    // Intentionally keyed by stable ids so analytics/db refreshes don't reset the form.
  }, [open, item?.id, editingLine?.id, groupsKey, comboKey])

  const priced = useMemo(() => {
    if (!item) {
      return { unitPriceCents: 0, modifiers: [], comboSelections: undefined }
    }
    return calculateLineUnitPrice(
      {
        item,
        quantity,
        modifiers,
        comboSelections,
        specialInstructions: notes,
        priceOverrideCents,
      },
      groups,
      combo,
      catalogItems,
    )
  }, [item, quantity, modifiers, comboSelections, notes, priceOverrideCents, groups, combo, catalogItems])

  const notesEnabled =
    item?.notesEnabled ?? restaurant.ordering.itemNotesEnabled ?? true

  function toggleOption(group: ModifierGroup, optionId: string) {
    setModifiers((prev) => {
      const existing = prev.find((m) => m.groupId === group.id)
      const current = existing?.optionIds ?? []
      let next: string[]
      if (group.selectionMode === 'single') {
        next = current.includes(optionId) && !group.required ? [] : [optionId]
      } else if (current.includes(optionId)) {
        next = current.filter((id) => id !== optionId)
      } else if (current.length >= group.maxSelections) {
        next = [...current.slice(1), optionId]
      } else {
        next = [...current, optionId]
      }
      const others = prev.filter((m) => m.groupId !== group.id)
      return [...others, { groupId: group.id, optionIds: next }]
    })
  }

  function setComboItem(groupId: string, itemId: string) {
    setComboSelections((prev) => {
      const others = prev.filter((s) => s.groupId !== groupId)
      return [...others, { groupId, itemId, modifiers: [] }]
    })
  }

  function toggleComboModifier(
    comboGroupId: string,
    group: ModifierGroup,
    optionId: string,
  ) {
    setComboSelections((prev) =>
      prev.map((sel) => {
        if (sel.groupId !== comboGroupId) return sel
        const existing = sel.modifiers.find((m) => m.groupId === group.id)
        const current = existing?.optionIds ?? []
        let next: string[]
        if (group.selectionMode === 'single') {
          next = current.includes(optionId) && !group.required ? [] : [optionId]
        } else if (current.includes(optionId)) {
          next = current.filter((id) => id !== optionId)
        } else if (current.length >= group.maxSelections) {
          next = [...current.slice(1), optionId]
        } else {
          next = [...current, optionId]
        }
        const otherMods = sel.modifiers.filter((m) => m.groupId !== group.id)
        return {
          ...sel,
          modifiers: [...otherMods, { groupId: group.id, optionIds: next }],
        }
      }),
    )
  }

  function validateCombo(): string[] {
    if (!combo) return []
    const errs: string[] = []
    for (const cg of combo.componentGroups) {
      const sel = comboSelections.find((s) => s.groupId === cg.id)
      if (cg.required && (!sel || !sel.itemId)) {
        errs.push(`Please select “${cg.name}”.`)
        continue
      }
      if (sel && sel.itemId && !cg.allowedItemIds.includes(sel.itemId)) {
        errs.push(`Invalid selection for “${cg.name}”.`)
      }
      if (sel?.itemId) {
        const componentGroups = getModifierGroupsForItem(sel.itemId)
        errs.push(...validateModifierSelections(componentGroups, sel.modifiers))
      }
    }
    return errs
  }

  function getModifierGroupsForItem(itemId: string): ModifierGroup[] {
    if (!db) return []
    return db.itemModifiers
      .filter((m) => m.itemId === itemId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((a) => db.modifierGroups.find((g) => g.id === a.modifierGroupId))
      .filter((g): g is ModifierGroup => Boolean(g))
  }

  async function handleSubmit() {
    if (!item) return
    const modErrors = validateModifierSelections(groups, modifiers)
    const comboErrors = validateCombo()
    const all = [...modErrors, ...comboErrors]
    if (all.length) {
      setErrors(all)
      return
    }
    setErrors([])

    const labels = [
      ...priced.modifiers.map((m) => m.optionName),
      ...(priced.comboSelections?.map((c) => c.itemName) ?? []),
    ]

    const primaryImage = images[0] || item.imageUrl

    const payload = {
      restaurantId: restaurant.id,
      itemId: item.id,
      name: item.name,
      imageUrl: primaryImage,
      quantity,
      unitPriceCents: priced.unitPriceCents,
      modifiers,
      comboSelections: item.isCombo ? comboSelections : undefined,
      specialInstructions: notes.trim() || undefined,
      modifierLabels: labels,
    }

    if (editingLine) {
      updateLine(editingLine.id, payload)
      onClose()
      return
    }

    const rect = imageRef.current?.getBoundingClientRect()
    addLine(payload)
    void trackEvent({
      restaurantId: restaurant.id,
      type: 'item_add_to_bag',
      itemId: item.id,
    })
    onClose()

    if (rect && rect.width > 0 && rect.height > 0) {
      // Close the modal first so the flying image isn't trapped under the dialog overlay.
      window.requestAnimationFrame(() => {
        startFlight({
          imageUrl: primaryImage,
          from: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        })
      })
    } else {
      bumpPulse()
    }
  }

  if (!item) return null

  const lineTotal = priced.unitPriceCents * quantity
  const isEditing = Boolean(editingLine)
  const copy = storeCopy(restaurant.storeKind)
  const selectedSrc = images[Math.min(activeImage, Math.max(images.length - 1, 0))]

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      shell
      hideHeader
      title={item.name}
      style={brandingStyleVars(restaurant.branding)}
      className="sm:max-w-4xl"
      bodyClassName="flex min-h-0 flex-col overflow-hidden p-0"
    >
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="shrink-0 border-b border-stone-100 bg-[var(--sf-surface)] px-4 pb-4 pt-5 sm:w-[46%] sm:border-b-0 sm:border-r sm:border-stone-100 sm:px-5 sm:pb-5">
          <div
            ref={imageRef}
            className="overflow-hidden rounded-[var(--sf-radius,12px)]"
          >
            <MenuItemImage
              src={selectedSrc}
              alt=""
              className="aspect-[4/3] w-full object-cover sm:aspect-square"
              fallbackClassName="aspect-[4/3] w-full sm:aspect-square"
            />
          </div>
          {images.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((src, index) => {
                const active = index === activeImage
                return (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`View image ${index + 1}`}
                    aria-pressed={active}
                    className={cn(
                      'h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
                      active
                        ? 'border-[var(--sf-primary)]'
                        : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                  >
                    <MenuItemImage
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                      fallbackClassName="h-full w-full"
                    />
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div>
              <h2 className="pr-10 text-2xl text-[var(--sf-text)]">{item.name}</h2>
              <p className="mt-1 text-sm text-[var(--sf-text)]/70">
                {item.fullDescription || item.shortDescription}
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--sf-primary)]">
                {formatMoney(priceOverrideCents ?? item.basePriceCents)}
              </p>
            </div>

            {groups.map((group) => {
              const selected = modifiers.find((m) => m.groupId === group.id)?.optionIds ?? []
              return (
                <ModifierGroupBlock
                  key={group.id}
                  group={group}
                  selected={selected}
                  onToggle={(optionId) => toggleOption(group, optionId)}
                />
              )
            })}

            {combo
              ? combo.componentGroups.map((cg) => {
                  const sel = comboSelections.find((s) => s.groupId === cg.id)
                  const componentMods = sel?.itemId
                    ? getModifierGroupsForItem(sel.itemId)
                    : []
                  return (
                    <div key={cg.id} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-[var(--sf-text)]">{cg.name}</h3>
                        <Badge tone={cg.required ? 'accent' : 'neutral'}>
                          {cg.required ? 'Required' : 'Optional'}
                        </Badge>
                      </div>
                      {cg.description ? (
                        <p className="text-xs text-[var(--sf-text)]/60">{cg.description}</p>
                      ) : null}
                      <div className="space-y-2">
                        {cg.allowedItemIds.map((allowedId) => {
                          const allowed = catalogItems.find((i) => i.id === allowedId)
                          if (!allowed) return null
                          const upgrade = cg.upgradeChargesCents[allowedId] ?? 0
                          const active = sel?.itemId === allowedId
                          return (
                            <button
                              key={allowedId}
                              type="button"
                              onClick={() => setComboItem(cg.id, allowedId)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-[var(--sf-radius,12px)] border px-3 py-2.5 text-left text-sm transition-colors',
                                active
                                  ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                                  : 'border-stone-200 bg-[var(--sf-surface)] hover:border-stone-300',
                              )}
                            >
                              <span>{allowed.name}</span>
                              {upgrade > 0 ? (
                                <span className="text-[var(--sf-text)]/60">
                                  +{formatMoney(upgrade)}
                                </span>
                              ) : (
                                <span className="text-[var(--sf-text)]/50">Included</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {sel?.itemId && componentMods.length > 0 ? (
                        <div className="ml-2 space-y-4 border-l-2 border-stone-200 pl-3">
                          {componentMods.map((group) => {
                            const selected =
                              sel.modifiers.find((m) => m.groupId === group.id)?.optionIds ??
                              []
                            return (
                              <ModifierGroupBlock
                                key={group.id}
                                group={group}
                                selected={selected}
                                onToggle={(optionId) =>
                                  toggleComboModifier(cg.id, group, optionId)
                                }
                              />
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              : null}

            {notesEnabled ? (
              <Field label="Special instructions" htmlFor="item-notes">
                <Textarea
                  id="item-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Allergies, preferences, etc."
                  rows={2}
                />
              </Field>
            ) : null}

            {errors.length ? (
              <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-4 border-t border-stone-200 bg-white px-5 py-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Decrease quantity"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-base font-semibold">{quantity}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Increase quantity"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              size="lg"
              className="flex-1 border-0 hover:opacity-90"
              style={{
                backgroundColor: restaurant.branding.buttonColor,
                color: restaurant.branding.buttonTextColor,
              }}
              onClick={() => void handleSubmit()}
            >
              {isEditing ? copy.updateBag : copy.addToBag} · {formatMoney(lineTotal)}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function ModifierGroupBlock({
  group,
  selected,
  onToggle,
}: {
  group: ModifierGroup
  selected: string[]
  onToggle: (optionId: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium text-[var(--sf-text)]">{group.name}</h3>
        <Badge tone={group.required ? 'accent' : 'neutral'}>
          {group.required ? 'Required' : 'Optional'}
        </Badge>
        {group.selectionMode === 'multi' ? (
          <span className="text-xs text-[var(--sf-text)]/50">
            Choose {group.minSelections}–{group.maxSelections}
          </span>
        ) : null}
      </div>
      {group.description ? (
        <p className="text-xs text-[var(--sf-text)]/60">{group.description}</p>
      ) : null}
      <div className="space-y-2">
        {group.options
          .filter((o) => o.available)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((option) => {
            const active = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onToggle(option.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-[var(--sf-radius,12px)] border px-3 py-2.5 text-left text-sm transition-colors',
                  active
                    ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/5'
                    : 'border-stone-200 bg-[var(--sf-surface)] hover:border-stone-300',
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center border',
                      group.selectionMode === 'single' ? 'rounded-full' : 'rounded',
                      active
                        ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]'
                        : 'border-stone-300',
                    )}
                  >
                    {active ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ) : null}
                  </span>
                  {option.name}
                </span>
                {option.priceAdjustmentCents !== 0 ? (
                  <span className="text-[var(--sf-text)]/60">
                    {option.priceAdjustmentCents > 0 ? '+' : ''}
                    {formatMoney(option.priceAdjustmentCents)}
                  </span>
                ) : null}
              </button>
            )
          })}
      </div>
    </div>
  )
}
