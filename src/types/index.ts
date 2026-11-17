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
  /** Shop / About / Contact / Home links when those pages are enabled. */
  showPageLinks: boolean
  showLogo?: boolean
  /** “Powered by MenuShop” credit. */
  showPoweredBy?: boolean
}

/** Reorderable storefront home sections (root `/r/:slug`). */
export type HomeSectionKind = 'splash' | 'aboutTeaser' | 'featured' | 'catalog'

export type HomeSplashLayout = 'fullBleedCenter' | 'fullBleedBottom'
export type HomeAboutLayout = 'splitImageRight' | 'splitImageLeft' | 'stacked'
export type HomeFeaturedLayout = 'carousel' | 'grid'

export interface HomeSection {
  id: ID
  kind: HomeSectionKind
  enabled: boolean
  sortOrder: number
  /** Splash */
  splashLayout?: HomeSplashLayout
  logoStyle?: LogoStyle
  showLogo?: boolean
  showTitle?: boolean
  showSubtitle?: boolean
  title?: string
  subtitle?: string
  primaryButtonLabel?: string
  primaryButtonHref?: string
  secondaryButtonLabel?: string
  secondaryButtonHref?: string
  /** About teaser */
  aboutLayout?: HomeAboutLayout
  aboutTitle?: string
  aboutBody?: string
  aboutButtonLabel?: string
  aboutImageUrl?: string
  /** Featured */
  featuredLayout?: HomeFeaturedLayout
  /** Grid: how many items to show (carousel always shows one at a time). */
  featuredCount?: number
}

