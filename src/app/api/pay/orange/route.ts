import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const APP_URL           = process.env.NEXT_PUBLIC_APP_URL ?? 'https://semou-group.vercel.app'
const ORANGE_TOKEN_URL  = 'https://api.orange.com/oauth/v3/token'
const ORANGE_PAY_URL    = 'https://api.orange.com/orange-money-webpay/SN/v1/webpayment'

async function getOrangeToken(): Promise<string> {
  const creds = Buffer.from(
    `${process.env.ORANGE_CLIENT_ID}:${process.env.ORANGE_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(ORANGE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) throw new Error('Impossible d\'obtenir le token Orange')
  const data = await res.json()
  return data.access_token as string
}

export async function POST(req: NextRequest) {
  const { type, id, telephone } = await req.json()

  if (!type || !id || !telephone) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // 1. Vérifier ownership + créer transaction
  const { data: init, error: initErr } = await supabase.rpc('paiement_initier', {
    p_type: type, p_id: id, p_telephone: telephone, p_moyen: 'ORANGE_MONEY',
  })
  if (initErr || !init) {
    return NextResponse.json({ error: initErr?.message ?? 'Erreur' }, { status: 400 })
  }

  const txId    = (init as { transaction_id: string }).transaction_id
  const montant = (init as { montant: number }).montant

  try {
    // 2. Obtenir token Orange
    const token = await getOrangeToken()

    // 3. Créer paiement Orange Money
    const payRes = await fetch(ORANGE_PAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_key: process.env.ORANGE_MERCHANT_KEY,
        currency:     'OUV',
        order_id:     txId,
        amount:       String(montant),
        return_url:   `${APP_URL}/suivi?paiement=succes&ref=${txId}`,
        cancel_url:   `${APP_URL}/suivi?paiement=annule&ref=${txId}`,
        notif_url:    `${APP_URL}/api/pay/orange/notify`,
      }),
    })

    if (!payRes.ok) {
      await supabase.rpc('paiement_annuler', { p_transaction_id: txId })
      return NextResponse.json({ error: 'Erreur Orange Money' }, { status: 502 })
    }

    const pay = await payRes.json()
    return NextResponse.json({ checkout_url: pay.payment_url })

  } catch (err: unknown) {
    await supabase.rpc('paiement_annuler', { p_transaction_id: txId })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
