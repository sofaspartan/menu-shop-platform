import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { AuthShell } from '@/pages/auth/LoginPage'

export function SignupPage() {
  const signUp = useAuthStore((s) => s.signUp)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signUp(name, email, password)
      navigate('/dashboard/restaurants/new')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account')
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Manage restaurants and retail stores from one place.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" htmlFor="name">
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 6 characters">
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button className="w-full" size="lg" disabled={loading}>
          {loading ? 'Creating…' : 'Create account'}
        </Button>
      </form>
      <p className="mt-4 text-sm text-stone-600">
        Already have an account?{' '}
        <Link className="text-[var(--color-brand)] hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
