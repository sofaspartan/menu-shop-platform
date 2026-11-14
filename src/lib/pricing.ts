import type {
  ComboConfig,
  ComboSelectionSnapshot,
  CurrencyCents,
  MenuItem,
  ModifierGroup,
  OrderingSettings,
  OrderPricing,
  SelectedModifierSnapshot,
} from '@/types'

export interface BagModifierSelection {
  groupId: string
  optionIds: string[]
}

export interface BagComboSelection {
  groupId: string
  itemId: string
  modifiers: BagModifierSelection[]
}

export interface BagLineInput {
  item: MenuItem
  quantity: number
  modifiers: BagModifierSelection[]
  comboSelections?: BagComboSelection[]
  specialInstructions?: string
  priceOverrideCents?: CurrencyCents
}

export function calculateModifierTotal(
  modifiers: BagModifierSelection[],
  groups: ModifierGroup[],
): { totalCents: CurrencyCents; snapshots: SelectedModifierSnapshot[] } {
  const snapshots: SelectedModifierSnapshot[] = []
  let totalCents = 0

  for (const sel of modifiers) {
    const group = groups.find((g) => g.id === sel.groupId)
    if (!group) continue
    for (const optionId of sel.optionIds) {
      const option = group.options.find((o) => o.id === optionId)
      if (!option) continue
      totalCents += option.priceAdjustmentCents
      snapshots.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceAdjustmentCents: option.priceAdjustmentCents,
      })
    }
  }

  return { totalCents, snapshots }
}

export function calculateLineUnitPrice(
  input: BagLineInput,
  groups: ModifierGroup[],
  combo?: ComboConfig,
  catalogItems: MenuItem[] = [],
): {
  unitPriceCents: CurrencyCents
  modifiers: SelectedModifierSnapshot[]
  comboSelections?: ComboSelectionSnapshot[]
} {
  const base =
    input.priceOverrideCents ??
    (input.item.isCombo && combo ? combo.basePriceCents : input.item.basePriceCents)

  const { totalCents: modCents, snapshots } = calculateModifierTotal(
    input.modifiers,
    groups,
  )

  let comboUpgradeCents = 0
  const comboSnapshots: ComboSelectionSnapshot[] = []

  if (input.item.isCombo && combo && input.comboSelections) {
    for (const sel of input.comboSelections) {
      const group = combo.componentGroups.find((g) => g.id === sel.groupId)
      if (!group) continue
      const item = catalogItems.find((i) => i.id === sel.itemId)
      if (!item) continue
      const upgrade = group.upgradeChargesCents[sel.itemId] ?? 0
      comboUpgradeCents += upgrade
      const { snapshots: componentMods } = calculateModifierTotal(
        sel.modifiers,
        groups,
      )
      comboUpgradeCents += componentMods.reduce(
        (sum, m) => sum + m.priceAdjustmentCents,
        0,
      )
      comboSnapshots.push({
        groupId: group.id,
        groupName: group.name,
        itemId: item.id,
        itemName: item.name,
        upgradeCents: upgrade,
        modifiers: componentMods,
      })
    }
  }

  return {
    unitPriceCents: base + modCents + comboUpgradeCents,
    modifiers: snapshots,
    comboSelections: comboSnapshots.length ? comboSnapshots : undefined,
  }
}

export function calculateOrderPricing(
  subtotalCents: CurrencyCents,
  settings: OrderingSettings,
  orderType: 'pickup' | 'delivery',
  tipCents: CurrencyCents,
): OrderPricing {
  const taxCents = Math.round(subtotalCents * (settings.taxRatePercent / 100))
  const deliveryFeeCents =
    orderType === 'delivery' ? settings.deliveryFeeCents : 0
  const totalCents = subtotalCents + taxCents + deliveryFeeCents + tipCents

  return {
    subtotalCents,
    taxCents,
    deliveryFeeCents,
    tipCents,
    totalCents,
    taxRatePercent: settings.taxRatePercent,
  }
}

export function validateModifierSelections(
  groups: ModifierGroup[],
  selections: BagModifierSelection[],
): string[] {
  const errors: string[] = []
  for (const group of groups) {
    const sel = selections.find((s) => s.groupId === group.id)
    const count = sel?.optionIds.length ?? 0
    if (group.required && count < group.minSelections) {
      errors.push(`Please make a selection for “${group.name}”.`)
    } else if (count < group.minSelections) {
      errors.push(
        `Select at least ${group.minSelections} option(s) for “${group.name}”.`,
      )
    }
    if (count > group.maxSelections) {
      errors.push(
        `Select at most ${group.maxSelections} option(s) for “${group.name}”.`,
      )
    }
  }
  return errors
}
