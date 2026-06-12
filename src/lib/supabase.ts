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
  type_fonctionnaire: string
  ecole: string | null
  ief: string | null
  ia: string | null
  region: string | null
  statut: string
}

export type CFACommande = {
  id: string
  reference: string
  client_id: string
  prix_vente: number
  apport_paye: number
  reste_a_payer: number
  nb_mensualites: number
  montant_mensualite: number
  statut: string
  notes: string | null
}
