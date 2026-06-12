'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Loader2, AlertCircle, Package, Truck, CheckCircle2, Clock, XCircle, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFALivraison } from '@/lib/supabase'

/* ── Utilitaires ── */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('221')) return digits
  return '221' + (digits.startsWith('0') ? digits.slice(1) : digits)
}
function formatFcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }
function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })
}

/* ── Livraison ── */
const LIVRAISON_STEPS = [
  { key: 'EN_ATTENTE', label: 'En attente', Icon: Clock },
  { key: 'PLANIFIEE',  label: 'Planifiée',  Icon: Package },
  { key: 'EN_ROUTE',   label: 'En route',   Icon: Truck },
  { key: 'LIVREE',     label: 'Livrée',     Icon: CheckCircle2 },
]

const STATUT_COLORS: Record<string, string> = {
  VALIDE:     'text-spruce-light bg-spruce/20 border border-spruce/30',
  EN_ATTENTE: 'text-brass-light bg-brass/10 border border-brass/20',
  EN_COURS:   'text-spruce-light bg-spruce/20 border border-spruce/30',
  SOLDE:      'text-paper/30 bg-white/5 border border-white/10',
  PAYE:       'text-spruce-light bg-spruce/20 border border-spruce/30',
  EN_RETARD:  'text-clay bg-clay/10 border border-clay/20',
  LIVREE:     'text-spruce-light bg-spruce/20 border border-spruce/30',
  ECHEC:      'text-clay bg-clay/10 border border-clay/20',
  ANNULEE:    'text-paper/25 bg-white/5 border border-white/8',
}
const STATUT_LABELS: Record<string, string> = {
  VALIDE: 'Validé', EN_ATTENTE: 'En attente', EN_COURS: 'En cours',
  SOLDE: 'Soldé', PAYE: 'Payé', EN_RETARD: 'En retard',
  LIVREE: 'Livrée', PLANIFIEE: 'Planifiée', EN_ROUTE: 'En route',
  ECHEC: 'Échec', ANNULEE: 'Annulée',
}

/* ── Types ── */
type CommandeWithDetails = CFACommande & {
  versements: CFAVersement[]
  livraison: CFALivraison | null
}
type ResultData = { client: CFAClient; commandes: CommandeWithDetails[] }

