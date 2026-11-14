import { Link } from 'react-router-dom'
import { ArrowRight, QrCode, Smartphone, Store, UtensilsCrossed } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { DEMO_CREDENTIALS } from '@/data/seed/demo'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8efeb_0%,_#f4f1ec_45%,_#efe6d8_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand)] text-white">
            <UtensilsCrossed className="h-4 w-4" />
          </div>
          <span className="font-display text-xl">MenuShop</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-fade-up">
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--color-brand)]">
              Digital restaurant ordering
            </p>
            <h1 className="font-display text-5xl leading-[1.05] text-stone-900 md:text-6xl">
              MenuShop
            </h1>
            <p className="mt-5 max-w-xl text-lg text-stone-600">
              Create a branded digital storefront, manage menus and modifiers, take simulated
              orders, and track every step from kitchen to customer.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button size="lg">
                  Start free demo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/r/the-corner-table">
                <Button size="lg" variant="outline">
                  View demo storefront
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-stone-500">
              Demo login: {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
            </p>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_30px_80px_-40px_rgba(26,58,47,0.45)]">
              <img
                src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80"
                alt="Warm restaurant dining room"
                className="h-72 w-full object-cover md:h-96"
              />
              <div className="space-y-3 p-5">
                <div className="font-display text-2xl">The Corner Table</div>
                <p className="text-sm text-stone-500">
                  Neighborhood plates, craft drinks, and a polished mobile ordering experience.
                </p>
                <div className="flex gap-2">
                  <span className="rounded-lg bg-[var(--color-brand-soft)] px-2 py-1 text-xs text-[var(--color-brand)]">
                    Accepting orders
                  </span>
                  <span className="rounded-lg bg-stone-100 px-2 py-1 text-xs text-stone-600">
                    Pickup & delivery
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-24 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Smartphone,
              title: 'Mobile-first storefronts',
              body: 'Beautiful menus, modifiers, combos, and a persistent shopping bag designed for phones.',
            },
            {
              icon: Store,
              title: 'Owner dashboard',
              body: 'Menus, item library, branding, scheduling, orders, QR codes, and analytics in one place.',
            },
            {
              icon: QrCode,
              title: 'QR to order',
              body: 'Generate scannable codes that open the right menu and track campaign performance.',
            },
          ].map((feature, i) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-stone-200 bg-white/80 p-6 animate-fade-up"
              style={{ animationDelay: `${(i + 1) * 80}ms` }}
            >
              <feature.icon className="mb-4 h-6 w-6 text-[var(--color-brand)]" />
              <h2 className="font-display text-xl">{feature.title}</h2>
              <p className="mt-2 text-sm text-stone-560 text-stone-600">{feature.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
