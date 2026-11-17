/** Core domain types for the MenuShop platform */

export type ID = string
export type ISODateTime = string
export type CurrencyCents = number

export type MembershipRole = 'owner' | 'administrator' | 'manager' | 'staff'

export type ItemAvailability =
  | 'available'
  | 'temporarily_unavailable'
  | 'sold_out'
  | 'hidden'

export type OrderType = 'pickup' | 'delivery'

/** Vertical for a storefront: food service vs general retail. */
export type StoreKind = 'restaurant' | 'retail'

/** Visual catalog layout: list menu vs merch product grid. */
export type StorefrontLayout = 'restaurant' | 'retail'
/** Content column: centered with max width, or edge-to-edge. */
export type StorefrontWidth = 'margined' | 'full'

export interface StoreAboutPage {
  enabled: boolean
  title: string
  heroImageUrl?: string
  /** Plain text; blank lines become paragraphs. */
  body: string
}

export interface StoreContactPage {
  enabled: boolean
  title: string
  intro?: string
  showPhone: boolean
  phoneOverride?: string
  showEmail: boolean
  emailOverride?: string
  showAddress: boolean
  showHours: boolean
  showWebsite: boolean
  showInstagram: boolean
  showFacebook: boolean
  showTwitter: boolean
  showTiktok: boolean
}

/** Cover image overlay copy for retail (and optional restaurant) storefronts. */
export interface StoreCoverIntro {
  title?: string
  /** Shown when non-empty; hidden if blank. */
  buttonLabel?: string
  /**
   * Button target: absolute URL, in-app path (`/r/slug/about`), or hash (`#section-featured`).
   * Defaults to the featured section when label is set and this is blank.
   */
  buttonHref?: string
}

export interface StorePages {
  about: StoreAboutPage
  contact: StoreContactPage
  coverIntro?: StoreCoverIntro
}

export type OrderStatus =
  | 'received'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'

export type ModifierSelectionMode = 'single' | 'multi'

export type OverlapBehavior = 'show_both' | 'prioritize' | 'combine'

export type AnalyticsEventType =
  | 'menu_view'
  | 'item_view'
  | 'item_add_to_bag'
  | 'item_remove_from_bag'
  | 'checkout_start'
  | 'order_placed'
  | 'qr_scan'
  | 'link_visit'

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Timestamps {
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface User extends Timestamps {
  id: ID
  email: string
  passwordHash: string
  name: string
  phone?: string
}

export interface Organization extends Timestamps {
  id: ID
  name: string
  ownerUserId: ID
}

export interface RestaurantMembership extends Timestamps {
  id: ID
  restaurantId: ID
  userId: ID
  role: MembershipRole
}

export interface BusinessHoursDay {
  day: DayOfWeek
  closed: boolean
  open: string // HH:mm
  close: string // HH:mm
}

export interface SocialLinks {
  instagram?: string
  facebook?: string
  twitter?: string
  tiktok?: string
}

export interface RestaurantBranding {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor: string
  surfaceColor: string
  textColor: string
  buttonColor: string
  buttonTextColor: string
  headingFont: string
  bodyFont: string
  accentFont?: string
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  cardStyle: 'flat' | 'bordered' | 'elevated'
  buttonStyle: 'solid' | 'outline' | 'soft'
  logoPlacement: 'left' | 'center'
  coverDisplay: 'full' | 'banner' | 'none'
  imagePresentation: 'cover' | 'contain' | 'rounded'
  appearance: 'light' | 'dark' | 'auto'
}

/** Saved custom look for a restaurant (presets live in code, not here) */
export interface BrandTheme extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  description?: string
  branding: RestaurantBranding
}

export interface OrderingSettings {
  pickupEnabled: boolean
  deliveryEnabled: boolean
  minimumDeliveryCents: CurrencyCents
  deliveryFeeCents: CurrencyCents
  taxRatePercent: number
  estimatedPrepMinutes: number
  acceptingOrders: boolean
  temporarilyClosed: boolean
  temporaryClosureMessage?: string
  orderCutoffMinutesBeforeClose: number
  tipPresetsPercent: number[]
  itemNotesEnabled: boolean
}

export interface Restaurant extends Timestamps {
  id: ID
  organizationId: ID
  slug: string
  name: string
  description: string
  /** restaurant = food menus; retail = product catalogs (bags, furniture, etc.) */
  storeKind: StoreKind
  /** Catalog presentation — independent of storeKind so owners can choose. */
  storefrontLayout: StorefrontLayout
  /** Full-bleed vs centered content column (applies mainly to retail chrome). */
  storefrontWidth: StorefrontWidth
  pages: StorePages
  logoUrl?: string
  coverImageUrl?: string
  phone: string
  email: string
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  website?: string
  social: SocialLinks
  businessHours: BusinessHoursDay[]
  timezone: string
  branding: RestaurantBranding
  ordering: OrderingSettings
  overlapBehavior: OverlapBehavior
  isDemo?: boolean
}

