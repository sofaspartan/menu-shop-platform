import { useEffect, useState } from 'react'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { useAuthStore } from '@/stores/authStore'
import * as restaurantService from '@/services/restaurantService'
import * as authService from '@/services/authService'
import { resetDemoData } from '@/data/db'
import { DEMO_CREDENTIALS } from '@/data/seed/demo'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import type { Restaurant } from '@/types'

export function SettingsPage() {
  const current = useRestaurantStore((s) => s.current())
  const loadRestaurants = useRestaurantStore((s) => s.load)
  const user = useAuthStore((s) => s.user)
  const refreshUser = useAuthStore((s) => s.refresh)

  const [profile, setProfile] = useState({
    name: '',
    description: '',
    phone: '',
    email: '',
    website: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'US',
    instagram: '',
    facebook: '',
    twitter: '',
    tiktok: '',
  })
  const [accountName, setAccountName] = useState('')
  const [accountPhone, setAccountPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!current) return
    setProfile({
      name: current.name,
      description: current.description,
      phone: current.phone,
      email: current.email,
      website: current.website || '',
      line1: current.address.line1,
      line2: current.address.line2 || '',
      city: current.address.city,
      state: current.address.state,
      postalCode: current.address.postalCode,
      country: current.address.country,
      instagram: current.social.instagram || '',
      facebook: current.social.facebook || '',
      twitter: current.social.twitter || '',
      tiktok: current.social.tiktok || '',
    })
  }, [current])

  useEffect(() => {
    if (!user) return
    setAccountName(user.name)
    setAccountPhone(user.phone || '')
  }, [user])

  if (!current || !user) {
    return <p className="text-sm text-stone-500">Select a restaurant to edit settings.</p>
  }

  async function saveRestaurant() {
    if (!user || !current) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const patch: Parameters<typeof restaurantService.updateRestaurant>[2] = {
        name: profile.name.trim(),
        description: profile.description.trim(),
        phone: profile.phone.trim(),
        email: profile.email.trim(),
        website: profile.website.trim() || undefined,
        address: {
          line1: profile.line1.trim(),
          line2: profile.line2.trim() || undefined,
          city: profile.city.trim(),
          state: profile.state.trim(),
          postalCode: profile.postalCode.trim(),
          country: profile.country.trim() || 'US',
        },
        social: {
          instagram: profile.instagram.trim() || undefined,
          facebook: profile.facebook.trim() || undefined,
          twitter: profile.twitter.trim() || undefined,
          tiktok: profile.tiktok.trim() || undefined,
        },
      }
      await restaurantService.updateRestaurant(user.id, current.id, patch)
      await loadRestaurants(user.id)
      setMessage('Restaurant profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save restaurant')
    } finally {
      setBusy(false)
    }
  }

  async function saveAccount() {
    if (!user) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await authService.updateProfile(user.id, {
        name: accountName.trim(),
        phone: accountPhone.trim() || undefined,
      })
      await refreshUser()
      setMessage('Account profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save account')
    } finally {
      setBusy(false)
    }
  }

  async function onResetDemo() {
    if (
      !window.confirm(
        'Reset all local demo data? This replaces the current database with the seeded demo.',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await resetDemoData()
      window.location.reload()
    } catch (err) {
      setBusy(false)
      setError(err instanceof Error ? err.message : 'Could not reset demo data')
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-1 text-stone-500">
          Store profile, your account, and demo data tools.
        </p>
      </div>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Store profile</h2>
        <p className="mt-1 text-sm capitalize text-stone-500">
          Type: {current?.storeKind ?? 'restaurant'}
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="rest-name">
            <Input
              id="rest-name"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
          </Field>
          <Field label="Phone" htmlFor="rest-phone">
            <Input
              id="rest-phone"
              value={profile.phone}
              onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description" htmlFor="rest-desc">
              <Textarea
                id="rest-desc"
                value={profile.description}
                onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Email" htmlFor="rest-email">
            <Input
              id="rest-email"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            />
          </Field>
          <Field label="Website" htmlFor="rest-web">
            <Input
              id="rest-web"
              value={profile.website}
              onChange={(e) => setProfile((p) => ({ ...p, website: e.target.value }))}
            />
          </Field>
          <Field label="Address line 1" htmlFor="addr1">
            <Input
              id="addr1"
              value={profile.line1}
              onChange={(e) => setProfile((p) => ({ ...p, line1: e.target.value }))}
            />
          </Field>
          <Field label="Address line 2" htmlFor="addr2">
            <Input
              id="addr2"
              value={profile.line2}
              onChange={(e) => setProfile((p) => ({ ...p, line2: e.target.value }))}
            />
          </Field>
          <Field label="City" htmlFor="city">
            <Input
              id="city"
              value={profile.city}
              onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
            />
          </Field>
          <Field label="State" htmlFor="state">
            <Input
              id="state"
              value={profile.state}
              onChange={(e) => setProfile((p) => ({ ...p, state: e.target.value }))}
            />
          </Field>
          <Field label="Postal code" htmlFor="postal">
            <Input
              id="postal"
              value={profile.postalCode}
              onChange={(e) => setProfile((p) => ({ ...p, postalCode: e.target.value }))}
            />
          </Field>
          <Field label="Country" htmlFor="country">
            <Input
              id="country"
              value={profile.country}
              onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
            />
          </Field>
          <Field label="Instagram" htmlFor="ig">
            <Input
              id="ig"
              value={profile.instagram}
              onChange={(e) => setProfile((p) => ({ ...p, instagram: e.target.value }))}
            />
          </Field>
          <Field label="Facebook" htmlFor="fb">
            <Input
              id="fb"
              value={profile.facebook}
              onChange={(e) => setProfile((p) => ({ ...p, facebook: e.target.value }))}
            />
          </Field>
          <Field label="Twitter / X" htmlFor="tw">
            <Input
              id="tw"
              value={profile.twitter}
              onChange={(e) => setProfile((p) => ({ ...p, twitter: e.target.value }))}
            />
          </Field>
          <Field label="TikTok" htmlFor="tt">
            <Input
              id="tt"
              value={profile.tiktok}
              onChange={(e) => setProfile((p) => ({ ...p, tiktok: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-5">
          <Button disabled={busy} onClick={() => void saveRestaurant()}>
            Save restaurant
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Account</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="user-name">
            <Input
              id="user-name"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor="user-phone">
            <Input
              id="user-phone"
              value={accountPhone}
              onChange={(e) => setAccountPhone(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <Input value={user.email} disabled />
          </Field>
        </div>
        <div className="mt-5">
          <Button disabled={busy} onClick={() => void saveAccount()}>
            Save account
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 className="font-display text-xl">Demo data</h2>
        <p className="mt-2 text-sm text-stone-600">
          Demo login reminder:{' '}
          <span className="font-medium">
            {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
          </span>
        </p>
        <p className="mt-2 text-sm text-stone-500">
          Resetting restores the seeded restaurant, menus, orders, and analytics in local storage.
        </p>
        <Button className="mt-4" variant="danger" disabled={busy} onClick={() => void onResetDemo()}>
          Reset demo data
        </Button>
      </section>

      <p className="text-xs text-stone-400">
        Slug: /r/{(current as Restaurant).slug} · Restaurant ID: {current.id}
      </p>
    </div>
  )
}