export interface StoreHome {
  /** When true, root storefront uses ordered home sections. */
  enabled: boolean
  sections: HomeSection[]
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
  /** Optional reorderable homepage on `/r/:slug`. */
  home?: StoreHome
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

/** Earn/redeem rules for a store (restaurant or retail). */
export type LoyaltyRewardType = 'percent_off' | 'amount_off' | 'free_item'

export interface LoyaltyReward {
  id: ID
  type: LoyaltyRewardType
  label: string
  pointsCost: number
  /** For percent_off */
  percentOff?: number
  maxDiscountCents?: number
  /** For amount_off */
  amountOffCents?: number
  /** For free_item — catalog item id */
  itemId?: ID
}

export interface LoyaltySettings {
  enabled: boolean
  /** Points earned per $1 of merchandise subtotal (before tax/fees/tip). */
  pointsPerDollar: number
  rewards: LoyaltyReward[]
}

export interface LoyaltyAccount extends Timestamps {
  id: ID
  restaurantId: ID
  /** Lowercased email — guest checkout identity for this store. */
  email: string
  phone?: string
  name?: string
  pointsBalance: number
  lifetimePoints: number
}

export interface LoyaltyLedgerEntry {
  id: ID
  restaurantId: ID
  accountId: ID
  orderId?: ID
  delta: number
  reason: string
  balanceAfter: number
  createdAt: ISODateTime
}

export type CouponType = 'percent_off' | 'amount_off'

/**
 * always = permanently redeemable while enabled (no auto-expire by date).
 * fixed = one-time window between startsAt/endsAt (then auto-expires off, not deleted).
 * weekly = repeats on selected days/times until endsAt campaign bound (then auto-expires).
 */
export type PromoScheduleMode = 'always' | 'fixed' | 'weekly'
/** @deprecated Prefer PromoScheduleMode */
export type SaleScheduleMode = PromoScheduleMode

export interface Coupon extends Timestamps {
  id: ID
  restaurantId: ID
  code: string
  type: CouponType
  percentOff?: number
  amountOffCents?: number
  minSubtotalCents?: number
  maxDiscountCents?: number
  /** Empty/undefined = entire order; otherwise only matching line items. */
  itemIds?: ID[]
  /**
   * Owner enable switch. Past `endsAt` auto-sets this to false (record kept)
   * for fixed/weekly. `always` never auto-expires by date.
   */
  active: boolean
  startsAt?: ISODateTime
  endsAt?: ISODateTime
  /** Defaults to always when omitted (legacy coupons). */
  scheduleMode?: PromoScheduleMode
  daysOfWeek?: DayOfWeek[]
  startTime?: string
  endTime?: string
  expiredAt?: ISODateTime
  usageLimit?: number
  usedCount: number
}

/** Percent-off promotion on specific items or the whole store. */
export interface Sale extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  percentOff: number
  /** Empty = storewide. */
  itemIds: ID[]
  /**
   * Owner enable switch. Past `endsAt` auto-sets this to false (record kept).
   * Weekly sales stay true between cycles so they come back next week.
   */
  active: boolean
  /** Campaign / window window start (optional for open-ended weekly). */
  startsAt?: ISODateTime
  /** After this instant the sale auto-expires (active → false). */
  endsAt?: ISODateTime
  /** Defaults to fixed when omitted (legacy). Prefer always | fixed | weekly. */
  scheduleMode?: PromoScheduleMode
  /** For weekly: which days the sale is live (0=Sun … 6=Sat). */
  daysOfWeek?: DayOfWeek[]
  /** For weekly: local time window on those days (HH:mm). Defaults 00:00–23:59. */
  startTime?: string
  endTime?: string
  /** Set when auto-expired; cleared if the owner reactivates. */
  expiredAt?: ISODateTime
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
  loyalty: LoyaltySettings
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
  /**
   * Optional promotional price for this item/bundle.
   * When set below basePriceCents, storefront shows it on sale
   * (wins against weaker percent sales if cheaper).
   */
  salePriceCents?: CurrencyCents
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
  /**
   * When true, `stockQty` is decremented on purchase.
   * For retail this is units on hand; for restaurants it is typically
   * prepared portions / servings available today.
   */
  trackInventory?: boolean
  stockQty?: number
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
  /** Optional sale price mirrored onto the combo MenuItem. */
  salePriceCents?: CurrencyCents
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

/**
 * Digital board kinds:
 * - branding: logo + title on a chosen background image
 * - graphics: repeating image slideshow (fullscreen or framed with header/footer)
 * - featured: catalog/product slides (auto from featured items, or manual pages)
 * - menu: static above-counter ordering board (sections + prices + imagery)
 */
export type DisplayKind = 'branding' | 'graphics' | 'featured' | 'menu'

/** @deprecated Prefer DisplayKind */
export type DisplayMode = 'featured' | 'catalog' | 'mixed' | DisplayKind

export type GraphicsChrome = 'fullscreen' | 'framed'
export type FeaturedSource = 'auto' | 'manual'
/** Auto featured boards: follow live daypart schedules, or pin specific menus. */
export type FeaturedCatalogScope = 'daypart' | 'menus'
/** Ordering menu board presentation. */
export type MenuBoardLayout = 'cards' | 'columns'
/**
 * Ordering menu content scope:
 * - daypart: sections from menus currently serving by schedule
 * - custom: operator-picked menus and/or sections
 */
export type MenuCatalogScope = 'daypart' | 'custom'
/** Branding sign presentation. */
export type BrandingLayout = 'card' | 'fullbleed'
/** Logo framing on displays / homepage heroes. */
export type LogoStyle = 'roundedSquare' | 'natural'

export interface DisplayGraphicSlide {
  id: ID
  imageUrl: string
  title?: string
  subtitle?: string
  sortOrder: number
}

/** One page on a featured board — one or many items. */
export interface DisplayItemSlide {
  id: ID
  title?: string
  itemIds: ID[]
  sortOrder: number
}

/** @deprecated Prefer DisplayGraphicSlide / DisplayItemSlide */
export interface DisplayCustomSlide {
  id: ID
  title?: string
  subtitle?: string
  imageUrl?: string
  sortOrder: number
}

/**
 * URL-based digital menu board / store display.
 * Open `/r/{storeSlug}/display/{display.slug}` on a TV; updates live from the DB.
 */
export interface Display extends Timestamps {
  id: ID
  restaurantId: ID
  name: string
  slug: string
  active: boolean
  kind: DisplayKind
  slideDurationSec: number
  showLogo: boolean
  showStoreName: boolean
  /** Header / overlay: Live badge. */
  showLive: boolean
  /** Header chrome: show the calendar date beside live + time. */
  showDate: boolean
  /** Header / overlay: clock. */
  showTime: boolean
  /**
   * Card / framed layouts: show the top header row (logo, name, live/date/time).
   * Full-bleed branding still respects showLive/showDate/showTime as an overlay.
   */
  showHeader: boolean
  /** Logo framing: rounded square crop, or natural transparent wide logo. */
  logoStyle: LogoStyle
  headline?: string
  tagline?: string

