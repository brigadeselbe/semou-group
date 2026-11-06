import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isValidSession, SESSION_COOKIE } from '@/lib/adminSession'

// Photos et vidéos des produits : le public ne peut plus écrire dans le stockage,
// chaque opération passe par ici après contrôle de la session admin.
const BUCKETS = new Set(['produit-photos', 'produit-videos'])

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const erreur = (error: string, status: number) => NextResponse.json({ error }, { status })
const sessionValide = (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  return !!token && isValidSession(token)
}
const emplacementValide = (bucket: unknown, path: unknown): path is string =>
  typeof bucket === 'string' && BUCKETS.has(bucket) &&
  typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.includes('..')

// Lien d'envoi signé : le navigateur envoie le fichier directement au stockage,
// ce qui permet les vidéos plus lourdes que la limite du serveur web.
export async function POST(req: NextRequest) {
  if (!sessionValide(req)) return erreur('Session expirée — reconnectez-vous', 401)
  const { bucket, path } = await req.json().catch(() => ({}))
  if (!emplacementValide(bucket, path)) return erreur('Emplacement invalide', 400)

  const { data, error } = await db().storage.from(bucket).createSignedUploadUrl(path, { upsert: true })
  if (error || !data) return erreur(error?.message ?? 'Envoi impossible', 500)
  return NextResponse.json({ token: data.token })
}

// Enregistre un média déjà envoyé dans la galerie du produit
export async function PUT(req: NextRequest) {
  if (!sessionValide(req)) return erreur('Session expirée — reconnectez-vous', 401)
  const { produit_id, type, url, ordre } = await req.json().catch(() => ({}))
  if (typeof produit_id !== 'string' || (type !== 'IMAGE' && type !== 'VIDEO') || typeof url !== 'string' || !Number.isInteger(ordre)) {
    return erreur('Média invalide', 400)
  }

  const { data, error } = await db()
    .from('cfa_produit_medias')
    .insert({ produit_id, type, url, ordre })
    .select()
    .single()
  if (error) return erreur(error.message, 500)
  return NextResponse.json({ row: data })
}

export async function DELETE(req: NextRequest) {
  if (!sessionValide(req)) return erreur('Session expirée — reconnectez-vous', 401)
  const { bucket, path } = await req.json().catch(() => ({}))
  if (!emplacementValide(bucket, path)) return erreur('Emplacement invalide', 400)

  const { error } = await db().storage.from(bucket).remove([path])
  if (error) return erreur(error.message, 500)
  return NextResponse.json({ ok: true })
}
