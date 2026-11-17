import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { RetailChrome } from '@/components/storefront/RetailChrome'
import { RetailBagFab } from '@/components/storefront/RetailBagFab'
import { StorefrontNav } from '@/components/storefront/StorefrontNav'
import { StorefrontFooter } from '@/components/storefront/StorefrontFooter'
import { StorePageHeader } from '@/components/storefront/StorePageHeader'
import { BagDrawer } from '@/components/storefront/BagDrawer'
import { Button } from '@/components/ui/Button'
import { useDb } from '@/hooks/useDb'
import { useBagStore } from '@/stores/bagStore'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { cn } from '@/lib/utils'
import { DEFAULT_BRANDING, normalizeAboutPage } from '@/types'

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

  const about = normalizeAboutPage(restaurant.pages.about)
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
      <div className="flex min-h-screen flex-col">
        {isRetailLayout ? (
          <RetailChrome restaurant={restaurant} showSearch={false} />
        ) : (
          <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
            <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
              <StorefrontNav restaurant={restaurant} />
            </div>
          </div>
        )}

        <StorePageHeader
          title={about.title || 'About'}
          subtitle={about.subtitle}
          headerStyle={about.headerStyle}
          heroImageUrl={about.heroImageUrl}
          storefrontWidth={restaurant.storefrontWidth}
        />

        <article className={cn(contentClass, 'flex-1 py-10 pb-28')}>
          <div className="max-w-3xl space-y-5 text-[17px] leading-relaxed text-[var(--sf-text)]/85">
            {body.length ? (
              body.map((p) => <p key={p.slice(0, 24)}>{p}</p>)
            ) : (
              <p className="text-[var(--sf-text)]/55">No story added yet.</p>
            )}
          </div>
        </article>

        <StorefrontFooter restaurant={restaurant} />
      </div>

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
