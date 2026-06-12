import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function verifyWaveSignature(body: string, header: string | null): boolean {
  const secret = process.env.WAVE_WEBHOOK_SECRET
  if (!secret || !header) return false
  const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
  return expected === header
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig     = req.headers.get('x-wave-signature')

  if (!verifyWaveSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  const event = JSON.parse(rawBody)

  // Wave envoie { type: "checkout.session.completed", data: { client_reference, status, id } }
  if (event.type === 'checkout.session.completed' && event.data?.status === 'succeeded') {
    const txId = event.data.client_reference as string
    const ref  = event.data.id as string

    await supabase.rpc('paiement_confirmer', {
      p_transaction_id: txId,
      p_reference: ref,
    })
  }

  return NextResponse.json({ received: true })
}
