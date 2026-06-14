import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST(req: NextRequest) {
  const { telephone } = await req.json().catch(() => ({}))
  if (!telephone) return NextResponse.json({ error: 'Numéro manquant' }, { status: 400 })

  const { data: code, error } = await supabase.rpc('otp_create', { p_telephone: telephone })
  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  if (!code) {
    return NextResponse.json({ error: 'Veuillez patienter 60 secondes avant de renvoyer un code.' }, { status: 429 })
  }

  await sendSMS(telephone, smsTemplates.otpCode(code as string))

  /* En dev : retourner le code pour tester sans SMS réel */
  const devCode = process.env.NODE_ENV !== 'production' ? { debug_code: code } : {}
  return NextResponse.json({ ok: true, ...devCode })
}
