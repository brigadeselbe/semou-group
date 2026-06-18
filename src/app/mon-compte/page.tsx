'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Clock, XCircle, FileText,
  ExternalLink, LogOut, Loader2,
} from 'lucide-react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFALivraison } from '@/lib/supabase'

const STORAGE_KEY = 'sg_mon_compte_tel'

function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })
}

type CommandeExt = CFACommande & { versements: CFAVersement[]; livraison: CFALivraison | null }
type Result = { client: CFAClient; commandes: CommandeExt[] }

const BADGE: Record<string, string> = {
  VALIDE:     'text-spruce-light bg-spruce/15 border-spruce/25',
  EN_ATTENTE: 'text-brass-light bg-brass/10  border-brass/20',
  EN_COURS:   'text-spruce-light bg-spruce/15 border-spruce/25',
  SOLDE:      'text-paper/50   bg-paper/5   border-paper/10',
  EN_RETARD:  'text-clay       bg-clay/10   border-clay/20',
  PAYE:       'text-spruce-light bg-spruce/15 border-spruce/25',
  ANNULE:     'text-paper/40   bg-paper/4   border-paper/8',
}
const LABEL: Record<string, string> = {
  VALIDE: 'Validé', EN_ATTENTE: 'En attente', EN_COURS: 'En cours',
  SOLDE: 'Soldé', EN_RETARD: 'En retard', PAYE: 'Payé', ANNULE: 'Annulé',
}

