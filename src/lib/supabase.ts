import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://idgwekhrwbljdyhfabxx.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkZ3dla2hyd2JsamR5aGZhYnh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwODAyNDAsImV4cCI6MjA5NjY1NjI0MH0.wtNM7Z5Ho0MucYieQXRPe3_yZV_lYaptHWVvnAoomqI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type CFAClient = {
  id: string
  prenom: string
  nom: string
  telephone: string
  matricule: string | null
  type_fonctionnaire: string | null
  type_enseignant: string | null
  ecole: string | null
  ief: string | null
  ia: string | null
  region: string | null
  corps: string | null
  ministere: string | null
  grade: string | null
  statut: string
  source: string | null
  cni_url: string | null
  cni_valide: boolean
  bulletin_url: string | null
  bulletin_valide: boolean
  notes: string | null
  created_at: string
}

export type CFAProduit = {
  id: string
  nom: string
  description: string | null
  photo_url: string | null
  prix_vente: number
  apport_minimum: number
  nb_mensualites_max: number
  stock: number
  stock_illimite: boolean
  actif: boolean
  en_vedette: boolean
  etat: string
  created_at: string
}

export type CFACommande = {
  id: string
  reference: string
  client_id: string
  produit_id: string
  prix_vente: number
  apport_paye: number
  reste_a_payer: number
  nb_mensualites: number
  montant_mensualite: number
  statut: string
  statut_livraison: string | null
  livraison_id: string | null
  notes: string | null
  date_fin_prevue: string | null
  produit?: { nom: string } | null
}

export type CFAProduitMedia = {
  id: string
  produit_id: string
  type: 'IMAGE' | 'VIDEO'
  url: string
  ordre: number
  created_at: string
}

export type CFAVersement = {
  id: string
  commande_id: string
  numero_versement: number
  montant_prevu: number
  montant_paye: number
  date_echeance: string
  date_paiement: string | null
  moyen_paiement: string | null
  statut: string
}

export type CFALivraison = {
  id: string
  commande_id: string
  client_id: string
  statut: string
  adresse_livraison: string | null
  ville_livraison: string | null
  region_livraison: string | null
  telephone_livraison: string | null
  date_planifiee: string | null
  date_livraison_effective: string | null
  delai_max_jours: number
  livreur_nom: string | null
  livreur_telephone: string | null
  livreur_service: string | null
  numero_suivi: string | null
  frais_livraison: number
  frais_payes: boolean
}
