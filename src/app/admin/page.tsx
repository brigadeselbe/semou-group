'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFAProduit } from '@/lib/supabase'
import {
  Lock, LogOut, Search, CheckCircle2, XCircle, Loader2, ChevronDown,
  Users, FileText, ExternalLink, ShoppingBag,
  TrendingUp, AlertCircle, Package, Plus, Edit2, Trash2, ToggleLeft,
  ToggleRight, Star, MapPin,
} from 'lucide-react'

/* ── Types ── */
type CommandeAdmin = CFACommande & {
  client:    { prenom: string; nom: string; telephone: string } | null
  produit:   { nom: string } | null
  versements: CFAVersement[]
}
type DashStats = {
  total_clients: number; en_attente: number; valides: number; rejetes: number
  total_commandes: number; commandes_en_cours: number; commandes_soldees: number
  versements_payes: number; versements_retard: number; fcfa_collectes: number
  regions: { region: string; nb_clients: number }[] | null
}
type ClientFilter   = 'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE'
type CommandeFilter = 'TOUS' | 'EN_COURS' | 'SOLDE' | 'ANNULE'
type Tab = 'dashboard' | 'clients' | 'commandes' | 'produits'

/* ── Constantes ── */
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'SEMOU2026'
const SESSION_KEY    = 'sg_admin_session'

const CLI_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  VALIDE:     'text-spruce-light bg-spruce/15 border-spruce/25',
  REJETE:     'text-clay bg-clay/10 border-clay/20',
  SUSPENDU:   'text-paper/40 bg-white/5 border-white/10',
}
const CMD_STYLE: Record<string, string> = {
  EN_COURS: 'text-brass bg-brass/10 border-brass/20',
  SOLDE:    'text-spruce-light bg-spruce/15 border-spruce/25',
  ANNULE:   'text-clay bg-clay/10 border-clay/20',
}
const VER_STYLE: Record<string, string> = {
  PAYE:       'text-spruce-light bg-spruce/15 border-spruce/25',
  EN_ATTENTE: 'text-paper/35 bg-white/4 border-white/8',
  EN_RETARD:  'text-clay bg-clay/10 border-clay/20',
}
const CLI_LBL: Record<string, string>  = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté', SUSPENDU: 'Suspendu' }
const CMD_LBL: Record<string, string>  = { EN_COURS: 'En cours', SOLDE: 'Soldé', ANNULE: 'Annulé', EN_ATTENTE: 'En attente' }
const VER_LBL: Record<string, string>  = { PAYE: 'Payé', EN_ATTENTE: 'À venir', EN_RETARD: 'En retard' }

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

