'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement } from '@/lib/supabase'
import {
  Lock, LogOut, Search, CheckCircle2, XCircle, Loader2, ChevronDown,
  Users, Clock, BadgeCheck, Ban, FileText, ExternalLink,
  ShoppingBag, TrendingUp, AlertCircle,
} from 'lucide-react'

/* ── Types ── */
type CommandeAdmin = CFACommande & {
  client: { prenom: string; nom: string; telephone: string } | null
  produit: { nom: string } | null
  versements: CFAVersement[]
}

type ClientFilter  = 'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE'
type CommandeFilter = 'TOUS' | 'EN_COURS' | 'SOLDE' | 'ANNULE'
type Tab = 'clients' | 'commandes'

/* ── Constantes ── */
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'SEMOU2026'
const SESSION_KEY    = 'sg_admin_session'

const CLIENT_STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  VALIDE:     'text-spruce-light bg-spruce/15 border-spruce/25',
  REJETE:     'text-clay bg-clay/10 border-clay/20',
  SUSPENDU:   'text-paper/40 bg-white/5 border-white/10',
}
const CMD_STATUT_STYLE: Record<string, string> = {
  EN_COURS: 'text-brass bg-brass/10 border-brass/20',
  SOLDE:    'text-spruce-light bg-spruce/15 border-spruce/25',
  ANNULE:   'text-clay bg-clay/10 border-clay/20',
  EN_ATTENTE: 'text-paper/40 bg-white/5 border-white/8',
}
const VER_STATUT_STYLE: Record<string, string> = {
  PAYE:       'text-spruce-light bg-spruce/15 border-spruce/25',
  EN_ATTENTE: 'text-paper/35 bg-white/4 border-white/8',
  EN_RETARD:  'text-clay bg-clay/10 border-clay/20',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function formatFcfa(n: number) {
  return n.toLocaleString('fr-SN') + ' F'
}

function Badge({ statut, styleMap, labelMap }: {
  statut: string
  styleMap: Record<string, string>
  labelMap: Record<string, string>
}) {
  const cls = styleMap[statut] ?? 'text-paper/30 bg-white/5 border-white/8'
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${cls}`}>
      {labelMap[statut] ?? statut}
    </span>
  )
}

function SignedDocLink({ path, label }: { path: string; label: string }) {
  const [url, setUrl]       = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.storage.from('documents').createSignedUrl(path, 3600)
      .then(({ data }) => { setUrl(data?.signedUrl ?? null); setLoading(false) })
  }, [path])
  if (loading) return <span className="font-mono text-[10px] text-paper/25">Chargement…</span>
  if (!url)    return <span className="font-mono text-[10px] text-clay">Inaccessible</span>
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-brass-light border border-brass/20 rounded-full px-2.5 py-1 hover:bg-brass/10 transition-colors">
      <FileText className="w-3 h-3" />{label}<ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </a>
  )
}

/* ══════════════════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════════════════ */
export default function Admin() {
  const [stage,   setStage]   = useState<'login' | 'loading' | 'dashboard'>('login')
  const [pwd,     setPwd]     = useState('')
  const [pwdErr,  setPwdErr]  = useState('')
  const [adminPwd, setAdminPwd] = useState('')
  const [tab,     setTab]     = useState<Tab>('clients')

  /* ── Clients ── */
  const [clients,    setClients]    = useState<CFAClient[]>([])
  const [cliFilter,  setCliFilter]  = useState<ClientFilter>('TOUS')
  const [cliSearch,  setCliSearch]  = useState('')
  const [expanding,  setExpanding]  = useState<string | null>(null)
  const [updating,   setUpdating]   = useState<string | null>(null)

  /* ── Commandes ── */
  const [commandes,    setCommandes]    = useState<CommandeAdmin[]>([])
  const [cmdLoading,   setCmdLoading]   = useState(false)
  const [cmdLoaded,    setCmdLoaded]    = useState(false)
  const [cmdFilter,    setCmdFilter]    = useState<CommandeFilter>('TOUS')
  const [cmdSearch,    setCmdSearch]    = useState('')
  const [cmdExpanding, setCmdExpanding] = useState<string | null>(null)

  /* Restaurer session */
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
    if (saved) { setAdminPwd(saved); loadClients(saved) }
  }, []) // eslint-disable-line

  const loadClients = useCallback(async (pwd?: string) => {
    setStage('loading')
    const { data, error } = await supabase.from('cfa_clients').select('*').order('created_at', { ascending: false })
    if (error || !data) { setStage('login'); return }
    setClients(data as CFAClient[])
    setStage('dashboard')
  }, [])

  const loadCommandes = useCallback(async () => {
    if (cmdLoaded) return
    setCmdLoading(true)
    const { data: cmds } = await supabase
      .from('cfa_commandes')
      .select('*, client:cfa_clients(prenom, nom, telephone), produit:cfa_produits(nom)')
      .order('created_at', { ascending: false })
    if (!cmds) { setCmdLoading(false); return }

    const ids = cmds.map(c => c.id)
    const { data: vers } = ids.length > 0
      ? await supabase.from('cfa_versements').select('*').in('commande_id', ids).order('numero_versement')
      : { data: [] }

    const versMap: Record<string, CFAVersement[]> = {}
    ;(vers ?? []).forEach(v => {
      if (!versMap[v.commande_id]) versMap[v.commande_id] = []
      versMap[v.commande_id].push(v)
    })

    setCommandes(cmds.map(c => ({ ...c, versements: versMap[c.id] ?? [] })) as CommandeAdmin[])
    setCmdLoaded(true)
    setCmdLoading(false)
  }, [cmdLoaded])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pwd !== ADMIN_PASSWORD) { setPwdErr('Mot de passe incorrect.'); return }
    localStorage.setItem(SESSION_KEY, pwd)
    setAdminPwd(pwd)
    loadClients(pwd)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setAdminPwd(''); setClients([]); setCommandes([])
    setCmdLoaded(false); setStage('login'); setPwd('')
  }

  async function handleUpdateStatut(clientId: string, newStatut: string) {
    setUpdating(clientId)
    const { error } = await supabase.rpc('admin_update_client_statut', {
      p_client_id: clientId, p_statut: newStatut, p_password: adminPwd,
    })
    if (error) {
      alert('Erreur : ' + (error.message.includes('28P01') ? 'Mot de passe incorrect' : error.message))
    } else {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, statut: newStatut } : c))
    }
    setUpdating(null)
  }

  function switchTab(t: Tab) {
    setTab(t)
    if (t === 'commandes' && !cmdLoaded) loadCommandes()
  }

  /* ── Filtres clients ── */
  const filteredClients = clients.filter(c => {
    const ok = cliFilter === 'TOUS' || c.statut === cliFilter
    const q  = cliSearch.toLowerCase()
    return ok && (!q || [c.prenom, c.nom, c.telephone, c.matricule ?? '', c.region ?? ''].some(v => v.toLowerCase().includes(q)))
  })

  /* ── Filtres commandes ── */
  const filteredCmds = commandes.filter(c => {
    const ok = cmdFilter === 'TOUS' || c.statut === cmdFilter
    const q  = cmdSearch.toLowerCase()
    const nom = `${c.client?.prenom ?? ''} ${c.client?.nom ?? ''}`.toLowerCase()
    return ok && (!q || nom.includes(q) || c.reference.toLowerCase().includes(q) || (c.produit?.nom ?? '').toLowerCase().includes(q))
  })

  /* Stats */
  const cStats = {
    total: clients.length,
    attente: clients.filter(c => c.statut === 'EN_ATTENTE').length,
    valide:  clients.filter(c => c.statut === 'VALIDE').length,
    rejete:  clients.filter(c => c.statut === 'REJETE').length,
  }
  const cmdStats = {
    total:    commandes.length,
    en_cours: commandes.filter(c => c.statut === 'EN_COURS').length,
    solde:    commandes.filter(c => c.statut === 'SOLDE').length,
    ca:       commandes.reduce((s, c) => s + c.apport_paye, 0),
  }

  const CLIENT_LABELS: Record<string, string>  = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté', SUSPENDU: 'Suspendu' }
  const CMD_LABELS: Record<string, string>     = { EN_COURS: 'En cours', SOLDE: 'Soldé', ANNULE: 'Annulé', EN_ATTENTE: 'En attente' }
  const VER_LABELS: Record<string, string>     = { PAYE: 'Payé', EN_ATTENTE: 'À venir', EN_RETARD: 'En retard' }

  /* ── LOGIN ── */
  if (stage === 'login') return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="relative max-w-sm w-full">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-60 h-40 bg-brass/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative bg-surface border border-white/6 rounded-2xl p-8 md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-brass/10 border border-brass/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-brass" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30">Accès restreint</div>
              <div className="font-display text-lg text-paper leading-tight">Administration</div>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30 block mb-2">Mot de passe</label>
              <input type="password" required value={pwd} onChange={e => { setPwd(e.target.value); setPwdErr('') }}
                placeholder="••••••••"
                className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-base text-paper pb-2 transition-colors placeholder:text-paper/15" />
              {pwdErr && <p className="font-mono text-[10px] text-clay mt-2">{pwdErr}</p>}
            </div>
            <button type="submit" className="w-full font-body font-medium bg-spruce-light text-paper py-3 rounded-full hover:bg-spruce transition-colors">
              Accéder au tableau de bord
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  if (stage === 'loading') return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-brass animate-spin" />
    </div>
  )

  /* ── DASHBOARD ── */
  return (
    <div className="min-h-screen px-4 md:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brass">CFA CUSEMS</div>
          <h1 className="font-display text-2xl md:text-3xl text-paper mt-0.5">
            Administration <span className="italic text-brass-light">Semou Group</span>
          </h1>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 font-mono text-xs text-paper/35 hover:text-clay border border-white/8 rounded-full px-4 py-2 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Déconnexion
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'clients',   label: 'Dossiers clients', icon: Users },
          { key: 'commandes', label: 'Commandes',        icon: ShoppingBag },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] px-4 py-2 rounded-lg transition-colors ${
              tab === key ? 'bg-void text-brass border border-brass/20' : 'text-paper/35 hover:text-paper/60'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ════════════ TAB CLIENTS ════════════ */}
      {tab === 'clients' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Users,      val: cStats.total,   lbl: 'Total',       color: 'text-paper' },
              { icon: Clock,      val: cStats.attente, lbl: 'En attente',  color: 'text-brass-light' },
              { icon: BadgeCheck, val: cStats.valide,  lbl: 'Validés',     color: 'text-spruce-light' },
              { icon: Ban,        val: cStats.rejete,  lbl: 'Rejetés',     color: 'text-clay' },
            ].map(({ icon: Icon, val, lbl, color }) => (
              <div key={lbl} className="bg-surface border border-white/6 rounded-xl p-4">
                <Icon className={`w-4 h-4 ${color} mb-2 opacity-60`} />
                <div className={`font-display text-2xl md:text-3xl ${color}`}>{val}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30 mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Recherche + filtre */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/25" />
              <input type="text" placeholder="Nom, téléphone, matricule, région…"
                value={cliSearch} onChange={e => setCliSearch(e.target.value)}
                className="w-full bg-surface border border-white/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/20 focus:border-brass/40 outline-none transition-colors" />
            </div>
            <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1">
              {(['TOUS', 'EN_ATTENTE', 'VALIDE', 'REJETE'] as ClientFilter[]).map(f => (
                <button key={f} onClick={() => setCliFilter(f)}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg transition-colors ${
                    cliFilter === f ? 'bg-void text-brass border border-brass/20' : 'text-paper/35 hover:text-paper/60'
                  }`}>
                  {f === 'TOUS' ? 'Tous' : f === 'EN_ATTENTE' ? 'Attente' : f === 'VALIDE' ? 'Validés' : 'Rejetés'}
                </button>
              ))}
            </div>
          </div>

          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/25 mb-3">
            {filteredClients.length} dossier{filteredClients.length > 1 ? 's' : ''}
          </div>

          {/* Table clients */}
          <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
            {filteredClients.length === 0
              ? <div className="py-16 text-center font-body text-paper/30 text-sm">Aucun dossier trouvé.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Nom & Prénom', 'Téléphone', 'Matricule', 'Corps / Région', 'Date', 'Statut', 'Actions'].map(h => (
                          <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25 px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client, i) => (
                        <>
                          <tr key={client.id}
                            className={`border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer ${i % 2 ? 'bg-void/30' : ''}`}
                            onClick={() => setExpanding(expanding === client.id ? null : client.id)}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-body text-sm font-medium text-paper">{client.prenom} {client.nom}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-paper/55">{client.telephone.replace(/^221/, '')}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-paper/55">{client.matricule ?? '—'}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-body text-xs text-paper/45">
                                {client.corps ?? client.type_fonctionnaire ?? '—'}{client.region ? ` · ${client.region}` : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-paper/35">{formatDate(client.created_at)}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge statut={client.statut} styleMap={CLIENT_STATUT_STYLE} labelMap={CLIENT_LABELS} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                {updating === client.id ? <Loader2 className="w-4 h-4 text-brass animate-spin" /> : (
                                  <>
                                    {client.statut !== 'VALIDE' && (
                                      <button onClick={() => handleUpdateStatut(client.id, 'VALIDE')}
                                        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-spruce-light border border-spruce/30 rounded-full px-2.5 py-1 hover:bg-spruce/15 transition-colors">
                                        <CheckCircle2 className="w-3 h-3" /> Valider
                                      </button>
                                    )}
                                    {client.statut !== 'REJETE' && (
                                      <button onClick={() => handleUpdateStatut(client.id, 'REJETE')}
                                        className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-clay border border-clay/30 rounded-full px-2.5 py-1 hover:bg-clay/10 transition-colors">
                                        <XCircle className="w-3 h-3" /> Rejeter
                                      </button>
                                    )}
                                    <ChevronDown className={`w-3.5 h-3.5 text-paper/20 transition-transform ${expanding === client.id ? 'rotate-180' : ''}`} />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Détail client */}
                          {expanding === client.id && (
                            <tr key={`${client.id}-d`} className="bg-void/50 border-b border-white/4">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  {[
                                    { lbl: 'IA / Académie', val: client.ia },
                                    { lbl: 'IEF', val: client.ief },
                                    { lbl: 'École / Poste', val: client.ecole },
                                    { lbl: 'Type agent', val: client.type_enseignant },
                                    { lbl: 'Ministère', val: client.ministere },
                                    { lbl: 'Grade', val: client.grade },
                                  ].map(({ lbl, val }) => val ? (
                                    <div key={lbl}>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-0.5">{lbl}</div>
                                      <div className="font-body text-paper/55 text-xs">{val}</div>
                                    </div>
                                  ) : null)}
                                  {client.cni_url && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-1.5">CNI Recto</div>
                                      <SignedDocLink path={client.cni_url} label="Ouvrir CNI recto" />
                                    </div>
                                  )}
                                  {client.notes?.startsWith('CNI_VERSO:') && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-1.5">CNI Verso</div>
                                      <SignedDocLink path={client.notes.replace('CNI_VERSO:', '')} label="Ouvrir CNI verso" />
                                    </div>
                                  )}
                                  {client.bulletin_url && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-1.5">Bulletin salaire</div>
                                      <SignedDocLink path={client.bulletin_url} label="Ouvrir bulletin" />
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </>
      )}

      {/* ════════════ TAB COMMANDES ════════════ */}
      {tab === 'commandes' && (
        <>
          {/* Stats commandes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { icon: ShoppingBag, val: cmdStats.total,                    lbl: 'Total commandes', color: 'text-paper' },
              { icon: Clock,       val: cmdStats.en_cours,                 lbl: 'En cours',        color: 'text-brass-light' },
              { icon: BadgeCheck,  val: cmdStats.solde,                    lbl: 'Soldées',         color: 'text-spruce-light' },
              { icon: TrendingUp,  val: formatFcfa(cmdStats.ca),           lbl: 'Total versé',     color: 'text-brass-light' },
            ].map(({ icon: Icon, val, lbl, color }) => (
              <div key={lbl} className="bg-surface border border-white/6 rounded-xl p-4">
                <Icon className={`w-4 h-4 ${color} mb-2 opacity-60`} />
                <div className={`font-display text-xl md:text-2xl ${color} leading-tight`}>{val}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30 mt-0.5">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Recherche + filtre */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/25" />
              <input type="text" placeholder="Référence, client, produit…"
                value={cmdSearch} onChange={e => setCmdSearch(e.target.value)}
                className="w-full bg-surface border border-white/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/20 focus:border-brass/40 outline-none transition-colors" />
            </div>
            <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1">
              {(['TOUS', 'EN_COURS', 'SOLDE', 'ANNULE'] as CommandeFilter[]).map(f => (
                <button key={f} onClick={() => setCmdFilter(f)}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg transition-colors ${
                    cmdFilter === f ? 'bg-void text-brass border border-brass/20' : 'text-paper/35 hover:text-paper/60'
                  }`}>
                  {f === 'TOUS' ? 'Tous' : f === 'EN_COURS' ? 'En cours' : f === 'SOLDE' ? 'Soldées' : 'Annulées'}
                </button>
              ))}
            </div>
          </div>

          {cmdLoading
            ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 text-brass animate-spin" /></div>
            : (
              <>
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/25 mb-3">
                  {filteredCmds.length} commande{filteredCmds.length > 1 ? 's' : ''}
                </div>

                <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
                  {filteredCmds.length === 0
                    ? <div className="py-16 text-center font-body text-paper/30 text-sm">Aucune commande trouvée.</div>
                    : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/5">
                              {['Référence', 'Client', 'Produit', 'Total', 'Versé', 'Reste', 'Mensualités', 'Statut'].map(h => (
                                <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25 px-4 py-3 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCmds.map((cmd, i) => {
                              const payees = cmd.versements.filter(v => v.statut === 'PAYE').length
                              const total  = cmd.versements.length || cmd.nb_mensualites
                              const retard = cmd.versements.filter(v => v.statut === 'EN_RETARD').length
                              return (
                                <>
                                  <tr key={cmd.id}
                                    className={`border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer ${i % 2 ? 'bg-void/30' : ''}`}
                                    onClick={() => setCmdExpanding(cmdExpanding === cmd.id ? null : cmd.id)}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="font-mono text-xs text-brass-light">{cmd.reference}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="font-body text-sm text-paper">{cmd.client?.prenom} {cmd.client?.nom}</div>
                                      <div className="font-mono text-[10px] text-paper/35">{cmd.client?.telephone.replace(/^221/, '')}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="font-body text-xs text-paper/60">{cmd.produit?.nom ?? '—'}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="font-mono text-xs text-paper/60">{formatFcfa(cmd.prix_vente)}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="font-mono text-xs text-spruce-light">{formatFcfa(cmd.apport_paye)}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`font-mono text-xs ${cmd.reste_a_payer > 0 ? 'text-clay' : 'text-spruce-light'}`}>
                                        {formatFcfa(cmd.reste_a_payer)}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1 bg-void rounded-full overflow-hidden">
                                          <div className="h-full bg-spruce-light rounded-full" style={{ width: total > 0 ? `${Math.round(payees/total*100)}%` : '0%' }} />
                                        </div>
                                        <span className="font-mono text-[10px] text-paper/40">{payees}/{total}</span>
                                        {retard > 0 && <AlertCircle className="w-3 h-3 text-clay" />}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <Badge statut={cmd.statut} styleMap={CMD_STATUT_STYLE} labelMap={CMD_LABELS} />
                                    </td>
                                  </tr>

                                  {/* Détail versements */}
                                  {cmdExpanding === cmd.id && (
                                    <tr key={`${cmd.id}-d`} className="bg-void/50 border-b border-white/4">
                                      <td colSpan={8} className="px-4 py-4">
                                        <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.15em] text-paper/30">
                                          Échéancier · {cmd.montant_mensualite > 0 ? `${formatFcfa(cmd.montant_mensualite)} / mois` : ''}
                                          {cmd.date_fin_prevue ? ` · Fin prévue ${formatDate(cmd.date_fin_prevue)}` : ''}
                                        </div>
                                        {cmd.versements.length === 0
                                          ? <p className="font-body text-paper/30 text-xs">Aucun versement enregistré.</p>
                                          : (
                                            <div className="space-y-1.5 max-w-xl">
                                              {cmd.versements.map(v => (
                                                <div key={v.id} className="flex items-center justify-between gap-4 font-mono text-xs">
                                                  <span className="text-paper/35 w-6">#{v.numero_versement}</span>
                                                  <span className="text-paper/40 flex-1">{formatDate(v.date_echeance)}</span>
                                                  <span className="text-paper/60 w-24 text-right">{formatFcfa(v.montant_prevu)}</span>
                                                  {v.date_paiement && (
                                                    <span className="text-paper/30 hidden md:inline">payé le {formatDate(v.date_paiement)}</span>
                                                  )}
                                                  <Badge statut={v.statut} styleMap={VER_STATUT_STYLE} labelMap={VER_LABELS} />
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                </div>
              </>
            )}
        </>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/12 text-center mt-8">
        Semou Group × CFA CUSEMS · Tableau de bord administrateur · Usage interne
      </p>
    </div>
  )
}
