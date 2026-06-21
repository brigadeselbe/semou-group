/* ── Client SMS Africa's Talking ────────────────────────────────────────── */

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('221')) return `+${digits}`
  if (digits.startsWith('+221')) return digits
  return `+221${digits.startsWith('0') ? digits.slice(1) : digits}`
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  const apiKey   = process.env.SMS_API_KEY
  const username = process.env.SMS_USERNAME ?? 'sandbox'
  const sender   = process.env.SMS_SENDER_ID ?? 'SEMOUGROUP'

  if (!apiKey) {
    console.warn('[SMS] SMS_API_KEY non configuré — SMS ignoré')
    return false
  }

  try {
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        username,
        to:      normalizePhone(to),
        from:    sender,
        message,
      }).toString(),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[SMS] Erreur Africa\'s Talking:', err)
      return false
    }
    return true
  } catch (e) {
    console.error('[SMS] Exception:', e)
    return false
  }
}

/* ── Templates ────────────────────────────────────────────────────────────── */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://semou-group.vercel.app'

export const smsTemplates = {
  inscriptionConfirmee: (prenom: string, ref: string) =>
    `Bonjour ${prenom}, votre dossier ${ref} a bien été enregistré. Validation sous 24 à 48h. Suivez votre dossier sur ${APP_URL}/suivi. SEMOU GROUP × CFA CUSEMS Authentique`,

  dossierValide: (prenom: string) =>
    `Bonjour ${prenom}, BONNE NOUVELLE ! Votre dossier est validé. Connectez-vous sur ${APP_URL}/suivi pour commander et payer votre apport. SEMOU GROUP`,

  dossierRejete: (prenom: string) =>
    `Bonjour ${prenom}, votre dossier n'a pas pu être validé. Contactez-nous pour plus d'informations. SEMOU GROUP × CFA CUSEMS Authentique`,

  rappelJ7: (prenom: string, n: number, montant: number, date: string) =>
    `Bonjour ${prenom}, rappel : votre versement #${n} de ${montant.toLocaleString('fr-SN')} F CFA est dû dans 7 jours (${date}). Payez sur ${APP_URL}/suivi. SEMOU GROUP`,

  rappelJ3: (prenom: string, n: number, montant: number, date: string) =>
    `Bonjour ${prenom}, rappel : votre versement #${n} de ${montant.toLocaleString('fr-SN')} F CFA est dû dans 3 jours (${date}). Payez vite sur ${APP_URL}/suivi. SEMOU GROUP`,

  rappelJourJ: (prenom: string, n: number, montant: number) =>
    `Bonjour ${prenom}, AUJOURD'HUI est la date de votre versement #${n} de ${montant.toLocaleString('fr-SN')} F CFA. Payez maintenant sur ${APP_URL}/suivi. SEMOU GROUP`,

  rappelRetard: (prenom: string, n: number, montant: number) =>
    `Bonjour ${prenom}, votre versement #${n} de ${montant.toLocaleString('fr-SN')} F CFA est EN RETARD. Régularisez sur ${APP_URL}/suivi. SEMOU GROUP`,

  otpCode: (code: string) =>
    `Votre code de verification SEMOU GROUP : ${code}. Valable 10 minutes. Ne le partagez pas.`,

  relanceMultiple: (prenom: string, nbRetard: number, montantTotal: number, appUrl: string) =>
    `Bonjour ${prenom}, vous avez ${nbRetard} versement${nbRetard > 1 ? 's' : ''} EN RETARD pour un total de ${montantTotal.toLocaleString('fr-SN')} F CFA. Régularisez sur ${appUrl}/suivi. SEMOU GROUP × CFA CUSEMS`,

  paiementConfirme: (prenom: string, montant: number, reste: number) =>
    reste > 0
      ? `Bonjour ${prenom}, paiement de ${montant.toLocaleString('fr-SN')} F confirmé ! Reste dû : ${reste.toLocaleString('fr-SN')} F. Merci. SEMOU GROUP`
      : `Bonjour ${prenom}, votre commande est entièrement soldée ! Félicitations. Merci de votre confiance. SEMOU GROUP × CFA CUSEMS Authentique`,
}
