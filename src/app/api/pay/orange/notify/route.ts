import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  const body = await req.json()

  // Orange Money envoie : { status, txnid, txnstatus, pay_token, ... }
  // order_id = notre transaction_id
  const txId   = body.order_id as string | undefined
  const status = (body.txnstatus as string | undefined)?.toUpperCase()
  const ref    = body.txnid as string | undefined

  if (!txId) return NextResponse.json({ received: true })

  if (status === 'SUCCESS') {
    await supabase.rpc('paiement_confirmer', {
      p_transaction_id: txId,
      p_reference: ref ?? null,
    })
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await supabase.rpc('paiement_annuler', { p_transaction_id: txId })
  }

  return NextResponse.json({ received: true })
}
