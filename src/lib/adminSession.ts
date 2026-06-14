import { createHmac } from 'crypto'

const DURATION_MS = 8 * 60 * 60 * 1000 // 8 heures

export function makeSessionToken(): string {
  const secret = process.env.SESSION_SECRET!
  const expiry = String(Date.now() + DURATION_MS)
  const sig = createHmac('sha256', secret).update(expiry).digest('base64url')
  return `${expiry}.${sig}`
}

export function isValidSession(token: string): boolean {
  const secret = process.env.SESSION_SECRET
  if (!secret) return false
  const dot = token.lastIndexOf('.')
  if (dot < 0) return false
  const expiry = token.slice(0, dot)
  const sig    = token.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(expiry).digest('base64url')
  if (sig !== expected) return false
  const exp = parseInt(expiry, 10)
  return Number.isFinite(exp) && exp > Date.now()
}

export const SESSION_COOKIE = 'sg_admin'
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge:   8 * 60 * 60,
  path:     '/',
}
