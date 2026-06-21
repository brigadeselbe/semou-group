'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Search, Loader2, AlertCircle, Package, Truck,
  CheckCircle2, Clock, XCircle, CreditCard, Eye, EyeOff,
  FileText, UserCircle2, MapPin,
} from 'lucide-react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFALivraison } from '@/lib/supabase'

/* ── Utilitaires ── */
function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function maskStr(s: string) {
  if (s.length <= 3) return '•'.repeat(s.length)
  return s.slice(0, 2) + '•'.repeat(Math.max(3, s.length - 3)) + s.slice(-1)
}

/* ── Types ── */
type CommandeWithDetails = CFACommande & { versements: CFAVersement[]; livraison: CFALivraison | null }
type ResultData = { client: CFAClient; commandes: CommandeWithDetails[] }

const STATUT_COLORS: Record<string, string> = {
  VALIDE:     'text-spruce-light bg-spruce/20 border-spruce/30',
  EN_ATTENTE: 'text-brass-light bg-brass/10 border-brass/20',
  EN_COURS:   'text-spruce-light bg-spruce/20 border-spruce/30',
  SOLDE:      'text-paper/55 bg-paper/5 border-paper/10',
  PAYE:       'text-spruce-light bg-spruce/20 border-spruce/30',
  EN_RETARD:  'text-clay bg-clay/10 border-clay/20',
  LIVREE:     'text-spruce-light bg-spruce/20 border-spruce/30',
  ECHEC:      'text-clay bg-clay/10 border-clay/20',
  ANNULEE:    'text-paper/45 bg-paper/5 border-paper/8',
}
const STATUT_LABELS: Record<string, string> = {
  VALIDE: 'Validé', EN_ATTENTE: 'En attente', EN_COURS: 'En cours',
  SOLDE: 'Soldé', PAYE: 'Payé', EN_RETARD: 'En retard',
  LIVREE: 'Livrée', PLANIFIEE: 'Planifiée', EN_ROUTE: 'En route',
  ECHEC: 'Échec', ANNULEE: 'Annulée',
}
function StatutBadge({ statut }: { statut: string }) {
  return (
    <span className={`font-mono text-xs uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${STATUT_COLORS[statut] ?? 'text-paper/55 bg-paper/5 border-paper/8'}`}>
      {STATUT_LABELS[statut] ?? statut}
    </span>
  )
}

/* ── Modal paiement ── */
type PayTarget = { type: 'VERSEMENT' | 'APPORT'; id: string; montant: number; label: string }

