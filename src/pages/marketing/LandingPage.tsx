import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Gift,
  MonitorPlay,
  Percent,
  QrCode,
  ShoppingBag,
  Store,
  TabletSmartphone,
  UtensilsCrossed,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DEMO_CREDENTIALS } from '@/data/seed/demo'
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '@/lib/platformBrand'
import { cn } from '@/lib/utils'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1800&q=80'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f1c18] text-stone-100">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white ring-1 ring-white/15">
              <Store className="h-4 w-4" />
            </span>
            <span className="font-display text-xl tracking-tight text-white">
              {PLATFORM_NAME}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button
                variant="ghost"
                className="text-white/85 hover:bg-white/10 hover:text-white"
              >
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-white text-stone-900 hover:bg-white/90">
                Get started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* One composition: brand-first full-bleed hero */}
      <section className="relative isolate min-h-[100svh] overflow-hidden">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1c18] via-[#0f1c18]/70 to-[#0f1c18]/35" />
        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 sm:pb-20">
          <p className="font-display text-5xl tracking-tight text-white sm:text-6xl md:text-7xl animate-fade-up">
            {PLATFORM_NAME}
          </p>
          <h1 className="mt-4 max-w-2xl text-xl font-medium leading-snug text-white/90 sm:text-2xl animate-fade-up [animation-delay:80ms]">
            One platform for restaurant menus and retail shops.
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/70 sm:text-lg animate-fade-up [animation-delay:140ms]">
            {PLATFORM_TAGLINE}
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-fade-up [animation-delay:200ms]">
            <Link to="/signup">
              <Button size="lg" className="bg-white text-stone-900 hover:bg-white/90">
                Start free demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/r/the-corner-table">
              <Button
                size="lg"
                variant="outline"
                className="border-white/35 bg-transparent text-white hover:bg-white/10"
              >
                Demo restaurant
              </Button>
            </Link>
            <Link to="/r/haven-and-hide">
              <Button
                size="lg"
                variant="outline"
                className="border-white/35 bg-transparent text-white hover:bg-white/10"
              >
                Demo retail shop
              </Button>
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/45 animate-fade-up [animation-delay:260ms]">
            Demo login: {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
          </p>
        </div>
      </section>

      <main>
        {/* Two verticals */}
        <section className="border-t border-white/10 bg-[#12241e]">
          <div className="mx-auto grid max-w-6xl gap-0 md:grid-cols-2">
            <VerticalPanel
              href="/r/the-corner-table"
              icon={UtensilsCrossed}
              eyebrow="Restaurants"
              title="Menus that order themselves"
              body="Daypart menus, modifiers, combos, kitchen display, and pickup or delivery — branded to your dining room."
              image="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"
              cta="Open restaurant demo"
            />
            <VerticalPanel
              href="/r/haven-and-hide"
              icon={ShoppingBag}
              eyebrow="Retail"
              title="Catalogs that feel like a shop"
              titleDelay
              body="Product grids, bundles, shipping or pickup, fulfillment boards, and a cart built for browsing."
              image="https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80"
              cta="Open retail demo"
            />
          </div>
        </section>

        {/* Capability bands — one job each */}
        <FeatureBand
          eyebrow="Storefronts"
          title="Your brand, not a generic template"
          body="Custom colors, fonts, logos, homepage splash pages, about and contact, and a shop that matches your look."
          points={[
            'Reorderable homepage sections',
            'Restaurant list or retail grid layouts',
            'Full-bleed or margined storefront width',
          ]}
        />

        <FeatureBand
          eyebrow="In-store displays"
          title="TV boards that stay live"
          body="Menu boards, featured product signage, branding screens, and graphic slideshows — updated from the same catalog."
          points={[
            'Auto-rotating featured items',
            'Logo styles for square or wide marks',
            'Ready for counters and windows',
          ]}
          invert
        />

        <FeatureBand
          eyebrow="Orders & operations"
          title="From tap to ticket"
          body="Customers order on phone; staff run POS, kitchen or fulfillment displays, and live order tracking."
          points={[
            'Simulated checkout and live order status',
            'QR codes into the right catalog',
            'Owner dashboard with analytics',
          ]}
        />

        <FeatureBand
          eyebrow="Loyalty & promos"
          title="Bring people back"
          body="Points, coupons, and sales that apply on the storefront — without bolting on another tool."
          points={[
            'Loyalty accounts and rewards',
            'Percent-off and sale pricing',
            'Promo tracking for campaigns',
          ]}
          invert
        />

        {/* Feature strip */}
        <section className="border-t border-white/10 bg-[#0f1c18] px-6 py-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--color-brand)_55%,white)]">
              Everything in one place
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl tracking-tight text-white sm:text-4xl">
              Built for the counter — online and on the floor.
            </h2>
            <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: TabletSmartphone,
                  title: 'Mobile ordering',
                  body: 'Menus or catalogs, modifiers, bundles, and a persistent bag or cart.',
                },
                {
                  icon: MonitorPlay,
                  title: 'Digital signage',
                  body: 'Featured boards, ordering menus, branding signs, and graphic slides.',
                },
                {
                  icon: QrCode,
                  title: 'QR campaigns',
                  body: 'Table tents and window codes that open the right page and track scans.',
                },
                {
                  icon: Store,
                  title: 'Owner dashboard',
                  body: 'Catalogs, branding, pages, scheduling, orders, and analytics.',
                },
                {
                  icon: Gift,
                  title: 'Loyalty',
                  body: 'Points earned on purchases with rewards your guests actually notice.',
                },
                {
                  icon: Percent,
                  title: 'Promotions',
                  body: 'Sales and coupons that update prices on the storefront automatically.',
                },
              ].map((item) => (
                <li key={item.title} className="border-t border-white/10 pt-5">
                  <item.icon className="mb-3 h-5 w-5 text-[color-mix(in_srgb,var(--color-brand)_40%,#9fbeb0)]" />
                  <h3 className="font-display text-xl text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="relative overflow-hidden border-t border-white/10 px-6 py-24">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              background:
                'radial-gradient(ellipse at 30% 20%, #1a3a2f 0%, transparent 55%), radial-gradient(ellipse at 80% 80%, #2a4a3a 0%, transparent 50%)',
            }}
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="font-display text-4xl tracking-tight text-white sm:text-5xl">
              Ready when your counter is.
            </p>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/65">
              Spin up a restaurant or retail demo in minutes — same toolkit, tailored wording and
              layouts for each kind of shop.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/signup">
                <Button size="lg" className="bg-white text-stone-900 hover:bg-white/90">
                  Create your store
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/35 bg-transparent text-white hover:bg-white/10"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-white/40">
        © {new Date().getFullYear()} {PLATFORM_NAME}. For restaurants and retail shops.
      </footer>
    </div>
  )
}

