import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  const { produit_id, telephone } = await req.json().catch(() => ({}))
  if (!produit_id || !telephone) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  const { data, error } = await supabase.rpc('waitlist_rejoindre', { p_produit_id: produit_id, p_telephone: telephone })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, result: data })
}
