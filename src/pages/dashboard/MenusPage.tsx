import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, EyeOff, Eye, Trash2, Pencil, Search } from 'lucide-react'
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
import type { MenuSection } from '@/types'

function SortableSection({
  section,
  children,
}: {
  section: MenuSection
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.7 : 1,
      }}
      className="rounded-2xl border border-stone-200 bg-white"
    >
      <div className="flex items-start gap-2 border-b border-stone-100 p-3">
        <button
          type="button"
          className="mt-1 cursor-grab touch-none rounded-lg p-1 text-stone-400 hover:bg-stone-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

export function MenusPage() {
  const current = useRestaurantStore((s) => s.current())
  const user = useAuthStore((s) => s.user)
  const { db } = useDb()

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [menuName, setMenuName] = useState('')
  const [menuDescription, setMenuDescription] = useState('')
  const [sectionName, setSectionName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [assignSectionId, setAssignSectionId] = useState<string | null>(null)
  const [assignItemId, setAssignItemId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const menus = useMemo(() => {
    if (!db || !current) return []
    return db.menus
      .filter((m) => m.restaurantId === current.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current])

  const filteredMenus = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return menus
    return menus.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q) ||
        m.slug.toLowerCase().includes(q),
    )
  }, [menus, query])

  const selectedMenu =
    filteredMenus.find((m) => m.id === selectedMenuId) ??
    menus.find((m) => m.id === selectedMenuId) ??
    filteredMenus[0] ??
    menus[0] ??
    null
  const activeMenuId = selectedMenu?.id ?? null

  const sections = useMemo(() => {
    if (!db || !current || !activeMenuId) return []
    return db.sections
      .filter((s) => s.restaurantId === current.id && s.menuId === activeMenuId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [db, current, activeMenuId])

  const items = useMemo(() => {
    if (!db || !current) return []
    return db.items.filter((i) => i.restaurantId === current.id)
  }, [db, current])

  const assignments = useMemo(() => {
    if (!db || !current || !activeMenuId) return []
    return db.assignments.filter(
      (a) => a.restaurantId === current.id && a.menuId === activeMenuId,
    )
  }, [db, current, activeMenuId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to manage menus.</p>
  }

  async function createMenu() {
    if (!user || !current || !menuName.trim()) return
    setBusy(true)
    setError('')
    try {
      const menu = await menuService.createMenu(user.id, current.id, {
        name: menuName,
        description: menuDescription,
      })
      setSelectedMenuId(menu.id)
      setMenuName('')
      setMenuDescription('')
      setCreateOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create menu')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive() {
    if (!user || !current || !selectedMenu) return
    await menuService.updateMenu(user.id, current.id, selectedMenu.id, {
      active: !selectedMenu.active,
    })
  }

  async function addSection() {
    if (!user || !current || !activeMenuId || !sectionName.trim()) return
    setBusy(true)
    try {
      await menuService.createSection(user.id, current.id, activeMenuId, {
        name: sectionName.trim(),
      })
      setSectionName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create section')
    } finally {
      setBusy(false)
    }
  }

  async function saveRename(sectionId: string) {
    if (!user || !current || !renameValue.trim()) return
    await menuService.updateSection(user.id, current.id, sectionId, {
      name: renameValue.trim(),
    })
    setRenamingId(null)
  }

  async function onDragEnd(event: DragEndEvent) {
    if (!user || !current || !activeMenuId) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(sections, oldIndex, newIndex)
    await menuService.reorderSections(
      user.id,
      current.id,
      activeMenuId,
      next.map((s) => s.id),
    )
  }

  async function assignItem() {
    if (!user || !current || !activeMenuId || !assignSectionId || !assignItemId) return
    setBusy(true)
    try {
      await menuService.assignItem(user.id, current.id, {
        menuId: activeMenuId,
        sectionId: assignSectionId,
        itemId: assignItemId,
      })
      setAssignItemId('')
      setAssignSectionId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign item')
    } finally {
      setBusy(false)
    }
  }

  const assignedItemIds = new Set(assignments.map((a) => a.itemId))

  if (menus.length === 0) {
    return (
      <div className="space-y-6 animate-fade-up">
        <h1 className="font-display text-3xl">Menus</h1>
        <EmptyState
          title="No menus yet"
          description="Create a breakfast, lunch, dinner, or specialty menu for your restaurant."
          actionLabel="Create menu"
          onAction={() => setCreateOpen(true)}
        />
        <CreateMenuModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          name={menuName}
          description={menuDescription}
          onName={setMenuName}
          onDescription={setMenuDescription}
          onSubmit={createMenu}
          busy={busy}
          error={error}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Menus</h1>
          <p className="mt-1 text-stone-500">
            Organize sections and assign items from your library. Schedules are edited separately.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> New menu
        </Button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input
          className="pl-9"
          placeholder="Search menus…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filteredMenus.length === 0 ? (
          <p className="text-sm text-stone-500">No menus match “{query.trim()}”.</p>
        ) : (
          filteredMenus.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedMenuId(m.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                activeMenuId === m.id
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white'
                  : 'border-stone-200 bg-white text-stone-700'
              }`}
            >
              {m.name}
              {!m.active ? ' (inactive)' : ''}
            </button>
          ))
        )}
      </div>

      {selectedMenu ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl">{selectedMenu.name}</h2>
              <p className="mt-1 text-sm text-stone-500">
                {selectedMenu.description || 'No description'}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Tip: set when this menu appears under{' '}
                <Link className="text-[var(--color-brand)] underline" to="/dashboard/scheduling">
                  Scheduling
                </Link>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={selectedMenu.active ? 'success' : 'warning'}>
                {selectedMenu.active ? 'Active' : 'Inactive'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => void toggleActive()}>
                {selectedMenu.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <Field label="New section" htmlFor="section-name">
          <Input
            id="section-name"
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="e.g. Starters"
          />
        </Field>
        <Button disabled={busy || !sectionName.trim()} onClick={() => void addSection()}>
          Add section
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void onDragEnd(e)}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {sections.map((section) => {
              const sectionAssignments = assignments
                .filter((a) => a.sectionId === section.id)
                .sort((a, b) => a.sortOrder - b.sortOrder)
              return (
                <SortableSection key={section.id} section={section}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      {renamingId === section.id ? (
                        <div className="flex flex-wrap gap-2">
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="max-w-xs"
                          />
                          <Button size="sm" onClick={() => void saveRename(section.id)}>
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setRenamingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-lg">{section.name}</h3>
                          {section.hidden ? <Badge tone="warning">Hidden</Badge> : null}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRenamingId(section.id)
                          setRenameValue(section.name)
                        }}
                        aria-label="Rename section"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void menuService.updateSection(user.id, current.id, section.id, {
                            hidden: !section.hidden,
                          })
                        }
                        aria-label={section.hidden ? 'Show section' : 'Hide section'}
                      >
                        {section.hidden ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void menuService.deleteSection(user.id, current.id, section.id)
                        }
                        aria-label="Delete section"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => {
                          setAssignSectionId(section.id)
                          setAssignItemId('')
                        }}
                      >
                        Assign item
                      </Button>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-2 px-1 pb-3">
                    {sectionAssignments.map((a) => {
                      const item = items.find((i) => i.id === a.itemId)
                      if (!item) return null
                      return (
                        <li
                          key={a.id}
                          className="flex items-center justify-between rounded-xl border border-stone-100 px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-medium">{item.name}</span>
                            <span className="ml-2 text-stone-500">
                              {formatMoney(item.basePriceCents)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void menuService.unassignItem(user.id, current.id, a.id)
                            }
                          >
                            Unassign
                          </Button>
                        </li>
                      )
                    })}
                    {sectionAssignments.length === 0 ? (
                      <li className="px-1 text-sm text-stone-500">No items in this section.</li>
                    ) : null}
                  </ul>
                </SortableSection>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      {sections.length === 0 ? (
        <p className="text-sm text-stone-500">Add a section to start assigning menu items.</p>
      ) : null}

      <CreateMenuModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        name={menuName}
        description={menuDescription}
        onName={setMenuName}
        onDescription={setMenuDescription}
        onSubmit={createMenu}
        busy={busy}
        error={error}
      />

      <Modal
        open={!!assignSectionId}
        onClose={() => setAssignSectionId(null)}
        title="Assign item to section"
      >
        <div className="space-y-4">
          <Field label="Item" htmlFor="assign-item">
            <Select
              id="assign-item"
              value={assignItemId}
              onChange={(e) => setAssignItemId(e.target.value)}
            >
              <option value="">Select an item…</option>
              <optgroup label="Unassigned to this menu">
                {items
                  .filter((i) => !assignedItemIds.has(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="All items">
                {items.map((i) => (
                  <option key={`all-${i.id}`} value={i.id}>
                    {i.name}
                    {assignedItemIds.has(i.id) ? ' (already on menu)' : ''}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssignSectionId(null)}>
              Cancel
            </Button>
            <Button disabled={!assignItemId || busy} onClick={() => void assignItem()}>
              Assign
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function CreateMenuModal({
  open,
  onClose,
  name,
  description,
  onName,
  onDescription,
  onSubmit,
  busy,
  error,
}: {
  open: boolean
  onClose: () => void
  name: string
  description: string
  onName: (v: string) => void
  onDescription: (v: string) => void
  onSubmit: () => void
  busy: boolean
  error: string
}) {
  return (
    <Modal open={open} onClose={onClose} title="Create menu">
      <div className="space-y-4">
        <Field label="Name" htmlFor="menu-name">
          <Input
            id="menu-name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Dinner"
            required
          />
        </Field>
        <Field label="Description" htmlFor="menu-desc">
          <Textarea
            id="menu-desc"
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            placeholder="Evening favorites and chef specials"
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !name.trim()} onClick={() => void onSubmit()}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
