import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isValidSession, SESSION_COOKIE } from '@/lib/adminSession'

const ALLOWED_RPCS = new Set([
  'admin_get_stats',
  'admin_get_livraison_stats',
  'admin_get_all_clients',
  'admin_get_commandes_full',
  'admin_update_client_statut',
  'admin_marquer_versement_paye',
  'admin_update_livraison',
  'admin_creer_commande',
  'admin_upsert_produit',
  'admin_delete_produit',
  'admin_delete_media',
])

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: 'Session expirée — reconnectez-vous' }, { status: 401 })
  }

  const { rpc, params } = await req.json().catch(() => ({}))
  if (!rpc || !ALLOWED_RPCS.has(rpc)) {
    return NextResponse.json({ error: 'Opération non autorisée' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { data, error } = await supabase.rpc(rpc, {
    ...(params ?? {}),
    p_password: process.env.ADMIN_PASSWORD!,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
