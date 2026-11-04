import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { sendSMS, smsTemplates } from '@/lib/sms'

// Clé service_role : paiement_confirmer n'est plus accessible avec la clé publique.
// Client créé à la requête : la clé n'existe pas au moment du build.
const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TOLERANCE_S = 5 * 60

/* En-tête Wave-Signature : "t=<timestamp>,v1=<signature>[,v1=<signature>]"
   signature = HMAC-SHA256 (hex) de timestamp + corps brut, clé = secret de signature du webhook */
function verifyWaveSignature(body: string, header: string | null): boolean {
  const secret = process.env.WAVE_WEBHOOK_SECRET
  if (!secret || !header) return false

  const parts      = header.split(',').map(p => p.trim())
  const timestamp  = parts.find(p => p.startsWith('t='))?.slice(2) ?? ''
  const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3))
  const ts         = Number(timestamp)
  if (!timestamp || !Number.isFinite(ts) || signatures.length === 0) return false
  if (Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) return false

  const expected = Buffer.from(createHmac('sha256', secret).update(timestamp + body).digest('hex'))
  return signatures.some(sig => {
    const given = Buffer.from(sig)
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}

type WaveSession = { id: string; client_reference: string; amount: string; currency: string; payment_status: string }

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig     = req.headers.get('wave-signature')

  if (!verifyWaveSignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as { id: string; type: string; data?: WaveSession }

  if (event.type === 'checkout.session.completed' && event.data?.payment_status === 'succeeded') {
    const session  = event.data
    const txId     = session.client_reference
    const supabase = db()

    // Le montant encaissé doit correspondre à la transaction
    const { data: tx, error: txErr } = await supabase
      .from('cfa_transactions').select('montant, statut').eq('id', txId).single()
    if (txErr || !tx) {
      console.error(`[WAVE] transaction ${txId} illisible :`, txErr?.message)
      return NextResponse.json({ error: 'Transaction illisible' }, { status: 500 }) // Wave réessaiera
    }
    // Wave peut renvoyer le même événement : déjà confirmée → pas de second SMS
    if (tx.statut === 'SUCCES') return NextResponse.json({ received: true })

    if (session.currency !== 'XOF' || Number(session.amount) !== Math.round(tx.montant)) {
      console.error(`[WAVE] montant incohérent pour ${txId} : ${session.amount} ${session.currency}, attendu ${tx.montant}`)
      return NextResponse.json({ received: true })
    }

    const { error: confErr } = await supabase.rpc('paiement_confirmer', { p_transaction_id: txId, p_reference: session.id })
    if (confErr) {
      console.error(`[WAVE] paiement_confirmer ${txId} :`, confErr.message)
      return NextResponse.json({ error: 'Confirmation échouée' }, { status: 500 }) // Wave réessaiera
    }
    await sendSmsConfirmation(supabase, txId)
  }

  if (event.type === 'checkout.session.payment_failed') {
    // La session reste ouverte : le client peut réessayer, elle expire seule après 30 min
    console.log(`[WAVE] échec de paiement pour ${event.data?.client_reference}`)
  }

  return NextResponse.json({ received: true })
}

async function sendSmsConfirmation(supabase: ReturnType<typeof db>, txId: string) {
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
