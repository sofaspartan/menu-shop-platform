import type { OrderStatus, OrderType, StoreKind } from '@/types'

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
    /** Keep pickup; retail "delivery" is framed as shipping. */
    pickupLabel: retail ? 'Store pickup' : 'Pickup',
    shipOrDeliveryLabel: retail ? 'Shipping' : 'Delivery',
    shipOrDeliveryEnabled: retail ? 'Shipping enabled' : 'Delivery enabled',
    shipOrDeliveryFee: retail ? 'Shipping fee' : 'Delivery fee',
    shipOrDeliveryAddress: retail ? 'Shipping address' : 'Delivery address',
    shipOrDeliveryMinimum: retail
      ? 'Minimum shipping order'
      : 'Minimum delivery order',
    shipOrDeliveryMinimumError: (amount: string) =>
      retail ? `Shipping minimum is ${amount}.` : `Delivery minimum is ${amount}.`,
    completeAddressError: retail
      ? 'Please complete your shipping address.'
      : 'Please complete your delivery address.',
    placingOrderTitle: (orderType: OrderType) => {
      if (orderType === 'delivery') {
        return retail ? 'Placing shipping order…' : 'Placing delivery order…'
      }
      return retail ? 'Placing pickup order…' : 'Placing pickup order…'
    },
    estimatedEtaPrefix: (orderType: OrderType) => {
      if (orderType === 'delivery') {
        return retail ? 'Estimated delivery by' : 'Estimated arrival at'
      }
      return retail ? 'Estimated ready for pickup by' : 'Estimated ready by'
    },
    noCatalogTitle: retail ? 'No catalogs available right now' : 'No menus available right now',
    noCatalogBody: retail
      ? 'Check back during open hours or ask the store what’s available.'
      : 'Check back during open hours or ask the restaurant for today’s offerings.',
  } as const
}

export function statusHeadlineFor(
  status: OrderStatus,
  kind: StoreKind,
  orderType: OrderType,
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
      return retail ? 'Shipped' : 'Out for delivery'
    case 'completed':
      if (orderType === 'delivery') return 'Delivered'
      return 'Picked up'
    case 'cancelled':
      return 'Order cancelled'
    default:
      return 'Tracking order'
  }
}

export function statusSubtitleFor(
  status: OrderStatus,
  kind: StoreKind,
  orderType: OrderType,
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
      return retail
        ? `Your order from ${name} has shipped and is on the way.`
        : `Your order from ${name} is on the way.`
    case 'completed':
      return orderType === 'delivery'
        ? retail
          ? 'Your order has been delivered. Enjoy!'
          : 'Your order has been delivered. Enjoy!'
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
  _orderType: OrderType,
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
      return retail ? 'Shipped' : 'Delivery'
    case 'completed':
      return 'Done'
    case 'cancelled':
      return 'Cancelled'
    default:
      return status
  }
}
