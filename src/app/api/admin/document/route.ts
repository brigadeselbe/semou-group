import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isValidSession, SESSION_COOKIE } from '@/lib/adminSession'

// Le bucket "documents" est privé : le lien signé est créé côté serveur, après contrôle de la session
export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token || !isValidSession(token)) {
    return NextResponse.json({ error: 'Session expirée — reconnectez-vous' }, { status: 401 })
  }

  const { path } = await req.json().catch(() => ({}))
  if (typeof path !== 'string' || !/^(cni|bulletins)\//.test(path)) {
    return NextResponse.json({ error: 'Document invalide' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600)
  if (error || !data) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  return NextResponse.json({ url: data.signedUrl })
}
