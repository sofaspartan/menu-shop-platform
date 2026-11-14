import { create } from 'zustand'
import type { User } from '@/types'
import * as authService from '@/services/authService'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  init: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (name: string, email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  init: async () => {
    set({ loading: true })
    try {
      const user = await authService.getCurrentUser()
      set({ user, initialized: true, loading: false })
    } catch {
      set({ user: null, initialized: true, loading: false })
    }
  },
  signIn: async (email, password) => {
    set({ loading: true })
    try {
      const { user } = await authService.signIn(email, password)
      set({ user, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },
  signUp: async (name, email, password) => {
    set({ loading: true })
    try {
      const { user } = await authService.signUp({ name, email, password })
      set({ user, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },
  signOut: async () => {
    await authService.signOut()
    set({ user: null })
  },
  refresh: async () => {
    const user = await authService.getCurrentUser()
    set({ user })
  },
}))
