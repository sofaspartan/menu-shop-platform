import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Armchair, UtensilsCrossed } from 'lucide-react'
import type { StoreKind } from '@/types'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'
import { cn } from '@/lib/utils'

export function NewRestaurantPage() {
  const user = useAuthStore((s) => s.user)
  const create = useRestaurantStore((s) => s.create)
  const navigate = useNavigate()
  const [storeKind, setStoreKind] = useState<StoreKind>('restaurant')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const isRetail = storeKind === 'retail'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await create(user.id, name, description, storeKind)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create store')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-3xl">Create a store</h1>
        <p className="mt-2 text-stone-500">
          Choose a restaurant or retail shop. Each store gets its own branding, catalogs, orders,
          QR codes, and analytics.
        </p>
      </div>
      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-2xl border border-stone-200 bg-white p-6"
      >
        <fieldset>
          <legend className="mb-3 text-sm font-medium text-stone-800">Store type</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStoreKind('restaurant')}
              className={cn(
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                storeKind === 'restaurant'
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-stone-200 hover:bg-stone-50',
              )}
            >
              <UtensilsCrossed className="mb-2 h-5 w-5 text-[var(--color-brand)]" />
              <div className="font-medium">Restaurant</div>
              <p className="mt-1 text-xs text-stone-500">
                Menus, modifiers, combos, and kitchen-style order flow.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setStoreKind('retail')}
              className={cn(
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                storeKind === 'retail'
                  ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]'
                  : 'border-stone-200 hover:bg-stone-50',
              )}
            >
              <Armchair className="mb-2 h-5 w-5 text-[var(--color-brand)]" />
              <div className="font-medium">Retail</div>
              <p className="mt-1 text-xs text-stone-500">
                Product catalogs for leather goods, furniture, and any shop.
              </p>
            </button>
          </div>
        </fieldset>

        <Field label={isRetail ? 'Store name' : 'Restaurant name'} htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Short description" htmlFor="description">
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isRetail
                ? 'A few words shoppers will see on your storefront'
                : 'A few words guests will see on your storefront'
            }
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button size="lg" disabled={saving || !name.trim()}>
          {saving ? 'Creating…' : isRetail ? 'Create store' : 'Create restaurant'}
        </Button>
      </form>
    </div>
  )
}
