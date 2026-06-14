import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long' })
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  let smsSent = 0; let errors = 0

  const { data: rappels, error: rErr } = await supabase.rpc('get_rappels_sms')
  if (rErr) console.error('[CRON] get_rappels_sms:', rErr.message)

  for (const r of rappels ?? []) {
    const row = r as {
      versement_id: string; numero_versement: number; montant_prevu: number
      date_echeance: string; type_rappel: string; telephone: string; prenom: string
    }
    let message: string | null = null
    const date = formatDate(row.date_echeance)
    if (row.type_rappel === 'J7')     message = smsTemplates.rappelJ7(row.prenom,    row.numero_versement, row.montant_prevu, date)
    if (row.type_rappel === 'J3')     message = smsTemplates.rappelJ3(row.prenom,    row.numero_versement, row.montant_prevu, date)
    if (row.type_rappel === 'JOUR_J') message = smsTemplates.rappelJourJ(row.prenom, row.numero_versement, row.montant_prevu)
    if (row.type_rappel === 'RETARD') message = smsTemplates.rappelRetard(row.prenom, row.numero_versement, row.montant_prevu)

    if (message) {
      const ok = await sendSMS(row.telephone, message)
      if (ok) {
        await supabase.rpc('marquer_rappel_envoye', { p_versement_id: row.versement_id, p_type: row.type_rappel })
        smsSent++
      } else { errors++ }
    }
  }

  /* Alerte stock bas → SMS admin */
  const adminPhone = process.env.ADMIN_PHONE
  if (adminPhone) {
    const { data: stockBas } = await supabase.rpc('get_stock_bas')
    for (const p of stockBas ?? []) {
      const prod = p as { nom: string; stock: number }
      const msg = prod.stock === 0
        ? `SEMOU ADMIN — Stock épuisé : "${prod.nom}". Pensez à réapprovisionner.`
        : `SEMOU ADMIN — Stock bas : "${prod.nom}" (${prod.stock} restant).`
      const ok = await sendSMS(adminPhone, msg)
      if (ok) smsSent++
    }
  }

  console.log(`[CRON rappels] SMS: ${smsSent}, erreurs: ${errors}`)
  return NextResponse.json({ ok: true, smsSent, errors })
}
