import { create } from 'zustand'
import type { Restaurant } from '@/types'
import * as restaurantService from '@/services/restaurantService'

interface RestaurantState {
  restaurants: Restaurant[]
  currentId: string | null
  loading: boolean
  load: (userId: string) => Promise<void>
  setCurrent: (id: string) => void
  current: () => Restaurant | null
  create: (userId: string, name: string, description?: string) => Promise<Restaurant>
}

const CURRENT_KEY = 'menushop:current-restaurant'

export const useRestaurantStore = create<RestaurantState>((set, get) => ({
  restaurants: [],
  currentId: localStorage.getItem(CURRENT_KEY),
  loading: false,
  load: async (userId) => {
    set({ loading: true })
    const restaurants = await restaurantService.listRestaurantsForUser(userId)
    let currentId = get().currentId
    if (!currentId || !restaurants.some((r) => r.id === currentId)) {
      currentId = restaurants[0]?.id ?? null
      if (currentId) localStorage.setItem(CURRENT_KEY, currentId)
    }
    set({ restaurants, currentId, loading: false })
  },
  setCurrent: (id) => {
    localStorage.setItem(CURRENT_KEY, id)
    set({ currentId: id })
  },
  current: () => {
    const { restaurants, currentId } = get()
    return restaurants.find((r) => r.id === currentId) ?? null
  },
  create: async (userId, name, description) => {
    const restaurant = await restaurantService.createRestaurant(userId, { name, description })
    await get().load(userId)
    get().setCurrent(restaurant.id)
    return restaurant
  },
}))