function PayModal({ target, telephone, onClose }: { target: PayTarget; telephone: string; onClose: () => void }) {
  const [loading, setLoading] = useState<'wave' | 'orange' | null>(null)
  const [error,   setError]   = useState('')

  async function pay(moyen: 'wave' | 'orange') {
    setLoading(moyen); setError('')
    const res = await fetch(`/api/pay/${moyen}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: target.type, id: target.id, telephone }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Erreur'); setLoading(null); return }
    window.location.href = json.checkout_url
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
      <div className="absolute inset-0 bg-void/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-paper/8 rounded-2xl p-6 w-full max-w-sm">
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/55 mb-1">Paiement sécurisé</div>
        <div className="font-display text-xl text-paper mb-0.5">{target.label}</div>
        <div className="font-mono text-lg text-brass-light mb-6">{fcfa(target.montant)}</div>
        {error && (
          <div className="flex items-start gap-2 bg-clay/10 border border-clay/25 rounded-xl p-3 mb-4 text-clay text-xs font-body">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
        <div className="space-y-3">
          <button onClick={() => pay('wave')} disabled={!!loading}
            className="w-full flex items-center justify-between bg-[#1B75D0] hover:bg-[#1565BA] text-white font-body font-medium px-5 py-3.5 rounded-xl transition-colors disabled:opacity-60">
            <span className="flex items-center gap-3"><CreditCard className="w-4 h-4" />Payer avec Wave</span>
            {loading === 'wave' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="opacity-60 text-sm">→</span>}
          </button>
          <button onClick={() => pay('orange')} disabled={!!loading}
            className="w-full flex items-center justify-between bg-[#F66B00] hover:bg-[#E05C00] text-white font-body font-medium px-5 py-3.5 rounded-xl transition-colors disabled:opacity-60">
            <span className="flex items-center gap-3"><CreditCard className="w-4 h-4" />Payer avec Orange Money</span>
            {loading === 'orange' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="opacity-60 text-sm">→</span>}
          </button>
          <button onClick={onClose} className="w-full font-body text-sm text-paper/55 hover:text-paper/70 py-2 transition-colors">Annuler</button>
        </div>
      </div>
    </div>
  )
}

/* ── Timeline versements ── */
function VersementsTimeline({ versements, canPay, onPay }: {
  versements: CFAVersement[]
  canPay: boolean
  onPay: (t: PayTarget) => void
}) {
  if (versements.length === 0) return null
  return (
    <div className="space-y-0">
      {versements.map((v, i) => {
        const isPaid  = v.statut === 'PAYE'
        const isLate  = v.statut === 'EN_RETARD'
        const isDue   = v.statut === 'EN_ATTENTE'
        const isLast  = i === versements.length - 1

        return (
          <div key={v.id} className="flex gap-4">
            {/* Timeline rail */}
            <div className="flex flex-col items-center flex-shrink-0 w-7">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0 z-10 ${
                isPaid ? 'bg-spruce-light border-spruce-light'
                : isLate ? 'bg-clay/20 border-clay'
                : 'bg-surface border-paper/20'
              }`}>
                {isPaid  ? <CheckCircle2 className="w-3.5 h-3.5 text-paper" />
                : isLate ? <XCircle      className="w-3.5 h-3.5 text-clay" />
                :          <span className="font-mono text-xs text-paper/45">{i + 1}</span>}
              </div>
              {!isLast && (
                <div className={`w-px flex-1 mt-0.5 mb-0.5 min-h-[28px] ${isPaid ? 'bg-spruce-light/40' : 'bg-paper/10'}`} />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className={`font-mono text-xs font-medium ${
                    isPaid ? 'text-spruce-light' : isLate ? 'text-clay' : 'text-paper/70'
                  }`}>
                    {fcfa(v.montant_prevu)}
                  </div>
                  <div className="font-mono text-xs text-paper/65 mt-0.5">{fmtDate(v.date_echeance)}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatutBadge statut={v.statut} />
                  {isPaid && v.id && (
                    <a href={`/recu/${v.id}`} target="_blank" rel="noreferrer"
                      title="Télécharger le reçu"
                      className="flex items-center gap-1 font-mono text-xs text-paper/65 hover:text-brass-light transition-colors border border-paper/10 rounded-full px-2 py-0.5 hover:border-brass/30">
                      <FileText className="w-2.5 h-2.5" /> Reçu
                    </a>
                  )}
                  {canPay && (isDue || isLate) && (
                    <button
                      onClick={() => onPay({ type: 'VERSEMENT', id: v.id, montant: v.montant_prevu, label: `Versement ${i + 1}` })}
                      className="font-mono text-xs uppercase tracking-[0.1em] text-brass-light border border-brass/25 hover:bg-brass/10 px-2.5 py-0.5 rounded-full transition-colors">
                      Payer →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Livraison tracker ── */
const LIV_STEPS = [
  { key: 'EN_ATTENTE', label: 'En attente',  Icon: Clock,         desc: 'Paiement en cours de validation' },
  { key: 'PLANIFIEE',  label: 'Planifiée',   Icon: Package,       desc: 'Livraison programmée' },
  { key: 'EN_ROUTE',   label: 'En route',    Icon: Truck,         desc: 'En cours de livraison' },
  { key: 'LIVREE',     label: 'Livrée',      Icon: CheckCircle2,  desc: 'Produit remis' },
]

function LivraisonTracker({ livraison }: { livraison: CFALivraison | null }) {
  if (!livraison) {
    return (
      <div className="flex items-center gap-3 bg-paper/3 border border-paper/6 rounded-xl px-4 py-3">
        <Package className="w-4 h-4 text-paper/30 flex-shrink-0" />
        <span className="font-mono text-xs text-paper/70 uppercase tracking-[0.1em]">
          Livraison planifiée après validation du dossier
        </span>
      </div>
    )
  }

  const curIdx  = LIV_STEPS.findIndex(s => s.key === livraison.statut)
  const isEchec = livraison.statut === 'ECHEC' || livraison.statut === 'ANNULEE'

  return (
    <div className="space-y-4">
      {/* Steps horizontal */}
      <div className="grid grid-cols-4 gap-1">
        {LIV_STEPS.map((step, i) => {
          const done = !isEchec && i <= curIdx
          const cur  = i === curIdx && !isEchec
          const { Icon } = step
          return (
            <div key={step.key} className="flex flex-col items-center text-center gap-1.5 relative">
              {i > 0 && (
                <div className={`absolute left-0 top-3.5 w-full h-px -translate-y-1/2 ${done ? 'bg-spruce-light/50' : 'bg-paper/8'}`}
                  style={{ left: '-50%', width: '100%' }} />
              )}
              <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                done  ? 'bg-spruce-light border-spruce-light'
                : cur ? 'bg-surface border-brass animate-pulse'
                : 'bg-surface border-paper/15'
              }`}>
                <Icon className={`w-3.5 h-3.5 ${done ? 'text-paper' : cur ? 'text-brass' : 'text-paper/55'}`} />
              </div>
              <span className={`font-mono text-xs uppercase tracking-[0.1em] leading-tight ${
                done ? 'text-spruce-light' : cur ? 'text-brass/80' : 'text-paper/55'
              }`}>{step.label}</span>
            </div>
          )
        })}
      </div>

      {isEchec && (
        <div className="flex items-center gap-2 bg-clay/8 border border-clay/20 rounded-xl px-3 py-2">
          <XCircle className="w-3.5 h-3.5 text-clay flex-shrink-0" />
          <span className="font-mono text-xs text-clay">Livraison {livraison.statut === 'ECHEC' ? 'échouée' : 'annulée'} — contactez-nous</span>
        </div>
      )}

      {/* Détails */}
      <div className="grid grid-cols-2 gap-3">
        {livraison.date_planifiee && (
          <InfoCell label="Date prévue" value={fmtDate(livraison.date_planifiee)} />
        )}
        {livraison.ville_livraison && (
          <InfoCell label="Ville" value={livraison.ville_livraison} icon={<MapPin className="w-3 h-3" />} />
        )}
        {livraison.livreur_nom && (
          <InfoCell label="Livreur" value={`${livraison.livreur_nom}${livraison.livreur_telephone ? ' · ' + livraison.livreur_telephone.replace(/^221/, '') : ''}`} />
        )}
        {livraison.numero_suivi && (
          <InfoCell label="N° suivi" value={livraison.numero_suivi} highlight />
        )}
        {livraison.frais_livraison > 0 && (
          <InfoCell
            label="Frais livraison"
            value={`${fcfa(livraison.frais_livraison)} · ${livraison.frais_payes ? 'Payés' : 'À la réception'}`}
            highlight={!livraison.frais_payes}
          />
        )}
      </div>
    </div>
  )
}

function InfoCell({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className="font-mono text-xs uppercase tracking-[0.12em] text-paper/65 mb-0.5 flex items-center gap-1">
        {icon}{label}
      </div>
      <div className={`font-mono text-xs ${highlight ? 'text-brass-light' : 'text-paper/60'}`}>{value}</div>
    </div>
  )
}

/* ── Carte commande ── */
function CommandeCard({ commande, telephone }: { commande: CommandeWithDetails; telephone: string }) {
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null)
  const [openVers,  setOpenVers]  = useState(true)
  const [openLiv,   setOpenLiv]   = useState(true)

  const payees = commande.versements.filter(v => v.statut === 'PAYE').length
  const total  = commande.versements.length || commande.nb_mensualites
  const pct    = total > 0 ? Math.round((payees / total) * 100) : 0
  const canPay = commande.statut === 'EN_COURS'
  const retards = commande.versements.filter(v => v.statut === 'EN_RETARD').length

  return (
    <div className="bg-surface border border-paper/6 rounded-2xl overflow-hidden">
      {payTarget && <PayModal target={payTarget} telephone={telephone} onClose={() => setPayTarget(null)} />}

      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/65 mb-0.5">Référence</div>
            <div className="font-mono text-sm font-medium text-paper">{commande.reference}</div>
          </div>
          <StatutBadge statut={commande.statut} />
        </div>
        {commande.produit?.nom && (
          <div className="font-body text-sm text-paper/70">{commande.produit.nom}</div>
        )}
      </div>

      {/* Montants + barre */}
      <div className="border-t border-paper/5 px-5 py-4">
        <div className="grid grid-cols-3 gap-px bg-paper/5 rounded-xl overflow-hidden border border-paper/5 mb-4">
          {[
            { lbl: 'Total',  val: fcfa(commande.prix_vente),    hi: false },
            { lbl: 'Versé',  val: fcfa(commande.apport_paye),   hi: true  },
            { lbl: 'Reste',  val: fcfa(commande.reste_a_payer), hi: false },
          ].map(({ lbl, val, hi }) => (
            <div key={lbl} className="bg-surface-2 px-3 py-2.5">
              <div className="font-mono text-xs uppercase tracking-[0.1em] text-paper/65">{lbl}</div>
              <div className={`font-mono text-xs font-medium mt-0.5 ${hi ? 'text-spruce-light' : 'text-paper/65'}`}>{val}</div>
            </div>
          ))}
        </div>

        {/* Progression */}
        {total > 0 && (
          <div>
            <div className="flex justify-between font-mono text-xs text-paper/70 mb-1.5">
              <span>{payees}/{total} mensualités payées</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 bg-paper/8 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-spruce-light' : retards > 0 ? 'bg-clay/70' : 'bg-gradient-to-r from-spruce to-spruce-light'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Alerte retards */}
        {retards > 0 && (
          <div className="flex items-center gap-2 mt-3 bg-clay/8 border border-clay/20 rounded-xl px-3 py-2">
            <XCircle className="w-3.5 h-3.5 text-clay flex-shrink-0" />
            <span className="font-mono text-xs text-clay">
              {retards} versement{retards > 1 ? 's' : ''} en retard — contactez-nous rapidement
            </span>
          </div>
        )}

        {/* Apport non payé */}
        {canPay && commande.apport_paye === 0 && commande.prix_vente > 0 && (
          <button
            onClick={() => setPayTarget({ type: 'APPORT', id: commande.id, montant: commande.prix_vente - commande.nb_mensualites * commande.montant_mensualite, label: 'Apport initial' })}
            className="mt-3 w-full flex items-center justify-center gap-2 font-body text-sm font-medium bg-brass/12 hover:bg-brass/20 border border-brass/25 text-brass-light px-4 py-3 rounded-xl transition-colors">
            <CreditCard className="w-4 h-4" /> Payer l&apos;apport initial
          </button>
        )}
      </div>

      {/* Versements timeline */}
      {commande.versements.length > 0 && (
        <div className="border-t border-paper/5 px-5 pt-4 pb-2">
          <button onClick={() => setOpenVers(v => !v)}
            className="flex items-center justify-between w-full mb-3">
            <span className="font-mono text-xs uppercase tracking-[0.15em] text-paper/70">
              Échéancier · {commande.versements.length} versements
            </span>
            <span className="font-mono text-xs text-paper/30">{openVers ? '▲' : '▼'}</span>
          </button>
          {openVers && (
            <VersementsTimeline
              versements={commande.versements}
              canPay={canPay}
              onPay={setPayTarget}
            />
          )}
        </div>
      )}

      {/* Livraison */}
      <div className="border-t border-paper/5 px-5 pt-4 pb-5">
        <button onClick={() => setOpenLiv(v => !v)}
          className="flex items-center justify-between w-full mb-3">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-paper/70">
            Livraison
          </span>
          <span className="font-mono text-xs text-paper/30">{openLiv ? '▲' : '▼'}</span>
        </button>
        {openLiv && <LivraisonTracker livraison={commande.livraison} />}
      </div>
    </div>
  )
}

/* ── Page principale ── */
type Stage = 'search' | 'loading' | 'result' | 'notfound' | 'error'

export default function Suivi() {
  const [phone,         setPhone]         = useState('')
  const [stage,         setStage]         = useState<Stage>('search')
  const [errMsg,        setErrMsg]        = useState('')
  const [result,        setResult]        = useState<ResultData | null>(null)
  const [showSensitive, setShowSensitive] = useState(false)
  const [payBanner,     setPayBanner]     = useState(false)

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('paiement')
    if (s === 'succes') { setPayBanner(true); setTimeout(() => setPayBanner(false), 6000) }
  }, [])

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault(); setErrMsg(''); setStage('loading')
    const { data, error } = await supabase.rpc('get_dossier_client', { p_telephone: phone })
    if (error) { setErrMsg(error.message); setStage('error'); return }
    if (!data)  { setStage('notfound'); return }
    setResult(data as ResultData)
    setStage('result')
    setShowSensitive(false)
  }

  /* ── Résultat ── */
  if (stage === 'result' && result) {
    const { client, commandes } = result
    return (
      <div className="min-h-screen px-4 md:px-8 py-10">
        <div className="max-w-2xl mx-auto">

          {/* Banner succès paiement */}
          {payBanner && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-spruce-light text-paper font-body text-sm px-5 py-3 rounded-full shadow-lg">
              <CheckCircle2 className="w-4 h-4" /> Paiement confirmé — merci !
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => { setStage('search'); setPhone(''); setResult(null) }}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/55 hover:text-brass-light transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Nouvelle recherche
            </button>
            <Link href="/" className="opacity-60 hover:opacity-100 transition-opacity">
              <LogoSG size={30} />
            </Link>
          </div>

          {/* Bannière Mon espace */}
          <Link href="/mon-compte"
            className="flex items-center justify-between gap-3 bg-brass/6 border border-brass/20 rounded-2xl px-5 py-3.5 mb-5 hover:bg-brass/10 transition-colors group">
            <div className="flex items-center gap-3">
              <UserCircle2 className="w-5 h-5 text-brass-light flex-shrink-0" />
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.15em] text-brass/70">Mon espace personnel</div>
                <div className="font-body text-sm text-paper/70 mt-0.5">Accès permanent à votre dossier sans re-saisir</div>
              </div>
            </div>
            <span className="font-mono text-xs text-brass/60 group-hover:text-brass-light transition-colors flex-shrink-0">→</span>
          </Link>

          {/* Carte client */}
          <div className="bg-surface border border-paper/6 rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/65 mb-0.5">Dossier</div>
                <div className="font-display text-xl text-paper">
                  {showSensitive ? `${client.prenom} ${client.nom}` : `${client.prenom} ${maskStr(client.nom ?? '')}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowSensitive(v => !v)}
                  className="p-1.5 rounded-lg text-paper/65 hover:text-paper/70 hover:bg-paper/8 transition-colors">
                  {showSensitive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <StatutBadge statut={client.statut} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-xs">
              {client.matricule && (
                <InfoCell label="Matricule" value={showSensitive ? client.matricule : maskStr(client.matricule)} />
              )}
              {(client.corps ?? client.type_fonctionnaire) && (
                <InfoCell label="Corps" value={showSensitive ? (client.corps ?? client.type_fonctionnaire ?? '') : '••••'} />
              )}
              {client.region && <InfoCell label="Région" value={client.region} />}
              {client.ia     && <InfoCell label="Académie" value={showSensitive ? client.ia : maskStr(client.ia)} />}
            </div>

            {client.statut === 'EN_ATTENTE' && (
              <div className="mt-3 pt-3 border-t border-dashed border-paper/6 font-mono text-xs text-brass/70 tracking-[0.06em] leading-relaxed">
                Dossier en cours de validation — SMS de confirmation sous 24 à 48h.
              </div>
            )}
          </div>

          {/* Commandes */}
          {commandes.length === 0 ? (
            <div className="text-center py-16 bg-surface border border-paper/6 rounded-2xl">
              <Package className="w-8 h-8 text-paper/20 mx-auto mb-3" />
              <p className="font-body text-paper/55 text-sm mb-3">Aucune commande enregistrée.</p>
              <Link href="/produits" className="font-body text-sm text-brass-light underline underline-offset-4">
                Voir le catalogue →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/65">
                {commandes.length} commande{commandes.length > 1 ? 's' : ''}
              </div>
              {commandes.map(cmd => (
                <CommandeCard key={cmd.id} commande={cmd} telephone={phone} />
              ))}
            </div>
          )}

          <p className="font-mono text-xs text-paper/20 text-center mt-12">
            SEMOU GROUP × CFA CUSEMS Authentique · Récépissé N. 0413/MINT/DGAT/DLP
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

        <Link href="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/55 hover:text-brass-light transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="mb-8">
          <LogoSG size={52} className="mb-4" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">CUSEMS Authentique</span>
          <h1 className="font-display text-4xl md:text-5xl mt-2 leading-[1.05] text-paper">
            Suivi de<br /><span className="italic text-brass-light">commande.</span>
          </h1>
          <p className="font-body text-paper/60 text-sm mt-4 leading-relaxed">
            Entrez le numéro de téléphone enregistré lors de votre inscription.
          </p>
        </div>

        <div className="relative bg-surface border border-paper/6 rounded-2xl glow-green p-6 md:p-8">
          <form onSubmit={handleSearch} className="space-y-6">
            <div>
              <label className="font-mono text-xs uppercase tracking-[0.2em] text-paper/50 block mb-3">
                Numéro de téléphone
              </label>
              <input required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="77 XXX XX XX" autoFocus
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-mono text-xl text-paper pb-2 transition-colors placeholder:text-paper/65" />
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
                  <Link href="/inscription" className="font-body text-sm text-brass-light underline underline-offset-2 mt-1 inline-block">
                    Créer un dossier →
                  </Link>
                </div>
              </div>
            )}

            <button type="submit" disabled={stage === 'loading'}
              className="w-full flex items-center justify-center gap-2 font-body font-medium bg-spruce-light text-paper px-8 py-4 rounded-full hover:bg-spruce transition-colors disabled:opacity-50">
              {stage === 'loading'
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Recherche…</>
                : <><Search className="w-4 h-4" /> Consulter mon dossier</>}
            </button>
          </form>
        </div>

        <Link href="/mon-compte"
          className="flex items-center justify-center gap-2 mt-4 font-mono text-xs uppercase tracking-[0.15em] text-paper/30 hover:text-brass-light transition-colors">
          <UserCircle2 className="w-3.5 h-3.5" /> Accéder à mon espace personnel →
        </Link>
      </div>
    </div>
  )
}