export interface ScheduleRule {
  id: ID
  daysOfWeek: DayOfWeek[]
  startTime: string // HH:mm
  endTime: string
  startDate?: string // YYYY-MM-DD
  endDate?: string
  timezone?: string
  enabled: boolean
}

export interface Menu extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  description: string
  coverImageUrl?: string
  slug: string
  active: boolean
  sortOrder: number
  schedule?: ScheduleRule
  showWhenUnavailable: boolean
  priority: number
}

export interface MenuSection extends Timestamps {
  id: ID
  restaurantId: ID
  menuId: ID
  name: string
  description?: string
  imageUrl?: string
  sortOrder: number
  hidden: boolean
}

export interface DietaryLabel {
  id: ID
  restaurantId: ID
  name: string
  slug: string
  color?: string
}

export interface MenuItem extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  imageUrl?: string
  shortDescription: string
  fullDescription?: string
  basePriceCents: CurrencyCents
  itemType: 'food' | 'drink' | 'combo' | 'product' | 'other'
  sku?: string
  dietaryLabelIds: ID[]
  allergens: string[]
  prepTimeMinutes?: number
  active: boolean
  featured: boolean
  availability: ItemAvailability
  schedule?: ScheduleRule
  notesEnabled?: boolean
  isCombo: boolean
}

/** Assignment of a library item into a menu section (no duplication of the item) */
export interface MenuItemAssignment extends Timestamps {
  id: ID
  restaurantId: ID
  menuId: ID
  sectionId: ID
  itemId: ID
  sortOrder: number
  featured: boolean
  visible: boolean
  priceOverrideCents?: CurrencyCents
}

export interface ModifierOption {
  id: ID
  name: string
  priceAdjustmentCents: CurrencyCents
  available: boolean
  isDefault?: boolean
  sortOrder: number
}

export interface ModifierGroup extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  description?: string
  required: boolean
  minSelections: number
  maxSelections: number
  selectionMode: ModifierSelectionMode
  options: ModifierOption[]
}

export interface ItemModifierAssignment {
  id: ID
  restaurantId: ID
  itemId: ID
  modifierGroupId: ID
  sortOrder: number
}

export interface ComboComponentGroup {
  id: ID
  name: string
  description?: string
  required: boolean
  minQuantity: number
  maxQuantity: number
  allowedItemIds: ID[]
  includedItemId?: ID
  upgradeChargesCents: Record<string, CurrencyCents>
}

export interface ComboConfig {
  itemId: ID
  restaurantId: ID
  basePriceCents: CurrencyCents
  componentGroups: ComboComponentGroup[]
}

export interface QrCodeStyle {
  foreground: string
  background: string
  cornerStyle: 'square' | 'rounded' | 'dots'
  dotStyle: 'square' | 'rounded' | 'dots'
  logoEnabled: boolean
  logoSize: number
  frameEnabled: boolean
  caption?: string
  showRestaurantName: boolean
  errorCorrection: 'L' | 'M' | 'Q' | 'H'
}

export interface QrCode extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  targetType: 'restaurant' | 'menu'
  menuId?: ID
  campaign?: string
  style: QrCodeStyle
  scanCount: number
}

export interface OrderCustomer {
  name: string
  phone: string
  email?: string
}

export interface OrderFulfillment {
  type: OrderType
  instructions?: string
  requestedTime?: ISODateTime
  address?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
  }
}

export interface SelectedModifierSnapshot {
  groupId: ID
  groupName: string
  optionId: ID
  optionName: string
  priceAdjustmentCents: CurrencyCents
}

export interface ComboSelectionSnapshot {
  groupId: ID
  groupName: string
  itemId: ID
  itemName: string
  upgradeCents: CurrencyCents
  modifiers: SelectedModifierSnapshot[]
}

/** Historical snapshot — immutable after order placement */
export interface OrderLineItem {
  id: ID
  sourceItemId: ID
  name: string
  imageUrl?: string
  quantity: number
  unitPriceCents: CurrencyCents
  lineTotalCents: CurrencyCents
  specialInstructions?: string
  modifiers: SelectedModifierSnapshot[]
  isCombo: boolean
  comboSelections?: ComboSelectionSnapshot[]
}

export interface OrderStatusEvent {
  status: OrderStatus
  at: ISODateTime
  note?: string
  byUserId?: ID
}

export interface OrderPricing {
  subtotalCents: CurrencyCents
  taxCents: CurrencyCents
  deliveryFeeCents: CurrencyCents
  tipCents: CurrencyCents
  totalCents: CurrencyCents
  taxRatePercent: number
}

export interface Order extends Timestamps {
  id: ID
  restaurantId: ID
  orderNumber: string
  reference: string
  status: OrderStatus
  customer: OrderCustomer
  fulfillment: OrderFulfillment
  items: OrderLineItem[]
  pricing: OrderPricing
  payment: {
    method: 'simulated'
    status: 'authorized' | 'captured' | 'failed'
    simulatedCardLast4: string
    message: string
  }
  statusHistory: OrderStatusEvent[]
  internalNotes?: string
  estimatedReadyAt?: ISODateTime
  demoAutoAdvance?: boolean
}