function Badge({ s }: { s: string }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${BADGE[s] ?? 'text-paper/50 bg-paper/5 border-paper/8'}`}>
      {LABEL[s] ?? s}
    </span>
  )
}

export default function MonCompte() {
  const [phone,    setPhone]    = useState('')
  const [remember, setRemember] = useState(true)
  const [stage,    setStage]    = useState<'login' | 'loading' | 'result' | 'error'>('login')
  const [errMsg,   setErrMsg]   = useState('')
  const [result,   setResult]   = useState<Result | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) { setPhone(saved); autoLogin(saved) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function autoLogin(tel: string) {
    setStage('loading')
    const { data } = await supabase.rpc('get_dossier_client', { p_telephone: tel })
    if (data) { setResult(data as Result); setStage('result') }
    else       { setStage('login'); localStorage.removeItem(STORAGE_KEY) }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setErrMsg(''); setStage('loading')
    const { data, error } = await supabase.rpc('get_dossier_client', { p_telephone: phone })
    if (error) { setErrMsg(error.message); setStage('error'); return }
    if (!data)  { setErrMsg('Aucun dossier trouvé pour ce numéro.'); setStage('login'); return }
    if (remember) localStorage.setItem(STORAGE_KEY, phone)
    setResult(data as Result)
    setStage('result')
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY)
    setResult(null); setPhone(''); setStage('login')
  }

  /* ── Chargement ── */
  if (stage === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-brass animate-spin" />
    </div>
  )

  /* ── Connexion ── */
  if (stage !== 'result' || !result) return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <Link href="/" className="mb-10"><LogoSG size={44} /></Link>
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl text-paper mb-2">Mon espace</h1>
        <p className="font-body text-sm text-paper/55 mb-8">
          Entrez votre numéro de téléphone pour accéder à votre dossier et suivre vos commandes.
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="tel" required placeholder="7X XXX XX XX"
            value={phone} onChange={e => setPhone(e.target.value)}
            className="w-full bg-surface border border-paper/8 rounded-xl px-4 py-3 font-mono text-sm text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors"
          />
          {errMsg && (
            <div className="flex items-center gap-2 text-clay font-mono text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> {errMsg}
            </div>
          )}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="accent-brass" />
            <span className="font-mono text-xs text-paper/55">Se souvenir de moi sur cet appareil</span>
          </label>
          <button type="submit"
            className="w-full bg-spruce-light text-paper font-body font-medium py-3 rounded-xl hover:bg-spruce transition-colors">
            Accéder à mon espace
          </button>
        </form>
        <div className="flex items-center justify-center gap-4 mt-6">
          <Link href="/suivi" className="font-mono text-[10px] text-paper/35 hover:text-paper/60 transition-colors">
            Suivi rapide →
          </Link>
          <Link href="/inscription" className="font-mono text-[10px] text-paper/35 hover:text-paper/60 transition-colors">
            Créer un dossier →
          </Link>
        </div>
      </div>
    </div>
  )

  const { client, commandes } = result

  /* ── Espace compte ── */
  return (
    <div className="min-h-screen px-4 md:px-8 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/"><LogoSG size={36} /></Link>
            <div>
              <div className="font-display text-lg text-paper leading-tight">Bonjour, {client.prenom}</div>
              <div className="font-mono text-[10px] text-paper/40 uppercase tracking-[0.15em]">Mon espace</div>
            </div>
          </div>
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/40 hover:text-clay border border-paper/8 rounded-full px-3 py-1.5 transition-colors">
            <LogOut className="w-3 h-3" /> Déconnexion
          </button>
        </div>

        {/* Carte dossier */}
        <div className="bg-surface border border-paper/6 rounded-2xl p-5 md:p-6 mb-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/40 mb-1">Dossier</div>
              <div className="font-display text-xl text-paper">{client.prenom} {client.nom}</div>
              {client.matricule && (
                <div className="font-mono text-xs text-paper/45 mt-0.5">{client.matricule}</div>
              )}
            </div>
            <Badge s={client.statut} />
          </div>

          {/* Infos personnelles */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 font-mono text-xs mb-4">
            {([
              ['Corps',     client.corps ?? client.type_fonctionnaire],
              ['Région',    client.region],
              ['Académie',  client.ia],
              ['IEF',       client.ief],
              ['École',     client.ecole],
              ['Grade',     client.grade],
            ] as [string, string | null][]).filter(([, v]) => v).map(([lbl, val]) => (
              <div key={lbl}>
                <div className="text-[9px] uppercase tracking-[0.15em] text-paper/35 mb-0.5">{lbl}</div>
                <div className="text-paper/60">{val}</div>
              </div>
            ))}
          </div>

          {/* Statut documents */}
          <div className="border-t border-paper/6 pt-3 grid grid-cols-2 gap-2">
            {[
              { lbl: 'Bulletin de salaire', ok: client.bulletin_valide },
              { lbl: 'Pièce d\'identité',   ok: client.cni_valide },
            ].map(({ lbl, ok }) => (
              <div key={lbl} className={`flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[10px] border ${
                ok ? 'bg-spruce/10 border-spruce/20 text-spruce-light' : 'bg-paper/4 border-paper/8 text-paper/45'
              }`}>
                {ok
                  ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  : <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                }
                {lbl}{ok ? ' ✓' : ' — en attente'}
              </div>
            ))}
          </div>

          {client.statut === 'EN_ATTENTE' && (
            <p className="mt-3 font-mono text-[10px] text-brass/70 tracking-[0.06em] leading-relaxed">
              Votre dossier est en cours de validation. Vous recevrez un SMS sous 24 à 48h.
            </p>
          )}
        </div>

        {/* Commandes */}
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40 mb-3">
          {commandes.length} commande{commandes.length > 1 ? 's' : ''}
        </div>

        {commandes.length === 0 ? (
          <div className="bg-surface border border-paper/6 rounded-2xl p-10 text-center">
            <div className="font-body text-sm text-paper/50 mb-3">Aucune commande enregistrée.</div>
            <Link href="/produits" className="font-mono text-xs text-brass-light hover:underline">
              Voir le catalogue →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {commandes.map(cmd => {
              const payees  = cmd.versements.filter(v => v.statut === 'PAYE').length
              const total   = cmd.versements.length || cmd.nb_mensualites
              const retards = cmd.versements.filter(v => v.statut === 'EN_RETARD')
              const pct     = total > 0 ? Math.round((payees / total) * 100) : 0

              return (
                <div key={cmd.id} className="bg-surface border border-paper/6 rounded-2xl p-5">
                  {/* En-tête */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="font-mono text-xs font-medium text-brass-light">{cmd.reference}</div>
                      {cmd.produit?.nom && (
                        <div className="font-body text-sm text-paper mt-0.5">{cmd.produit.nom}</div>
                      )}
                    </div>
                    <Badge s={cmd.statut} />
                  </div>

                  {/* Montants */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { lbl: 'Prix total', val: fcfa(cmd.prix_vente),    hi: false },
                      { lbl: 'Versé',      val: fcfa(cmd.apport_paye),   hi: true  },
                      { lbl: 'Reste dû',   val: fcfa(cmd.reste_a_payer), hi: false },
                    ].map(({ lbl, val, hi }) => (
                      <div key={lbl} className="bg-surface-2 rounded-xl px-3 py-2">
                        <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-paper/35 mb-0.5">{lbl}</div>
                        <div className={`font-mono text-xs font-medium ${hi ? 'text-spruce-light' : 'text-paper/65'}`}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barre progression */}
                  {total > 0 && (
                    <div className="mb-3">
                      <div className="flex justify-between font-mono text-[10px] text-paper/40 mb-1">
                        <span>{payees} / {total} versements payés</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-paper/8 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-spruce-light' : 'bg-brass/70'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Alerte retards */}
                  {retards.length > 0 && (
                    <div className="flex items-center gap-2 bg-clay/8 border border-clay/20 rounded-xl px-3 py-2 mb-3">
                      <XCircle className="w-3.5 h-3.5 text-clay flex-shrink-0" />
                      <span className="font-mono text-[10px] text-clay">
                        {retards.length} versement{retards.length > 1 ? 's' : ''} en retard — contactez-nous au plus vite
                      </span>
                    </div>
                  )}

                  {/* Liste versements */}
                  {cmd.versements.length > 0 && (
                    <div className="border-t border-paper/6 pt-3 space-y-2">
                      {cmd.versements.map(v => (
                        <div key={v.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-mono text-[10px] text-paper/50">
                            <span className="w-4 text-paper/35">{v.numero_versement}.</span>
                            <span>{fmtDate(v.date_echeance)}</span>
                            <span className="text-paper/35">{fcfa(v.montant_prevu)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge s={v.statut} />
                            {v.statut === 'PAYE' && (
                              <a
                                href={`/recu/${v.id}?tel=${encodeURIComponent(client.telephone)}`}
                                target="_blank" rel="noreferrer"
                                title="Télécharger le reçu"
                                className="text-paper/30 hover:text-brass transition-colors">
                                <FileText className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Lien paiement */}
                  {cmd.statut === 'EN_COURS' && cmd.reste_a_payer > 0 && (
                    <Link href="/suivi"
                      className="mt-4 flex items-center gap-1.5 font-mono text-[10px] text-brass/60 hover:text-brass-light transition-colors border-t border-paper/6 pt-3">
                      <ExternalLink className="w-3 h-3" /> Payer en ligne via le suivi
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="font-mono text-[10px] text-paper/15 text-center mt-12">
          SEMOU GROUP × CFA CUSEMS Authentique
        </p>
      </div>
    </div>
  )
}
