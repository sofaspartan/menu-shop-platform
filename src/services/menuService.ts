import type {
  ComboConfig,
  DietaryLabel,
  Menu,
  MenuItem,
  MenuItemAssignment,
  MenuSection,
  ModifierGroup,
  ScheduleRule,
} from '@/types'
import { getDb, saveDb } from '@/data/db'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { createId, nowIso, slugify } from '@/lib/utils'

export async function getMenus(restaurantId: string): Promise<Menu[]> {
  const db = await getDb()
  return db.menus
    .filter((m) => m.restaurantId === restaurantId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getSections(restaurantId: string, menuId?: string): Promise<MenuSection[]> {
  const db = await getDb()
  return db.sections
    .filter((s) => s.restaurantId === restaurantId && (!menuId || s.menuId === menuId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getItems(restaurantId: string): Promise<MenuItem[]> {
  const db = await getDb()
  return db.items.filter((i) => i.restaurantId === restaurantId)
}

export async function getAssignments(restaurantId: string, menuId?: string): Promise<MenuItemAssignment[]> {
  const db = await getDb()
  return db.assignments
    .filter((a) => a.restaurantId === restaurantId && (!menuId || a.menuId === menuId))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

export async function getModifierGroups(restaurantId: string): Promise<ModifierGroup[]> {
  const db = await getDb()
  return db.modifierGroups.filter((g) => g.restaurantId === restaurantId)
}

export async function getItemModifiers(restaurantId: string, itemId?: string) {
  const db = await getDb()
  return db.itemModifiers.filter(
    (m) => m.restaurantId === restaurantId && (!itemId || m.itemId === itemId),
  )
}

export async function getCombos(restaurantId: string): Promise<ComboConfig[]> {
  const db = await getDb()
  return db.combos.filter((c) => c.restaurantId === restaurantId)
}

export async function getDietaryLabels(restaurantId: string): Promise<DietaryLabel[]> {
  const db = await getDb()
  return db.dietaryLabels.filter((l) => l.restaurantId === restaurantId)
}

export async function createMenu(
  userId: string,
  restaurantId: string,
  input: { name: string; description?: string },
): Promise<Menu> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const db = await getDb()
  const ts = nowIso()
  const sortOrder = db.menus.filter((m) => m.restaurantId === restaurantId).length
  let slug = slugify(input.name)
  let n = 2
  while (db.menus.some((m) => m.restaurantId === restaurantId && m.slug === slug)) {
    slug = `${slugify(input.name)}-${n++}`
  }
  const menu: Menu = {
    id: createId('menu'),
    restaurantId,
    name: input.name.trim(),
    description: input.description?.trim() || '',
    slug,
    active: true,
    sortOrder,
    priority: 10,
    showWhenUnavailable: true,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => {
    d.menus.push(menu)
  })
  return menu
}

export async function updateMenu(
  userId: string,
  restaurantId: string,
  menuId: string,
  patch: Partial<
    Pick<
      Menu,
      | 'name'
      | 'description'
      | 'coverImageUrl'
      | 'active'
      | 'sortOrder'
      | 'schedule'
      | 'showWhenUnavailable'
      | 'priority'
      | 'slug'
    >
  >,
): Promise<Menu> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: Menu | null = null
  await saveDb((d) => {
    const menu = d.menus.find((m) => m.id === menuId && m.restaurantId === restaurantId)
    if (!menu) throw new Error('Menu not found.')
    Object.assign(menu, patch, { updatedAt: nowIso() })
    updated = menu
  })
  return updated!
}

export async function deleteMenu(userId: string, restaurantId: string, menuId: string) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  await saveDb((d) => {
    d.menus = d.menus.filter((m) => !(m.id === menuId && m.restaurantId === restaurantId))
    d.sections = d.sections.filter((s) => s.menuId !== menuId)
    d.assignments = d.assignments.filter((a) => a.menuId !== menuId)
  })
}

export async function createSection(
  userId: string,
  restaurantId: string,
  menuId: string,
  input: { name: string; description?: string },
): Promise<MenuSection> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const db = await getDb()
  const sortOrder = db.sections.filter((s) => s.menuId === menuId).length
  const section: MenuSection = {
    id: createId('sec'),
    restaurantId,
    menuId,
    name: input.name.trim(),
    description: input.description,
    sortOrder,
    hidden: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await saveDb((d) => d.sections.push(section))
  return section
}

export async function updateSection(
  userId: string,
  restaurantId: string,
  sectionId: string,
  patch: Partial<Pick<MenuSection, 'name' | 'description' | 'imageUrl' | 'sortOrder' | 'hidden'>>,
) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    const section = d.sections.find((s) => s.id === sectionId && s.restaurantId === restaurantId)
    if (!section) throw new Error('Section not found.')
    Object.assign(section, patch, { updatedAt: nowIso() })
  })
}

