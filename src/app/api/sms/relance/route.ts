import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'
import { isValidSession, SESSION_COOKIE } from '@/lib/adminSession'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://semou-group.vercel.app'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { commande_id, client_id, telephone, prenom, nb_retard, montant_total } = await req.json()
  if (!commande_id || !client_id || !telephone || !prenom) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const message = nb_retard > 1
    ? smsTemplates.relanceMultiple(prenom, nb_retard, montant_total, APP_URL)
    : smsTemplates.rappelRetard(prenom, 1, montant_total)

  const smsSent = await sendSMS(telephone, message)

  await supabase.rpc('admin_log_relance_sms', {
    p_password:    process.env.ADMIN_PASSWORD!,
    p_client_id:   client_id,
    p_telephone:   telephone,
    p_message:     message,
    p_commande_id: commande_id,
  })

  return NextResponse.json({ ok: true, sms_sent: smsSent, message })
}
