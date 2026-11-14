import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { AuthShell } from '@/pages/auth/LoginPage'
import * as authService from '@/services/authService'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function requestReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const resetToken = await authService.requestPasswordReset(email)
      setToken(resetToken.includes('If that') ? '' : resetToken)
      setMessage(
        resetToken.includes('If that')
          ? resetToken
          : 'Reset token ready (POC — email delivery is simulated).',
      )
      if (!resetToken.includes('If that')) setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    }
  }

  async function completeReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await authService.resetPassword(token, password)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  return (
    <AuthShell title="Reset password" subtitle="We’ll help you get back into your account.">
      {step === 'request' ? (
        <form onSubmit={requestReset} className="space-y-4">
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {message ? <p className="text-sm text-stone-600">{message}</p> : null}
          <Button className="w-full" size="lg">
            Send reset link
          </Button>
        </form>
      ) : null}

      {step === 'reset' ? (
        <form onSubmit={completeReset} className="space-y-4">
          <p className="text-sm text-stone-600">{message}</p>
          <Field label="Reset token" htmlFor="token">
            <Input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
          </Field>
          <Field label="New password" htmlFor="password">
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
          <Button className="w-full" size="lg">
            Update password
          </Button>
        </form>
      ) : null}

      {step === 'done' ? (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">Password updated. You can sign in now.</p>
          <Link to="/login">
            <Button className="w-full" size="lg">
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : null}

      <p className="mt-4 text-sm">
        <Link className="text-[var(--color-brand)] hover:underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  )
}
