import { NextRequest, NextResponse } from 'next/server'
import { makeSessionToken, SESSION_COOKIE, COOKIE_OPTIONS } from '@/lib/adminSession'

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))

  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json({ error: 'Serveur mal configuré' }, { status: 500 })
  }
  if (!password || password !== expected) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const token = makeSessionToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS)
  return res
}
