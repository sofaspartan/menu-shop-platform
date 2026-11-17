import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Clock3, Globe, Mail, MapPin, Phone } from 'lucide-react'
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
import { formatHoursSummary } from '@/lib/scheduling'
import { storefrontContentClass } from '@/lib/storefrontWidth'
import { formatPhone, cn } from '@/lib/utils'
import { DEFAULT_BRANDING, normalizeContactPage } from '@/types'

export function ContactPage() {
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

  if (!restaurant || !restaurant.pages?.contact?.enabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl">Page not found</h1>
        <Link to={slug ? `/r/${slug}` : '/'} className="mt-6">
          <Button>Back to shop</Button>
        </Link>
      </div>
    )
  }

  const contact = normalizeContactPage(restaurant.pages.contact)
  const phone = contact.phoneOverride?.trim() || restaurant.phone
  const email = contact.emailOverride?.trim() || restaurant.email
  const hoursSummary = formatHoursSummary(restaurant, new Date())
  const social = restaurant.social
  const isRetailLayout =
    (restaurant.storefrontLayout ??
      (restaurant.storeKind === 'retail' ? 'retail' : 'restaurant')) === 'retail'
  const bagCount = bagLines
    .filter((l) => l.restaurantId === restaurant.id)
    .reduce((n, l) => n + l.quantity, 0)
  const contentClass = storefrontContentClass(restaurant.storefrontWidth)

  const rows: Array<{
    key: string
    icon: typeof Phone
    label: string
    href?: string
    value: string
  }> = []

  if (contact.showPhone && phone) {
    rows.push({
      key: 'phone',
      icon: Phone,
      label: 'Phone',
      href: `tel:${phone}`,
      value: formatPhone(phone),
    })
  }
  if (contact.showEmail && email) {
    rows.push({
      key: 'email',
      icon: Mail,
      label: 'Email',
      href: `mailto:${email}`,
      value: email,
    })
  }
  if (contact.showAddress && restaurant.address.line1) {
    const value = [
      restaurant.address.line1,
      restaurant.address.line2,
      `${restaurant.address.city}, ${restaurant.address.state} ${restaurant.address.postalCode}`,
    ]
      .filter(Boolean)
      .join('\n')
    rows.push({ key: 'address', icon: MapPin, label: 'Address', value })
  }
  if (contact.showHours) {
    rows.push({ key: 'hours', icon: Clock3, label: 'Hours', value: hoursSummary })
  }
  if (contact.showWebsite && restaurant.website) {
    rows.push({
      key: 'website',
      icon: Globe,
      label: 'Website',
      href: restaurant.website,
      value: restaurant.website.replace(/^https?:\/\//, ''),
    })
  }

  const socialLinks = [
    contact.showInstagram && social.instagram
      ? { key: 'instagram', label: 'Instagram', href: social.instagram }
      : null,
    contact.showFacebook && social.facebook
      ? { key: 'facebook', label: 'Facebook', href: social.facebook }
      : null,
    contact.showTwitter && social.twitter
      ? { key: 'twitter', label: 'X / Twitter', href: social.twitter }
      : null,
    contact.showTiktok && social.tiktok
      ? { key: 'tiktok', label: 'TikTok', href: social.tiktok }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; href: string }>

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
          title={contact.title || 'Contact'}
          subtitle={contact.intro}
          headerStyle={contact.headerStyle}
          heroImageUrl={contact.heroImageUrl}
          hero={contact.hero}
          storefrontWidth={restaurant.storefrontWidth}
        />

        <div className={cn(contentClass, 'flex-1 py-10 pb-28')}>
          {rows.length ? (
            <ul className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="border-t border-[color-mix(in_srgb,var(--sf-text)_12%,transparent)] pt-5"
                >
                  <div className="flex gap-3">
                    <row.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-[var(--sf-text)]/45">
                        {row.label}
                      </p>
                      {row.href ? (
                        <a
                          href={row.href}
                          className="mt-2 block whitespace-pre-line text-[17px] leading-relaxed text-[var(--sf-text)] hover:text-[var(--sf-primary)]"
                          target={row.href.startsWith('http') ? '_blank' : undefined}
                          rel={row.href.startsWith('http') ? 'noreferrer' : undefined}
                        >
                          {row.value}
                        </a>
                      ) : (
                        <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed text-[var(--sf-text)]">
                          {row.value}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {socialLinks.length ? (
            <div
              className={cn(
                'border-t border-[color-mix(in_srgb,var(--sf-text)_12%,transparent)] pt-8',
                rows.length ? 'mt-12' : '',
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-[var(--sf-text)]/45">
                Social
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {socialLinks.map((s) => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl bg-[var(--sf-surface)] px-5 py-2.5 text-base font-medium text-[var(--sf-text)] ring-1 ring-[color-mix(in_srgb,var(--sf-text)_12%,transparent)] transition-colors hover:bg-white"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {!rows.length && !socialLinks.length ? (
            <p className="text-[var(--sf-text)]/55">No contact details are published yet.</p>
          ) : null}
        </div>

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