function Badge({ statut, s, l }: { statut: string; s: Record<string, string>; l: Record<string, string> }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${s[statut] ?? 'text-paper/30 bg-white/5 border-white/8'}`}>
      {l[statut] ?? statut}
    </span>
  )
}

function SignedDocLink({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
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

/* ── Formulaire produit ── */
const EMPTY_PRODUIT = {
  nom: '', description: '', prix_vente: 0, apport_minimum: 0,
  nb_mensualites_max: 6, stock: 1, stock_illimite: false,
  actif: true, en_vedette: false, etat: 'NEUF',
}
type ProduitForm = typeof EMPTY_PRODUIT

/* ══════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════ */
export default function Admin() {
  const [stage,    setStage]    = useState<'login' | 'loading' | 'dashboard'>('login')
  const [pwd,      setPwd]      = useState('')
  const [pwdErr,   setPwdErr]   = useState('')
  const [adminPwd, setAdminPwd] = useState('')
  const [tab,      setTab]      = useState<Tab>('dashboard')

  /* Clients */
  const [clients,   setClients]   = useState<CFAClient[]>([])
  const [cliSearch, setCliSearch] = useState('')
  const [cliFilter, setCliFilter] = useState<ClientFilter>('TOUS')
  const [cliExpand, setCliExpand] = useState<string | null>(null)
  const [updating,  setUpdating]  = useState<string | null>(null)

  /* Commandes */
  const [commandes,  setCommandes]  = useState<CommandeAdmin[]>([])
  const [cmdLoaded,  setCmdLoaded]  = useState(false)
  const [cmdLoading, setCmdLoading] = useState(false)
  const [cmdFilter,  setCmdFilter]  = useState<CommandeFilter>('TOUS')
  const [cmdSearch,  setCmdSearch]  = useState('')
  const [cmdExpand,  setCmdExpand]  = useState<string | null>(null)

  /* Produits */
  const [produits,    setProduits]    = useState<CFAProduit[]>([])
  const [prodLoaded,  setProdLoaded]  = useState(false)
  const [prodLoading, setProdLoading] = useState(false)
  const [editProd,    setEditProd]    = useState<CFAProduit | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [prodForm,    setProdForm]    = useState<ProduitForm>(EMPTY_PRODUIT)
  const [savingProd,  setSavingProd]  = useState(false)

  /* Stats */
  const [stats,      setStats]      = useState<DashStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [matSearch,  setMatSearch]  = useState('')
  const [matResult,  setMatResult]  = useState<CFAClient | null | 'none'>('none')
  const [matLoading, setMatLoading] = useState(false)

  /* Restaurer session */
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
    if (saved) { setAdminPwd(saved); loadAll(saved) }
  }, []) // eslint-disable-line

  async function loadAll(pwd: string) {
    setStage('loading')
    const [{ data: cls }] = await Promise.all([
      supabase.from('cfa_clients').select('*').order('created_at', { ascending: false }),
    ])
    if (!cls) { setStage('login'); return }
    setClients(cls as CFAClient[])
    setStage('dashboard')
    loadStats(pwd)
  }

  async function loadStats(pwd: string) {
    setStatsLoading(true)
    const { data, error } = await supabase.rpc('admin_get_stats', { p_password: pwd })
    if (!error && data) setStats(data as DashStats)
    setStatsLoading(false)
  }

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
    const vm: Record<string, CFAVersement[]> = {}
    ;(vers ?? []).forEach(v => { if (!vm[v.commande_id]) vm[v.commande_id] = []; vm[v.commande_id].push(v) })
    setCommandes(cmds.map(c => ({ ...c, versements: vm[c.id] ?? [] })) as CommandeAdmin[])
    setCmdLoaded(true); setCmdLoading(false)
  }, [cmdLoaded])

  const loadProduits = useCallback(async () => {
    if (prodLoaded) return
    setProdLoading(true)
    const { data } = await supabase.from('cfa_produits').select('*').order('created_at', { ascending: false })
    if (data) { setProduits(data as CFAProduit[]); setProdLoaded(true) }
    setProdLoading(false)
  }, [prodLoaded])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pwd !== ADMIN_PASSWORD) { setPwdErr('Mot de passe incorrect.'); return }
    localStorage.setItem(SESSION_KEY, pwd); setAdminPwd(pwd); loadAll(pwd)
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setAdminPwd(''); setClients([]); setCommandes([]); setProduits([])
    setCmdLoaded(false); setProdLoaded(false); setStats(null)
    setStage('login'); setPwd('')
  }

  async function handleUpdateStatut(clientId: string, newStatut: string) {
    setUpdating(clientId)
    const { error } = await supabase.rpc('admin_update_client_statut', {
      p_client_id: clientId, p_statut: newStatut, p_password: adminPwd,
    })
    if (error) { alert('Erreur : ' + error.message); setUpdating(null); return }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, statut: newStatut } : c))
    // SMS notification (non bloquant)
    if (newStatut === 'VALIDE' || newStatut === 'REJETE') {
      fetch('/api/sms/statut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, statut: newStatut, password: adminPwd }),
      }).catch(() => null)
    }
    setUpdating(null)
  }

  async function handleMatSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!matSearch.trim()) return
    setMatLoading(true); setMatResult('none')
    const { data } = await supabase.from('cfa_clients').select('*')
      .ilike('matricule', `%${matSearch.trim()}%`).limit(1).single()
    setMatResult(data ? data as CFAClient : null)
    setMatLoading(false)
  }

  /* Produit form */
  function openNewProd() {
    setEditProd(null); setProdForm(EMPTY_PRODUIT); setShowForm(true)
  }
  function openEditProd(p: CFAProduit) {
    setEditProd(p)
    setProdForm({
      nom: p.nom, description: p.description ?? '', prix_vente: p.prix_vente,
      apport_minimum: p.apport_minimum, nb_mensualites_max: p.nb_mensualites_max,
      stock: p.stock, stock_illimite: p.stock_illimite, actif: p.actif,
      en_vedette: p.en_vedette, etat: p.etat,
    })
    setShowForm(true)
  }
  async function handleSaveProd(e: React.FormEvent) {
    e.preventDefault()
    setSavingProd(true)
    const { error } = await supabase.rpc('admin_upsert_produit', {
      p_password:       adminPwd,
      p_id:             editProd?.id ?? null,
      p_nom:            prodForm.nom,
      p_description:    prodForm.description || null,
      p_prix_vente:     Number(prodForm.prix_vente),
      p_apport_minimum: Number(prodForm.apport_minimum),
      p_nb_mensualites: Number(prodForm.nb_mensualites_max),
      p_stock:          Number(prodForm.stock),
      p_stock_illimite: prodForm.stock_illimite,
      p_actif:          prodForm.actif,
      p_en_vedette:     prodForm.en_vedette,
      p_etat:           prodForm.etat,
    })
    if (error) { alert('Erreur : ' + error.message); setSavingProd(false); return }
    setProdLoaded(false); await loadProduits()
    setShowForm(false); setSavingProd(false)
  }
  async function handleDeleteProd(id: string) {
    if (!confirm('Supprimer ce produit ?')) return
    const { error } = await supabase.rpc('admin_delete_produit', { p_password: adminPwd, p_id: id })
    if (error) alert('Erreur : ' + error.message)
    else setProduits(prev => prev.filter(p => p.id !== id))
  }
  async function handleToggleActif(p: CFAProduit) {
    const { error } = await supabase.rpc('admin_upsert_produit', {
      p_password: adminPwd, p_id: p.id,
      p_nom: p.nom, p_description: p.description, p_prix_vente: p.prix_vente,
      p_apport_minimum: p.apport_minimum, p_nb_mensualites: p.nb_mensualites_max,
      p_stock: p.stock, p_stock_illimite: p.stock_illimite, p_actif: !p.actif,
      p_en_vedette: p.en_vedette, p_etat: p.etat,
    })
    if (!error) setProduits(prev => prev.map(x => x.id === p.id ? { ...x, actif: !p.actif } : x))
  }

  function switchTab(t: Tab) {
    setTab(t)
    if (t === 'commandes' && !cmdLoaded) loadCommandes()
    if (t === 'produits'  && !prodLoaded) loadProduits()
  }

  const filteredClients = clients.filter(c => {
    const ok = cliFilter === 'TOUS' || c.statut === cliFilter
    const q  = cliSearch.toLowerCase()
    return ok && (!q || [c.prenom, c.nom, c.telephone, c.matricule ?? '', c.region ?? ''].some(v => v.toLowerCase().includes(q)))
  })
  const filteredCmds = commandes.filter(c => {
    const ok = cmdFilter === 'TOUS' || c.statut === cmdFilter
    const q  = cmdSearch.toLowerCase()
    const nom = `${c.client?.prenom ?? ''} ${c.client?.nom ?? ''}`.toLowerCase()
    return ok && (!q || nom.includes(q) || c.reference.toLowerCase().includes(q) || (c.produit?.nom ?? '').toLowerCase().includes(q))
  })

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
              <div className="font-display text-lg text-paper">Administration</div>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30 block mb-2">Mot de passe</label>
              <input type="password" required value={pwd}
                onChange={e => { setPwd(e.target.value); setPwdErr('') }}
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
  const TABS: { key: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: 'dashboard', label: 'Vue d\'ensemble', icon: TrendingUp },
    { key: 'clients',   label: 'Dossiers',        icon: Users },
    { key: 'commandes', label: 'Commandes',        icon: ShoppingBag },
    { key: 'produits',  label: 'Produits',         icon: Package },
  ]

  return (
    <div className="min-h-screen px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brass">CFA CUSEMS</div>
          <h1 className="font-display text-2xl md:text-3xl text-paper mt-0.5">
            Tableau de bord <span className="italic text-brass-light">administrateur</span>
          </h1>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 font-mono text-xs text-paper/35 hover:text-clay border border-white/8 rounded-full px-4 py-2 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Déconnexion
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1 mb-6 w-fit overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] px-3 md:px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              tab === key ? 'bg-void text-brass border border-brass/20' : 'text-paper/35 hover:text-paper/60'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ═══════ VUE D'ENSEMBLE ═══════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statsLoading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-surface border border-white/6 rounded-xl p-4 animate-pulse h-24" />
                ))
              : [
                  { emoji: '👨‍🏫', val: stats?.total_clients ?? clients.length, lbl: 'Fonctionnaires inscrits', color: 'text-paper' },
                  { emoji: '✅', val: stats?.versements_payes ?? 0,  lbl: 'Paiements à jour',         color: 'text-spruce-light' },
                  { emoji: '⚠️', val: stats?.versements_retard ?? 0, lbl: 'Versements en retard',     color: 'text-clay' },
                  { emoji: '💰', val: fcfa(stats?.fcfa_collectes ?? 0), lbl: 'FCFA collectés',        color: 'text-brass-light' },
                ].map(({ emoji, val, lbl, color }) => (
                  <div key={lbl} className="bg-surface border border-white/6 rounded-xl p-4">
                    <div className="text-xl mb-2">{emoji}</div>
                    <div className={`font-display text-xl md:text-2xl ${color} leading-tight`}>{val}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30 mt-0.5">{lbl}</div>
                  </div>
                ))}
          </div>

          {/* Commandes stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: stats?.total_commandes ?? 0,    lbl: 'Total commandes',  color: 'text-paper' },
              { val: stats?.commandes_en_cours ?? 0, lbl: 'En cours',         color: 'text-brass-light' },
              { val: stats?.commandes_soldees ?? 0,  lbl: 'Soldées',          color: 'text-spruce-light' },
            ].map(({ val, lbl, color }) => (
              <div key={lbl} className="bg-surface border border-white/6 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className={`font-display text-2xl ${color}`}>{val}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Recherche matricule */}
          <div className="bg-surface border border-white/6 rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-brass" />
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/50">Recherche par matricule</div>
            </div>
            <form onSubmit={handleMatSearch} className="flex gap-3">
              <input type="text" value={matSearch} onChange={e => setMatSearch(e.target.value)}
                placeholder="ex : 300501163/E"
                className="flex-1 bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-sm text-paper pb-2 placeholder:text-paper/15 transition-colors" />
              <button type="submit" disabled={matLoading}
                className="font-mono text-xs text-brass border border-brass/30 rounded-full px-4 py-1.5 hover:bg-brass/10 transition-colors disabled:opacity-50">
                {matLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Chercher'}
              </button>
            </form>

            {matResult === null && (
              <p className="font-body text-sm text-clay mt-4">Aucun fonctionnaire trouvé pour ce matricule.</p>
            )}
            {matResult && matResult !== 'none' && (
              <div className="mt-4 bg-void border border-white/6 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-display text-lg text-paper">{matResult.prenom} {matResult.nom}</div>
                  <Badge statut={matResult.statut} s={CLI_STYLE} l={CLI_LBL} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs text-paper/50">
                  <div><span className="text-paper/25 block text-[9px] uppercase tracking-wider mb-0.5">Téléphone</span>{matResult.telephone.replace(/^221/, '')}</div>
                  <div><span className="text-paper/25 block text-[9px] uppercase tracking-wider mb-0.5">Matricule</span>{matResult.matricule}</div>
                  <div><span className="text-paper/25 block text-[9px] uppercase tracking-wider mb-0.5">Corps</span>{matResult.corps ?? '—'}</div>
                  <div><span className="text-paper/25 block text-[9px] uppercase tracking-wider mb-0.5">IA</span>{matResult.ia ?? '—'}</div>
                  <div><span className="text-paper/25 block text-[9px] uppercase tracking-wider mb-0.5">Région</span>{matResult.region ?? '—'}</div>
                  <div><span className="text-paper/25 block text-[9px] uppercase tracking-wider mb-0.5">Inscription</span>{fmt(matResult.created_at)}</div>
                </div>
              </div>
            )}
          </div>

          {/* Répartition par région */}
          {stats?.regions && stats.regions.length > 0 && (
            <div className="bg-surface border border-white/6 rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-4 h-4 text-brass" />
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/50">Fonctionnaires par région</div>
              </div>
              <div className="space-y-2.5">
                {stats.regions.map(r => {
                  const max = stats.regions![0].nb_clients
                  const pct = Math.round((r.nb_clients / max) * 100)
                  return (
                    <div key={r.region} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-paper/50 w-28 flex-shrink-0">{r.region}</span>
                      <div className="flex-1 h-1.5 bg-void rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-spruce to-spruce-light rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-xs text-paper/40 w-6 text-right flex-shrink-0">{r.nb_clients}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ CLIENTS ═══════ */}
      {tab === 'clients' && (
        <>
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
                      {filteredClients.map((c, i) => (
                        <>
                          <tr key={c.id}
                            className={`border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer ${i % 2 ? 'bg-void/30' : ''}`}
                            onClick={() => setCliExpand(cliExpand === c.id ? null : c.id)}>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-body text-sm font-medium text-paper">{c.prenom} {c.nom}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-paper/55">{c.telephone.replace(/^221/, '')}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-paper/55">{c.matricule ?? '—'}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-body text-xs text-paper/45">
                                {c.corps ?? c.type_fonctionnaire ?? '—'}{c.region ? ` · ${c.region}` : ''}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono text-xs text-paper/35">{fmt(c.created_at)}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge statut={c.statut} s={CLI_STYLE} l={CLI_LBL} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                {updating === c.id ? <Loader2 className="w-4 h-4 text-brass animate-spin" /> : (
                                  <>
                                    {c.statut !== 'VALIDE' && (
                                      <button onClick={() => handleUpdateStatut(c.id, 'VALIDE')}
                                        className="flex items-center gap-1 font-mono text-[10px] uppercase text-spruce-light border border-spruce/30 rounded-full px-2.5 py-1 hover:bg-spruce/15 transition-colors">
                                        <CheckCircle2 className="w-3 h-3" /> Valider
                                      </button>
                                    )}
                                    {c.statut !== 'REJETE' && (
                                      <button onClick={() => handleUpdateStatut(c.id, 'REJETE')}
                                        className="flex items-center gap-1 font-mono text-[10px] uppercase text-clay border border-clay/30 rounded-full px-2.5 py-1 hover:bg-clay/10 transition-colors">
                                        <XCircle className="w-3 h-3" /> Rejeter
                                      </button>
                                    )}
                                    <ChevronDown className={`w-3.5 h-3.5 text-paper/20 transition-transform ${cliExpand === c.id ? 'rotate-180' : ''}`} />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {cliExpand === c.id && (
                            <tr key={`${c.id}-d`} className="bg-void/50 border-b border-white/4">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  {[
                                    { lbl: 'IA / Académie', val: c.ia }, { lbl: 'IEF', val: c.ief },
                                    { lbl: 'École / Poste', val: c.ecole }, { lbl: 'Type agent', val: c.type_enseignant },
                                    { lbl: 'Ministère', val: c.ministere }, { lbl: 'Grade', val: c.grade },
                                  ].map(({ lbl, val }) => val ? (
                                    <div key={lbl}>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-0.5">{lbl}</div>
                                      <div className="font-body text-paper/55 text-xs">{val}</div>
                                    </div>
                                  ) : null)}
                                  {c.cni_url && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-1.5">CNI Recto</div>
                                      <SignedDocLink path={c.cni_url} label="Ouvrir CNI recto" />
                                    </div>
                                  )}
                                  {c.notes?.startsWith('CNI_VERSO:') && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-1.5">CNI Verso</div>
                                      <SignedDocLink path={c.notes.replace('CNI_VERSO:', '')} label="Ouvrir CNI verso" />
                                    </div>
                                  )}
                                  {c.bulletin_url && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-1.5">Bulletin salaire</div>
                                      <SignedDocLink path={c.bulletin_url} label="Ouvrir bulletin" />
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

      {/* ═══════ COMMANDES ═══════ */}
      {tab === 'commandes' && (
        <>
          {cmdLoading
            ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 text-brass animate-spin" /></div>
            : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { val: commandes.length,                                   lbl: 'Total commandes', color: 'text-paper' },
                    { val: commandes.filter(c => c.statut === 'EN_COURS').length, lbl: 'En cours',     color: 'text-brass-light' },
                    { val: commandes.filter(c => c.statut === 'SOLDE').length,    lbl: 'Soldées',      color: 'text-spruce-light' },
                    { val: fcfa(commandes.reduce((s, c) => s + c.apport_paye, 0)), lbl: 'Total versé', color: 'text-brass-light' },
                  ].map(({ val, lbl, color }) => (
                    <div key={lbl} className="bg-surface border border-white/6 rounded-xl p-4">
                      <div className={`font-display text-xl md:text-2xl ${color} leading-tight`}>{val}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>
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
                <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
                  {filteredCmds.length === 0
                    ? <div className="py-16 text-center font-body text-paper/30 text-sm">Aucune commande.</div>
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
                                    onClick={() => setCmdExpand(cmdExpand === cmd.id ? null : cmd.id)}>
                                    <td className="px-4 py-3"><span className="font-mono text-xs text-brass-light">{cmd.reference}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="font-body text-sm text-paper">{cmd.client?.prenom} {cmd.client?.nom}</div>
                                      <div className="font-mono text-[10px] text-paper/35">{cmd.client?.telephone.replace(/^221/, '')}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-body text-xs text-paper/60">{cmd.produit?.nom ?? '—'}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs text-paper/60">{fcfa(cmd.prix_vente)}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs text-spruce-light">{fcfa(cmd.apport_paye)}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`font-mono text-xs ${cmd.reste_a_payer > 0 ? 'text-clay' : 'text-spruce-light'}`}>{fcfa(cmd.reste_a_payer)}</span>
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
                                    <td className="px-4 py-3 whitespace-nowrap"><Badge statut={cmd.statut} s={CMD_STYLE} l={CMD_LBL} /></td>
                                  </tr>
                                  {cmdExpand === cmd.id && (
                                    <tr key={`${cmd.id}-d`} className="bg-void/50 border-b border-white/4">
                                      <td colSpan={8} className="px-4 py-4">
                                        <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/30 mb-3">
                                          Échéancier · {cmd.montant_mensualite > 0 ? `${fcfa(cmd.montant_mensualite)} / mois` : ''}
                                          {cmd.date_fin_prevue ? ` · Fin prévue ${fmt(cmd.date_fin_prevue)}` : ''}
                                        </div>
                                        {cmd.versements.length === 0
                                          ? <p className="font-body text-paper/30 text-xs">Aucun versement.</p>
                                          : (
                                            <div className="space-y-1.5 max-w-xl">
                                              {cmd.versements.map(v => (
                                                <div key={v.id} className="flex items-center gap-4 font-mono text-xs">
                                                  <span className="text-paper/35 w-5">#{v.numero_versement}</span>
                                                  <span className="text-paper/40 flex-1">{fmt(v.date_echeance)}</span>
                                                  <span className="text-paper/60 w-24 text-right">{fcfa(v.montant_prevu)}</span>
                                                  {v.date_paiement && <span className="text-paper/30 hidden md:inline">payé le {fmt(v.date_paiement)}</span>}
                                                  <Badge statut={v.statut} s={VER_STYLE} l={VER_LBL} />
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

      {/* ═══════ PRODUITS ═══════ */}
      {tab === 'produits' && (
        <>
          <div className="flex items-center justify-between mb-5">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/25">
              {produits.length} produit{produits.length > 1 ? 's' : ''} enregistré{produits.length > 1 ? 's' : ''}
            </div>
            <button onClick={openNewProd}
              className="flex items-center gap-2 font-mono text-xs text-spruce-light border border-spruce/30 rounded-full px-4 py-2 hover:bg-spruce/15 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Nouveau produit
            </button>
          </div>

          {/* Formulaire produit */}
          {showForm && (
            <div className="bg-surface border border-brass/20 rounded-2xl p-5 md:p-6 mb-6">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-5">
                {editProd ? `Modifier — ${editProd.nom}` : 'Nouveau produit'}
              </div>
              <form onSubmit={handleSaveProd}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormField label="Nom du produit *">
                    <input required value={prodForm.nom} onChange={e => setProdForm(p => ({ ...p, nom: e.target.value }))}
                      placeholder="ex : Samsung Galaxy A55"
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-body text-sm text-paper pb-1.5 placeholder:text-paper/15 transition-colors" />
                  </FormField>
                  <FormField label="État">
                    <select value={prodForm.etat} onChange={e => setProdForm(p => ({ ...p, etat: e.target.value }))}
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-body text-sm text-paper pb-1.5 transition-colors">
                      <option value="NEUF">Neuf</option>
                      <option value="RECONDITIONNE">Reconditionné</option>
                      <option value="OCCASION">Occasion</option>
                    </select>
                  </FormField>
                  <FormField label="Prix de vente (FCFA) *">
                    <input required type="number" min="0" value={prodForm.prix_vente}
                      onChange={e => setProdForm(p => ({ ...p, prix_vente: +e.target.value }))}
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                  </FormField>
                  <FormField label="Apport minimum (FCFA) *">
                    <input required type="number" min="0" value={prodForm.apport_minimum}
                      onChange={e => setProdForm(p => ({ ...p, apport_minimum: +e.target.value }))}
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                  </FormField>
                  <FormField label="Nb mensualités max">
                    <input type="number" min="1" max="36" value={prodForm.nb_mensualites_max}
                      onChange={e => setProdForm(p => ({ ...p, nb_mensualites_max: +e.target.value }))}
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                  </FormField>
                  <FormField label={prodForm.stock_illimite ? 'Stock illimité' : 'Stock disponible'}>
                    <div className="flex items-center gap-3">
                      {!prodForm.stock_illimite && (
                        <input type="number" min="0" value={prodForm.stock}
                          onChange={e => setProdForm(p => ({ ...p, stock: +e.target.value }))}
                          className="w-24 bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={prodForm.stock_illimite}
                          onChange={e => setProdForm(p => ({ ...p, stock_illimite: e.target.checked }))}
                          className="accent-brass" />
                        <span className="font-mono text-xs text-paper/50">Illimité</span>
                      </label>
                    </div>
                  </FormField>
                </div>
                <FormField label="Description">
                  <textarea value={prodForm.description}
                    onChange={e => setProdForm(p => ({ ...p, description: e.target.value }))}
                    rows={2} placeholder="Description courte du produit…"
                    className="w-full bg-void border border-white/8 rounded-lg p-2.5 font-body text-sm text-paper placeholder:text-paper/15 focus:border-brass/40 outline-none resize-none transition-colors" />
                </FormField>
                <div className="flex items-center gap-6 mt-3 mb-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prodForm.actif}
                      onChange={e => setProdForm(p => ({ ...p, actif: e.target.checked }))} className="accent-brass" />
                    <span className="font-mono text-xs text-paper/50">Actif (visible)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prodForm.en_vedette}
                      onChange={e => setProdForm(p => ({ ...p, en_vedette: e.target.checked }))} className="accent-brass" />
                    <span className="font-mono text-xs text-paper/50">En vedette</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={savingProd}
                    className="flex items-center gap-2 font-body text-sm font-medium bg-spruce-light text-paper px-6 py-2.5 rounded-full hover:bg-spruce transition-colors disabled:opacity-50">
                    {savingProd ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {editProd ? 'Enregistrer' : 'Créer le produit'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="font-body text-sm text-paper/40 border border-white/8 px-6 py-2.5 rounded-full hover:text-paper/60 transition-colors">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {prodLoading
            ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 text-brass animate-spin" /></div>
            : produits.length === 0
              ? <div className="py-16 text-center font-body text-paper/30 text-sm">Aucun produit. Créez-en un ci-dessus.</div>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {produits.map(p => (
                    <div key={p.id} className={`bg-surface border rounded-2xl p-5 transition-colors ${p.actif ? 'border-white/6' : 'border-white/3 opacity-60'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-base text-paper leading-tight">{p.nom}</span>
                            {p.en_vedette && <Star className="w-3.5 h-3.5 text-brass flex-shrink-0" fill="currentColor" />}
                          </div>
                          {p.description && (
                            <p className="font-body text-xs text-paper/40 mt-1 leading-relaxed">{p.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button onClick={() => openEditProd(p)}
                            className="w-7 h-7 flex items-center justify-center text-paper/30 hover:text-brass transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteProd(p.id)}
                            className="w-7 h-7 flex items-center justify-center text-paper/30 hover:text-clay transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-void rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/25 mb-0.5">Prix</div>
                          <div className="font-mono text-xs text-brass-light">{fcfa(p.prix_vente)}</div>
                        </div>
                        <div className="bg-void rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/25 mb-0.5">Apport</div>
                          <div className="font-mono text-xs text-paper/60">{fcfa(p.apport_minimum)}</div>
                        </div>
                        <div className="bg-void rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/25 mb-0.5">Mensualités</div>
                          <div className="font-mono text-xs text-paper/60">max {p.nb_mensualites_max}×</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${
                            p.etat === 'NEUF' ? 'text-spruce-light border-spruce/25 bg-spruce/10'
                            : p.etat === 'RECONDITIONNE' ? 'text-brass border-brass/25 bg-brass/10'
                            : 'text-paper/40 border-white/10 bg-white/4'
                          }`}>
                            {p.etat === 'NEUF' ? 'Neuf' : p.etat === 'RECONDITIONNE' ? 'Reconditionné' : 'Occasion'}
                          </span>
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${p.stock_illimite ? 'text-spruce-light' : p.stock > 0 ? 'text-paper/50' : 'text-clay'}`}>
                            {p.stock_illimite ? '∞ illimité' : `${p.stock} en stock`}
                          </span>
                        </div>
                        <button onClick={() => handleToggleActif(p)}
                          className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${p.actif ? 'text-spruce-light' : 'text-paper/30'}`}>
                          {p.actif ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {p.actif ? 'Actif' : 'Inactif'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
        </>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/12 text-center mt-10">
        Semou Group × CFA CUSEMS · Tableau de bord administrateur · Usage interne
      </p>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/30 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