export async function reorderSections(
  userId: string,
  restaurantId: string,
  menuId: string,
  orderedIds: string[],
) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    orderedIds.forEach((id, index) => {
      const section = d.sections.find(
        (s) => s.id === id && s.menuId === menuId && s.restaurantId === restaurantId,
      )
      if (section) {
        section.sortOrder = index
        section.updatedAt = nowIso()
      }
    })
  })
}

export async function deleteSection(userId: string, restaurantId: string, sectionId: string) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.sections = d.sections.filter((s) => s.id !== sectionId)
    d.assignments = d.assignments.filter((a) => a.sectionId !== sectionId)
  })
}

export async function createItem(
  userId: string,
  restaurantId: string,
  input: Partial<MenuItem> & { name: string; basePriceCents: number },
): Promise<MenuItem> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const ts = nowIso()
  const item: MenuItem = {
    id: createId('item'),
    restaurantId,
    name: input.name.trim(),
    imageUrl: input.imageUrl,
    imageUrls: input.imageUrls?.length ? input.imageUrls : undefined,
    shortDescription: input.shortDescription || '',
    fullDescription: input.fullDescription,
    basePriceCents: input.basePriceCents,
    salePriceCents:
      input.salePriceCents != null && input.salePriceCents < input.basePriceCents
        ? input.salePriceCents
        : undefined,
    itemType: input.itemType || 'food',
    sku: input.sku,
    dietaryLabelIds: input.dietaryLabelIds || [],
    allergens: input.allergens || [],
    prepTimeMinutes: input.prepTimeMinutes,
    active: input.active ?? true,
    featured: input.featured ?? false,
    availability: input.availability || 'available',
    schedule: input.schedule,
    notesEnabled: input.notesEnabled,
    isCombo: input.isCombo ?? false,
    trackInventory: input.trackInventory,
    stockQty: input.trackInventory ? (input.stockQty ?? 0) : undefined,
    createdAt: ts,
    updatedAt: ts,
  }
  await saveDb((d) => d.items.push(item))
  return item
}

export async function updateItem(
  userId: string,
  restaurantId: string,
  itemId: string,
  patch: Partial<MenuItem>,
): Promise<MenuItem> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: MenuItem | null = null
  await saveDb((d) => {
    const item = d.items.find((i) => i.id === itemId && i.restaurantId === restaurantId)
    if (!item) throw new Error('Item not found.')
    const { id: _id, restaurantId: _rid, createdAt: _c, ...rest } = patch
    Object.assign(item, rest, { updatedAt: nowIso() })
    // Keep menu-assignment featured flags in sync with the catalog item toggle.
    if (typeof patch.featured === 'boolean') {
      for (const a of d.assignments) {
        if (a.itemId === itemId && a.restaurantId === restaurantId) {
          a.featured = patch.featured
          a.updatedAt = nowIso()
        }
      }
    }
    updated = item
  })
  return updated!
}

export async function deleteItem(userId: string, restaurantId: string, itemId: string) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  await saveDb((d) => {
    d.items = d.items.filter((i) => i.id !== itemId)
    d.assignments = d.assignments.filter((a) => a.itemId !== itemId)
    d.itemModifiers = d.itemModifiers.filter((m) => m.itemId !== itemId)
    d.combos = d.combos.filter((c) => c.itemId !== itemId)
  })
}

export async function assignItem(
  userId: string,
  restaurantId: string,
  input: { menuId: string; sectionId: string; itemId: string; featured?: boolean },
): Promise<MenuItemAssignment> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const db = await getDb()
  const existing = db.assignments.find(
    (a) =>
      a.restaurantId === restaurantId &&
      a.sectionId === input.sectionId &&
      a.itemId === input.itemId,
  )
  if (existing) return existing

  const sortOrder = db.assignments.filter((a) => a.sectionId === input.sectionId).length
  const assignment: MenuItemAssignment = {
    id: createId('as'),
    restaurantId,
    menuId: input.menuId,
    sectionId: input.sectionId,
    itemId: input.itemId,
    sortOrder,
    featured: input.featured ?? false,
    visible: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await saveDb((d) => d.assignments.push(assignment))
  return assignment
}

export async function unassignItem(userId: string, restaurantId: string, assignmentId: string) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.assignments = d.assignments.filter(
      (a) => !(a.id === assignmentId && a.restaurantId === restaurantId),
    )
  })
}

