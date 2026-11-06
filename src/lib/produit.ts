import type { CFAProduit } from '@/lib/supabase'

/* Un produit mal renseigné (prix à 0, apport supérieur au prix) ou épuisé ne peut pas être commandé */
export function produitCommandable(p: Pick<CFAProduit, 'actif' | 'prix_vente' | 'apport_minimum' | 'stock' | 'stock_illimite'>): boolean {
  return p.actif
    && p.prix_vente > 0
    && p.apport_minimum >= 0
    && p.apport_minimum < p.prix_vente
    && (p.stock_illimite || p.stock > 0)
}
