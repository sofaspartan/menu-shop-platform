import type { AuthSession, User } from '@/types'
import { getDb, saveDb } from '@/data/db'
import { createSessionToken, hashPassword, verifyPassword } from '@/lib/crypto'
import { createId, nowIso } from '@/lib/utils'

const SESSION_KEY = 'menushop:session'

export async function signUp(input: {
  name: string
  email: string
  password: string
}): Promise<{ user: User; token: string }> {
  const email = input.email.trim().toLowerCase()
  if (!email || !input.password || input.password.length < 6) {
    throw new Error('Enter a valid email and a password with at least 6 characters.')
  }

  const db = await getDb()
  if (db.users.some((u) => u.email === email)) {
    throw new Error('An account with this email already exists.')
  }

  const ts = nowIso()
  const user: User = {
    id: createId('user'),
    email,
    name: input.name.trim() || email.split('@')[0],
    passwordHash: await hashPassword(input.password),
    createdAt: ts,
    updatedAt: ts,
  }

  const session = makeSession(user.id)
  await saveDb((d) => {
    d.users.push(user)
    d.sessions.push(session)
  })
  persistSession(session.token)
  return { user: publicUser(user), token: session.token }
}

export async function signIn(email: string, password: string): Promise<{ user: User; token: string }> {
  const db = await getDb()
  const user = db.users.find((u) => u.email === email.trim().toLowerCase())
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new Error('Invalid email or password.')
  }
  const session = makeSession(user.id)
  await saveDb((d) => {
    d.sessions = d.sessions.filter((s) => s.userId !== user.id)
    d.sessions.push(session)
  })
  persistSession(session.token)
  return { user: publicUser(user), token: session.token }
}

export async function signOut(): Promise<void> {
  const token = localStorage.getItem(SESSION_KEY)
  if (token) {
    await saveDb((d) => {
      d.sessions = d.sessions.filter((s) => s.token !== token)
    })
  }
  localStorage.removeItem(SESSION_KEY)
}

export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem(SESSION_KEY)
  if (!token) return null
  const db = await getDb()
  const session = db.sessions.find((s) => s.token === token)
  if (!session || new Date(session.expiresAt) < new Date()) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  const user = db.users.find((u) => u.id === session.userId)
  return user ? publicUser(user) : null
}

export async function requestPasswordReset(email: string): Promise<string> {
  const db = await getDb()
  const user = db.users.find((u) => u.email === email.trim().toLowerCase())
  if (!user) {
    // Don't reveal whether the email exists
    return 'If that email exists, a reset link has been prepared.'
  }
  const token = createSessionToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString()
  await saveDb((d) => {
    d.passwordResetTokens = d.passwordResetTokens.filter((t) => t.userId !== user.id)
    d.passwordResetTokens.push({ token, userId: user.id, expiresAt })
  })
  // POC: return token so the UI can complete reset without email delivery
  return token
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.')
  const db = await getDb()
  const entry = db.passwordResetTokens.find((t) => t.token === token)
  if (!entry || new Date(entry.expiresAt) < new Date()) {
    throw new Error('This reset link is invalid or expired.')
  }
  const passwordHash = await hashPassword(newPassword)
  await saveDb((d) => {
    const user = d.users.find((u) => u.id === entry.userId)
    if (user) {
      user.passwordHash = passwordHash
      user.updatedAt = nowIso()
    }
    d.passwordResetTokens = d.passwordResetTokens.filter((t) => t.token !== token)
  })
}

export async function updateProfile(userId: string, patch: { name?: string; phone?: string }): Promise<User> {
  let updated: User | null = null
  await saveDb((d) => {
    const user = d.users.find((u) => u.id === userId)
    if (!user) throw new Error('User not found.')
    if (patch.name !== undefined) user.name = patch.name
    if (patch.phone !== undefined) user.phone = patch.phone
    user.updatedAt = nowIso()
    updated = publicUser(user)
  })
  return updated!
}

function makeSession(userId: string): AuthSession {
  const createdAt = nowIso()
  return {
    userId,
    token: createSessionToken(),
    createdAt,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
  }
}

function persistSession(token: string) {
  localStorage.setItem(SESSION_KEY, token)
}

function publicUser(user: User): User {
  return { ...user, passwordHash: '' }
}