export interface AnalyticsEvent {
  id: ID
  restaurantId: ID
  type: AnalyticsEventType
  at: ISODateTime
  menuId?: ID
  itemId?: ID
  qrCodeId?: ID
  orderId?: ID
  sessionId?: string
  metadata?: Record<string, string | number | boolean>
}

export interface AuthSession {
  userId: ID
  token: string
  createdAt: ISODateTime
  expiresAt: ISODateTime
}

/** Root document stored by the persistence adapter */
export interface AppDatabase {
  version: number
  users: User[]
  organizations: Organization[]
  memberships: RestaurantMembership[]
  restaurants: Restaurant[]
  menus: Menu[]
  sections: MenuSection[]
  items: MenuItem[]
  assignments: MenuItemAssignment[]
  modifierGroups: ModifierGroup[]
  itemModifiers: ItemModifierAssignment[]
  combos: ComboConfig[]
  dietaryLabels: DietaryLabel[]
  qrCodes: QrCode[]
  brandThemes: BrandTheme[]
  orders: Order[]
  analyticsEvents: AnalyticsEvent[]
  sessions: AuthSession[]
  passwordResetTokens: Array<{
    token: string
    userId: ID
    expiresAt: ISODateTime
  }>
}

export const DEFAULT_BRANDING: RestaurantBranding = {
  primaryColor: '#1A3A2F',
  secondaryColor: '#C4A574',
  accentColor: '#E07A3D',
  backgroundColor: '#F7F3EC',
  surfaceColor: '#FFFFFF',
  textColor: '#1C1917',
  buttonColor: '#1A3A2F',
  buttonTextColor: '#FFFFFF',
  headingFont: 'Fraunces',
  bodyFont: 'DM Sans',
  borderRadius: 'md',
  cardStyle: 'bordered',
  buttonStyle: 'solid',
  logoPlacement: 'left',
  coverDisplay: 'full',
  imagePresentation: 'cover',
  appearance: 'light',
}

export const DEFAULT_ORDERING: OrderingSettings = {
  pickupEnabled: true,
  deliveryEnabled: true,
  minimumDeliveryCents: 1500,
  deliveryFeeCents: 399,
  taxRatePercent: 8.25,
  estimatedPrepMinutes: 20,
  acceptingOrders: true,
  temporarilyClosed: false,
  orderCutoffMinutesBeforeClose: 15,
  tipPresetsPercent: [15, 18, 20, 25],
  itemNotesEnabled: true,
}

/** Sensible fulfillment defaults when creating a retail store. */
export const DEFAULT_RETAIL_ORDERING: OrderingSettings = {
  ...DEFAULT_ORDERING,
  minimumDeliveryCents: 5000,
  deliveryFeeCents: 999,
  estimatedPrepMinutes: 90,
  tipPresetsPercent: [10, 15, 20],
}

export const DEFAULT_COVER_INTRO: StoreCoverIntro = {
  title: '',
  buttonLabel: '',
  buttonHref: '',
}

export const DEFAULT_STORE_PAGES: StorePages = {
  about: {
    enabled: false,
    title: 'About',
    body: '',
  },
  contact: {
    enabled: false,
    title: 'Contact',
    intro: '',
    showPhone: true,
    showEmail: true,
    showAddress: true,
    showHours: true,
    showWebsite: true,
    showInstagram: true,
    showFacebook: true,
    showTwitter: true,
    showTiktok: true,
  },
  coverIntro: { ...DEFAULT_COVER_INTRO },
}

export function defaultStorePagesFor(kind: StoreKind): StorePages {
  if (kind !== 'retail') {
    return {
      about: { ...DEFAULT_STORE_PAGES.about },
      contact: { ...DEFAULT_STORE_PAGES.contact },
      coverIntro: { ...DEFAULT_COVER_INTRO },
    }
  }
  return {
    about: {
      enabled: true,
      title: 'About',
      body: 'Tell your story — craft, materials, and what makes your shop unique.',
    },
    contact: {
      ...DEFAULT_STORE_PAGES.contact,
      enabled: true,
      intro: 'Questions about an order or a custom piece? Reach out anytime.',
    },
    coverIntro: {
      title: 'New season essentials',
      buttonLabel: 'Shop featured',
      buttonHref: '#section-featured',
    },
  }
}

export const FONT_OPTIONS = [
  { id: 'Fraunces', label: 'Fraunces', stack: '"Fraunces", Georgia, serif' },
  { id: 'Source Serif 4', label: 'Source Serif', stack: '"Source Serif 4", Georgia, serif' },
  { id: 'Libre Baskerville', label: 'Libre Baskerville', stack: '"Libre Baskerville", Georgia, serif' },
  { id: 'DM Sans', label: 'DM Sans', stack: '"DM Sans", system-ui, sans-serif' },
  { id: 'Outfit', label: 'Outfit', stack: '"Outfit", system-ui, sans-serif' },
  { id: 'IBM Plex Sans', label: 'IBM Plex Sans', stack: '"IBM Plex Sans", system-ui, sans-serif' },
] as const