  /** Branding board background (falls back to store cover). */
  backgroundImageUrl?: string
  /**
   * Branding sign layout:
   * - card: framed panel with title anchored toward the bottom (current look)
   * - fullbleed: edge-to-edge image with logo + title centered
   */
  brandingLayout: BrandingLayout

  /** Graphics slideshow chrome. */
  graphicsChrome: GraphicsChrome
  graphicSlides: DisplayGraphicSlide[]

  /** Featured board: auto from catalog featured flags, or manual pages. */
  featuredSource: FeaturedSource
  /**
   * Auto featured: `daypart` follows menus currently serving by schedule;
   * `menus` pulls from the manually selected menuIds (breakfast, lunch, …).
   */
  featuredCatalogScope: FeaturedCatalogScope
  /**
   * Limit menu / featured boards to these menus.
   * Featured + daypart / menu + daypart: ignored (live schedule wins).
   * Featured + menus / menu + custom: empty = all active menus.
   */
  menuIds: ID[]
  /**
   * Ordering menu + custom: limit to these sections; empty = every section
   * on the selected menus (or all active menus when menuIds is also empty).
   * Ignored when menuCatalogScope is daypart.
   */
  sectionIds: ID[]
  /** Ordering menu: follow live daypart or pick menus/sections manually. */
  menuCatalogScope: MenuCatalogScope
  showPrices: boolean
  showSoldOut: boolean
  /**
   * Ordering menu board layout:
   * - cards: visual section panels with optional imagery
   * - columns: dense traditional listed menu (no cards)
   */
  menuLayout: MenuBoardLayout
  /** Menu board (cards): show item imagery beside each offering. */
  showItemImages: boolean
  /** Auto mode: max items per rotating page. */
  itemsPerAutoSlide: number
  /**
   * Featured board: show the slide title above the item(s)
   * (e.g. “Featured drink”). Defaults on.
   */
  showFeaturedTitle: boolean
  /** Manual mode pages. */
  itemSlides: DisplayItemSlide[]