function VerticalPanel({
  href,
  icon: Icon,
  eyebrow,
  title,
  body,
  image,
  cta,
}: {
  href: string
  icon: typeof Store
  eyebrow: string
  title: string
  body: string
  image: string
  cta: string
  titleDelay?: boolean
}) {
  return (
    <Link
      to={href}
      className="group relative isolate min-h-[28rem] overflow-hidden border-white/10 md:border-r md:last:border-r-0"
    >
      <img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/20" />
      <div className="relative z-10 flex h-full min-h-[28rem] flex-col justify-end p-8 sm:p-10">
        <Icon className="mb-4 h-5 w-5 text-white/80" />
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
          {eyebrow}
        </p>
        <h2 className="mt-2 font-display text-3xl tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
          {body}
        </p>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white">
          {cta}
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

function FeatureBand({
  eyebrow,
  title,
  body,
  points,
  invert = false,
}: {
  eyebrow: string
  title: string
  body: string
  points: string[]
  invert?: boolean
}) {
  return (
    <section
      className={cn(
        'border-t border-white/10 px-6 py-20',
        invert ? 'bg-[#152820]' : 'bg-[#0f1c18]',
      )}
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-end lg:gap-16">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--color-brand)_55%,white)]">
            {eyebrow}
          </p>
          <h2 className="mt-3 font-display text-3xl tracking-tight text-white sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">{body}</p>
        </div>
        <ul className="space-y-4 border-l border-white/15 pl-6">
          {points.map((point) => (
            <li key={point} className="text-base text-white/80">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
