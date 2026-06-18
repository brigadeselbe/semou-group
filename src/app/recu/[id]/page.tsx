import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F CFA' }
function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })
}

const MOYENS: Record<string, string> = {
  WAVE: 'Wave', ORANGE_MONEY: 'Orange Money', ESPECES: 'Espèces', VIREMENT: 'Virement bancaire',
}

export default async function RecuPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tel?: string }>
}) {
  const { id }  = await params
  const { tel } = await searchParams

  if (!tel) notFound()

  const { data } = await supabase.rpc('get_recu_versement', {
    p_versement_id: id,
    p_telephone:    tel,
  })
  if (!data) notFound()

  const r = data as {
    versement_id: string; numero_versement: number; montant_prevu: number; montant_paye: number
    date_echeance: string; date_paiement: string | null; moyen_paiement: string | null
    reference: string; produit_nom: string; prix_vente: number; nb_mensualites: number
    client_prenom: string; client_nom: string; client_telephone: string; client_matricule: string | null
  }

  return (
    <>
      {/* Styles print uniquement */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
        @page { margin: 1.5cm; }
      `}</style>

      {/* Bouton imprimer */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-3">
        <button onClick={() => window.print()}
          className="bg-spruce-light text-paper font-body text-sm px-5 py-2.5 rounded-full hover:bg-spruce transition-colors shadow-lg">
          Imprimer / Télécharger PDF
        </button>
        <button onClick={() => window.close()}
          className="bg-paper/8 text-paper font-body text-sm px-5 py-2.5 rounded-full hover:bg-paper/15 transition-colors">
          Fermer
        </button>
      </div>

      {/* Reçu */}
      <div className="min-h-screen bg-[#FAF8F3] py-16 px-6 print:py-0 print:px-0 print:bg-white">
        <div className="max-w-lg mx-auto bg-surface print:bg-white border border-paper/8 print:border-gray-200 rounded-2xl print:rounded-none overflow-hidden">

          {/* En-tête */}
          <div className="bg-spruce/20 print:bg-gray-50 px-8 py-6 border-b border-paper/6 print:border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-2xl text-paper print:text-gray-900">SEMOU GROUP</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/55 print:text-gray-500 mt-1">
                  CFA CUSEMS Authentique · Récépissé N. 0413/MINT/DGAT/DLP
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/45 print:text-gray-500">Reçu de paiement</div>
                <div className="font-mono text-xs font-medium text-brass-light print:text-yellow-700 mt-0.5">
                  #{r.reference}-V{r.numero_versement}
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-6 space-y-5">
            {/* Client */}
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/40 print:text-gray-400 mb-2">Client</div>
              <div className="font-display text-lg text-paper print:text-gray-900">{r.client_prenom} {r.client_nom}</div>
              <div className="font-mono text-xs text-paper/60 print:text-gray-600 mt-0.5">{r.client_telephone}</div>
              {r.client_matricule && (
                <div className="font-mono text-xs text-paper/50 print:text-gray-500">Matricule : {r.client_matricule}</div>
              )}
            </div>

            <div className="border-t border-dashed border-paper/8 print:border-gray-200" />

            {/* Commande */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Produit</div>
                <div className="font-body text-sm text-paper print:text-gray-800">{r.produit_nom}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Référence commande</div>
                <div className="font-mono text-sm text-paper print:text-gray-800">{r.reference}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Plan</div>
                <div className="font-body text-sm text-paper print:text-gray-800">{r.nb_mensualites} mensualités</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Versement N°</div>
                <div className="font-body text-sm text-paper print:text-gray-800">{r.numero_versement} / {r.nb_mensualites}</div>
              </div>
            </div>

            <div className="border-t border-dashed border-paper/8 print:border-gray-200" />

            {/* Paiement */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Date d&apos;échéance</div>
                <div className="font-body text-sm text-paper print:text-gray-800">{fmtDate(r.date_echeance)}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Date de paiement</div>
                <div className="font-body text-sm text-paper print:text-gray-800">{fmtDate(r.date_paiement)}</div>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 print:text-gray-400 mb-1">Moyen de paiement</div>
                <div className="font-body text-sm text-paper print:text-gray-800">{MOYENS[r.moyen_paiement ?? ''] ?? r.moyen_paiement ?? '—'}</div>
              </div>
            </div>

            {/* Montant — mis en valeur */}
            <div className="bg-brass/10 print:bg-yellow-50 border border-brass/20 print:border-yellow-200 rounded-xl px-6 py-4 flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/60 print:text-gray-600">Montant payé</div>
              <div className="font-display text-3xl text-brass-light print:text-yellow-700">{fcfa(r.montant_paye || r.montant_prevu)}</div>
            </div>

            {/* Pied de page */}
            <div className="border-t border-paper/6 print:border-gray-200 pt-4 text-center">
              <p className="font-mono text-[9px] text-paper/35 print:text-gray-400 leading-relaxed">
                Ce reçu est généré automatiquement par la plateforme SEMOU GROUP.<br />
                Conservez-le comme preuve de votre paiement.<br />
                Contact : semou-group.vercel.app
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
