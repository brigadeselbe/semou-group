import { NextRequest, NextResponse } from 'next/server'
import { makeSessionToken, SESSION_COOKIE, COOKIE_OPTIONS } from '@/lib/adminSession'
import { createHmac, timingSafeEqual } from 'crypto'

const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 15 * 60 * 1000   // 15 minutes de blocage
const DELAY_MIN    = 500               // délai minimum par tentative (ms)
const DELAY_RANGE  = 1000             // délai aléatoire supplémentaire (ms)
const ATT_COOKIE   = 'sg_adm_att'

interface Att { n: number; until: number }

/* Cookie signé HMAC pour stocker les tentatives côté serveur */
function sign(data: Att): string {
  const body = Buffer.from(JSON.stringify(data)).toString('base64url')
  const sig  = createHmac('sha256', process.env.SESSION_SECRET!).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verify(raw: string): Att {
  try {
    const dot = raw.lastIndexOf('.')
    if (dot < 0) return { n: 0, until: 0 }
    const body = raw.slice(0, dot)
    const sig  = raw.slice(dot + 1)
    const expected = createHmac('sha256', process.env.SESSION_SECRET!).update(body).digest('base64url')
    const a = Buffer.from(sig,      'base64url')
    const b = Buffer.from(expected, 'base64url')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { n: 0, until: 0 }
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as Att
  } catch { return { n: 0, until: 0 } }
}

const ATT_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path:     '/',
  maxAge:   60 * 60,   // cookie d'tentatives valide 1h
}

export async function POST(req: NextRequest) {
  const secret   = process.env.SESSION_SECRET
  const expected = process.env.ADMIN_PASSWORD
  if (!secret || !expected) {
    return NextResponse.json({ error: 'Serveur mal configuré' }, { status: 500 })
  }

  /* ── 1. Vérifier le blocage (cookie signé) ── */
  const rawCookie = req.cookies.get(ATT_COOKIE)?.value ?? ''
  const att       = rawCookie ? verify(rawCookie) : { n: 0, until: 0 }

  if (att.until > Date.now()) {
    const mins = Math.ceil((att.until - Date.now()) / 60000)
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${mins} minute${mins > 1 ? 's' : ''}.` },
      { status: 429 },
    )
  }

  /* ── 2. Délai artificiel — ralentit toute automatisation ── */
  await new Promise(r => setTimeout(r, DELAY_MIN + Math.random() * DELAY_RANGE))

  /* ── 3. Lire le mot de passe ── */
  const { password = '' } = await req.json().catch(() => ({ password: '' }))

  /* ── 4. Comparaison en temps constant (anti-timing attack) ── */
  let ok = false
  try {
    const a = Buffer.from(String(password), 'utf8')
    const b = Buffer.from(expected,         'utf8')
    ok = a.length === b.length && timingSafeEqual(a, b)
  } catch { ok = false }

  /* ── 5. Échec ── */
  if (!ok) {
    const newN   = (att.n || 0) + 1
    const locked = newN >= MAX_ATTEMPTS
    const next: Att = locked
      ? { n: 0, until: Date.now() + LOCKOUT_MS }
      : { n: newN, until: 0 }

    const msg = locked
      ? 'Trop de tentatives. Accès bloqué 15 minutes.'
      : `Mot de passe incorrect (${newN}/${MAX_ATTEMPTS}).`

    const res = NextResponse.json({ error: msg }, { status: locked ? 429 : 401 })
    res.cookies.set(ATT_COOKIE, sign(next), ATT_OPTS)
    return res
  }

  /* ── 6. Succès — émettre session, effacer compteur ── */
  const token = makeSessionToken()
  const res   = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, COOKIE_OPTIONS)
  res.cookies.delete(ATT_COOKIE)
  return res
}
