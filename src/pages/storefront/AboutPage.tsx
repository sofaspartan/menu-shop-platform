import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { RetailChrome } from '@/components/storefront/RetailChrome'
import { RetailBagFab } from '@/components/storefront/RetailBagFab'
import { StorefrontNav } from '@/components/storefront/StorefrontNav'
import { BagDrawer } from '@/components/storefront/BagDrawer'
import { Button } from '@/components/ui/Button'
import { useDb } from '@/hooks/useDb'
import { useBagStore } from '@/stores/bagStore'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANDING } from '@/types'

function paragraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function AboutPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { db, loading } = useDb()
  const bagLines = useBagStore((s) => s.lines)
  const [bagOpen, setBagOpen] = useState(false)

  const restaurant = useMemo(
    () => db?.restaurants.find((r) => r.slug === slug) ?? null,
    [db, slug],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-pulse-soft text-stone-500">Loading…</p>
      </div>
    )
  }

  if (!restaurant || !restaurant.pages?.about?.enabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl">Page not found</h1>
        <Link to={slug ? `/r/${slug}` : '/'} className="mt-6">
          <Button>Back to shop</Button>
        </Link>
      </div>
    )
  }

  const about = restaurant.pages.about
  const body = paragraphs(about.body)
  const isRetailLayout =
    (restaurant.storefrontLayout ??
      (restaurant.storeKind === 'retail' ? 'retail' : 'restaurant')) === 'retail'
  const bagCount = bagLines
    .filter((l) => l.restaurantId === restaurant.id)
    .reduce((n, l) => n + l.quantity, 0)
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)

  return (
    <StorefrontShell branding={restaurant.branding ?? DEFAULT_BRANDING}>
      {isRetailLayout ? (
        <RetailChrome restaurant={restaurant} showSearch={false} />
      ) : (
        <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
            <StorefrontNav restaurant={restaurant} />
          </div>
        </div>
      )}

      {about.heroImageUrl ? (
        <div className="relative aspect-[21/9] min-h-[240px] max-h-[440px] w-full overflow-hidden">
          <img
            src={about.heroImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
          <div className={cn(contentClass, 'absolute inset-x-0 bottom-0 pb-8')}>
            <h1 className="max-w-3xl font-display text-4xl text-white drop-shadow sm:text-5xl">
              {about.title || 'About'}
            </h1>
          </div>
        </div>
      ) : (
        <div className={cn(contentClass, 'pt-10')}>
          <h1 className="max-w-3xl font-display text-4xl text-[var(--sf-text)] sm:text-5xl">
            {about.title || 'About'}
          </h1>
        </div>
      )}

      <article className={cn(contentClass, 'py-10 pb-28')}>
        <div className="max-w-3xl space-y-5 text-[17px] leading-relaxed text-[var(--sf-text)]/85">
          {body.length ? (
            body.map((p) => <p key={p.slice(0, 24)}>{p}</p>)
          ) : (
            <p className="text-[var(--sf-text)]/55">No story added yet.</p>
          )}
        </div>
      </article>

      {isRetailLayout ? (
        <RetailBagFab
          storeKind={restaurant.storeKind}
          bagCount={bagCount}
          onOpen={() => setBagOpen(true)}
        />
      ) : null}

      <BagDrawer
        open={bagOpen}
        onClose={() => setBagOpen(false)}
        restaurant={restaurant}
        onEditLine={() => {
          setBagOpen(false)
          navigate(`/r/${restaurant.slug}`)
        }}
      />
    </StorefrontShell>
  )
}
