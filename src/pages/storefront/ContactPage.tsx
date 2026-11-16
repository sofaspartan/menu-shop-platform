import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock3, Globe, Mail, MapPin, Phone } from 'lucide-react'
import { StorefrontShell } from '@/components/storefront/StorefrontShell'
import { StorefrontNav } from '@/components/storefront/StorefrontNav'
import { Button } from '@/components/ui/Button'
import { useDb } from '@/hooks/useDb'
import { formatHoursSummary } from '@/lib/scheduling'
import { formatPhone } from '@/lib/utils'
import { DEFAULT_BRANDING } from '@/types'

export function ContactPage() {
  const { slug } = useParams<{ slug: string }>()
  const { db, loading } = useDb()

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

  const contact = restaurant.pages.contact
  const phone = contact.phoneOverride?.trim() || restaurant.phone
  const email = contact.emailOverride?.trim() || restaurant.email
  const hoursSummary = formatHoursSummary(restaurant, new Date())
  const social = restaurant.social

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
      <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-[var(--sf-bg)]/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6">
          <StorefrontNav restaurant={restaurant} />
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="font-display text-4xl text-[var(--sf-text)] sm:text-5xl">
          {contact.title || 'Contact'}
        </h1>
        {contact.intro ? (
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-[var(--sf-text)]/70">
            {contact.intro}
          </p>
        ) : null}

        <ul className="mt-10 divide-y divide-stone-200/80 border-y border-stone-200/80">
          {rows.map((row) => (
            <li key={row.key} className="flex gap-4 py-5">
              <row.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]" />
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-[var(--sf-text)]/45">
                  {row.label}
                </p>
                {row.href ? (
                  <a
                    href={row.href}
                    className="mt-1 block whitespace-pre-line text-[17px] text-[var(--sf-text)] hover:text-[var(--sf-primary)]"
                    target={row.href.startsWith('http') ? '_blank' : undefined}
                    rel={row.href.startsWith('http') ? 'noreferrer' : undefined}
                  >
                    {row.value}
                  </a>
                ) : (
                  <p className="mt-1 whitespace-pre-line text-[17px] text-[var(--sf-text)]">
                    {row.value}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {socialLinks.length ? (
          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--sf-text)]/45">
              Social
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-[var(--sf-surface)] px-4 py-2 text-sm font-medium text-[var(--sf-text)] ring-1 ring-stone-200/80 hover:bg-white"
                >
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {!rows.length && !socialLinks.length ? (
          <p className="mt-8 text-[var(--sf-text)]/55">No contact details are published yet.</p>
        ) : null}

        <Link
          to={`/r/${restaurant.slug}`}
          className="mt-10 inline-flex items-center gap-2 text-sm text-[var(--sf-text)]/70 hover:text-[var(--sf-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to shop
        </Link>
      </div>
    </StorefrontShell>
  )
}
