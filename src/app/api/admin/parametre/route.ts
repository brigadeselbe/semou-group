import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isValidSession, SESSION_COOKIE } from '@/lib/adminSession'

// Contenu du site (bannière, vidéo…) : lecture publique, modification réservée à l'admin
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: 'Session expirée — reconnectez-vous' }, { status: 401 })
  }

  const { cle, valeur } = await req.json().catch(() => ({}))
  if (typeof cle !== 'string' || !cle || typeof valeur !== 'string') {
    return NextResponse.json({ error: 'Paramètre invalide' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('cfa_parametres')
    .update({ valeur, updated_at: new Date().toISOString() })
    .eq('cle', cle)
    .select('cle')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: 'Paramètre introuvable' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
