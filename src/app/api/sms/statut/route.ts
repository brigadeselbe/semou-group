import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'
import { isValidSession, SESSION_COOKIE } from '@/lib/adminSession'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { client_id, statut } = await req.json()
  if (!client_id || !statut) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const { data: rows } = await supabase.rpc('get_client_contact', { p_client_id: client_id })
  const client = rows?.[0]
  if (!client) return NextResponse.json({ ok: true })

  let message: string | null = null
  if (statut === 'VALIDE') message = smsTemplates.dossierValide(client.prenom)
  if (statut === 'REJETE') message = smsTemplates.dossierRejete(client.prenom)

  if (message) await sendSMS(client.telephone, message)

  return NextResponse.json({ ok: true })
}
