import type { MenuItem } from '@/types'

/** Primary + gallery URLs for a catalog item (deduped, primary first). */
export function resolveItemImages(
  item: Pick<MenuItem, 'imageUrl' | 'imageUrls'>,
): string[] {
  const primary = item.imageUrl?.trim()
  const extras = (item.imageUrls ?? []).map((u) => u.trim()).filter(Boolean)
  if (!primary && extras.length === 0) return []
  if (!primary) return [...new Set(extras)]
  return [primary, ...extras.filter((u) => u !== primary)]
}
