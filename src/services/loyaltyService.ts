import type { LoyaltyAccount, LoyaltyReward, LoyaltySettings } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createId, nowIso } from '@/lib/utils'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { normalizeLoyaltySettings } from '@/types'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function updateLoyaltySettings(
  userId: string,
  restaurantId: string,
  patch: Partial<LoyaltySettings>,
): Promise<LoyaltySettings> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let next: LoyaltySettings = normalizeLoyaltySettings(patch)
  await saveDb((d) => {
    const restaurant = d.restaurants.find((r) => r.id === restaurantId)
    if (!restaurant) throw new Error('Restaurant not found.')
    next = normalizeLoyaltySettings({
      ...restaurant.loyalty,
      ...patch,
      rewards: patch.rewards ?? restaurant.loyalty?.rewards,
    })
    restaurant.loyalty = next
    restaurant.updatedAt = nowIso()
  })
  return next
}

export async function listLoyaltyAccounts(
  userId: string,
  restaurantId: string,
): Promise<LoyaltyAccount[]> {
  await assertRestaurantAccess(userId, restaurantId)
  const db = await getDb()
  return db.loyaltyAccounts
    .filter((a) => a.restaurantId === restaurantId)
    .sort((a, b) => b.pointsBalance - a.pointsBalance)
}

export async function getLoyaltyAccountByEmail(
  restaurantId: string,
  email: string,
): Promise<LoyaltyAccount | null> {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const db = await getDb()
  return (
    db.loyaltyAccounts.find(
      (a) => a.restaurantId === restaurantId && a.email === normalized,
    ) ?? null
  )
}

export async function findOrCreateLoyaltyAccount(input: {
  restaurantId: string
  email: string
  phone?: string
  name?: string
}): Promise<LoyaltyAccount> {
  const email = normalizeEmail(input.email)
  if (!email) throw new Error('Email is required for loyalty.')
  const ts = nowIso()
  let account: LoyaltyAccount | null = null
  await saveDb((d) => {
    const existing = d.loyaltyAccounts.find(
      (a) => a.restaurantId === input.restaurantId && a.email === email,
    )
    if (existing) {
      if (input.phone) existing.phone = input.phone
      if (input.name) existing.name = input.name
      existing.updatedAt = ts
      account = existing
      return
    }
    const created: LoyaltyAccount = {
      id: createId('loyal'),
      restaurantId: input.restaurantId,
      email,
      phone: input.phone,
      name: input.name,
      pointsBalance: 0,
      lifetimePoints: 0,
      createdAt: ts,
      updatedAt: ts,
    }
    d.loyaltyAccounts.push(created)
    account = created
  })
  return account!
}

export function getReward(
  settings: LoyaltySettings,
  rewardId: string,
): LoyaltyReward | undefined {
  return settings.rewards.find((r) => r.id === rewardId)
}
