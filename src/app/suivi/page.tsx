'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Loader2, AlertCircle, Package, Truck, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFALivraison } from '@/lib/supabase'

/* ── Utilitaires ─────────────────────────────────────────────────────── */

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('221')) return digits
  return '221' + (digits.startsWith('0') ? digits.slice(1) : digits)
}

function formatFcfa(n: number) {
  return n.toLocaleString('fr-SN') + ' F'
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

/* ── Statuts livraison ───────────────────────────────────────────────── */

const LIVRAISON_STEPS = [
  { key: 'EN_ATTENTE',  label: 'En attente',  Icon: Clock },
  { key: 'PLANIFIEE',   label: 'Planifiée',   Icon: Package },
  { key: 'EN_ROUTE',    label: 'En route',    Icon: Truck },
  { key: 'LIVREE',      label: 'Livrée',      Icon: CheckCircle2 },
]

const STATUT_COLORS: Record<string, string> = {
  VALIDE:    'text-spruce bg-spruce/10',
  EN_ATTENTE:'text-brass-dark bg-brass/10',
  EN_COURS:  'text-spruce bg-spruce/10',
  SOLDE:     'text-ink/50 bg-ink/5',
  PAYE:      'text-spruce bg-spruce/10',
  EN_RETARD: 'text-clay bg-clay/10',
  LIVREE:    'text-spruce bg-spruce/10',
  ECHEC:     'text-clay bg-clay/10',
  ANNULEE:   'text-ink/40 bg-ink/5',
}

const STATUT_LABELS: Record<string, string> = {
  VALIDE:     'Validé',
  EN_ATTENTE: 'En attente',
  EN_COURS:   'En cours',
  SOLDE:      'Soldé',
  PAYE:       'Payé',
  EN_RETARD:  'En retard',
  LIVREE:     'Livrée',
  PLANIFIEE:  'Planifiée',
  EN_ROUTE:   'En route',
  ECHEC:      'Échec',
  ANNULEE:    'Annulée',
}

/* ── Types résultat ──────────────────────────────────────────────────── */

type CommandeWithDetails = CFACommande & {
  versements: CFAVersement[]
  livraison: CFALivraison | null
}

type ResultData = {
  client: CFAClient
  commandes: CommandeWithDetails[]
}

/* ── Composants d'affichage ──────────────────────────────────────────── */

function StatutBadge({ statut }: { statut: string }) {
  const cls = STATUT_COLORS[statut] ?? 'text-ink/50 bg-ink/5'
  const lbl = STATUT_LABELS[statut] ?? statut
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded-full ${cls}`}>
      {lbl}
    </span>
  )
}

function LivraisonTimeline({ livraison }: { livraison: CFALivraison | null }) {
  if (!livraison) {
    return (
      <p className="font-mono text-[10px] text-ink/35 uppercase tracking-[0.1em]">
        Livraison planifiée après validation du paiement
      </p>
    )
  }

  const currentIdx = LIVRAISON_STEPS.findIndex(s => s.key === livraison.statut)
  const isEchec = livraison.statut === 'ECHEC' || livraison.statut === 'ANNULEE'

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {LIVRAISON_STEPS.map((step, i) => {
          const done    = i <= currentIdx && !isEchec
          const current = i === currentIdx && !isEchec
          return (
            <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-colors ${
                done
                  ? 'bg-spruce border-spruce text-paper'
                  : 'bg-paper border-ink/15 text-ink/30'
              } ${current ? 'ring-2 ring-spruce/30' : ''}`}>
                <step.Icon className="w-3.5 h-3.5" />
              </div>
              <span className={`font-mono text-[9px] uppercase tracking-[0.1em] ${done ? 'text-spruce' : 'text-ink/30'}`}>
                {step.label}
              </span>
              {i < LIVRAISON_STEPS.length - 1 && (
                <div className={`w-6 h-px flex-shrink-0 ${done && i < currentIdx ? 'bg-spruce' : 'bg-ink/10'}`} />
              )}
            </div>
          )
        })}
        {isEchec && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <XCircle className="w-4 h-4 text-clay" />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-clay">
              {livraison.statut === 'ECHEC' ? 'Échec' : 'Annulée'}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        {livraison.date_planifiee && (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35">
              Date prévue
            </div>
            <div className="font-mono text-xs text-ink/70 mt-0.5">
              {formatDate(livraison.date_planifiee)}
            </div>
          </div>
        )}
        {livraison.frais_livraison !== null && (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35">
              Frais livraison
            </div>
            <div className={`font-mono text-xs mt-0.5 ${livraison.frais_payes ? 'text-spruce' : 'text-clay'}`}>
              {formatFcfa(livraison.frais_livraison)} {livraison.frais_payes ? '· Payé' : '· À payer à la réception'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CommandeCard({ commande }: { commande: CommandeWithDetails }) {
  const payees  = commande.versements.filter(v => v.statut === 'PAYE').length
  const total   = commande.versements.length || commande.nb_mensualites
  const pct     = total > 0 ? Math.round((payees / total) * 100) : 0

  return (
    <div className="bg-white border border-ink/10 rounded-sm perforated shadow-[0_4px_20px_-8px_rgba(13,59,46,0.15)] p-5 md:p-6 relative">
      {/* En-tête commande */}
      <div className="flex items-start justify-between pb-4 mb-4 border-b border-dashed border-ink/10">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/35">
            Commande
          </div>
          <div className="font-mono text-sm font-medium mt-0.5">{commande.reference}</div>
        </div>
        <StatutBadge statut={commande.statut} />
      </div>

      {/* Produit */}
      {commande.notes && (
        <div className="mb-4">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35 mb-0.5">
            Produit
          </div>
          <div className="font-body text-sm text-ink/80 leading-snug">{commande.notes}</div>
        </div>
      )}

      {/* Montants */}
      <div className="grid grid-cols-3 gap-px bg-ink/8 border border-ink/8 rounded-sm overflow-hidden mb-4">
        {[
          { lbl: 'Prix total',    val: formatFcfa(commande.prix_vente) },
          { lbl: 'Versé',         val: formatFcfa(commande.apport_paye) },
          { lbl: 'Reste à payer', val: formatFcfa(commande.reste_a_payer) },
        ].map(({ lbl, val }) => (
          <div key={lbl} className="bg-paper px-3 py-2.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-ink/40">{lbl}</div>
            <div className="font-mono text-xs font-medium text-ink/80 mt-0.5">{val}</div>
          </div>
        ))}
      </div>

      {/* Progression mensualités */}
      <div className="mb-5">
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-ink/40 mb-1.5">
          <span>Progression</span>
          <span>{payees} / {total} mensualités</span>
        </div>
        <div className="h-1.5 bg-parchment rounded-full overflow-hidden">
          <div
            className="h-full bg-spruce rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {commande.montant_mensualite > 0 && (
          <div className="font-mono text-[9px] text-ink/35 mt-1">
            {formatFcfa(commande.montant_mensualite)} / mois
          </div>
        )}
      </div>

      {/* Versements */}
      {commande.versements.length > 0 && (
        <div className="mb-5">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35 mb-2">
            Échéancier
          </div>
          <div className="space-y-1.5">
            {commande.versements.map((v, i) => (
              <div
                key={v.id}
                className="flex items-center justify-between font-mono text-xs"
              >
                <span className="text-ink/40">Versement {i + 1}</span>
                <span className="text-ink/50 text-[10px]">{formatDate(v.date_echeance)}</span>
                <div className="flex items-center gap-2">
                  <span className={v.statut === 'PAYE' ? 'text-spruce' : v.statut === 'EN_RETARD' ? 'text-clay' : 'text-ink/50'}>
                    {formatFcfa(v.montant_prevu)}
                  </span>
                  <StatutBadge statut={v.statut} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Livraison */}
      <div className="pt-4 border-t border-dashed border-ink/10">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35 mb-3">
          Livraison
        </div>
        <LivraisonTimeline livraison={commande.livraison} />
      </div>
    </div>
  )
}

/* ── Page principale ─────────────────────────────────────────────────── */

type Stage = 'search' | 'loading' | 'result' | 'notfound' | 'error'

export default function Suivi() {
  const [phone,   setPhone]   = useState('')
  const [stage,   setStage]   = useState<Stage>('search')
  const [errMsg,  setErrMsg]  = useState('')
  const [result,  setResult]  = useState<ResultData | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')
    setStage('loading')

    const normalized = normalizePhone(phone)

    /* 1. Client */
    const { data: client, error: clientErr } = await supabase
      .from('cfa_clients')
      .select('*')
      .eq('telephone', normalized)
      .single()

    if (clientErr || !client) {
      setStage('notfound')
      return
    }

    /* 2. Commandes */
    const { data: commandes, error: cmdErr } = await supabase
      .from('cfa_commandes')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })

    if (cmdErr) {
      setErrMsg(`Erreur lors du chargement des commandes : ${cmdErr.message}`)
      setStage('error')
      return
    }

    const commandeIds = (commandes ?? []).map(c => c.id)

    /* 3. Versements & livraisons en parallèle */
    const [verRes, livRes] = await Promise.all([
      commandeIds.length > 0
        ? supabase.from('cfa_versements').select('*').in('commande_id', commandeIds).order('date_echeance')
        : Promise.resolve({ data: [], error: null }),
      commandeIds.length > 0
        ? supabase.from('cfa_livraisons').select('*').in('commande_id', commandeIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const versements: CFAVersement[] = verRes.data ?? []
    const livraisons: CFALivraison[] = livRes.data ?? []

    const commandesWithDetails: CommandeWithDetails[] = (commandes ?? []).map(cmd => ({
      ...cmd,
      versements: versements.filter(v => v.commande_id === cmd.id),
      livraison:  livraisons.find(l => l.commande_id === cmd.id) ?? null,
    }))

    setResult({ client: client as CFAClient, commandes: commandesWithDetails })
    setStage('result')
  }

  /* ── Rendu résultat ── */
  if (stage === 'result' && result) {
    const { client, commandes } = result
    return (
      <div className="min-h-screen px-6 md:px-10 py-12 md:py-20">
        <div className="max-w-2xl mx-auto">

          <button
            onClick={() => { setStage('search'); setPhone(''); setResult(null) }}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-spruce mb-10"
          >
            <ArrowLeft className="w-4 h-4" /> Nouvelle recherche
          </button>

          {/* Carte client */}
          <div className="bg-white border border-ink/10 rounded-sm shadow-[0_4px_20px_-8px_rgba(13,59,46,0.15)] p-5 md:p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/35">
                  Dossier client
                </div>
                <div className="font-display text-xl mt-1">
                  {client.prenom} {client.nom}
                </div>
              </div>
              <StatutBadge statut={client.statut} />
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {client.matricule && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35">Matricule</div>
                  <div className="text-ink/70 mt-0.5">{client.matricule}</div>
                </div>
              )}
              {client.type_fonctionnaire && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35">Corps</div>
                  <div className="text-ink/70 mt-0.5">{client.type_fonctionnaire}</div>
                </div>
              )}
              {client.ia && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35">Académie</div>
                  <div className="text-ink/70 mt-0.5">{client.ia}</div>
                </div>
              )}
              {client.region && (
                <div>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-ink/35">Région</div>
                  <div className="text-ink/70 mt-0.5">{client.region}</div>
                </div>
              )}
            </div>

            {client.statut === 'EN_ATTENTE' && (
              <div className="mt-4 pt-4 border-t border-dashed border-ink/10 font-mono text-[10px] text-brass-dark tracking-[0.08em]">
                Dossier en cours de validation — vous recevrez un SMS sous 24 à 48h.
              </div>
            )}
          </div>

          {/* Commandes */}
          {commandes.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-body text-ink/50 text-sm">Aucune commande enregistrée pour ce dossier.</p>
              <Link href="/" className="inline-block mt-4 font-body text-sm text-spruce underline underline-offset-4">
                Découvrir nos produits
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/35">
                {commandes.length} commande{commandes.length > 1 ? 's' : ''}
              </div>
              {commandes.map(cmd => (
                <CommandeCard key={cmd.id} commande={cmd} />
              ))}
            </div>
          )}

          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/30 text-center mt-12">
            © 2026 Semou Group × CFA CUSEMS · Récépissé N. 0413/MINT/DGAT/DLP
          </p>
        </div>
      </div>
    )
  }

  /* ── Rendu recherche ── */
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full">

        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-spruce mb-10"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass-dark">
            CFA CUSEMS
          </span>
          <h1 className="font-display text-4xl md:text-5xl mt-2 leading-[1.05]">
            Suivi de<br />
            <span className="italic text-spruce">commande.</span>
          </h1>
          <p className="font-body text-ink/60 text-sm mt-4 leading-relaxed">
            Entrez le numéro de téléphone enregistré lors de votre inscription.
          </p>
        </div>

        <div className="bg-white border border-ink/10 rounded-sm shadow-[0_8px_30px_-10px_rgba(13,59,46,0.2)] p-6 md:p-8 perforated">
          <form onSubmit={handleSearch} className="space-y-5">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40 block mb-2">
                Numéro de téléphone
              </label>
              <input
                required
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="77 XXX XX XX"
                className="w-full bg-transparent border-b border-ink/20 focus:border-spruce outline-none font-mono text-lg pb-1.5 transition-colors placeholder:text-ink/20"
              />
            </div>

            {(stage === 'error') && errMsg && (
              <div className="flex items-start gap-3 bg-clay/8 border border-clay/20 rounded-sm p-3">
                <AlertCircle className="w-4 h-4 text-clay flex-shrink-0 mt-0.5" />
                <p className="font-body text-sm text-clay">{errMsg}</p>
              </div>
            )}

            {stage === 'notfound' && (
              <div className="flex items-start gap-3 bg-brass/8 border border-brass/20 rounded-sm p-3">
                <AlertCircle className="w-4 h-4 text-brass-dark flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-body text-sm text-ink/70">
                    Aucun dossier trouvé pour ce numéro.
                  </p>
                  <Link href="/inscription" className="font-body text-sm text-spruce underline underline-offset-2 mt-1 inline-block">
                    Créer un dossier →
                  </Link>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={stage === 'loading'}
              className="w-full flex items-center justify-center gap-2 font-body font-medium bg-spruce text-paper px-8 py-4 rounded-full hover:bg-spruce-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {stage === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Recherche…
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Consulter mon dossier
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  )
}
