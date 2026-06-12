import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  const body   = await req.json()
  const txId   = body.order_id  as string | undefined
  const status = (body.txnstatus as string | undefined)?.toUpperCase()
  const ref    = body.txnid     as string | undefined

  if (!txId) return NextResponse.json({ received: true })

  if (status === 'SUCCESS') {
    await supabase.rpc('paiement_confirmer', { p_transaction_id: txId, p_reference: ref ?? null })
    await sendSmsConfirmation(txId)
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await supabase.rpc('paiement_annuler', { p_transaction_id: txId })
  }

  return NextResponse.json({ received: true })
}

async function sendSmsConfirmation(txId: string) {
  const { data: tx } = await supabase
    .from('cfa_transactions')
    .select('montant, client_id, commande_id')
    .eq('id', txId).single()
  if (!tx) return

  const [{ data: client }, { data: commande }] = await Promise.all([
    supabase.from('cfa_clients').select('prenom, telephone').eq('id', tx.client_id).single(),
    supabase.from('cfa_commandes').select('reste_a_payer').eq('id', tx.commande_id).single(),
  ])
  if (!client || !commande) return

  await sendSMS(
    client.telephone,
    smsTemplates.paiementConfirme(client.prenom, tx.montant, commande.reste_a_payer),
  )
}
