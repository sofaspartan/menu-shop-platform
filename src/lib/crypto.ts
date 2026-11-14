/** Lightweight password hashing for the POC using Web Crypto (SHA-256 + salt).
 *  Production should swap AuthService to Netlify Identity, Clerk, Auth0, etc. */

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const usedSalt = salt ?? crypto.randomUUID().replace(/-/g, '')
  const data = new TextEncoder().encode(`${usedSalt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return `${usedSalt}$${toHex(digest)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const next = await hashPassword(password, salt)
  return next === stored
}

export function createSessionToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return toHex(bytes.buffer)
}
