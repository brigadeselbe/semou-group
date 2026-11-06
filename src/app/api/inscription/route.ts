import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendSMS, smsTemplates } from '@/lib/sms'
import { produitCommandable } from '@/lib/produit'

// Clé service_role : le dossier et les pièces sont enregistrés côté serveur uniquement.
// Client créé à la requête : la clé n'existe pas au moment du build.
const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const TAILLE_MAX = 10 * 1024 * 1024 // limite du bucket "documents"
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
}
const NUMERO_DEJA_INSCRIT = 'Ce numéro est déjà enregistré. Rendez-vous sur /suivi pour retrouver votre dossier.'

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('221')) return digits
  return '221' + (digits.startsWith('0') ? digits.slice(1) : digits)
}

function erreur(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return erreur('Formulaire invalide')

  const champ = (nom: string) => String(form.get(nom) ?? '').trim().slice(0, 200)
  const prenom    = champ('prenom')
  const nom       = champ('nom')
  const matricule = champ('matricule')
  const corps     = champ('corps')
  const telephone = normalizePhone(champ('telephone'))

  if (!prenom || !nom || !matricule || !corps) {
    return erreur('Veuillez remplir tous les champs obligatoires (Prénom, Nom, Téléphone, Matricule, Corps).')
  }
  if (!/^221\d{9}$/.test(telephone)) return erreur('Numéro de téléphone invalide (9 chiffres attendus).')

  const pieces = [
    { cle: 'cni_recto', dossier: 'cni',       suffixe: '_recto', libelle: 'CNI recto' },
    { cle: 'cni_verso', dossier: 'cni',       suffixe: '_verso', libelle: 'CNI verso' },
    { cle: 'bulletin',  dossier: 'bulletins', suffixe: '',       libelle: 'bulletin de salaire' },
  ].map(p => ({ ...p, fichier: form.get(p.cle) }))

  for (const { fichier, libelle } of pieces) {
    if (!(fichier instanceof File) || fichier.size === 0) {
      return erreur('Veuillez joindre les trois pièces : CNI recto, CNI verso et bulletin de salaire.')
    }
    if (!EXTENSIONS[fichier.type]) return erreur(`${libelle} : format non accepté (JPEG, PNG, WEBP ou PDF).`)
    if (fichier.size > TAILLE_MAX) return erreur(`${libelle} : fichier trop volumineux (10 Mo maximum).`)
  }

  const supabase = db()

  const { data: existant } = await supabase.from('cfa_clients').select('id').eq('telephone', telephone).maybeSingle()
  if (existant) return erreur(NUMERO_DEJA_INSCRIT, 409)

  // Commande optionnelle : vérifiée avant tout enregistrement
  const produitId     = champ('produit_id')
  const nbMensualites = Number(champ('nb_mensualites'))
  if (produitId) {
    const { data: produit } = await supabase.from('cfa_produits').select('*').eq('id', produitId).maybeSingle()
    if (!produit || !produitCommandable(produit)) return erreur('Ce produit n\'est pas disponible à la commande.')
    if (!Number.isInteger(nbMensualites) || nbMensualites < 1 || nbMensualites > produit.nb_mensualites_max) {
      return erreur('Nombre de mensualités invalide pour ce produit.')
    }
  }

  // 1. Pièces justificatives : un échec est signalé au client, jamais ignoré
  const ts = Date.now()
  const chemins: string[] = []
  const annulerPieces = async () => { await supabase.storage.from('documents').remove(chemins) }

  for (const { dossier, suffixe, fichier, libelle } of pieces) {
    const file   = fichier as File
    const chemin = `${dossier}/${telephone}/${ts}${suffixe}.${EXTENSIONS[file.type]}`
    const { error } = await supabase.storage.from('documents').upload(chemin, file, { contentType: file.type })
    if (error) {
      console.error(`[INSCRIPTION] upload ${libelle} :`, error.message)
      await annulerPieces()
      return erreur(`Impossible d'enregistrer votre ${libelle}. Veuillez réessayer.`, 500)
    }
    chemins.push(chemin)
  }

  // 2. Dossier client : statut et source ne viennent jamais du formulaire
  const { data: client, error } = await supabase
    .from('cfa_clients')
    .insert({
      prenom:             prenom.toUpperCase(),
      nom:                nom.toUpperCase(),
      telephone,
      matricule:          matricule.toUpperCase(),
      type_fonctionnaire: corps,
      type_enseignant:    corps === 'ENSEIGNANT' ? champ('type_agent') || null : null,
      corps,
      ia:           champ('ia')     || null,
      ief:          champ('ief')    || null,
      region:       champ('region') || null,
      ecole:        champ('ecole')  || null,
      statut:       'EN_ATTENTE',
      source:       'INSCRIPTION',
      cni_url:      chemins[0],
      bulletin_url: chemins[2],
      notes:        `CNI_VERSO:${chemins[1]}`,
    })
    .select('id')
    .single()

  if (error) {
    await annulerPieces()
    if (error.code === '23505') return erreur(NUMERO_DEJA_INSCRIT, 409)
    console.error('[INSCRIPTION] création du dossier :', error.message)
    return erreur('Impossible d\'enregistrer votre dossier. Veuillez réessayer.', 500)
  }

  const clientId = client.id as string
  const ref      = `SG-${new Date().getFullYear()}-${clientId.slice(-8).toUpperCase()}`

  await sendSMS(telephone, smsTemplates.inscriptionConfirmee(prenom, ref))

  // 3. Commande : le dossier reste enregistré même si cette étape échoue
  if (!produitId) return NextResponse.json({ ref })

  const { data: commandeId, error: cmdErr } = await supabase.rpc('inscription_creer_commande', {
    p_client_id:      clientId,
    p_produit_id:     produitId,
    p_nb_mensualites: nbMensualites,
  })
  if (cmdErr || !commandeId) {
    console.error('[INSCRIPTION] création de la commande :', cmdErr?.message)
    return NextResponse.json({ ref, commande_error: 'Dossier créé, mais la commande n\'a pas pu être enregistrée. Contactez le bureau SEMOU GROUP.' })
  }

  return NextResponse.json({ ref, commande_id: commandeId })
}
