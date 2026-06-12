import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'

// POST { telephone, prenom, ref }  — appelé après création du client
export async function POST(req: NextRequest) {
  const { telephone, prenom, ref } = await req.json()
  if (!telephone || !prenom || !ref) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }
  await sendSMS(telephone, smsTemplates.inscriptionConfirmee(prenom, ref))
  return NextResponse.json({ ok: true })
}
