import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Appelé par l'admin après validate/reject d'un client
// POST { client_id, statut, password }
export async function POST(req: NextRequest) {
  const { client_id, statut, password } = await req.json()

  if (!client_id || !statut || !password) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // Vérifier le mot de passe admin via RPC
  const { error: authErr } = await supabase.rpc('admin_update_client_statut', {
    p_client_id: client_id,
    p_statut:    statut,
    p_password:  password,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 })

  // Charger le client pour avoir téléphone + prénom
  const { data: client } = await supabase
    .from('cfa_clients').select('prenom, telephone').eq('id', client_id).single()
  if (!client) return NextResponse.json({ ok: true }) // statut mis à jour, SMS non bloquant

  // Envoyer SMS selon statut
  let message: string | null = null
  if (statut === 'VALIDE')  message = smsTemplates.dossierValide(client.prenom)
  if (statut === 'REJETE')  message = smsTemplates.dossierRejete(client.prenom)

  if (message) await sendSMS(client.telephone, message)

  return NextResponse.json({ ok: true })
}
