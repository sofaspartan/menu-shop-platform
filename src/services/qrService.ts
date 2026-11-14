import type { QrCode, QrCodeStyle } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { assertRestaurantAccess } from '@/services/restaurantService'
import { createId, nowIso } from '@/lib/utils'

export const DEFAULT_QR_STYLE: QrCodeStyle = {
  foreground: '#1A3A2F',
  background: '#FFFFFF',
  cornerStyle: 'rounded',
  dotStyle: 'rounded',
  logoEnabled: true,
  logoSize: 18,
  frameEnabled: true,
  caption: 'Scan to order',
  showRestaurantName: true,
  errorCorrection: 'H',
}

export async function listQrCodes(restaurantId: string): Promise<QrCode[]> {
  const db = await getDb()
  return db.qrCodes.filter((q) => q.restaurantId === restaurantId)
}

export async function createQrCode(
  userId: string,
  restaurantId: string,
  input: {
    name: string
    targetType: 'restaurant' | 'menu'
    menuId?: string
    campaign?: string
    style?: Partial<QrCodeStyle>
  },
): Promise<QrCode> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  const qr: QrCode = {
    id: createId('qr'),
    restaurantId,
    name: input.name.trim(),
    targetType: input.targetType,
    menuId: input.menuId,
    campaign: input.campaign,
    style: { ...DEFAULT_QR_STYLE, ...input.style },
    scanCount: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await saveDb((d) => d.qrCodes.push(qr))
  return qr
}

export async function updateQrCode(
  userId: string,
  restaurantId: string,
  qrId: string,
  patch: Partial<Pick<QrCode, 'name' | 'campaign' | 'style' | 'targetType' | 'menuId'>>,
): Promise<QrCode> {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator', 'manager'])
  let updated: QrCode | null = null
  await saveDb((d) => {
    const qr = d.qrCodes.find((q) => q.id === qrId && q.restaurantId === restaurantId)
    if (!qr) throw new Error('QR code not found.')
    if (patch.style) qr.style = { ...qr.style, ...patch.style }
    if (patch.name !== undefined) qr.name = patch.name
    if (patch.campaign !== undefined) qr.campaign = patch.campaign
    if (patch.targetType !== undefined) qr.targetType = patch.targetType
    if (patch.menuId !== undefined) qr.menuId = patch.menuId
    qr.updatedAt = nowIso()
    updated = qr
  })
  return updated!
}

export async function deleteQrCode(userId: string, restaurantId: string, qrId: string) {
  await assertRestaurantAccess(userId, restaurantId, ['owner', 'administrator'])
  await saveDb((d) => {
    d.qrCodes = d.qrCodes.filter((q) => !(q.id === qrId && q.restaurantId === restaurantId))
  })
}

export function qrTargetPath(
  restaurantSlug: string,
  qr: Pick<QrCode, 'targetType' | 'menuId'>,
  menus: Array<{ id: string; slug: string }>,
): string {
  if (qr.targetType === 'menu' && qr.menuId) {
    const menu = menus.find((m) => m.id === qr.menuId)
    if (menu) return `/r/${restaurantSlug}/menu/${menu.slug}?qr=${qr && 'id' in qr ? '' : ''}`
  }
  return `/r/${restaurantSlug}`
}

export function buildQrUrl(
  origin: string,
  restaurantSlug: string,
  qr: QrCode,
  menus: Array<{ id: string; slug: string }>,
): string {
  let path = `/r/${restaurantSlug}`
  if (qr.targetType === 'menu' && qr.menuId) {
    const menu = menus.find((m) => m.id === qr.menuId)
    if (menu) path = `/r/${restaurantSlug}/menu/${menu.slug}`
  }
  return `${origin}${path}?src=qr&qid=${qr.id}`
}