export async function reorderAssignments(
  userId: string,
  restaurantId: string,
  sectionId: string,
  orderedIds: string[],
) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    orderedIds.forEach((id, index) => {
      const a = d.assignments.find(
        (x) => x.id === id && x.sectionId === sectionId && x.restaurantId === restaurantId,
      )
      if (a) {
        a.sortOrder = index
        a.updatedAt = nowIso()
      }
    })
  })
}

export async function saveModifierGroup(
  userId: string,
  restaurantId: string,
  group: Omit<ModifierGroup, 'createdAt' | 'updatedAt' | 'restaurantId' | 'id'> & {
    id?: string
  },
): Promise<ModifierGroup> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const ts = nowIso()
  let saved: ModifierGroup | null = null
  await saveDb((d) => {
    if (group.id) {
      const idx = d.modifierGroups.findIndex(
        (g) => g.id === group.id && g.restaurantId === restaurantId,
      )
      if (idx >= 0) {
        saved = {
          ...d.modifierGroups[idx],
          ...group,
          restaurantId,
          updatedAt: ts,
        } as ModifierGroup
        d.modifierGroups[idx] = saved
        return
      }
    }
    saved = {
      ...(group as ModifierGroup),
      id: group.id || createId('mod'),
      restaurantId,
      createdAt: ts,
      updatedAt: ts,
    }
    d.modifierGroups.push(saved)
  })
  return saved!
}

export async function setItemModifierGroups(
  userId: string,
  restaurantId: string,
  itemId: string,
  groupIds: string[],
) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    d.itemModifiers = d.itemModifiers.filter(
      (m) => !(m.restaurantId === restaurantId && m.itemId === itemId),
    )
    groupIds.forEach((groupId, sortOrder) => {
      d.itemModifiers.push({
        id: createId('im'),
        restaurantId,
        itemId,
        modifierGroupId: groupId,
        sortOrder,
      })
    })
  })
}

export async function saveCombo(
  userId: string,
  restaurantId: string,
  combo: ComboConfig,
): Promise<ComboConfig> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  await saveDb((d) => {
    const idx = d.combos.findIndex(
      (c) => c.itemId === combo.itemId && c.restaurantId === restaurantId,
    )
    if (idx >= 0) d.combos[idx] = combo
    else d.combos.push(combo)
    const item = d.items.find((i) => i.id === combo.itemId)
    if (item) {
      item.isCombo = true
      item.itemType = 'combo'
      item.basePriceCents = combo.basePriceCents
      item.salePriceCents =
        combo.salePriceCents != null && combo.salePriceCents < combo.basePriceCents
          ? combo.salePriceCents
          : undefined
      item.updatedAt = nowIso()
    }
  })
  return combo
}

export async function deleteModifierGroup(
  userId: string,
  restaurantId: string,
  groupId: string,
) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  await saveDb((d) => {
    d.modifierGroups = d.modifierGroups.filter(
      (g) => !(g.id === groupId && g.restaurantId === restaurantId),
    )
    d.itemModifiers = d.itemModifiers.filter(
      (m) => !(m.modifierGroupId === groupId && m.restaurantId === restaurantId),
    )
  })
}

export async function deleteCombo(
  userId: string,
  restaurantId: string,
  itemId: string,
) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  await saveDb((d) => {
    d.combos = d.combos.filter(
      (c) => !(c.itemId === itemId && c.restaurantId === restaurantId),
    )
    d.items = d.items.filter((i) => !(i.id === itemId && i.restaurantId === restaurantId))
    d.assignments = d.assignments.filter((a) => a.itemId !== itemId)
    d.itemModifiers = d.itemModifiers.filter((m) => m.itemId !== itemId)
  })
}

export async function updateItemAvailability(
  userId: string,
  restaurantId: string,
  itemId: string,
  availability: MenuItem['availability'],
) {
  return updateItem(userId, restaurantId, itemId, { availability })
}

/** Set absolute stock; re-opens sold-out items when restocked. */
export async function setItemStock(
  userId: string,
  restaurantId: string,
  itemId: string,
  stockQty: number,
  trackInventory = true,
) {
  const qty = Math.max(0, Math.floor(stockQty))
  const patch: Partial<MenuItem> = {
    trackInventory,
    stockQty: trackInventory ? qty : undefined,
  }
  if (trackInventory) {
    patch.availability = qty <= 0 ? 'sold_out' : 'available'
  }
  return updateItem(userId, restaurantId, itemId, patch)
}

export async function updateMenuSchedule(
  userId: string,
  restaurantId: string,
  menuId: string,
  schedule: ScheduleRule | undefined,
) {
  return updateMenu(userId, restaurantId, menuId, { schedule })
}
