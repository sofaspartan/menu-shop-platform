import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PLATFORM_NAME } from '@/lib/platformBrand'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/authStore'
import { DEMO_CREDENTIALS } from '@/data/seed/demo'

export function LoginPage() {
  const signIn = useAuthStore((s) => s.signIn)
  const loading = useAuthStore((s) => s.loading)
  const navigate = useNavigate()
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to manage your restaurants.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button className="w-full" size="lg" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link className="text-[var(--color-brand)] hover:underline" to="/forgot-password">
          Forgot password?
        </Link>
        <Link className="text-stone-600 hover:underline" to="/signup">
          Create account
        </Link>
      </div>
    </AuthShell>
  )
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#e8efeb_0%,_#f4f1ec_50%)] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-8 shadow-sm animate-fade-up">
        <Link to="/" className="font-display text-2xl text-stone-900">
          {PLATFORM_NAME}
        </Link>
        <h1 className="mt-6 font-display text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-stone-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}
