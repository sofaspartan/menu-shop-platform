import { create } from 'zustand'

interface PreviewState {
  enabled: boolean
  simulatedAt: Date | null
  device: 'mobile' | 'desktop'
  setEnabled: (v: boolean) => void
  setSimulatedAt: (d: Date | null) => void
  setDevice: (d: 'mobile' | 'desktop') => void
  clock: () => Date
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  enabled: false,
  simulatedAt: null,
  device: 'mobile',
  setEnabled: (enabled) => set({ enabled }),
  setSimulatedAt: (simulatedAt) => set({ simulatedAt, enabled: !!simulatedAt }),
  setDevice: (device) => set({ device }),
  clock: () => (get().enabled && get().simulatedAt ? get().simulatedAt! : new Date()),
}))
