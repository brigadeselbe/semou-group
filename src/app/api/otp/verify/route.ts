import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const ERROR_MESSAGES: Record<string, string> = {
  no_otp:       'Aucun code envoyé — recommencez.',
  expired:      'Code expiré — demandez un nouveau code.',
  max_attempts: 'Trop de tentatives — demandez un nouveau code.',
  wrong_code:   'Code incorrect.',
}

export async function POST(req: NextRequest) {
  const { telephone, code } = await req.json().catch(() => ({}))
  if (!telephone || !code) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

  /* 1. Vérifier le code OTP */
  const { data: result, error: rpcError } = await supabase.rpc('otp_verify', {
    p_telephone: telephone,
    p_code:      code,
  })
  if (rpcError) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  const res = result as { ok?: boolean; error?: string; attempts_left?: number }

  if (!res.ok) {
    const msg = ERROR_MESSAGES[res.error ?? ''] ?? 'Erreur inconnue.'
    const extra = res.attempts_left !== undefined ? ` (${res.attempts_left} essai${res.attempts_left > 1 ? 's' : ''} restant)` : ''
    return NextResponse.json({ error: msg + extra }, { status: 401 })
  }

  /* 2. Code valide — récupérer le dossier */
  const { data: dossier, error: dossierError } = await supabase.rpc('get_dossier_client', {
    p_telephone: telephone,
  })
  if (dossierError) return NextResponse.json({ error: 'Dossier introuvable.' }, { status: 404 })
  if (!dossier)     return NextResponse.json({ notfound: true }, { status: 200 })

  return NextResponse.json({ ok: true, data: dossier })
}
