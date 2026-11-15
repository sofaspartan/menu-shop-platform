import type { OrderStatus, StoreKind } from '@/types'

/** Customer- and dashboard-facing labels that change with store kind. */
export function storeCopy(kind: StoreKind = 'restaurant') {
  const retail = kind === 'retail'
  return {
    kind,
    isRetail: retail,
    storeNoun: retail ? 'store' : 'restaurant',
    storeNounTitle: retail ? 'Store' : 'Restaurant',
    dashboardSubtitle: retail ? 'Retail dashboard' : 'Restaurant dashboard',
    catalogNoun: retail ? 'catalog' : 'menu',
    catalogNounTitle: retail ? 'Catalog' : 'Menu',
    catalogNounPlural: retail ? 'Catalogs' : 'Menus',
    itemNoun: retail ? 'product' : 'item',
    itemNounPlural: retail ? 'Products' : 'Items',
    itemLibrary: retail ? 'Product library' : 'Item library',
    bagNoun: retail ? 'cart' : 'bag',
    bagNounTitle: retail ? 'Cart' : 'Bag',
    yourBag: retail ? 'Your cart' : 'Your bag',
    viewBag: retail ? 'View cart' : 'View bag',
    addToBag: retail ? 'Add to cart' : 'Add to bag',
    updateBag: retail ? 'Update cart' : 'Update bag',
    emptyBag: retail ? 'Your cart is empty' : 'Your bag is empty',
    comboNoun: retail ? 'bundle' : 'combo',
    comboNounPlural: retail ? 'Bundles' : 'Combos',
    modifiersNoun: 'Options',
    browseCta: retail ? 'Browse catalog' : 'Browse menu',
    newStoreCta: retail ? '+ New store' : '+ New restaurant',
    createStoreTitle: retail ? 'Create a store' : 'Create a restaurant',
    estimatedReady: retail ? 'Estimated ready' : 'Estimated ready',
    estimatedPrepLabel: retail ? 'Fulfillment time (minutes)' : 'Prep time (minutes)',
    kitchenOrShop: retail ? 'shop' : 'kitchen',
  } as const
}

export function statusHeadlineFor(
  status: OrderStatus,
  kind: StoreKind,
  orderType: 'pickup' | 'delivery',
): string {
  const retail = kind === 'retail'
  switch (status) {
    case 'received':
      return 'Order received'
    case 'confirmed':
      return 'Order confirmed'
    case 'preparing':
      return retail ? 'Packing order' : 'Preparing order'
    case 'ready':
      return orderType === 'pickup' ? 'Ready for pickup' : 'Ready'
    case 'out_for_delivery':
      return 'Out for delivery'
    case 'completed':
      return orderType === 'delivery' ? 'Delivered' : 'Picked up'
    case 'cancelled':
      return 'Order cancelled'
    default:
      return 'Tracking order'
  }
}

export function statusSubtitleFor(
  status: OrderStatus,
  kind: StoreKind,
  orderType: 'pickup' | 'delivery',
  storeName: string,
): string {
  const retail = kind === 'retail'
  const name = storeName || (retail ? 'The store' : 'The restaurant')
  switch (status) {
    case 'received':
      return `${name} got your order and will confirm it shortly.`
    case 'confirmed':
      return retail
        ? `${name} confirmed your order and will start packing soon.`
        : `${name} confirmed your order and will start preparing soon.`
    case 'preparing':
      return retail
        ? `${name} is packing your order.`
        : `${name} is preparing your order.`
    case 'ready':
      return orderType === 'pickup'
        ? `Your order is ready — head to ${name} to pick it up.`
        : 'Your order is ready for the next step.'
    case 'out_for_delivery':
      return `Your order from ${name} is on the way.`
    case 'completed':
      return orderType === 'delivery'
        ? 'Your order has been delivered. Enjoy!'
        : 'Your order has been picked up. Enjoy!'
    case 'cancelled':
      return `This order was cancelled. Contact ${name} if you have questions.`
    default:
      return 'We’ll update this page as your order progresses.'
  }
}

export function shortStatusLabel(
  status: OrderStatus,
  kind: StoreKind,
  orderType: 'pickup' | 'delivery',
): string {
  const retail = kind === 'retail'
  switch (status) {
    case 'received':
      return 'Received'
    case 'confirmed':
      return 'Confirmed'
    case 'preparing':
      return retail ? 'Packing' : 'Preparing'
    case 'ready':
      return 'Ready'
    case 'out_for_delivery':
      return 'Delivery'
    case 'completed':
      return orderType === 'delivery' ? 'Done' : 'Done'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}
