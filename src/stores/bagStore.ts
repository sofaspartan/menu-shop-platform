import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BagComboSelection, BagModifierSelection } from '@/lib/pricing'
import { createId } from '@/lib/utils'

export interface BagLine {
  id: string
  restaurantId: string
  itemId: string
  name: string
  imageUrl?: string
  quantity: number
  unitPriceCents: number
  modifiers: BagModifierSelection[]
  comboSelections?: BagComboSelection[]
  specialInstructions?: string
  modifierLabels: string[]
}

interface BagState {
  lines: BagLine[]
  addLine: (line: Omit<BagLine, 'id'>) => void
  updateLine: (id: string, patch: Partial<BagLine>) => void
  removeLine: (id: string) => void
  duplicateLine: (id: string) => void
  setQuantity: (id: string, quantity: number) => void
  clearRestaurant: (restaurantId: string) => void
  clearAll: () => void
  linesFor: (restaurantId: string) => BagLine[]
  subtotalFor: (restaurantId: string) => number
}

export const useBagStore = create<BagState>()(
  persist(
    (set, get) => ({
      lines: [],
      addLine: (line) =>
        set((s) => ({
          lines: [...s.lines, { ...line, id: createId('bag') }],
        })),
      updateLine: (id, patch) =>
        set((s) => ({
          lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),
      removeLine: (id) => set((s) => ({ lines: s.lines.filter((l) => l.id !== id) })),
      duplicateLine: (id) => {
        const line = get().lines.find((l) => l.id === id)
        if (!line) return
        const { id: _id, ...rest } = line
        get().addLine(rest)
      },
      setQuantity: (id, quantity) => {
        if (quantity <= 0) get().removeLine(id)
        else get().updateLine(id, { quantity })
      },
      clearRestaurant: (restaurantId) =>
        set((s) => ({ lines: s.lines.filter((l) => l.restaurantId !== restaurantId) })),
      clearAll: () => set({ lines: [] }),
      linesFor: (restaurantId) => get().lines.filter((l) => l.restaurantId === restaurantId),
      subtotalFor: (restaurantId) =>
        get()
          .linesFor(restaurantId)
          .reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0),
    }),
    { name: 'menushop:bag' },
  ),
)