  /** Legacy fields kept for migration from earlier drafts. */
  mode?: DisplayMode
  customSlides?: DisplayCustomSlide[]
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
  /** Staff cancelled this line; optional note is shown to the customer. */
  cancelled?: boolean
  cancellationNote?: string
}

export interface OrderStatusEvent {
  status: OrderStatus
  at: ISODateTime
  note?: string
  byUserId?: ID
}

export interface OrderPricing {
  subtotalCents: CurrencyCents
  /** Absolute discount applied to merchandise (coupons / loyalty). */
  discountCents: CurrencyCents
  discountLabel?: string
  couponCode?: string
  taxCents: CurrencyCents
  deliveryFeeCents: CurrencyCents
  tipCents: CurrencyCents
  totalCents: CurrencyCents
  taxRatePercent: number
  loyaltyPointsEarned?: number
  loyaltyPointsRedeemed?: number
  loyaltyRewardId?: ID
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
  /** Optional reason shared with the customer when the order is cancelled. */
  cancellationNote?: string
  estimatedReadyAt?: ISODateTime
  demoAutoAdvance?: boolean
  loyaltyAccountId?: ID
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
  displays: Display[]
  brandThemes: BrandTheme[]
  orders: Order[]
  coupons: Coupon[]
  sales: Sale[]
  loyaltyAccounts: LoyaltyAccount[]
  loyaltyLedger: LoyaltyLedgerEntry[]
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

export const DEFAULT_LOYALTY: LoyaltySettings = {
  enabled: false,
  pointsPerDollar: 1,
  rewards: [],
}

export function normalizeLoyaltySettings(
  loyalty?: Partial<LoyaltySettings> | null,
): LoyaltySettings {
  return {
    enabled: loyalty?.enabled ?? DEFAULT_LOYALTY.enabled,
    pointsPerDollar:
      typeof loyalty?.pointsPerDollar === 'number' && loyalty.pointsPerDollar >= 0
        ? loyalty.pointsPerDollar
        : DEFAULT_LOYALTY.pointsPerDollar,
    rewards: Array.isArray(loyalty?.rewards) ? loyalty.rewards : [],
  }
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
  showLogo: true,
  showPoweredBy: true,
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
    showLogo: footer?.showLogo ?? true,
    showPoweredBy: footer?.showPoweredBy ?? true,
  }
}

export function defaultHomeSectionsFor(kind: StoreKind): HomeSection[] {
  const retail = kind === 'retail'
  return [
    {
      id: 'home_splash',
      kind: 'splash',
      enabled: true,
      sortOrder: 0,
      splashLayout: 'fullBleedCenter',
      logoStyle: 'natural',
      showLogo: true,
      showTitle: true,
      showSubtitle: true,
      title: retail ? 'Welcome in' : 'Tonight’s table',
      subtitle: retail
        ? 'New arrivals and everyday essentials, curated for you.'
        : 'Seasonal plates, craft drinks, and a warm welcome.',
      primaryButtonLabel: retail ? 'Shop catalog' : 'View menu',
      primaryButtonHref: '#section-catalog',
      secondaryButtonLabel: 'About us',
      secondaryButtonHref: 'about',
    },
    {
      id: 'home_about',
      kind: 'aboutTeaser',
      enabled: true,
      sortOrder: 1,
      aboutLayout: retail ? 'splitImageRight' : 'splitImageLeft',
      aboutTitle: retail ? 'Our craft' : 'Our kitchen',
      aboutBody: retail
        ? 'Materials, makers, and the story behind the shop.'
        : 'From the pass to your table — our story, season by season.',
      aboutButtonLabel: 'Read more',
    },
    {
      id: 'home_featured',
      kind: 'featured',
      enabled: true,
      sortOrder: 2,
      featuredLayout: retail ? 'grid' : 'carousel',
      featuredCount: retail ? 4 : 1,
    },
    {
      id: 'home_catalog',
      kind: 'catalog',
      enabled: true,
      sortOrder: 3,
    },
  ]
}

export function normalizeHomeSection(
  section: Partial<HomeSection> & Pick<HomeSection, 'id' | 'kind'>,
  index: number,
): HomeSection {
  return {
    id: section.id,
    kind: section.kind,
    enabled: section.enabled !== false,
    sortOrder: section.sortOrder ?? index,
    splashLayout:
      section.splashLayout === 'fullBleedBottom' ? 'fullBleedBottom' : 'fullBleedCenter',
    logoStyle: section.logoStyle === 'roundedSquare' ? 'roundedSquare' : 'natural',
    showLogo: section.showLogo !== false,
    showTitle: section.showTitle !== false,
    showSubtitle: section.showSubtitle !== false,
    title: section.title,
    subtitle: section.subtitle,
    primaryButtonLabel: section.primaryButtonLabel,
    primaryButtonHref: section.primaryButtonHref,
    secondaryButtonLabel: section.secondaryButtonLabel,
    secondaryButtonHref: section.secondaryButtonHref,
    aboutLayout:
      section.aboutLayout === 'splitImageLeft'
        ? 'splitImageLeft'
        : section.aboutLayout === 'stacked'
          ? 'stacked'
          : 'splitImageRight',
    aboutTitle: section.aboutTitle,
    aboutBody: section.aboutBody,
    aboutButtonLabel: section.aboutButtonLabel,
    aboutImageUrl: section.aboutImageUrl,
    featuredLayout: section.featuredLayout === 'grid' ? 'grid' : 'carousel',
    featuredCount: Math.max(1, Math.min(8, section.featuredCount ?? 4)),
  }
}

export function normalizeStoreHome(
  home: Partial<StoreHome> | null | undefined,
  kind: StoreKind,
): StoreHome {
  const defaults = defaultHomeSectionsFor(kind)
  if (!home?.sections?.length) {
    return {
      enabled: home?.enabled ?? false,
      sections: defaults,
    }
  }
  const sections = home.sections
    .filter((s) => s && s.id && s.kind)
    .map((s, i) => normalizeHomeSection(s as HomeSection, i))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  // Ensure catalog exists so shop never disappears.
  if (!sections.some((s) => s.kind === 'catalog')) {
    sections.push({
      id: 'home_catalog',
      kind: 'catalog',
      enabled: true,
      sortOrder: sections.length,
    })
  }
  return {
    enabled: home.enabled === true,
    sections,
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
      footer: {
        ...DEFAULT_STORE_FOOTER,
        enabled: true,
        showLogo: true,
        showPoweredBy: true,
      },
      home: { enabled: true, sections: defaultHomeSectionsFor('restaurant') },
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
      showLogo: true,
      showPoweredBy: true,
    },
    home: { enabled: true, sections: defaultHomeSectionsFor('retail') },
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