/* ── Badge statut ── */
function StatutBadge({ statut }: { statut: string }) {
  const cls = STATUT_COLORS[statut] ?? 'text-paper/30 bg-white/5 border border-white/8'
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded-full ${cls}`}>
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

/* ── Modal paiement ── */
type PayTarget = { type: 'VERSEMENT' | 'APPORT'; id: string; montant: number; label: string }

function PayModal({ target, telephone, onClose }: {
  target: PayTarget; telephone: string; onClose: () => void
}) {
  const [loading, setLoading] = useState<'wave' | 'orange' | null>(null)
  const [error,   setError]   = useState('')

  async function pay(moyen: 'wave' | 'orange') {
    setLoading(moyen); setError('')
    const res = await fetch(`/api/pay/${moyen}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: target.type, id: target.id, telephone }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Erreur'); setLoading(null); return }
    window.location.href = json.checkout_url
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-white/8 rounded-2xl p-6 w-full max-w-sm">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30 mb-1">Paiement</div>
        <div className="font-display text-xl text-paper mb-1">{target.label}</div>
        <div className="font-mono text-sm text-brass-light mb-5">{formatFcfa(target.montant)}</div>

        {error && (
          <div className="flex items-start gap-2 bg-clay/10 border border-clay/25 rounded-xl p-3 mb-4 text-clay text-xs font-body leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}

        <div className="space-y-3">
          <button onClick={() => pay('wave')} disabled={!!loading}
            className="w-full flex items-center justify-between bg-[#1B75D0] hover:bg-[#1565BA] text-white font-body font-medium px-5 py-3.5 rounded-xl transition-colors disabled:opacity-60">
            <span className="flex items-center gap-3">
              <CreditCard className="w-4 h-4" />
              <span>Payer avec Wave</span>
            </span>
            {loading === 'wave' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm opacity-70">→</span>}
          </button>

          <button onClick={() => pay('orange')} disabled={!!loading}
            className="w-full flex items-center justify-between bg-[#F66B00] hover:bg-[#E05C00] text-white font-body font-medium px-5 py-3.5 rounded-xl transition-colors disabled:opacity-60">
            <span className="flex items-center gap-3">
              <CreditCard className="w-4 h-4" />
              <span>Payer avec Orange Money</span>
            </span>
            {loading === 'orange' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm opacity-70">→</span>}
          </button>

          <button onClick={onClose} className="w-full font-body text-sm text-paper/40 hover:text-paper/60 py-2 transition-colors">
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Livraison timeline ── */
function LivraisonTimeline({ livraison }: { livraison: CFALivraison | null }) {
  if (!livraison) return (
    <p className="font-mono text-[10px] text-paper/25 uppercase tracking-[0.1em]">
      Livraison planifiée après validation du paiement
    </p>
  )
  const currentIdx = LIVRAISON_STEPS.findIndex(s => s.key === livraison.statut)
  const isEchec = livraison.statut === 'ECHEC' || livraison.statut === 'ANNULEE'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {LIVRAISON_STEPS.map((step, i) => {
          const done = i <= currentIdx && !isEchec
          return (
            <div key={step.key} className="flex items-center gap-2 flex-shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${done ? 'bg-spruce-light border-spruce-light text-paper' : 'bg-void border-white/10 text-paper/20'}`}>
                <step.Icon className="w-3.5 h-3.5" />
              </div>
              <span className={`font-mono text-[9px] uppercase tracking-[0.1em] ${done ? 'text-spruce-light' : 'text-paper/20'}`}>{step.label}</span>
              {i < LIVRAISON_STEPS.length - 1 && (
                <div className={`w-6 h-px flex-shrink-0 ${done && i < currentIdx ? 'bg-spruce-light' : 'bg-white/8'}`} />
              )}
            </div>
          )
        })}
        {isEchec && <div className="flex items-center gap-2 ml-2"><XCircle className="w-4 h-4 text-clay" /></div>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {livraison.date_planifiee && (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25">Date prévue</div>
            <div className="font-mono text-xs text-paper/60 mt-0.5">{formatDate(livraison.date_planifiee)}</div>
          </div>
        )}
        {livraison.frais_livraison !== null && (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25">Frais livraison</div>
            <div className={`font-mono text-xs mt-0.5 ${livraison.frais_payes ? 'text-spruce-light' : 'text-clay'}`}>
              {formatFcfa(livraison.frais_livraison)}{' '}
              <span className="text-paper/35">{livraison.frais_payes ? '· Payé' : '· À réception'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Carte commande ── */
function CommandeCard({ commande, telephone }: {
  commande: CommandeWithDetails; telephone: string
}) {
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null)
  const payees = commande.versements.filter(v => v.statut === 'PAYE').length
  const total  = commande.versements.length || commande.nb_mensualites
  const pct    = total > 0 ? Math.round((payees / total) * 100) : 0
  const canPay = commande.statut === 'EN_COURS'

  return (
    <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
      {payTarget && (
        <PayModal
          target={payTarget}
          telephone={telephone}
          onClose={() => setPayTarget(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between px-5 md:px-6 pt-5 pb-4 border-b border-dashed border-white/5">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/25">Commande</div>
          <div className="font-mono text-sm font-medium text-paper mt-0.5">{commande.reference}</div>
        </div>
        <StatutBadge statut={commande.statut} />
      </div>

      <div className="px-5 md:px-6 py-4 space-y-5">

        {/* Produit */}
        {(commande.produit?.nom || commande.notes) && (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-0.5">Produit</div>
            <div className="font-body text-sm text-paper/70">{commande.produit?.nom ?? commande.notes}</div>
          </div>
        )}

        {/* Montants */}
        <div className="grid grid-cols-3 gap-px bg-white/5 border border-white/6 rounded-xl overflow-hidden">
          {[
            { lbl: 'Prix total', val: formatFcfa(commande.prix_vente) },
            { lbl: 'Versé',      val: formatFcfa(commande.apport_paye) },
            { lbl: 'Reste',      val: formatFcfa(commande.reste_a_payer) },
          ].map(({ lbl, val }) => (
            <div key={lbl} className="bg-surface-2 px-3 py-2.5">
              <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-paper/25">{lbl}</div>
              <div className="font-mono text-xs font-medium text-paper/70 mt-0.5">{val}</div>
            </div>
          ))}
        </div>

        {/* Apport non payé → bouton payer */}
        {canPay && commande.apport_paye === 0 && commande.prix_vente > 0 && (
          <button
            onClick={() => setPayTarget({
              type: 'APPORT', id: commande.id,
              montant: commande.prix_vente - commande.nb_mensualites * commande.montant_mensualite,
              label: 'Apport initial',
            })}
            className="w-full flex items-center justify-center gap-2 font-body text-sm font-medium bg-brass/15 hover:bg-brass/25 border border-brass/30 text-brass-light px-4 py-3 rounded-xl transition-colors">
            <CreditCard className="w-4 h-4" /> Payer l&apos;apport
          </button>
        )}

        {/* Progression */}
        <div>
          <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.1em] text-paper/25 mb-2">
            <span>Progression</span>
            <span>{payees} / {total} mensualités</span>
          </div>
          <div className="h-1.5 bg-void rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-spruce to-spruce-light rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {commande.montant_mensualite > 0 && (
            <div className="font-mono text-[9px] text-paper/25 mt-1">{formatFcfa(commande.montant_mensualite)} / mois</div>
          )}
        </div>

        {/* Versements */}
        {commande.versements.length > 0 && (
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-2">Échéancier</div>
            <div className="space-y-2">
              {commande.versements.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between font-mono text-xs">
                  <span className="text-paper/30">Versement {i + 1}</span>
                  <span className="text-paper/30 text-[10px]">{formatDate(v.date_echeance)}</span>
                  <div className="flex items-center gap-2">
                    <span className={
                      v.statut === 'PAYE' ? 'text-spruce-light' :
                      v.statut === 'EN_RETARD' ? 'text-clay' : 'text-paper/40'
                    }>{formatFcfa(v.montant_prevu)}</span>
                    <StatutBadge statut={v.statut} />
                    {canPay && (v.statut === 'EN_ATTENTE' || v.statut === 'EN_RETARD') && (
                      <button
                        onClick={() => setPayTarget({
                          type: 'VERSEMENT', id: v.id,
                          montant: v.montant_prevu,
                          label: `Versement ${i + 1}`,
                        })}
                        className="font-mono text-[9px] uppercase tracking-[0.1em] text-brass-light border border-brass/25 hover:bg-brass/10 px-2 py-0.5 rounded-full transition-colors">
                        Payer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Livraison */}
        <div className="pt-4 border-t border-dashed border-white/5">
          <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-3">Livraison</div>
          <LivraisonTimeline livraison={commande.livraison} />
        </div>
      </div>
    </div>
  )
}

/* ── Page principale ── */
type Stage = 'search' | 'loading' | 'result' | 'notfound' | 'error'

export default function Suivi() {
  const [phone,  setPhone]  = useState('')
  const [stage,  setStage]  = useState<Stage>('search')
  const [errMsg, setErrMsg] = useState('')
  const [result, setResult] = useState<ResultData | null>(null)

  /* Lire le résultat paiement depuis l'URL */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const statut = params.get('paiement')
    if (statut === 'succes') {
      const el = document.getElementById('paiement-banner')
      if (el) { el.style.display = 'flex'; setTimeout(() => el.style.display = 'none', 6000) }
    }
  }, [])

  async function fetchDossier(tel: string) {
    setStage('loading')
    const normalized = normalizePhone(tel)
    const { data: client, error: clientErr } = await supabase
      .from('cfa_clients').select('*').eq('telephone', normalized).single()
    if (clientErr || !client) { setStage('notfound'); return }

    const { data: commandes, error: cmdErr } = await supabase
      .from('cfa_commandes').select('*, produit:cfa_produits(nom)')
      .eq('client_id', client.id).order('created_at', { ascending: false })
    if (cmdErr) { setErrMsg(cmdErr.message); setStage('error'); return }

    const ids = (commandes ?? []).map(c => c.id)
    const [verRes, livRes] = await Promise.all([
      ids.length > 0 ? supabase.from('cfa_versements').select('*').in('commande_id', ids).order('numero_versement') : Promise.resolve({ data: [] }),
      ids.length > 0 ? supabase.from('cfa_livraisons').select('*').in('commande_id', ids) : Promise.resolve({ data: [] }),
    ])
    const versements: CFAVersement[] = (verRes.data ?? []) as CFAVersement[]
    const livraisons: CFALivraison[] = (livRes.data ?? []) as CFALivraison[]
    const commandesWithDetails: CommandeWithDetails[] = (commandes ?? []).map(cmd => ({
      ...cmd,
      versements: versements.filter(v => v.commande_id === cmd.id),
      livraison:  livraisons.find(l => l.commande_id === cmd.id) ?? null,
    }))
    setResult({ client: client as CFAClient, commandes: commandesWithDetails })
    setStage('result')
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setErrMsg('')
    await fetchDossier(phone)
  }

  /* ── Résultat ── */
  if (stage === 'result' && result) {
    const { client, commandes } = result
    return (
      <div className="min-h-screen px-6 md:px-10 py-12 md:py-20">
        <div className="max-w-2xl mx-auto">

          {/* Banner succès paiement */}
          <div id="paiement-banner" style={{ display: 'none' }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-spruce-light text-paper font-body text-sm px-5 py-3 rounded-full shadow-lg">
            <CheckCircle2 className="w-4 h-4" /> Paiement confirmé — merci !
          </div>

          <button onClick={() => { setStage('search'); setPhone(''); setResult(null) }}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/40 hover:text-brass-light transition-colors mb-10">
            <ArrowLeft className="w-4 h-4" /> Nouvelle recherche
          </button>

          {/* Carte client */}
          <div className="bg-surface border border-white/6 rounded-2xl p-5 md:p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/25">Dossier client</div>
                <div className="font-display text-xl text-paper mt-1">{client.prenom} {client.nom}</div>
              </div>
              <StatutBadge statut={client.statut} />
            </div>
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              {client.matricule && <div><div className="text-[9px] uppercase tracking-[0.12em] text-paper/25">Matricule</div><div className="text-paper/60 mt-0.5">{client.matricule}</div></div>}
              {client.type_fonctionnaire && <div><div className="text-[9px] uppercase tracking-[0.12em] text-paper/25">Corps</div><div className="text-paper/60 mt-0.5">{client.type_fonctionnaire}</div></div>}
              {client.ia && <div><div className="text-[9px] uppercase tracking-[0.12em] text-paper/25">Académie</div><div className="text-paper/60 mt-0.5">{client.ia}</div></div>}
              {client.region && <div><div className="text-[9px] uppercase tracking-[0.12em] text-paper/25">Région</div><div className="text-paper/60 mt-0.5">{client.region}</div></div>}
            </div>
            {client.statut === 'EN_ATTENTE' && (
              <div className="mt-4 pt-4 border-t border-dashed border-white/5 font-mono text-[10px] text-brass/80 tracking-[0.08em]">
                Dossier en cours de validation — vous recevrez un SMS sous 24 à 48h.
              </div>
            )}
          </div>

          {/* Commandes */}
          {commandes.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-body text-paper/40 text-sm">Aucune commande enregistrée pour ce dossier.</p>
              <Link href="/" className="inline-block mt-4 font-body text-sm text-brass-light underline underline-offset-4">Découvrir nos produits</Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/25">
                {commandes.length} commande{commandes.length > 1 ? 's' : ''}
              </div>
              {commandes.map(cmd => (
                <CommandeCard key={cmd.id} commande={cmd} telephone={phone} />
              ))}
            </div>
          )}

          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/15 text-center mt-12">
            © 2026 Semou Group × CFA CUSEMS Authentique · Récépissé N. 0413/MINT/DGAT/DLP
          </p>
        </div>
      </div>
    )
  }

  /* ── Écran de recherche ── */
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full">
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 w-80 h-60 bg-spruce/20 blur-[100px] rounded-full pointer-events-none" />
        <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/40 hover:text-brass-light transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">CFA CUSEMS Authentique</span>
          <h1 className="font-display text-4xl md:text-5xl mt-2 leading-[1.05] text-paper">Suivi de<br /><span className="italic text-brass-light">commande.</span></h1>
          <p className="font-body text-paper/40 text-sm mt-4 leading-relaxed">Entrez le numéro de téléphone enregistré lors de votre inscription.</p>
        </div>
        <div className="relative bg-surface border border-white/6 rounded-2xl glow-green p-6 md:p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30 block mb-3">Numéro de téléphone</label>
              <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="77 XXX XX XX"
                className="w-full bg-transparent border-b border-white/10 focus:border-brass outline-none font-mono text-xl text-paper pb-2 transition-colors placeholder:text-paper/15" />
            </div>
            {stage === 'error' && errMsg && (
              <div className="flex items-start gap-3 bg-clay/10 border border-clay/25 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-clay flex-shrink-0 mt-0.5" />
                <p className="font-body text-sm text-clay">{errMsg}</p>
              </div>
            )}
            {stage === 'notfound' && (
              <div className="flex items-start gap-3 bg-brass/8 border border-brass/20 rounded-xl p-4">
                <AlertCircle className="w-4 h-4 text-brass flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-body text-sm text-paper/60">Aucun dossier trouvé pour ce numéro.</p>
                  <Link href="/inscription" className="font-body text-sm text-brass-light underline underline-offset-2 mt-1 inline-block">Créer un dossier →</Link>
                </div>
              </div>
            )}
            <button type="submit" disabled={stage === 'loading'}
              className="w-full flex items-center justify-center gap-2 font-body font-medium bg-spruce-light text-paper px-8 py-4 rounded-full hover:bg-spruce transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {stage === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Recherche…</> : <><Search className="w-4 h-4" /> Consulter mon dossier</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
