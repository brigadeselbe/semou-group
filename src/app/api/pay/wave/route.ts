import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const WAVE_API_KEY  = process.env.WAVE_API_KEY ?? ''
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://semou-group.vercel.app'
const WAVE_ENDPOINT = 'https://api.wave.com/v1/checkout/sessions'

export async function POST(req: NextRequest) {
  const { type, id, telephone } = await req.json()

  if (!type || !id || !telephone) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // 1. Vérifier ownership + créer transaction via RPC
  const { data: init, error: initErr } = await supabase.rpc('paiement_initier', {
    p_type: type, p_id: id, p_telephone: telephone, p_moyen: 'WAVE',
  })
  if (initErr || !init) {
    return NextResponse.json({ error: initErr?.message ?? 'Erreur' }, { status: 400 })
  }

  const txId   = (init as { transaction_id: string }).transaction_id
  const montant = (init as { montant: number }).montant

  // 2. Créer session Wave Checkout
  const waveRes = await fetch(WAVE_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WAVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount:           String(montant),
      currency:         'XOF',
      client_reference: txId,
      success_url:      `${APP_URL}/suivi?paiement=succes&ref=${txId}`,
      error_url:        `${APP_URL}/suivi?paiement=echec&ref=${txId}`,
    }),
  })

  if (!waveRes.ok) {
    await supabase.rpc('paiement_annuler', { p_transaction_id: txId })
    const err = await waveRes.json().catch(() => ({}))
    return NextResponse.json({ error: err?.message ?? 'Erreur Wave' }, { status: 502 })
  }

  const session = await waveRes.json()
  return NextResponse.json({ checkout_url: session.wave_launch_url })
}
