import { create } from 'zustand'
import { createId } from '@/lib/utils'

export interface BagFlight {
  id: string
  imageUrl?: string
  from: { x: number; y: number; width: number; height: number }
}

interface BagAnimationState {
  flight: BagFlight | null
  pulseToken: number
  startFlight: (input: {
    imageUrl?: string
    from: { x: number; y: number; width: number; height: number }
  }) => void
  clearFlight: () => void
  bumpPulse: () => void
}

export const useBagAnimationStore = create<BagAnimationState>((set) => ({
  flight: null,
  pulseToken: 0,
  startFlight: (input) =>
    set({
      flight: {
        id: createId('fly'),
        imageUrl: input.imageUrl,
        from: input.from,
      },
    }),
  clearFlight: () => set({ flight: null }),
  bumpPulse: () => set((s) => ({ pulseToken: s.pulseToken + 1 })),
}))
