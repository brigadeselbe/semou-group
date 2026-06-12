import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

// Vercel Cron — tourne tous les jours à 8h00 WAT
// Protégé par CRON_SECRET (Vercel l'envoie automatiquement)
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: rappels, error } = await supabase.rpc('get_rappels_to_send')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0; let failed = 0

  for (const r of rappels ?? []) {
    const dateStr = new Date(r.date_echeance).toLocaleDateString('fr-SN', {
      day: '2-digit', month: 'long',
    })

    let message: string
    switch (r.type_rappel) {
      case 'J7':     message = smsTemplates.rappelJ7(r.prenom, r.versement_num, r.montant_prevu, dateStr); break
      case 'J3':     message = smsTemplates.rappelJ3(r.prenom, r.versement_num, r.montant_prevu, dateStr); break
      case 'JOUR_J': message = smsTemplates.rappelJourJ(r.prenom, r.versement_num, r.montant_prevu); break
      case 'RETARD': message = smsTemplates.rappelRetard(r.prenom, r.versement_num, r.montant_prevu); break
      default:       continue
    }

    const ok = await sendSMS(r.telephone, message)
    ok ? sent++ : failed++
  }

  return NextResponse.json({ sent, failed, total: (rappels ?? []).length })
}
