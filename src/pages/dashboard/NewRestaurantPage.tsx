import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { useRestaurantStore } from '@/stores/restaurantStore'

export function NewRestaurantPage() {
  const user = useAuthStore((s) => s.user)
  const create = useRestaurantStore((s) => s.create)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      const restaurant = await create(user.id, name, description)
      navigate('/dashboard')
      void restaurant
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create restaurant')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl animate-fade-up">
      <h1 className="font-display text-3xl">Create a restaurant</h1>
      <p className="mt-2 text-stone-500">
        Each restaurant gets its own branding, menus, orders, QR codes, and analytics.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
        <Field label="Restaurant name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Short description" htmlFor="description">
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A few words guests will see on your storefront"
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button size="lg" disabled={saving || !name.trim()}>
          {saving ? 'Creating…' : 'Create restaurant'}
        </Button>
      </form>
    </div>
  )
}
