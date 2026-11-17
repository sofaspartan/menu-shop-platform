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

/** Page top: cover image band, or simple title + subtitle (no image). */
export type PageHeaderStyle = 'cover' | 'simple'

export type CoverHeroHeight = 'short' | 'tall'
/** left = bottom-left; centerBottom = centered on bottom; centerMiddle = true center of hero */
export type CoverHeroAlign = 'left' | 'centerBottom' | 'centerMiddle'

/** Shared hero overlay controls for About / Contact (mirrors shop cover). */
export interface PageHeroOptions {
  height: CoverHeroHeight
  align: CoverHeroAlign
  showTitle: boolean
  showSubtitle: boolean
  showButton: boolean
  buttonLabel?: string
  buttonHref?: string
}

export interface StoreAboutPage {
  enabled: boolean
  headerStyle: PageHeaderStyle
  title: string
  /** Supporting line under the title (simple header) or under cover title. */
  subtitle?: string
  heroImageUrl?: string
  hero: PageHeroOptions
  /** Plain text; blank lines become paragraphs. */
  body: string
}

export interface StoreContactPage {
  enabled: boolean
  headerStyle: PageHeaderStyle
  title: string
  intro?: string
  heroImageUrl?: string
  hero: PageHeroOptions
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

export interface StoreFooter {
  enabled: boolean
  /** Defaults to the store name when blank. */
  companyName?: string
  /** Defaults to “© {year} {company}. All rights reserved.” when blank. */
  copyright?: string
  /** Shop / About / Contact links when those pages are enabled. */
  showPageLinks: boolean
}

/** Cover / hero band for retail (and optional restaurant) storefronts. */
export interface StoreCoverIntro {
  /** Show the cover image section at all. */
  enabled: boolean
  height: CoverHeroHeight
  /** Overlay copy alignment inside the cover. */
  align: CoverHeroAlign
  showTitle: boolean
  showDescription: boolean
  showButton: boolean
  title?: string
  /** Shown when showButton is on and label is non-empty. */
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
  /** Show the featured product hero on retail catalogs. */
  featuredEnabled?: boolean
  footer?: StoreFooter
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
  /** Primary / cover image (also used in grids and bag lines). */
  imageUrl?: string
  /** Additional gallery images shown in the product modal. */
  imageUrls?: string[]
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
  enabled: true,
  height: 'short',
  align: 'left',
  showTitle: true,
  showDescription: true,
  showButton: true,
  title: '',
  buttonLabel: '',
  buttonHref: '',
}

export const DEFAULT_STORE_FOOTER: StoreFooter = {
  enabled: true,
  companyName: '',
  copyright: '',
  showPageLinks: true,
}

export const DEFAULT_PAGE_HERO: PageHeroOptions = {
  height: 'short',
  align: 'left',
  showTitle: true,
  showSubtitle: true,
  showButton: false,
  buttonLabel: '',
  buttonHref: '',
}

export function normalizePageHero(hero?: Partial<PageHeroOptions> | null): PageHeroOptions {
  const rawAlign = hero?.align as string | undefined
  return {
    ...DEFAULT_PAGE_HERO,
    ...hero,
    height: hero?.height === 'tall' ? 'tall' : 'short',
    align:
      rawAlign === 'centerMiddle'
        ? 'centerMiddle'
        : rawAlign === 'centerBottom' || rawAlign === 'center'
          ? 'centerBottom'
          : 'left',
    showTitle: hero?.showTitle ?? true,
    showSubtitle: hero?.showSubtitle ?? true,
    showButton: hero?.showButton ?? false,
  }
}

export function normalizeCoverIntro(
  intro?: Partial<StoreCoverIntro> | null,
): StoreCoverIntro {
  return {
    ...DEFAULT_COVER_INTRO,
    ...intro,
    enabled: intro?.enabled ?? DEFAULT_COVER_INTRO.enabled,
    height: intro?.height === 'tall' ? 'tall' : 'short',
    align: (() => {
      const raw = intro?.align as string | undefined
      if (raw === 'centerMiddle') return 'centerMiddle'
      if (raw === 'centerBottom' || raw === 'center') return 'centerBottom'
      return 'left'
    })(),
    showTitle: intro?.showTitle ?? true,
    showDescription: intro?.showDescription ?? true,
    showButton: intro?.showButton ?? true,
  }
}

export const DEFAULT_STORE_PAGES: StorePages = {
  about: {
    enabled: false,
    headerStyle: 'cover',
    title: 'About',
    subtitle: '',
    hero: { ...DEFAULT_PAGE_HERO },
    body: '',
  },
  contact: {
    enabled: false,
    headerStyle: 'simple',
    title: 'Contact',
    intro: '',
    hero: { ...DEFAULT_PAGE_HERO },
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
  featuredEnabled: true,
  footer: { ...DEFAULT_STORE_FOOTER },
}

export function normalizeStoreFooter(footer?: Partial<StoreFooter> | null): StoreFooter {
  return {
    ...DEFAULT_STORE_FOOTER,
    ...footer,
    enabled: footer?.enabled ?? DEFAULT_STORE_FOOTER.enabled,
    showPageLinks: footer?.showPageLinks ?? true,
  }
}

export function normalizeAboutPage(
  about?: Partial<StoreAboutPage> | null,
): StoreAboutPage {
  const base = DEFAULT_STORE_PAGES.about
  return {
    ...base,
    ...about,
    enabled: about?.enabled ?? false,
    headerStyle: about?.headerStyle === 'simple' ? 'simple' : 'cover',
    title: about?.title ?? base.title,
    body: about?.body ?? '',
    hero: normalizePageHero(about?.hero ?? base.hero),
  }
}

export function normalizeContactPage(
  contact?: Partial<StoreContactPage> | null,
): StoreContactPage {
  const base = DEFAULT_STORE_PAGES.contact
  return {
    ...base,
    ...contact,
    enabled: contact?.enabled ?? false,
    headerStyle: contact?.headerStyle === 'cover' ? 'cover' : 'simple',
    title: contact?.title ?? base.title,
    hero: normalizePageHero(contact?.hero ?? base.hero),
  }
}

export function defaultStorePagesFor(kind: StoreKind): StorePages {
  if (kind !== 'retail') {
    return {
      about: { ...DEFAULT_STORE_PAGES.about, hero: { ...DEFAULT_PAGE_HERO } },
      contact: { ...DEFAULT_STORE_PAGES.contact, hero: { ...DEFAULT_PAGE_HERO } },
      coverIntro: { ...DEFAULT_COVER_INTRO },
      featuredEnabled: true,
      footer: { ...DEFAULT_STORE_FOOTER, enabled: false },
    }
  }
  return {
    about: {
      enabled: true,
      headerStyle: 'cover',
      title: 'About',
      subtitle: 'Our story, materials, and craft.',
      hero: { ...DEFAULT_PAGE_HERO },
      body: 'Tell your story — craft, materials, and what makes your shop unique.',
    },
    contact: {
      ...DEFAULT_STORE_PAGES.contact,
      enabled: true,
      headerStyle: 'simple',
      intro: 'Questions about an order or a custom piece? Reach out anytime.',
      hero: { ...DEFAULT_PAGE_HERO },
    },
    coverIntro: {
      ...DEFAULT_COVER_INTRO,
      title: 'New season essentials',
      buttonLabel: 'Shop featured',
      buttonHref: '#section-featured',
    },
    featuredEnabled: true,
    footer: {
      ...DEFAULT_STORE_FOOTER,
      enabled: true,
      showPageLinks: true,
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
