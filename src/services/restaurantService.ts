import type {
  MembershipRole,
  Restaurant,
  RestaurantBranding,
  RestaurantMembership,
  OrderingSettings,
} from '@/types'
import { DEFAULT_BRANDING, DEFAULT_ORDERING } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createId, nowIso, slugify } from '@/lib/utils'

export async function listRestaurantsForUser(userId: string): Promise<Restaurant[]> {
  const db = await getDb()
  const ids = new Set(
    db.memberships.filter((m) => m.userId === userId).map((m) => m.restaurantId),
  )
  return db.restaurants.filter((r) => ids.has(r.id))
}

export async function getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
  const db = await getDb()
  return db.restaurants.find((r) => r.slug === slug) ?? null
}

export async function getRestaurantById(id: string): Promise<Restaurant | null> {
  const db = await getDb()
  return db.restaurants.find((r) => r.id === id) ?? null
}

export async function assertRestaurantAccess(
  userId: string,
  restaurantId: string,
  roles: MembershipRole[] = ['owner', 'administrator', 'manager', 'staff'],
): Promise<RestaurantMembership> {
  const db = await getDb()
  const membership = db.memberships.find(
    (m) => m.userId === userId && m.restaurantId === restaurantId,
  )
  if (!membership || !roles.includes(membership.role)) {
    throw new Error('You do not have access to this restaurant.')
  }
  return membership
}

export async function createRestaurant(
  userId: string,
  input: { name: string; description?: string },
): Promise<Restaurant> {
  const ts = nowIso()
  const db = await getDb()
  let orgId = db.organizations.find((o) => o.ownerUserId === userId)?.id
  if (!orgId) {
    orgId = createId('org')
  }

  let baseSlug = slugify(input.name) || 'restaurant'
  let slug = baseSlug
  let n = 2
  while (db.restaurants.some((r) => r.slug === slug)) {
    slug = `${baseSlug}-${n++}`
  }

  const restaurant: Restaurant = {
    id: createId('rest'),
    organizationId: orgId,
    slug,
    name: input.name.trim(),
    description: input.description?.trim() || 'Welcome to our restaurant.',
    phone: '',
    email: '',
    address: {
      line1: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
    },
    social: {},
    businessHours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      day: day as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      closed: false,
      open: '09:00',
      close: '21:00',
    })),
    timezone: 'America/New_York',
    branding: { ...DEFAULT_BRANDING },
    ordering: { ...DEFAULT_ORDERING },
    overlapBehavior: 'show_both',
    createdAt: ts,
    updatedAt: ts,
  }

  await saveDb((d) => {
    if (!d.organizations.some((o) => o.id === orgId)) {
      d.organizations.push({
        id: orgId!,
        name: `${input.name} Group`,
        ownerUserId: userId,
        createdAt: ts,
        updatedAt: ts,
      })
    }
    d.restaurants.push(restaurant)
    d.memberships.push({
      id: createId('mem'),
      restaurantId: restaurant.id,
      userId,
      role: 'owner',
      createdAt: ts,
      updatedAt: ts,
    })
  })

  return restaurant
}

export async function updateRestaurant(
  userId: string,
  restaurantId: string,
  patch: Partial<
    Pick<
      Restaurant,
      | 'name'
      | 'description'
      | 'phone'
      | 'email'
      | 'address'
      | 'website'
      | 'social'
      | 'businessHours'
      | 'timezone'
      | 'logoUrl'
      | 'coverImageUrl'
      | 'overlapBehavior'
    >
  >,
): Promise<Restaurant> {
  await assertRestaurantAccess(userId, restaurantId, [
    'owner',
    'administrator',
    'manager',
  ])
  let updated: Restaurant | null = null
  await saveDb((d) => {
    const r = d.restaurants.find((x) => x.id === restaurantId)
    if (!r) throw new Error('Restaurant not found.')
    Object.assign(r, patch, { updatedAt: nowIso() })
    updated = r
  })
  return updated!
}

export async function updateBranding(
  userId: string,
  restaurantId: string,
  branding: Partial<RestaurantBranding>,
): Promise<Restaurant> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  let updated: Restaurant | null = null
  await saveDb((d) => {
    const r = d.restaurants.find((x) => x.id === restaurantId)
    if (!r) throw new Error('Restaurant not found.')
    r.branding = { ...r.branding, ...branding }
    r.updatedAt = nowIso()
    updated = r
  })
  return updated!
}

export async function updateOrderingSettings(
  userId: string,
  restaurantId: string,
  ordering: Partial<OrderingSettings>,
): Promise<Restaurant> {
  await assertRestaurantAccess(userId, restaurantId, [
    'owner',
    'administrator',
    'manager',
  ])
  let updated: Restaurant | null = null
  await saveDb((d) => {
    const r = d.restaurants.find((x) => x.id === restaurantId)
    if (!r) throw new Error('Restaurant not found.')
    r.ordering = { ...r.ordering, ...ordering }
    r.updatedAt = nowIso()
    updated = r
  })
  return updated!
}
