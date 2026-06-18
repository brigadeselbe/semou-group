'use client'

import { useState, useEffect, useCallback } from 'react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFAProduit, CFALivraison } from '@/lib/supabase'
import {
  Lock, LogOut, Search, CheckCircle2, XCircle, Loader2, ChevronDown,
  Users, FileText, ExternalLink, ShoppingBag,
  TrendingUp, AlertCircle, Package, Plus, Edit2, Trash2, ToggleLeft,
  ToggleRight, Star, MapPin, Download, Truck, Upload, X,
} from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

/* ── Types ── */
type CommandeAdmin = CFACommande & {
  client:     { prenom: string; nom: string; telephone: string } | null
  produit:    { nom: string } | null
  versements: CFAVersement[]
  livraison:  CFALivraison | null
}
type LivEdit = { statut: string; livreur: string; tel: string; suivi: string; datePlanifiee: string }
type DashStats = {
  total_clients: number; en_attente: number; valides: number; rejetes: number
  total_commandes: number; commandes_en_cours: number; commandes_soldees: number
  versements_payes: number; versements_retard: number; fcfa_collectes: number
  regions: { region: string; nb_clients: number }[] | null
}
type ClientFilter   = 'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE'
type CommandeFilter = 'TOUS' | 'EN_COURS' | 'SOLDE' | 'ANNULE'
type Tab = 'dashboard' | 'clients' | 'commandes' | 'produits' | 'livraisons'

/* ── Constantes ── */
const SESSION_KEY = 'sg_admin_session'

const CLI_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  VALIDE:     'text-spruce-light bg-spruce/15 border-spruce/25',
  REJETE:     'text-clay bg-clay/10 border-clay/20',
  SUSPENDU:   'text-paper/65 bg-paper/5 border-paper/10',
}
const CMD_STYLE: Record<string, string> = {
  EN_COURS: 'text-brass bg-brass/10 border-brass/20',
  SOLDE:    'text-spruce-light bg-spruce/15 border-spruce/25',
  ANNULE:   'text-clay bg-clay/10 border-clay/20',
}
const VER_STYLE: Record<string, string> = {
  PAYE:       'text-spruce-light bg-spruce/15 border-spruce/25',
  EN_ATTENTE: 'text-paper/60 bg-paper/4 border-paper/8',
  EN_RETARD:  'text-clay bg-clay/10 border-clay/20',
}
const LIV_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  PLANIFIEE:  'text-paper/70 bg-paper/5 border-paper/10',
  EN_ROUTE:   'text-spruce-light bg-spruce/15 border-spruce/25',
  LIVREE:     'text-spruce-light bg-spruce/15 border-spruce/25',
}
const CLI_LBL: Record<string, string>  = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté', SUSPENDU: 'Suspendu' }
const CMD_LBL: Record<string, string>  = { EN_COURS: 'En cours', SOLDE: 'Soldé', ANNULE: 'Annulé', EN_ATTENTE: 'En attente' }
const VER_LBL: Record<string, string>  = { PAYE: 'Payé', EN_ATTENTE: 'À venir', EN_RETARD: 'En retard' }
const LIV_LBL: Record<string, string>  = { EN_ATTENTE: 'En attente', PLANIFIEE: 'Planifiée', EN_ROUTE: 'En route', LIVREE: 'Livrée' }
const LIV_STEPS = [
  { key: 'EN_ATTENTE', lbl: 'En attente' },
  { key: 'PLANIFIEE',  lbl: 'Planifiée'  },
  { key: 'EN_ROUTE',   lbl: 'En route'   },
  { key: 'LIVREE',     lbl: 'Livrée'     },
]

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-SN', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

function Badge({ statut, s, l }: { statut: string; s: Record<string, string>; l: Record<string, string> }) {
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${s[statut] ?? 'text-paper/55 bg-paper/5 border-paper/8'}`}>
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
  if (loading) return <span className="font-mono text-[10px] text-paper/45">Chargement…</span>
  if (!url)    return <span className="font-mono text-[10px] text-clay">Inaccessible</span>
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-1.5 font-mono text-[10px] text-brass-light border border-brass/20 rounded-full px-2.5 py-1 hover:bg-brass/10 transition-colors">
      <FileText className="w-3 h-3" />{label}<ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </a>
  )
}

type LivStats = { en_attente: number; planifiee: number; en_route: number; livree: number }

/* ── Proxy /api/admin/rpc — le mot de passe reste côté serveur ── */
async function adminRpc(rpc: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/admin/rpc', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ rpc, params }),
  })
  const json = await res.json().catch(() => ({ error: 'Erreur réseau' }))
  if (!res.ok) return { data: null, error: { message: (json.error as string) ?? 'Erreur' } }
  return { data: json.data as unknown, error: null }
}

/* Rate-limiting géré côté serveur (cookie HttpOnly signé) — plus rien côté client */

/* ── Formulaire produit ── */
const EMPTY_PRODUIT = {
  nom: '', description: '', prix_vente: 0, apport_minimum: 0,
  nb_mensualites_max: 6, stock: 1, stock_illimite: false, stock_seuil: 3,
  actif: true, en_vedette: false, etat: 'NEUF',
}
type ProduitForm = typeof EMPTY_PRODUIT

/* ══════════════════════════════════════════
   PAGE PRINCIPALE
══════════════════════════════════════════ */
export default function Admin() {
  const [stage,  setStage]  = useState<'login' | 'loading' | 'dashboard'>('login')
  const [pwd,    setPwd]    = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [tab,    setTab]    = useState<Tab>('dashboard')

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
  const [cmdProduit, setCmdProduit] = useState('')
  const [cmdMois,    setCmdMois]    = useState('')
  const [livFilter,  setLivFilter]  = useState('TOUS')
  const [livSearch,  setLivSearch]  = useState('')
  const [cmdExpand,  setCmdExpand]  = useState<string | null>(null)

  /* Produits */
  const [produits,    setProduits]    = useState<CFAProduit[]>([])
  const [prodLoaded,  setProdLoaded]  = useState(false)
  const [prodLoading, setProdLoading] = useState(false)
  const [editProd,    setEditProd]    = useState<CFAProduit | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [prodForm,    setProdForm]    = useState<ProduitForm>(EMPTY_PRODUIT)
  const [savingProd,  setSavingProd]  = useState(false)
  const [justCreated, setJustCreated] = useState(false)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [prodMedias,   setProdMedias]   = useState<import('@/lib/supabase').CFAProduitMedia[]>([])
  const [mediasLoading, setMediasLoading] = useState(false)
  const [uploadingMedia, setUploadingMedia] = useState(false)

  /* Stats */
  const [stats,         setStats]        = useState<DashStats | null>(null)
  const [statsLoading,  setStatsLoading] = useState(false)
  const [livStats, setLivStats] = useState<LivStats | null>(null)
  const [stockBas, setStockBas] = useState<{ id: string; nom: string; stock: number; stock_seuil: number }[]>([])

  /* Rapport mensuel */
  const [rapportMois,      setRapportMois]      = useState(() => new Date().toISOString().slice(0, 7))
  const [generatingRapport, setGeneratingRapport] = useState(false)

  /* Import Excel clients */
  type ImportRow = Record<string, string>
  type ImportResult = { upserted: number; errors: { ligne: string; tel?: string; erreur: string }[] }
  const [importOpen,    setImportOpen]    = useState(false)
  const [importRows,    setImportRows]    = useState<ImportRow[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importResult,  setImportResult]  = useState<ImportResult | null>(null)
  const [matSearch,   setMatSearch]   = useState('')
  const [matMode,     setMatMode]     = useState<'matricule' | 'nom' | 'telephone'>('matricule')
  const [matResults,  setMatResults]  = useState<CFAClient[] | 'idle'>('idle')

  /* Versement manuel */
  const [markingVers, setMarkingVers] = useState<string | null>(null)

  /* Livraison */
  const [livEdits,  setLivEdits]  = useState<Record<string, LivEdit>>({})
  const [savingLiv, setSavingLiv] = useState<string | null>(null)

  /* Nouvelle commande */
  const [newCmdClient,  setNewCmdClient]  = useState<CFAClient | null>(null)
  const [newCmdProduit, setNewCmdProduit] = useState('')
  const [newCmdMens,    setNewCmdMens]    = useState(6)
  const [newCmdApport,  setNewCmdApport]  = useState(0)
  const [newCmdMoyen,   setNewCmdMoyen]   = useState('ESPECES')
  const [creatingCmd,   setCreatingCmd]   = useState(false)

  /* Restaurer session */
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_KEY) : null
    if (saved) loadAll()
  }, []) // eslint-disable-line

  async function loadAll() {
    setStage('loading')
    const { data: cls, error } = await adminRpc('admin_get_all_clients')
    if (error || !cls) { setStage('login'); return }
    setClients(cls as CFAClient[])
    setStage('dashboard')
    loadStats()
  }

  async function loadStats() {
    setStatsLoading(true)
    const [{ data, error }, { data: livs }, { data: sb }] = await Promise.all([
      adminRpc('admin_get_stats'),
      adminRpc('admin_get_livraison_stats'),
      supabase.rpc('get_stock_bas'),
    ])
    if (!error && data) setStats(data as DashStats)
    if (livs) setLivStats(livs as LivStats)
    if (sb) setStockBas(sb as { id: string; nom: string; stock: number; stock_seuil: number }[])
    setStatsLoading(false)
  }

  const loadCommandes = useCallback(async () => {
    if (cmdLoaded) return
    setCmdLoading(true)
    const { data: cmds } = await adminRpc('admin_get_commandes_full')
    if (!cmds) { setCmdLoading(false); return }
    setCommandes(cmds as CommandeAdmin[])
    setCmdLoaded(true)
    setCmdLoading(false)
  }, [cmdLoaded])

  const loadProduits = useCallback(async () => {
    if (prodLoaded) return
    setProdLoading(true)
    const { data } = await supabase.from('cfa_produits').select('*').order('created_at', { ascending: false })
    if (data) { setProduits(data as CFAProduit[]); setProdLoaded(true) }
    setProdLoading(false)
  }, [prodLoaded])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setPwdErr('')
    setStage('loading')
    const res = await fetch('/api/admin/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: pwd }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setPwdErr(json.error ?? 'Mot de passe incorrect.')
      setStage('login')
      return
    }
    sessionStorage.setItem(SESSION_KEY, '1')
    loadAll()
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    fetch('/api/admin/logout', { method: 'POST' }).catch(() => null)
    setClients([]); setCommandes([]); setProduits([])
    setCmdLoaded(false); setProdLoaded(false); setStats(null)
    setStage('login'); setPwd('')
  }

  async function handleUpdateStatut(clientId: string, newStatut: string) {
    setUpdating(clientId)
    const { error } = await adminRpc('admin_update_client_statut', {
      p_client_id: clientId, p_statut: newStatut,
    })
    if (error) { alert('Erreur : ' + error.message); setUpdating(null); return }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, statut: newStatut } : c))
    if (newStatut === 'VALIDE' || newStatut === 'REJETE') {
      fetch('/api/sms/statut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, statut: newStatut }),
      }).catch(() => null)
    }
    setUpdating(null)
  }

  async function handleMarquerPaye(versId: string, cmdId: string, moyen = 'ESPECES') {
    setMarkingVers(versId)
    const { error } = await adminRpc('admin_marquer_versement_paye', {
      p_versement_id: versId,
      p_moyen:        moyen,
    })
    if (error) { alert('Erreur : ' + error.message); setMarkingVers(null); return }
    // Mise à jour locale sans rechargement complet
    setCommandes(prev => prev.map(cmd => {
      if (cmd.id !== cmdId) return cmd
      const versements = cmd.versements.map(v =>
        v.id === versId
          ? { ...v, statut: 'PAYE', montant_paye: v.montant_prevu, date_paiement: new Date().toISOString(), moyen_paiement: moyen }
          : v
      )
      const resteApres = Math.max(0, cmd.reste_a_payer - (cmd.versements.find(v => v.id === versId)?.montant_prevu ?? 0))
      const encoreImpaye = versements.some(v => v.statut === 'EN_ATTENTE' || v.statut === 'EN_RETARD')
      return {
        ...cmd,
        versements,
        reste_a_payer: resteApres,
        statut: (!encoreImpaye || resteApres <= 0) ? 'SOLDE' : cmd.statut,
      }
    }))
    setMarkingVers(null)
  }

  async function handleUpdateLivraison(cmdId: string, edit: LivEdit) {
    setSavingLiv(cmdId)
    const { data: livId, error } = await adminRpc('admin_update_livraison', {
      p_commande_id:    cmdId,
      p_statut:         edit.statut,
      p_livreur_nom:    edit.livreur || null,
      p_livreur_tel:    edit.tel || null,
      p_numero_suivi:   edit.suivi || null,
      p_date_planifiee: edit.datePlanifiee || null,
    })
    if (error) { alert('Erreur livraison : ' + error.message); setSavingLiv(null); return }
    setCommandes(prev => prev.map(cmd => {
      if (cmd.id !== cmdId) return cmd
      const base: CFALivraison = cmd.livraison ?? {
        id: livId as string, commande_id: cmdId, client_id: cmd.client_id,
        statut: edit.statut, livreur_nom: null, livreur_telephone: null, livreur_service: null,
        adresse_livraison: null, ville_livraison: null, region_livraison: null,
        telephone_livraison: null, date_planifiee: edit.datePlanifiee || null,
        date_livraison_effective: null, delai_max_jours: 10,
        frais_livraison: 0, frais_payes: false, numero_suivi: null,
      }
      return { ...cmd, livraison: { ...base, id: livId as string, statut: edit.statut, livreur_nom: edit.livreur || null, livreur_telephone: edit.tel || null, numero_suivi: edit.suivi || null, date_planifiee: edit.datePlanifiee || null } }
    }))
    setSavingLiv(null)
  }

  async function handleCreateCommande(e: React.FormEvent) {
    e.preventDefault()
    if (!newCmdClient || !newCmdProduit) return
    setCreatingCmd(true)
    const { data: cmdId, error } = await adminRpc('admin_creer_commande', {
      p_client_id:      newCmdClient.id,
      p_produit_id:     newCmdProduit,
      p_nb_mensualites: newCmdMens,
      p_apport_paye:    newCmdApport,
      p_moyen:          newCmdMoyen,
    })
    if (error) { alert('Erreur : ' + error.message); setCreatingCmd(false); return }
    alert(`Commande créée ! Réf : ${cmdId}`)
    setNewCmdClient(null)
    setNewCmdProduit(''); setNewCmdMens(6); setNewCmdApport(0); setNewCmdMoyen('ESPECES')
    setCmdLoaded(false)
    setCreatingCmd(false)
  }

  function handleMatSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = matSearch.trim().toLowerCase()
    if (!q) return
    let results: CFAClient[]
    if (matMode === 'matricule') {
      results = clients.filter(c => c.matricule?.toLowerCase().includes(q))
    } else if (matMode === 'telephone') {
      const tel = q.replace(/^\+?221/, '').replace(/\s/g, '')
      results = clients.filter(c => (c.telephone ?? '').includes(tel))
    } else {
      results = clients.filter(c =>
        (c.prenom ?? '').toLowerCase().includes(q) || (c.nom ?? '').toLowerCase().includes(q)
      )
    }
    setMatResults(results.slice(0, 10))
  }

  /* ── Import Excel clients ── */
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportResult(null)
    setImportRows([])
    const XLSX  = (await import('xlsx')).default
    const buf   = await file.arrayBuffer()
    const wb    = XLSX.read(buf, { type: 'array' })
    const ws    = wb.Sheets[wb.SheetNames[0]]
    const raw   = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]

    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

    const COL: Record<string, string> = {
      prenom: 'prenom', nom: 'nom', telephone: 'telephone', matricule: 'matricule',
      corps: 'corps', region: 'region', ia: 'ia', iaacademie: 'ia', ief: 'ief',
      ecole: 'ecole', grade: 'grade', ministere: 'ministere', statut: 'statut',
    }

    const rows: ImportRow[] = raw
      .map((r, i) => {
        const out: ImportRow = { _ligne: String(i + 2) }
        for (const [k, v] of Object.entries(r)) {
          const mapped = COL[norm(k)]
          if (mapped) out[mapped] = String(v ?? '').trim()
        }
        return out
      })
      .filter(r => r.telephone)

    setImportRows(rows)
  }

  async function handleImportConfirm() {
    if (!importRows.length) return
    setImportLoading(true)
    const { data, error } = await adminRpc('admin_import_clients', { p_clients: importRows })
    setImportLoading(false)
    if (error) {
      setImportResult({ upserted: 0, errors: [{ ligne: '?', erreur: error.message }] })
      return
    }
    const res = data as ImportResult
    setImportResult(res)
    if (res.upserted > 0) {
      const { data: fresh } = await adminRpc('admin_get_all_clients')
      if (fresh) setClients(fresh as CFAClient[])
    }
  }

  /* ── Rapport mensuel ── */
  async function exportRapportMensuel(mois: string) {
    setGeneratingRapport(true)

    /* S'assurer que les commandes sont chargées */
    let cmds = commandes
    if (!cmdLoaded) {
      const { data } = await adminRpc('admin_get_commandes_full')
      cmds = (data as CommandeAdmin[] | null) ?? []
      setCommandes(cmds)
      setCmdLoaded(true)
    }

    const XLSX     = (await import('xlsx')).default
    const fcfa2    = (n: number) => n.toLocaleString('fr-FR') + ' F CFA'
    const fmtDate2 = (s?: string | null) => s ? new Date(s).toLocaleDateString('fr-FR') : '—'
    const [y, m]   = mois.split('-')
    const labelMois = new Date(Number(y), Number(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

    /* ── Données filtrées ── */
    const newClients   = clients.filter(c => (c as CFAClient & { created_at?: string }).created_at?.startsWith(mois))
    const moisCmds     = cmds.filter(c => c.created_at?.startsWith(mois))
    const allVers      = cmds.flatMap(c => c.versements.map(v => ({ ...v, cmd: c })))
    const versEncaisses = allVers.filter(v => v.date_paiement?.startsWith(mois))
    const versRetard    = allVers.filter(v => v.statut === 'EN_RETARD')

    const totalCollecte = cmds.reduce((s, c) => s + c.apport_paye, 0)
    const totalRestant  = cmds.reduce((s, c) => s + c.reste_a_payer, 0)
    const montantEnCaisses = versEncaisses.reduce((s, v) => s + (v.montant_paye || v.montant_prevu), 0)
    const montantRetard    = versRetard.reduce((s, v) => s + v.montant_prevu, 0)

    /* ── Sheet 1 : Résumé ── */
    const sep = { Indicateur: '────────────────', Valeur: '' }
    const resumeRows = [
      { Indicateur: 'Rapport SEMOU GROUP',         Valeur: labelMois },
      { Indicateur: 'Généré le',                   Valeur: new Date().toLocaleDateString('fr-FR') },
      sep,
      { Indicateur: 'CLIENTS',                     Valeur: '' },
      { Indicateur: 'Nouveaux inscrits ce mois',   Valeur: newClients.length },
      { Indicateur: 'Validés (total)',              Valeur: clients.filter(c => c.statut === 'VALIDE').length },
      { Indicateur: 'En attente (total)',           Valeur: clients.filter(c => c.statut === 'EN_ATTENTE').length },
      sep,
      { Indicateur: 'COMMANDES DU MOIS',           Valeur: '' },
      { Indicateur: 'Nouvelles commandes',          Valeur: moisCmds.length },
      { Indicateur: 'Montant commandé',             Valeur: fcfa2(moisCmds.reduce((s, c) => s + c.prix_vente, 0)) },
      { Indicateur: 'Apport collecté (ces cmd)',    Valeur: fcfa2(moisCmds.reduce((s, c) => s + c.apport_paye, 0)) },
      sep,
      { Indicateur: 'VERSEMENTS DU MOIS',          Valeur: '' },
      { Indicateur: 'Versements encaissés',         Valeur: versEncaisses.length },
      { Indicateur: 'Montant encaissé',             Valeur: fcfa2(montantEnCaisses) },
      sep,
      { Indicateur: 'SITUATION GLOBALE',            Valeur: '' },
      { Indicateur: 'Total collecté (toutes cmd)',  Valeur: fcfa2(totalCollecte) },
      { Indicateur: 'Restant à collecter',          Valeur: fcfa2(totalRestant) },
      { Indicateur: 'Versements en retard',         Valeur: versRetard.length },
      { Indicateur: 'Montant en retard',            Valeur: fcfa2(montantRetard) },
    ]
    const wsResume = XLSX.utils.json_to_sheet(resumeRows)
    wsResume['!cols'] = [{ wch: 30 }, { wch: 24 }]

    /* ── Sheet 2 : Nouveaux clients ── */
    const wsClients = XLSX.utils.json_to_sheet(newClients.map(c => ({
      Prénom: c.prenom, Nom: c.nom, Téléphone: c.telephone,
      Matricule: c.matricule ?? '', Corps: c.corps ?? '', Région: c.region ?? '',
      'IA / Académie': c.ia ?? '', IEF: c.ief ?? '', École: c.ecole ?? '',
      Statut: c.statut,
      'Date inscription': fmtDate2((c as CFAClient & { created_at?: string }).created_at),
    })))
    wsClients['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 14 },
    ]

    /* ── Sheet 3 : Commandes du mois ── */
    const wsCommandes = XLSX.utils.json_to_sheet(moisCmds.map(c => ({
      Référence: c.reference,
      Client: `${c.client?.prenom ?? ''} ${c.client?.nom ?? ''}`.trim(),
      Téléphone: c.client?.telephone ?? '',
      Produit: c.produit?.nom ?? '',
      'Prix vente (F)': c.prix_vente,
      'Apport payé (F)': c.apport_paye,
      'Reste dû (F)': c.reste_a_payer,
      Mensualités: c.nb_mensualites,
      Statut: c.statut,
      'Date commande': fmtDate2(c.created_at),
    })))
    wsCommandes['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 14 },
      { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
    ]

    /* ── Sheet 4 : Versements encaissés ── */
    const wsVers = XLSX.utils.json_to_sheet(versEncaisses.map(v => ({
      Référence: v.cmd.reference,
      Client: `${v.cmd.client?.prenom ?? ''} ${v.cmd.client?.nom ?? ''}`.trim(),
      Téléphone: v.cmd.client?.telephone ?? '',
      Produit: v.cmd.produit?.nom ?? '',
      'N° versement': v.numero_versement,
      'Prévu (F)': v.montant_prevu,
      'Payé (F)': v.montant_paye || v.montant_prevu,
      'Date paiement': fmtDate2(v.date_paiement),
      Moyen: v.moyen_paiement ?? '',
    })))
    wsVers['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 20 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
    ]

    /* ── Sheet 5 : Retards ── */
    const wsRetard = XLSX.utils.json_to_sheet(versRetard.map(v => {
      const echeance = v.date_echeance ? new Date(v.date_echeance) : null
      const joursRetard = echeance ? Math.floor((Date.now() - echeance.getTime()) / 86400000) : '?'
      return {
        Référence: v.cmd.reference,
        Client: `${v.cmd.client?.prenom ?? ''} ${v.cmd.client?.nom ?? ''}`.trim(),
        Téléphone: v.cmd.client?.telephone ?? '',
        Produit: v.cmd.produit?.nom ?? '',
        'N° versement': v.numero_versement,
        'Montant dû (F)': v.montant_prevu,
        'Date échéance': fmtDate2(v.date_echeance),
        'Jours de retard': joursRetard,
      }
    }).sort((a, b) => Number(b['Jours de retard']) - Number(a['Jours de retard'])))
    wsRetard['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 20 },
      { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    ]

    /* ── Assemblage ── */
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, wsResume,    'Résumé')
    XLSX.utils.book_append_sheet(wb, wsClients,   'Nouveaux clients')
    XLSX.utils.book_append_sheet(wb, wsCommandes, 'Commandes')
    XLSX.utils.book_append_sheet(wb, wsVers,      'Versements encaissés')
    XLSX.utils.book_append_sheet(wb, wsRetard,    'Retards')
    XLSX.writeFile(wb, `rapport-semou-${mois}.xlsx`)
    setGeneratingRapport(false)
  }

  /* ── Exports Excel ── */
  async function exportClients() {
    const XLSX = (await import('xlsx')).default
    const today = new Date().toLocaleDateString('fr-FR')

    /* Feuille 1 : liste complète */
    const rows = filteredClients.map(c => ({
      Prénom:              c.prenom,
      Nom:                 c.nom,
      Téléphone:           c.telephone,
      Matricule:           c.matricule ?? '',
      Corps:               c.corps ?? '',
      Région:              c.region ?? '',
      'IA / Académie':     c.ia ?? '',
      IEF:                 c.ief ?? '',
      École:               c.ecole ?? '',
      Statut:              c.statut,
      'Date inscription':  (c as CFAClient & { created_at?: string }).created_at
                             ? new Date((c as CFAClient & { created_at: string }).created_at).toLocaleDateString('fr-FR') : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
      { wch: 24 }, { wch: 12 }, { wch: 16 },
    ]

    /* Feuille 2 : synthèse */
    const byStatut:  Record<string, number> = {}
    const byCorps:   Record<string, number> = {}
    const byRegion:  Record<string, number> = {}
    filteredClients.forEach(c => {
      byStatut[c.statut]          = (byStatut[c.statut]         ?? 0) + 1
      if (c.corps)  byCorps[c.corps]   = (byCorps[c.corps]   ?? 0) + 1
      if (c.region) byRegion[c.region] = (byRegion[c.region] ?? 0) + 1
    })
    const sep = { Indicateur: '────────────────', Valeur: '' }
    const synthRows = [
      { Indicateur: 'Export SEMOU GROUP',   Valeur: today },
      { Indicateur: 'Total dossiers',       Valeur: filteredClients.length },
      sep,
      { Indicateur: 'PAR STATUT',           Valeur: '' },
      ...Object.entries(byStatut).map(([k, v]) => ({ Indicateur: k, Valeur: v })),
      sep,
      { Indicateur: 'PAR CORPS',            Valeur: '' },
      ...Object.entries(byCorps).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ Indicateur: k, Valeur: v })),
      sep,
      { Indicateur: 'PAR RÉGION',           Valeur: '' },
      ...Object.entries(byRegion).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ Indicateur: k, Valeur: v })),
    ]
    const wsSynth = XLSX.utils.json_to_sheet(synthRows)
    wsSynth['!cols'] = [{ wch: 24 }, { wch: 14 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws,      'Clients')
    XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse')
    XLSX.writeFile(wb, `clients_semou_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function exportCommandes() {
    const XLSX = (await import('xlsx')).default
    const { data: raw } = await adminRpc('admin_get_commandes_full')
    const cmds = raw as CommandeAdmin[] | null
    if (!cmds?.length) return

    const fcfa = (n: number) => n.toLocaleString('fr-FR') + ' F CFA'
    let totalVente = 0, totalCollecte = 0, totalRestant = 0
    const byProduit: Record<string, { count: number; vente: number; collecte: number }> = {}
    const byStatut:  Record<string, number> = {}

    /* Feuille 1 : détail versements */
    const rows: Record<string, string | number>[] = []
    cmds.forEach(cmd => {
      totalVente    += cmd.prix_vente    ?? 0
      totalCollecte += cmd.apport_paye  ?? 0
      totalRestant  += cmd.reste_a_payer ?? 0
      const prod = cmd.produit?.nom ?? 'Inconnu'
      if (!byProduit[prod]) byProduit[prod] = { count: 0, vente: 0, collecte: 0 }
      byProduit[prod].count    += 1
      byProduit[prod].vente    += cmd.prix_vente   ?? 0
      byProduit[prod].collecte += cmd.apport_paye  ?? 0
      byStatut[cmd.statut] = (byStatut[cmd.statut] ?? 0) + 1

      const base = {
        Référence:           cmd.reference ?? cmd.id,
        Client:              `${cmd.client?.prenom ?? ''} ${cmd.client?.nom ?? ''}`.trim(),
        Téléphone:           cmd.client?.telephone ?? '',
        Produit:             prod,
        'Statut commande':   cmd.statut,
        'Prix vente (F)':    cmd.prix_vente,
        'Apport payé (F)':   cmd.apport_paye,
        'Reste dû (F)':      cmd.reste_a_payer,
        Mensualités:         cmd.nb_mensualites,
        'Mensualité (F)':    cmd.montant_mensualite,
      }
      const vers = cmd.versements ?? []
      if (vers.length === 0) {
        rows.push(base)
      } else {
        vers.forEach(v => rows.push({
          ...base,
          'N° vers.':          v.numero_versement,
          'Prévu (F)':         v.montant_prevu,
          'Payé (F)':          v.montant_paye,
          'Statut versement':  v.statut,
          'Date échéance':     v.date_echeance ? new Date(v.date_echeance).toLocaleDateString('fr-FR') : '',
          'Date paiement':     v.date_paiement ? new Date(v.date_paiement).toLocaleDateString('fr-FR') : '',
          Moyen:               v.moyen_paiement ?? '',
        }))
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ]

    /* Feuille 2 : synthèse financière */
    const sep = { Indicateur: '────────────────', Valeur: '' }
    const synthRows = [
      { Indicateur: 'Export SEMOU GROUP',        Valeur: new Date().toLocaleDateString('fr-FR') },
      { Indicateur: 'Total commandes',           Valeur: cmds.length },
      sep,
      { Indicateur: 'BILAN FINANCIER',           Valeur: '' },
      { Indicateur: 'Montant total commandé',    Valeur: fcfa(totalVente) },
      { Indicateur: 'Total collecté',            Valeur: fcfa(totalCollecte) },
      { Indicateur: 'Total restant à collecter', Valeur: fcfa(totalRestant) },
      sep,
      { Indicateur: 'PAR STATUT',                Valeur: '' },
      ...Object.entries(byStatut).map(([k, v]) => ({ Indicateur: k, Valeur: v })),
      sep,
      { Indicateur: 'PAR PRODUIT',               Valeur: '' },
      ...Object.entries(byProduit)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([k, v]) => ({
          Indicateur: k,
          Valeur: `${v.count} cmd · collecté ${fcfa(v.collecte)} / ${fcfa(v.vente)}`,
        })),
    ]
    const wsSynth = XLSX.utils.json_to_sheet(synthRows)
    wsSynth['!cols'] = [{ wch: 28 }, { wch: 38 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws,      'Commandes')
    XLSX.utils.book_append_sheet(wb, wsSynth, 'Synthèse')
    XLSX.writeFile(wb, `commandes_semou_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  /* Produit form */
  function openNewProd() {
    setEditProd(null); setProdForm(EMPTY_PRODUIT)
    setPhotoFile(null); setPhotoPreview(null)
    setProdMedias([]); setJustCreated(false)
    setShowForm(true)
  }
  function openEditProd(p: CFAProduit) {
    setEditProd(p)
    setProdForm({
      nom: p.nom, description: p.description ?? '', prix_vente: p.prix_vente,
      apport_minimum: p.apport_minimum, nb_mensualites_max: p.nb_mensualites_max,
      stock: p.stock, stock_illimite: p.stock_illimite, stock_seuil: p.stock_seuil ?? 3, actif: p.actif,
      en_vedette: p.en_vedette, etat: p.etat,
    })
    setPhotoFile(null); setPhotoPreview(p.photo_url ?? null)
    setProdMedias([])
    loadProdMedias(p.id)
    setShowForm(true)
  }
  async function handleSaveProd(e: React.FormEvent) {
    e.preventDefault()
    setSavingProd(true)

    // Upload photo si nouveau fichier sélectionné
    let photoUrl: string | null = editProd?.photo_url ?? null
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('produit-photos').upload(path, photoFile, { upsert: true })
      if (upErr) { alert('Erreur upload photo : ' + upErr.message); setSavingProd(false); return }
      const { data: pub } = supabase.storage.from('produit-photos').getPublicUrl(path)
      photoUrl = pub.publicUrl
    }

    const isNew = !editProd
    const { data: returnedId, error } = await adminRpc('admin_upsert_produit', {
      p_id:             editProd?.id ?? null,
      p_nom:            prodForm.nom,
      p_description:    prodForm.description || null,
      p_photo_url:      photoUrl,
      p_prix_vente:     Number(prodForm.prix_vente),
      p_apport_minimum: Number(prodForm.apport_minimum),
      p_nb_mensualites: Number(prodForm.nb_mensualites_max),
      p_stock:          Number(prodForm.stock),
      p_stock_illimite: prodForm.stock_illimite,
      p_stock_seuil:    Number(prodForm.stock_seuil),
      p_actif:          prodForm.actif,
      p_en_vedette:     prodForm.en_vedette,
      p_etat:           prodForm.etat,
    })
    if (error) { alert('Erreur : ' + error.message); setSavingProd(false); return }

    setSavingProd(false)
    setPhotoFile(null); setPhotoPreview(null)
    setProdLoaded(false); await loadProduits()

    if (isNew && returnedId) {
      /* Basculer immédiatement en mode édition pour permettre l'upload des médias */
      const { data: newProd } = await supabase
        .from('cfa_produits').select('*').eq('id', returnedId as string).single()
      if (newProd) { setJustCreated(true); openEditProd(newProd as CFAProduit); return }
    }
    setJustCreated(false)
    setShowForm(false)
  }
  async function loadProdMedias(produitId: string) {
    setMediasLoading(true)
    const { data } = await supabase
      .from('cfa_produit_medias').select('*')
      .eq('produit_id', produitId).order('ordre')
    setProdMedias((data ?? []) as import('@/lib/supabase').CFAProduitMedia[])
    setMediasLoading(false)
  }

  async function handleUploadMedias(files: FileList, type: 'IMAGE' | 'VIDEO', produitId: string) {
    setUploadingMedia(true)
    const bucket = type === 'IMAGE' ? 'produit-photos' : 'produit-videos'
    const nextOrdre = prodMedias.length
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const ext  = f.name.split('.').pop()
      const path = `${produitId}/${Date.now()}-${i}.${ext}`
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, { upsert: true })
      if (upErr) { alert('Erreur upload : ' + upErr.message); continue }
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path)
      const { data: row } = await supabase
        .from('cfa_produit_medias')
        .insert({ produit_id: produitId, type, url: pub.publicUrl, ordre: nextOrdre + i })
        .select().single()
      if (row) setProdMedias(prev => [...prev, row as import('@/lib/supabase').CFAProduitMedia])
    }
    setUploadingMedia(false)
  }

  async function handleDeleteMedia(mediaId: string, url: string, type: 'IMAGE' | 'VIDEO') {
    const bucket = type === 'IMAGE' ? 'produit-photos' : 'produit-videos'
    const pathMatch = url.match(/\/object\/public\/[^/]+\/(.+)$/)
    if (pathMatch) await supabase.storage.from(bucket).remove([pathMatch[1]])
    await adminRpc('admin_delete_media', { p_media_id: mediaId })
    setProdMedias(prev => prev.filter(m => m.id !== mediaId))
  }

  async function handleDeleteProd(id: string) {
    if (!confirm('Supprimer ce produit ?')) return
    const { error } = await adminRpc('admin_delete_produit', { p_id: id })
    if (error) alert('Erreur : ' + error.message)
    else setProduits(prev => prev.filter(p => p.id !== id))
  }
  async function handleToggleActif(p: CFAProduit) {
    const { error } = await adminRpc('admin_upsert_produit', {
      p_id: p.id,
      p_nom: p.nom, p_description: p.description, p_prix_vente: p.prix_vente,
      p_apport_minimum: p.apport_minimum, p_nb_mensualites: p.nb_mensualites_max,
      p_stock: p.stock, p_stock_illimite: p.stock_illimite, p_stock_seuil: p.stock_seuil ?? 3, p_actif: !p.actif,
      p_en_vedette: p.en_vedette, p_etat: p.etat,
    })
    if (!error) setProduits(prev => prev.map(x => x.id === p.id ? { ...x, actif: !p.actif } : x))
  }

  function switchTab(t: Tab) {
    setTab(t)
    if ((t === 'commandes' || t === 'livraisons') && !cmdLoaded) loadCommandes()
    if (t === 'produits'  && !prodLoaded) loadProduits()
  }

  const filteredClients = clients.filter(c => {
    const ok = cliFilter === 'TOUS' || c.statut === cliFilter
    const q  = cliSearch.toLowerCase()
    return ok && (!q || [c.prenom, c.nom, c.telephone, c.matricule ?? '', c.region ?? ''].some(v => v.toLowerCase().includes(q)))
  })
  const produitOptions = [...new Set(commandes.map(c => c.produit?.nom ?? '').filter(Boolean))].sort()
  const moisOptions = [...new Set(
    commandes.map(c => (c.created_at ?? '').slice(0, 7)).filter(Boolean)
  )].sort().reverse()

  const filteredCmds = commandes.filter(c => {
    if (cmdFilter !== 'TOUS' && c.statut !== cmdFilter) return false
    if (cmdProduit && (c.produit?.nom ?? '') !== cmdProduit) return false
    if (cmdMois && !(c.created_at ?? '').startsWith(cmdMois)) return false
    const q   = cmdSearch.toLowerCase()
    const nom = `${c.client?.prenom ?? ''} ${c.client?.nom ?? ''}`.toLowerCase()
    return !q || nom.includes(q) || c.reference.toLowerCase().includes(q) || (c.produit?.nom ?? '').toLowerCase().includes(q)
  })

  const filteredVerse   = filteredCmds.reduce((s, c) => s + c.apport_paye, 0)
  const filteredRestant = filteredCmds.reduce((s, c) => s + c.reste_a_payer, 0)
  const filteredRetard  = filteredCmds.filter(c => c.versements.some(v => v.statut === 'EN_RETARD')).length

  const livCmds = commandes.filter(c => {
    const s = c.livraison?.statut ?? 'EN_ATTENTE'
    if (livFilter !== 'TOUS' && s !== livFilter) return false
    const q = livSearch.toLowerCase()
    const nom = `${c.client?.prenom ?? ''} ${c.client?.nom ?? ''}`.toLowerCase()
    return !q || nom.includes(q) || c.reference.toLowerCase().includes(q) || (c.client?.telephone ?? '').includes(q)
  })
  const livCounts = {
    enAttente: commandes.filter(c => !c.livraison || c.livraison.statut === 'EN_ATTENTE').length,
    planifiee: commandes.filter(c => c.livraison?.statut === 'PLANIFIEE').length,
    enRoute:   commandes.filter(c => c.livraison?.statut === 'EN_ROUTE').length,
    livree:    commandes.filter(c => c.livraison?.statut === 'LIVREE').length,
  }

  /* ── LOGIN ── */
  if (stage === 'login') return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="relative max-w-sm w-full">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-60 h-40 bg-brass/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative bg-surface border border-paper/6 rounded-2xl p-8 md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-brass/10 border border-brass/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-brass" />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/55">Accès restreint</div>
              <div className="font-display text-lg text-paper">Administration</div>
            </div>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/55 block mb-2">Mot de passe</label>
              <input type="password" required value={pwd}
                onChange={e => { setPwd(e.target.value); setPwdErr('') }}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={pwdErr.includes('bloqué') || pwdErr.includes('Réessayez')}
                className="w-full bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-base text-paper pb-2 transition-colors placeholder:text-paper/40 disabled:opacity-40" />
              {pwdErr && (
                <p className={`font-mono text-[10px] mt-2 ${pwdErr.includes('bloqué') || pwdErr.includes('Réessayez') ? 'text-clay flex items-center gap-1' : 'text-clay'}`}>
                  {(pwdErr.includes('bloqué') || pwdErr.includes('Réessayez')) && <Lock className="w-3 h-3 flex-shrink-0" />}
                  {pwdErr}
                </p>
              )}
            </div>
            <button type="submit"
              disabled={pwdErr.includes('bloqué') || pwdErr.includes('Réessayez')}
              className="w-full font-body font-medium bg-spruce-light text-paper py-3 rounded-full hover:bg-spruce transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
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
    { key: 'dashboard',   label: 'Vue d\'ensemble', icon: TrendingUp },
    { key: 'clients',     label: 'Dossiers',        icon: Users },
    { key: 'commandes',   label: 'Commandes',       icon: ShoppingBag },
    { key: 'livraisons',  label: 'Livraisons',      icon: Truck },
    { key: 'produits',    label: 'Produits',        icon: Package },
  ]

  return (
    <div className="min-h-screen px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LogoSG size={44} />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brass">CFA CUSEMS Authentique</div>
            <h1 className="font-display text-2xl md:text-3xl text-paper mt-0.5">
              Tableau de bord <span className="italic text-brass-light">administrateur</span>
            </h1>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 font-mono text-xs text-paper/60 hover:text-clay border border-paper/8 rounded-full px-4 py-2 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Déconnexion
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-surface border border-paper/8 rounded-xl p-1 mb-6 overflow-x-auto max-w-full">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => switchTab(key)}
            className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] px-3 md:px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              tab === key ? 'bg-void text-brass border border-brass/20' : 'text-paper/60 hover:text-paper/60'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ═══════ VUE D'ENSEMBLE ═══════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Bannière alerte stock bas */}
          {stockBas.length > 0 && (
            <div className="bg-clay/8 border border-clay/25 rounded-xl p-4 flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-medium text-clay uppercase tracking-[0.12em] mb-2">
                  Stock bas — {stockBas.length} produit{stockBas.length > 1 ? 's' : ''} à réapprovisionner
                </div>
                <div className="flex flex-wrap gap-2">
                  {stockBas.map(p => (
                    <button key={p.id} onClick={() => setTab('produits')}
                      className="font-mono text-[11px] bg-clay/10 border border-clay/20 text-paper/80 rounded-full px-3 py-1 hover:bg-clay/20 transition-colors">
                      {p.nom} — {p.stock === 0 ? 'épuisé' : `${p.stock} / ${p.stock_seuil}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Stats principales */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statsLoading
              ? Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-surface border border-paper/6 rounded-xl p-4 animate-pulse h-24" />
                ))
              : [
                  { emoji: '👨‍🏫', val: stats?.total_clients ?? clients.length, lbl: 'Fonctionnaires inscrits', color: 'text-paper' },
                  { emoji: '✅', val: stats?.versements_payes ?? 0,  lbl: 'Paiements à jour',         color: 'text-spruce-light' },
                  { emoji: '⚠️', val: stats?.versements_retard ?? 0, lbl: 'Versements en retard',     color: 'text-clay' },
                  { emoji: '💰', val: fcfa(stats?.fcfa_collectes ?? 0), lbl: 'FCFA collectés',        color: 'text-brass-light' },
                ].map(({ emoji, val, lbl, color }) => (
                  <div key={lbl} className="bg-surface border border-paper/6 rounded-xl p-4">
                    <div className="text-xl mb-2">{emoji}</div>
                    <div className={`font-display text-xl md:text-2xl ${color} leading-tight`}>{val}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55 mt-0.5">{lbl}</div>
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
              <div key={lbl} className="bg-surface border border-paper/6 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className={`font-display text-2xl ${color}`}>{val}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Graphiques */}
          {stats && !statsLoading && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pie — dossiers */}
              <div className="bg-surface border border-paper/6 rounded-2xl p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 mb-4">Répartition des dossiers</div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={[
                      { name: 'Validés',    value: stats.valides    },
                      { name: 'En attente', value: stats.en_attente },
                      { name: 'Rejetés',    value: stats.rejetes    },
                    ]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      <Cell fill="#4a8c6a" />
                      <Cell fill="#c9a84c" />
                      <Cell fill="#b85c4a" />
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f1410', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontFamily: 'monospace', fontSize: 11 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: 'monospace', fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar — versements */}
              <div className="bg-surface border border-paper/6 rounded-2xl p-5">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/50 mb-4">État des versements</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[
                    { name: 'Payés',    v: stats.versements_payes  },
                    { name: 'Retard',   v: stats.versements_retard },
                    { name: 'À venir',  v: Math.max(0, (stats.total_commandes * 6) - stats.versements_payes - stats.versements_retard) },
                  ]} barSize={32}>
                    <XAxis dataKey="name" tick={{ fontFamily: 'monospace', fontSize: 10, fill: 'rgba(240,235,220,0.45)' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: '#0f1410', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, fontFamily: 'monospace', fontSize: 11 }} />
                    <Bar dataKey="v" name="Versements" radius={[6,6,0,0]}>
                      <Cell fill="#4a8c6a" />
                      <Cell fill="#b85c4a" />
                      <Cell fill="rgba(255,255,255,0.12)" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Livraisons */}
          <div className="bg-surface border border-paper/6 rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-brass" />
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/70">Livraisons</div>
              </div>
              {(livStats?.en_attente ?? 0) + (livStats?.planifiee ?? 0) + (livStats?.en_route ?? 0) > 0 && (
                <button onClick={() => switchTab('commandes')}
                  className="font-mono text-[10px] uppercase tracking-[0.1em] text-brass hover:text-brass-light transition-colors">
                  Gérer →
                </button>
              )}
            </div>
            {statsLoading ? (
              <div className="flex gap-3">
                {Array(4).fill(0).map((_, i) => <div key={i} className="h-14 w-24 bg-surface-2 rounded-xl animate-pulse" />)}
              </div>
            ) : livStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { val: livStats.en_attente, lbl: 'En attente', color: livStats.en_attente > 0 ? 'text-brass-light' : 'text-paper/55' },
                  { val: livStats.planifiee,  lbl: 'Planifiées',  color: livStats.planifiee  > 0 ? 'text-paper/80'   : 'text-paper/55' },
                  { val: livStats.en_route,   lbl: 'En route',    color: livStats.en_route   > 0 ? 'text-spruce-light': 'text-paper/55' },
                  { val: livStats.livree,     lbl: 'Livrées',     color: 'text-spruce-light' },
                ].map(({ val, lbl, color }) => (
                  <div key={lbl} className="bg-surface-2 rounded-xl px-4 py-3">
                    <div className={`font-display text-2xl ${color}`}>{val}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 mt-0.5">{lbl}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-mono text-[10px] text-paper/45">Aucune donnée.</p>
            )}
          </div>

          {/* Rapport mensuel */}
          <div className="bg-surface border border-paper/6 rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-4 h-4 text-brass" />
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/70">Rapport mensuel</div>
            </div>
            <p className="font-body text-xs text-paper/55 mb-4 leading-relaxed">
              Excel 5 feuilles : Résumé · Nouveaux clients · Commandes · Versements encaissés · Retards
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select value={rapportMois} onChange={e => setRapportMois(e.target.value)}
                className="bg-surface-2 border border-paper/12 rounded-xl px-3 py-2 font-mono text-xs text-paper focus:border-brass/40 outline-none transition-colors">
                {Array.from({ length: 24 }, (_, i) => {
                  const d = new Date()
                  d.setDate(1)
                  d.setMonth(d.getMonth() - i)
                  const val = d.toISOString().slice(0, 7)
                  const lbl = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                  return <option key={val} value={val}>{lbl}</option>
                })}
              </select>
              <button onClick={() => exportRapportMensuel(rapportMois)} disabled={generatingRapport}
                className="flex items-center gap-2 bg-void text-brass border border-brass/25 font-mono text-xs px-5 py-2 rounded-xl hover:bg-brass/10 transition-colors disabled:opacity-50">
                {generatingRapport
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération…</>
                  : <><Download className="w-3.5 h-3.5" /> Générer le rapport</>
                }
              </button>
            </div>
          </div>

          {/* Recherche fonctionnaire */}
          <div className="bg-surface border border-paper/6 rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-brass" />
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/70">Recherche fonctionnaire</div>
            </div>

            {/* Sélecteur de critère */}
            <div className="flex gap-1 bg-surface-2 border border-paper/10 rounded-xl p-1 mb-4 w-fit">
              {([
                ['matricule', 'Matricule'],
                ['nom',       'Nom'],
                ['telephone', 'Téléphone'],
              ] as const).map(([mode, lbl]) => (
                <button key={mode} type="button" onClick={() => { setMatMode(mode); setMatResults('idle'); setMatSearch('') }}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg transition-colors ${
                    matMode === mode ? 'bg-surface text-brass border border-brass/20' : 'text-paper/60 hover:text-paper/60'
                  }`}>
                  {lbl}
                </button>
              ))}
            </div>

            <form onSubmit={handleMatSearch} className="flex gap-3">
              <input type={matMode === 'telephone' ? 'tel' : 'text'}
                value={matSearch} onChange={e => setMatSearch(e.target.value)}
                placeholder={
                  matMode === 'matricule' ? 'ex : 300501163/E' :
                  matMode === 'nom'       ? 'ex : Diallo ou Fatou' :
                                           'ex : 77 123 45 67'
                }
                className="flex-1 bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-sm text-paper pb-2 placeholder:text-paper/40 transition-colors" />
              <button type="submit"
                className="font-mono text-xs text-brass border border-brass/30 rounded-full px-4 py-1.5 hover:bg-brass/10 transition-colors">
                Chercher
              </button>
            </form>

            {/* Résultats */}
            {matResults !== 'idle' && (
              <div className="mt-4">
                {matResults.length === 0 ? (
                  <p className="font-body text-sm text-clay">Aucun fonctionnaire trouvé.</p>
                ) : (
                  <div className="space-y-3">
                    {matResults.map(c => (
                      <div key={c.id} className="bg-surface-2 border border-paper/10 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="font-display text-base text-paper">{c.prenom} {c.nom}</div>
                          <Badge statut={c.statut} s={CLI_STYLE} l={CLI_LBL} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 font-mono text-xs text-paper/70">
                          <div><span className="text-paper/45 block text-[9px] uppercase tracking-wider mb-0.5">Téléphone</span>{c.telephone.replace(/^221/, '')}</div>
                          <div><span className="text-paper/45 block text-[9px] uppercase tracking-wider mb-0.5">Matricule</span>{c.matricule ?? '—'}</div>
                          <div><span className="text-paper/45 block text-[9px] uppercase tracking-wider mb-0.5">Corps</span>{c.corps ?? '—'}</div>
                          <div><span className="text-paper/45 block text-[9px] uppercase tracking-wider mb-0.5">IA / Académie</span>{c.ia ?? '—'}</div>
                          <div><span className="text-paper/45 block text-[9px] uppercase tracking-wider mb-0.5">Région</span>{c.region ?? '—'}</div>
                          <div><span className="text-paper/45 block text-[9px] uppercase tracking-wider mb-0.5">Inscription</span>{fmt((c as CFAClient & { created_at: string }).created_at)}</div>
                        </div>
                      </div>
                    ))}
                    {matResults.length === 10 && (
                      <p className="font-mono text-[10px] text-paper/45 text-center">Affichage limité à 10 résultats — affinez la recherche.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Répartition par région */}
          {stats?.regions && stats.regions.length > 0 && (
            <div className="bg-surface border border-paper/6 rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-5">
                <MapPin className="w-4 h-4 text-brass" />
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/70">Fonctionnaires par région</div>
              </div>
              <div className="space-y-2.5">
                {stats.regions.map(r => {
                  const max = stats.regions![0].nb_clients
                  const pct = Math.round((r.nb_clients / max) * 100)
                  return (
                    <div key={r.region} className="flex items-center gap-3">
                      <span className="font-mono text-xs text-paper/70 w-28 flex-shrink-0">{r.region}</span>
                      <div className="flex-1 h-1.5 bg-paper/8 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-spruce to-spruce-light rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-xs text-paper/65 w-6 text-right flex-shrink-0">{r.nb_clients}</span>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/45" />
              <input type="text" placeholder="Nom, téléphone, matricule, région…"
                value={cliSearch} onChange={e => setCliSearch(e.target.value)}
                className="w-full bg-surface border border-paper/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/65 focus:border-brass/40 outline-none transition-colors" />
            </div>
            <div className="flex gap-1 bg-surface border border-paper/8 rounded-xl p-1">
              {(['TOUS', 'EN_ATTENTE', 'VALIDE', 'REJETE'] as ClientFilter[]).map(f => (
                <button key={f} onClick={() => setCliFilter(f)}
                  className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg transition-colors ${
                    cliFilter === f ? 'bg-void text-brass border border-brass/20' : 'text-paper/60 hover:text-paper/60'
                  }`}>
                  {f === 'TOUS' ? 'Tous' : f === 'EN_ATTENTE' ? 'Attente' : f === 'VALIDE' ? 'Validés' : 'Rejetés'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/45">
              {filteredClients.length} dossier{filteredClients.length > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => { setImportOpen(o => !o); setImportRows([]); setImportResult(null) }}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/65 hover:text-spruce-light border border-paper/8 hover:border-spruce/30 rounded-lg px-3 py-1.5 transition-colors">
                <Upload className="w-3 h-3" /> Importer
              </button>
              {filteredClients.length > 0 && (
                <button onClick={exportClients}
                  className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/65 hover:text-brass border border-paper/8 hover:border-brass/30 rounded-lg px-3 py-1.5 transition-colors">
                  <Download className="w-3 h-3" /> Excel
                </button>
              )}
            </div>
          </div>

          {/* Panel import Excel */}
          {importOpen && (
            <div className="bg-surface border border-paper/8 rounded-2xl p-5 mb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-xs font-medium text-paper/80 uppercase tracking-[0.12em]">
                  Importer des clients depuis Excel
                </div>
                <button onClick={() => setImportOpen(false)} className="text-paper/40 hover:text-paper/70">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Format attendu */}
              <div className="bg-surface-2 rounded-xl p-3 text-paper/55 font-mono text-[10px] leading-relaxed">
                Colonnes reconnues : <span className="text-paper/75">Prénom · Nom · Téléphone · Matricule · Corps · Région · IA / Académie · IEF · École · Statut</span>
                <br />Téléphone = clé unique — un client existant sera mis à jour.
              </div>

              {/* Sélecteur de fichier */}
              {!importResult && (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-paper/12 hover:border-brass/30 rounded-xl p-6 cursor-pointer transition-colors group">
                  <Upload className="w-6 h-6 text-paper/35 group-hover:text-brass/60 transition-colors" />
                  <span className="font-mono text-xs text-paper/50 group-hover:text-paper/70 transition-colors">
                    Cliquer ou glisser un fichier .xlsx
                  </span>
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                    onChange={handleImportFile} />
                </label>
              )}

              {/* Aperçu des lignes parsées */}
              {importRows.length > 0 && !importResult && (
                <div className="space-y-3">
                  <div className="font-mono text-[11px] text-paper/60">
                    <span className="text-spruce-light font-medium">{importRows.length} ligne{importRows.length > 1 ? 's' : ''}</span> avec téléphone détectées
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-paper/6">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-paper/5 bg-surface-2">
                          {['Prénom','Nom','Téléphone','Matricule','Corps','Région'].map(h => (
                            <th key={h} className="px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-b border-paper/4 last:border-0">
                            <td className="px-3 py-2 font-body text-xs text-paper/80">{r.prenom}</td>
                            <td className="px-3 py-2 font-body text-xs text-paper/80">{r.nom}</td>
                            <td className="px-3 py-2 font-mono text-xs text-paper/70">{r.telephone}</td>
                            <td className="px-3 py-2 font-mono text-xs text-paper/55">{r.matricule ?? '—'}</td>
                            <td className="px-3 py-2 font-body text-xs text-paper/55">{r.corps ?? '—'}</td>
                            <td className="px-3 py-2 font-body text-xs text-paper/55">{r.region ?? '—'}</td>
                          </tr>
                        ))}
                        {importRows.length > 5 && (
                          <tr><td colSpan={6} className="px-3 py-2 font-mono text-[10px] text-paper/40 text-center">
                            + {importRows.length - 5} autres lignes…
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <button onClick={handleImportConfirm} disabled={importLoading}
                    className="flex items-center gap-2 bg-spruce text-paper font-mono text-xs px-5 py-2.5 rounded-xl hover:bg-spruce-dark transition-colors disabled:opacity-50">
                    {importLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Import en cours…</>
                      : <><Upload className="w-3.5 h-3.5" /> Importer {importRows.length} client{importRows.length > 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              )}

              {/* Résultats */}
              {importResult && (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 font-mono text-sm font-medium ${importResult.upserted > 0 ? 'text-spruce-light' : 'text-clay'}`}>
                    {importResult.upserted > 0
                      ? <><CheckCircle2 className="w-4 h-4" /> {importResult.upserted} client{importResult.upserted > 1 ? 's' : ''} importé{importResult.upserted > 1 ? 's' : ''} avec succès</>
                      : <><XCircle className="w-4 h-4" /> Aucun client importé</>
                    }
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-clay/80 mb-1.5">
                        {importResult.errors.length} erreur{importResult.errors.length > 1 ? 's' : ''}
                      </div>
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="font-mono text-[10px] text-paper/60 bg-clay/5 border border-clay/15 rounded-lg px-3 py-1.5">
                          Ligne {e.ligne}{e.tel ? ` (${e.tel})` : ''} — {e.erreur}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setImportRows([]); setImportResult(null) }}
                    className="font-mono text-[10px] text-paper/50 hover:text-paper/70 underline underline-offset-2 transition-colors">
                    Importer un autre fichier
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="bg-surface border border-paper/6 rounded-2xl overflow-hidden">
            {filteredClients.length === 0
              ? <div className="py-16 text-center font-body text-paper/55 text-sm">Aucun dossier trouvé.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-paper/5">
                        {['Nom & Prénom', 'Téléphone', 'Matricule', 'Corps / Région', 'Date', 'Statut', 'Actions'].map(h => (
                          <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.15em] text-paper/45 px-4 py-3 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((c, i) => (
                        <>
                          <tr key={c.id}
                            className={`border-b border-paper/4 hover:bg-paper/2 transition-colors cursor-pointer ${i % 2 ? 'bg-void/30' : ''}`}
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
                              <span className="font-mono text-xs text-paper/60">{fmt(c.created_at)}</span>
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
                                    {c.statut === 'VALIDE' && (
                                      <button onClick={() => { setNewCmdClient(c); loadProduits() }}
                                        className="flex items-center gap-1 font-mono text-[10px] uppercase text-brass border border-brass/30 rounded-full px-2.5 py-1 hover:bg-brass/10 transition-colors">
                                        <Plus className="w-3 h-3" /> Commande
                                      </button>
                                    )}
                                    <ChevronDown className={`w-3.5 h-3.5 text-paper/65 transition-transform ${cliExpand === c.id ? 'rotate-180' : ''}`} />
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {cliExpand === c.id && (
                            <tr key={`${c.id}-d`} className="bg-void/50 border-b border-paper/4">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  {[
                                    { lbl: 'IA / Académie', val: c.ia }, { lbl: 'IEF', val: c.ief },
                                    { lbl: 'École / Poste', val: c.ecole }, { lbl: 'Type agent', val: c.type_enseignant },
                                    { lbl: 'Ministère', val: c.ministere }, { lbl: 'Grade', val: c.grade },
                                  ].map(({ lbl, val }) => val ? (
                                    <div key={lbl}>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 mb-0.5">{lbl}</div>
                                      <div className="font-body text-paper/55 text-xs">{val}</div>
                                    </div>
                                  ) : null)}
                                  {c.cni_url && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 mb-1.5">CNI Recto</div>
                                      <SignedDocLink path={c.cni_url} label="Ouvrir CNI recto" />
                                    </div>
                                  )}
                                  {c.notes?.startsWith('CNI_VERSO:') && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 mb-1.5">CNI Verso</div>
                                      <SignedDocLink path={c.notes.replace('CNI_VERSO:', '')} label="Ouvrir CNI verso" />
                                    </div>
                                  )}
                                  {c.bulletin_url && (
                                    <div>
                                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 mb-1.5">Bulletin salaire</div>
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
                    { val: filteredCmds.length,   lbl: 'Commandes',       color: 'text-paper' },
                    { val: filteredRetard,          lbl: 'En retard',       color: filteredRetard > 0 ? 'text-clay' : 'text-paper/50' },
                    { val: fcfa(filteredVerse),     lbl: 'Total collecté',  color: 'text-spruce-light' },
                    { val: fcfa(filteredRestant),   lbl: 'Restant à collecter', color: 'text-brass-light' },
                  ].map(({ val, lbl, color }) => (
                    <div key={lbl} className="bg-surface border border-paper/6 rounded-xl p-4">
                      <div className={`font-display text-lg md:text-xl ${color} leading-tight`}>{val}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/45" />
                    <input type="text" placeholder="Référence, client, produit…"
                      value={cmdSearch} onChange={e => setCmdSearch(e.target.value)}
                      className="w-full bg-surface border border-paper/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/65 focus:border-brass/40 outline-none transition-colors" />
                  </div>
                  <div className="flex gap-1 bg-surface border border-paper/8 rounded-xl p-1">
                    {(['TOUS', 'EN_COURS', 'SOLDE', 'ANNULE'] as CommandeFilter[]).map(f => (
                      <button key={f} onClick={() => setCmdFilter(f)}
                        className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg transition-colors ${
                          cmdFilter === f ? 'bg-void text-brass border border-brass/20' : 'text-paper/60 hover:text-paper/60'
                        }`}>
                        {f === 'TOUS' ? 'Tous' : f === 'EN_COURS' ? 'En cours' : f === 'SOLDE' ? 'Soldées' : 'Annulées'}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Filtres avancés : produit + mois */}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <select value={cmdProduit} onChange={e => setCmdProduit(e.target.value)}
                    className="flex-1 bg-surface border border-paper/8 rounded-xl px-3 py-2 font-mono text-xs text-paper/80 focus:border-brass/40 outline-none transition-colors">
                    <option value="">Tous les produits</option>
                    {produitOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <select value={cmdMois} onChange={e => setCmdMois(e.target.value)}
                    className="flex-1 bg-surface border border-paper/8 rounded-xl px-3 py-2 font-mono text-xs text-paper/80 focus:border-brass/40 outline-none transition-colors">
                    <option value="">Tous les mois</option>
                    {moisOptions.map(m => {
                      const [y, mo] = m.split('-')
                      const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                      return <option key={m} value={m}>{label}</option>
                    })}
                  </select>
                  {(cmdProduit || cmdMois) && (
                    <button onClick={() => { setCmdProduit(''); setCmdMois('') }}
                      className="flex items-center gap-1 font-mono text-[10px] text-paper/50 hover:text-clay border border-paper/8 rounded-xl px-3 py-2 transition-colors whitespace-nowrap">
                      <X className="w-3 h-3" /> Réinitialiser
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/45">
                    {filteredCmds.length} commande{filteredCmds.length > 1 ? 's' : ''}
                  </span>
                  {commandes.length > 0 && (
                    <button onClick={exportCommandes}
                      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/65 hover:text-brass border border-paper/8 hover:border-brass/30 rounded-lg px-3 py-1.5 transition-colors">
                      <Download className="w-3 h-3" /> Excel
                    </button>
                  )}
                </div>
                <div className="bg-surface border border-paper/6 rounded-2xl overflow-hidden">
                  {filteredCmds.length === 0
                    ? <div className="py-16 text-center font-body text-paper/55 text-sm">Aucune commande.</div>
                    : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-paper/5">
                              {['Référence', 'Client', 'Produit', 'Total', 'Versé', 'Reste', 'Mensualités', 'Statut'].map(h => (
                                <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.15em] text-paper/45 px-4 py-3 whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredCmds.map((cmd, i) => {
                              const payees  = cmd.versements.filter(v => v.statut === 'PAYE').length
                              const total   = cmd.versements.length || cmd.nb_mensualites
                              const retard  = cmd.versements.filter(v => v.statut === 'EN_RETARD').length
                              const livEdit: LivEdit = livEdits[cmd.id] ?? {
                                statut:        cmd.livraison?.statut ?? 'EN_ATTENTE',
                                livreur:       cmd.livraison?.livreur_nom ?? '',
                                tel:           cmd.livraison?.livreur_telephone ?? '',
                                suivi:         cmd.livraison?.numero_suivi ?? '',
                                datePlanifiee: cmd.livraison?.date_planifiee?.slice(0, 10) ?? '',
                              }
                              return (
                                <>
                                  <tr key={cmd.id}
                                    className={`border-b border-paper/4 hover:bg-paper/2 transition-colors cursor-pointer ${i % 2 ? 'bg-void/30' : ''}`}
                                    onClick={() => setCmdExpand(cmdExpand === cmd.id ? null : cmd.id)}>
                                    <td className="px-4 py-3"><span className="font-mono text-xs text-brass-light">{cmd.reference}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="font-body text-sm text-paper">{cmd.client?.prenom} {cmd.client?.nom}</div>
                                      <div className="font-mono text-[10px] text-paper/60">{cmd.client?.telephone.replace(/^221/, '')}</div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-body text-xs text-paper/60">{cmd.produit?.nom ?? '—'}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs text-paper/60">{fcfa(cmd.prix_vente)}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap"><span className="font-mono text-xs text-spruce-light">{fcfa(cmd.apport_paye)}</span></td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className={`font-mono text-xs ${cmd.reste_a_payer > 0 ? 'text-clay' : 'text-spruce-light'}`}>{fcfa(cmd.reste_a_payer)}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 h-1 bg-paper/8 rounded-full overflow-hidden">
                                          <div className="h-full bg-spruce-light rounded-full" style={{ width: total > 0 ? `${Math.round(payees/total*100)}%` : '0%' }} />
                                        </div>
                                        <span className="font-mono text-[10px] text-paper/65">{payees}/{total}</span>
                                        {retard > 0 && <AlertCircle className="w-3 h-3 text-clay" />}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><Badge statut={cmd.statut} s={CMD_STYLE} l={CMD_LBL} /></td>
                                  </tr>
                                  {cmdExpand === cmd.id && (
                                    <tr key={`${cmd.id}-d`} className="bg-void/50 border-b border-paper/4">
                                      <td colSpan={8} className="px-4 py-4">
                                        <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/55 mb-3">
                                          Échéancier · {cmd.montant_mensualite > 0 ? `${fcfa(cmd.montant_mensualite)} / mois` : ''}
                                          {cmd.date_fin_prevue ? ` · Fin prévue ${fmt(cmd.date_fin_prevue)}` : ''}
                                        </div>
                                        {cmd.versements.length === 0
                                          ? <p className="font-body text-paper/55 text-xs">Aucun versement.</p>
                                          : (
                                            <div className="space-y-1.5 max-w-xl">
                                              {cmd.versements.map(v => (
                                                <div key={v.id} className="flex items-center gap-3 font-mono text-xs">
                                                  <span className="text-paper/60 w-5">#{v.numero_versement}</span>
                                                  <span className="text-paper/65 w-20">{fmt(v.date_echeance)}</span>
                                                  <span className="text-paper/60 w-24 text-right">{fcfa(v.montant_prevu)}</span>
                                                  {v.date_paiement && <span className="text-paper/55 hidden md:inline">payé {fmt(v.date_paiement)}</span>}
                                                  <Badge statut={v.statut} s={VER_STYLE} l={VER_LBL} />
                                                  {(v.statut === 'EN_ATTENTE' || v.statut === 'EN_RETARD') && cmd.statut === 'EN_COURS' && (
                                                    markingVers === v.id
                                                      ? <Loader2 className="w-3.5 h-3.5 text-brass animate-spin ml-1" />
                                                      : (
                                                        <button onClick={() => handleMarquerPaye(v.id, cmd.id)}
                                                          className="ml-1 flex items-center gap-1 text-[10px] uppercase text-spruce-light border border-spruce/30 rounded-full px-2 py-0.5 hover:bg-spruce/10 transition-colors whitespace-nowrap">
                                                          <CheckCircle2 className="w-3 h-3" /> Espèces
                                                        </button>
                                                      )
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                        {/* ── Livraison ── */}
                                        <div className="mt-4 pt-4 border-t border-paper/8">
                                          <div className="flex items-center gap-2 mb-3">
                                            <Truck className="w-3.5 h-3.5 text-brass/70" />
                                            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/55">Livraison</span>
                                            {cmd.livraison && <Badge statut={cmd.livraison.statut} s={LIV_STYLE} l={LIV_LBL} />}
                                          </div>
                                          {/* Étapes */}
                                          <div className="flex gap-1.5 flex-wrap mb-3">
                                            {LIV_STEPS.map(({ key, lbl }) => (
                                              <button key={key} type="button"
                                                onClick={() => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, statut: key } }))}
                                                className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1 rounded-full border transition-colors ${
                                                  livEdit.statut === key
                                                    ? 'bg-brass/15 border-brass/40 text-brass'
                                                    : 'border-paper/10 text-paper/55 hover:border-paper/20 hover:text-paper/60'
                                                }`}>
                                                {lbl}
                                              </button>
                                            ))}
                                          </div>
                                          {/* Détails livreur */}
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 max-w-2xl">
                                            <input
                                              placeholder="Nom livreur"
                                              value={livEdit.livreur}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, livreur: e.target.value } }))}
                                              className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors" />
                                            <input
                                              placeholder="Tél livreur"
                                              value={livEdit.tel}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, tel: e.target.value } }))}
                                              className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors" />
                                            <input
                                              placeholder="N° suivi"
                                              value={livEdit.suivi}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, suivi: e.target.value } }))}
                                              className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors" />
                                            <input
                                              type="date"
                                              title="Date de livraison prévue"
                                              value={livEdit.datePlanifiee}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, datePlanifiee: e.target.value } }))}
                                              className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper/70 focus:border-brass/40 outline-none transition-colors" />
                                          </div>
                                          <button
                                            onClick={() => handleUpdateLivraison(cmd.id, livEdit)}
                                            disabled={savingLiv === cmd.id}
                                            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-spruce-light border border-spruce/30 rounded-full px-3 py-1.5 hover:bg-spruce/10 transition-colors disabled:opacity-50">
                                            {savingLiv === cmd.id
                                              ? <Loader2 className="w-3 h-3 animate-spin" />
                                              : <Truck className="w-3 h-3" />}
                                            {cmd.livraison ? 'Mettre à jour la livraison' : 'Créer la livraison'}
                                          </button>
                                        </div>
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
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/45">
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
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-brass mb-3">
                {editProd ? `Modifier — ${editProd.nom}` : 'Nouveau produit'}
              </div>
              {justCreated && (
                <div className="flex items-center gap-2 bg-spruce/15 border border-spruce/25 rounded-xl px-4 py-2.5 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-spruce-light flex-shrink-0" />
                  <p className="font-body text-sm text-spruce-light">Produit créé ! Ajoutez maintenant vos photos et vidéos ci-dessous.</p>
                </div>
              )}
              <form onSubmit={handleSaveProd}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <FormField label="Nom du produit *">
                    <input required value={prodForm.nom} onChange={e => setProdForm(p => ({ ...p, nom: e.target.value }))}
                      placeholder="ex : Samsung Galaxy A55"
                      className="w-full bg-transparent border-b border-paper/12 focus:border-brass outline-none font-body text-sm text-paper pb-1.5 placeholder:text-paper/40 transition-colors" />
                  </FormField>
                  <FormField label="État">
                    <select value={prodForm.etat} onChange={e => setProdForm(p => ({ ...p, etat: e.target.value }))}
                      className="w-full bg-transparent border-b border-paper/12 focus:border-brass outline-none font-body text-sm text-paper pb-1.5 transition-colors">
                      <option value="NEUF">Neuf</option>
                      <option value="BON_ETAT">Bon état</option>
                      <option value="OCCASION">Occasion</option>
                    </select>
                  </FormField>
                  <FormField label="Prix de vente (FCFA) *">
                    <input required type="number" min="0" value={prodForm.prix_vente}
                      onChange={e => setProdForm(p => ({ ...p, prix_vente: +e.target.value }))}
                      className="w-full bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                  </FormField>
                  <FormField label="Apport minimum (FCFA) *">
                    <input required type="number" min="0" value={prodForm.apport_minimum}
                      onChange={e => setProdForm(p => ({ ...p, apport_minimum: +e.target.value }))}
                      className="w-full bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                  </FormField>
                  <FormField label="Nb mensualités max">
                    <input type="number" min="1" max="36" value={prodForm.nb_mensualites_max}
                      onChange={e => setProdForm(p => ({ ...p, nb_mensualites_max: +e.target.value }))}
                      className="w-full bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                  </FormField>
                  <FormField label={prodForm.stock_illimite ? 'Stock illimité' : 'Stock disponible'}>
                    <div className="flex items-center gap-3">
                      {!prodForm.stock_illimite && (
                        <input type="number" min="0" value={prodForm.stock}
                          onChange={e => setProdForm(p => ({ ...p, stock: +e.target.value }))}
                          className="w-24 bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={prodForm.stock_illimite}
                          onChange={e => setProdForm(p => ({ ...p, stock_illimite: e.target.checked }))}
                          className="accent-brass" />
                        <span className="font-mono text-xs text-paper/70">Illimité</span>
                      </label>
                    </div>
                  </FormField>
                  {!prodForm.stock_illimite && (
                    <FormField label="Seuil d'alerte stock">
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={prodForm.stock_seuil}
                          onChange={e => setProdForm(p => ({ ...p, stock_seuil: +e.target.value }))}
                          className="w-24 bg-transparent border-b border-paper/12 focus:border-brass outline-none font-mono text-sm text-paper pb-1.5 transition-colors" />
                        <span className="font-mono text-xs text-paper/50">unités min avant alerte</span>
                      </div>
                    </FormField>
                  )}
                </div>
                <FormField label="Description">
                  <textarea value={prodForm.description}
                    onChange={e => setProdForm(p => ({ ...p, description: e.target.value }))}
                    rows={2} placeholder="Description courte du produit…"
                    className="w-full bg-surface-2 border border-paper/12 rounded-lg p-2.5 font-body text-sm text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none resize-none transition-colors" />
                </FormField>

                {/* ── Médias (images + vidéos) ── */}
                <div className="mt-4 mb-2">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 mb-3">
                    Photos &amp; vidéos
                  </div>

                  {/* Grille des médias existants */}
                  {mediasLoading ? (
                    <div className="flex items-center gap-2 text-paper/45 text-xs mb-3">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…
                    </div>
                  ) : prodMedias.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                      {prodMedias.map(m => (
                        <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden border border-paper/8 bg-void group/m">
                          {m.type === 'IMAGE' ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-paper/4">
                              <Plus className="w-5 h-5 text-paper/65 rotate-45" />
                              <span className="font-mono text-[9px] text-paper/45">Vidéo</span>
                            </div>
                          )}
                          <button type="button"
                            onClick={() => handleDeleteMedia(m.id, m.url, m.type)}
                            className="absolute top-1 right-1 opacity-0 group-hover/m:opacity-100 bg-void/80 rounded-full p-0.5 text-clay hover:text-red-400 transition-opacity">
                            <XCircle className="w-4 h-4" />
                          </button>
                          <span className={`absolute bottom-1 left-1 font-mono text-[8px] uppercase px-1.5 py-0.5 rounded-full ${m.type === 'IMAGE' ? 'bg-spruce/40 text-spruce-light' : 'bg-brass/30 text-brass-light'}`}>
                            {m.type === 'IMAGE' ? 'IMG' : 'VID'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Boutons d'upload — actifs seulement si le produit est déjà enregistré */}
                  {editProd ? (
                    <div className="flex flex-wrap gap-2">
                      <label className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] border border-dashed rounded-xl px-3 py-2 cursor-pointer transition-colors ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : 'border-paper/15 hover:border-brass/40 text-paper/65 hover:text-brass'}`}>
                        {uploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 rotate-180" />}
                        + Images
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingMedia}
                          onChange={e => { if (e.target.files?.length) handleUploadMedias(e.target.files, 'IMAGE', editProd.id) }} />
                      </label>
                      <label className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] border border-dashed rounded-xl px-3 py-2 cursor-pointer transition-colors ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : 'border-paper/15 hover:border-brass/40 text-paper/65 hover:text-brass'}`}>
                        {uploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 rotate-180" />}
                        + Vidéo MP4
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploadingMedia}
                          onChange={e => { if (e.target.files?.length) handleUploadMedias(e.target.files, 'VIDEO', editProd.id) }} />
                      </label>
                      <span className="font-mono text-[9px] text-paper/60 self-center">max 50 Mo par vidéo · JPG/PNG/WebP pour images</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border border-dashed border-paper/15 rounded-xl px-4 py-3 text-paper/50">
                      <span className="font-mono text-[10px]">👆 Remplis les infos ci-dessus puis clique <strong className="text-paper/75">"Créer le produit"</strong> — les boutons photos &amp; vidéos apparaîtront ici automatiquement.</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-6 mt-3 mb-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prodForm.actif}
                      onChange={e => setProdForm(p => ({ ...p, actif: e.target.checked }))} className="accent-brass" />
                    <span className="font-mono text-xs text-paper/70">Actif (visible)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={prodForm.en_vedette}
                      onChange={e => setProdForm(p => ({ ...p, en_vedette: e.target.checked }))} className="accent-brass" />
                    <span className="font-mono text-xs text-paper/70">En vedette</span>
                  </label>
                </div>
                <div className="flex gap-3">
                  <button type="submit" disabled={savingProd}
                    className="flex items-center gap-2 font-body text-sm font-medium bg-spruce-light text-paper px-6 py-2.5 rounded-full hover:bg-spruce transition-colors disabled:opacity-50">
                    {savingProd ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {editProd ? 'Enregistrer' : 'Créer le produit'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    className="font-body text-sm text-paper/65 border border-paper/8 px-6 py-2.5 rounded-full hover:text-paper/60 transition-colors">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {prodLoading
            ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 text-brass animate-spin" /></div>
            : produits.length === 0
              ? <div className="py-16 text-center font-body text-paper/55 text-sm">Aucun produit. Créez-en un ci-dessus.</div>
              : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {produits.map(p => (
                    <div key={p.id} className={`bg-surface border rounded-2xl p-5 transition-colors ${p.actif ? 'border-paper/6' : 'border-paper/3 opacity-60'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-base text-paper leading-tight">{p.nom}</span>
                            {p.en_vedette && <Star className="w-3.5 h-3.5 text-brass flex-shrink-0" fill="currentColor" />}
                          </div>
                          {p.description && (
                            <p className="font-body text-xs text-paper/65 mt-1 leading-relaxed">{p.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                          <button onClick={() => openEditProd(p)}
                            className="w-7 h-7 flex items-center justify-center text-paper/55 hover:text-brass transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteProd(p.id)}
                            className="w-7 h-7 flex items-center justify-center text-paper/55 hover:text-clay transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-surface-2 rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/45 mb-0.5">Prix</div>
                          <div className="font-mono text-xs text-brass-light">{fcfa(p.prix_vente)}</div>
                        </div>
                        <div className="bg-surface-2 rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/45 mb-0.5">Apport</div>
                          <div className="font-mono text-xs text-paper/60">{fcfa(p.apport_minimum)}</div>
                        </div>
                        <div className="bg-surface-2 rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/45 mb-0.5">Mensualités</div>
                          <div className="font-mono text-xs text-paper/60">max {p.nb_mensualites_max}×</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${
                            p.etat === 'NEUF' ? 'text-spruce-light border-spruce/25 bg-spruce/10'
                            : p.etat === 'BON_ETAT' ? 'text-brass border-brass/25 bg-brass/10'
                            : 'text-paper/65 border-paper/10 bg-paper/4'
                          }`}>
                            {p.etat === 'NEUF' ? 'Neuf' : p.etat === 'BON_ETAT' ? 'Bon état' : 'Occasion'}
                          </span>
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                            p.stock_illimite ? 'text-spruce-light'
                            : p.stock === 0 ? 'text-clay font-semibold'
                            : p.stock <= (p.stock_seuil ?? 3) ? 'text-brass-light'
                            : 'text-paper/70'
                          }`}>
                            {p.stock_illimite ? '∞ illimité'
                              : p.stock === 0 ? '⚠ épuisé'
                              : p.stock <= (p.stock_seuil ?? 3) ? `⚠ ${p.stock} en stock`
                              : `${p.stock} en stock`}
                          </span>
                        </div>
                        <button onClick={() => handleToggleActif(p)}
                          className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${p.actif ? 'text-spruce-light' : 'text-paper/55'}`}>
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

      {/* ── Modal : créer une commande ── */}
      {newCmdClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 backdrop-blur-sm p-4"
          onClick={() => !creatingCmd && setNewCmdClient(null)}>
          <div className="bg-void border border-paper/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg text-brass">Créer une commande</h2>
              <button onClick={() => setNewCmdClient(null)} className="text-paper/55 hover:text-paper/60 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Client info (lecture seule) */}
            <div className="bg-paper/4 rounded-xl px-4 py-3 mb-5">
              <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/55 mb-0.5">Client</div>
              <div className="font-body text-paper/80 text-sm">{newCmdClient.prenom} {newCmdClient.nom}</div>
              <div className="font-mono text-[10px] text-paper/65">{newCmdClient.telephone} · {newCmdClient.matricule}</div>
            </div>

            <form onSubmit={handleCreateCommande} className="space-y-4">
              {/* Produit */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 block mb-1.5">Produit</label>
                {prodLoading ? (
                  <div className="flex items-center gap-2 text-paper/55 text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
                ) : (
                  <select value={newCmdProduit} onChange={e => setNewCmdProduit(e.target.value)} required
                    className="w-full bg-paper/6 border border-paper/10 rounded-xl px-3 py-2.5 text-paper text-sm focus:outline-none focus:border-brass/50 transition-colors">
                    <option value="">-- Sélectionner un produit --</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} — {p.prix_vente.toLocaleString('fr-FR')} FCFA</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Nb mensualités */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 block mb-1.5">
                  Nombre de mensualités : <span className="text-brass">{newCmdMens}</span>
                </label>
                <input type="range" min={1} max={24} value={newCmdMens}
                  onChange={e => setNewCmdMens(Number(e.target.value))}
                  className="w-full accent-brass" />
                <div className="flex justify-between font-mono text-[9px] text-paper/45 mt-0.5">
                  <span>1</span><span>12</span><span>24</span>
                </div>
              </div>

              {/* Apport payé */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 block mb-1.5">Apport déjà payé (FCFA)</label>
                <input type="number" min={0} value={newCmdApport}
                  onChange={e => setNewCmdApport(Number(e.target.value))}
                  className="w-full bg-paper/6 border border-paper/10 rounded-xl px-3 py-2.5 text-paper text-sm focus:outline-none focus:border-brass/50 transition-colors" />
              </div>

              {/* Moyen de paiement */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 block mb-1.5">Moyen de paiement apport</label>
                <div className="grid grid-cols-3 gap-2">
                  {[['ESPECES', 'Espèces'], ['WAVE', 'Wave'], ['ORANGE', 'Orange']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setNewCmdMoyen(val)}
                      className={`font-mono text-[10px] uppercase py-2 rounded-xl border transition-colors ${newCmdMoyen === val ? 'bg-brass/15 border-brass/50 text-brass' : 'border-paper/10 text-paper/65 hover:border-paper/20'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={creatingCmd || !newCmdProduit}
                className="w-full flex items-center justify-center gap-2 bg-brass text-void font-mono text-xs uppercase tracking-[0.15em] py-3 rounded-xl hover:bg-brass/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                {creatingCmd ? <><Loader2 className="w-4 h-4 animate-spin" /> Création…</> : <><Plus className="w-4 h-4" /> Créer la commande</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════ LIVRAISONS ═══════ */}
      {tab === 'livraisons' && (
        <>
          {cmdLoading
            ? <div className="flex justify-center py-20"><Loader2 className="w-5 h-5 text-brass animate-spin" /></div>
            : (
              <>
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { val: livCounts.enAttente, lbl: 'En attente',  color: livCounts.enAttente > 0 ? 'text-brass-light' : 'text-paper/50' },
                    { val: livCounts.planifiee, lbl: 'Planifiées',  color: 'text-paper/70' },
                    { val: livCounts.enRoute,   lbl: 'En route',    color: 'text-spruce-light' },
                    { val: livCounts.livree,    lbl: 'Livrées ✓',  color: 'text-spruce-light' },
                  ].map(({ val, lbl, color }) => (
                    <div key={lbl} className="bg-surface border border-paper/6 rounded-xl p-4">
                      <div className={`font-display text-2xl ${color} leading-tight`}>{val}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>

                {/* Filtres */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/45" />
                    <input type="text" placeholder="Client, téléphone, référence…"
                      value={livSearch} onChange={e => setLivSearch(e.target.value)}
                      className="w-full bg-surface border border-paper/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/65 focus:border-brass/40 outline-none transition-colors" />
                  </div>
                  <div className="flex gap-1 bg-surface border border-paper/8 rounded-xl p-1">
                    {(['TOUS', 'EN_ATTENTE', 'PLANIFIEE', 'EN_ROUTE', 'LIVREE']).map(f => (
                      <button key={f} onClick={() => setLivFilter(f)}
                        className={`font-mono text-[10px] uppercase tracking-[0.08em] px-2.5 py-1.5 rounded-lg transition-colors ${
                          livFilter === f ? 'bg-void text-brass border border-brass/20' : 'text-paper/60 hover:text-paper/60'
                        }`}>
                        {LIV_LBL[f] ?? 'Tous'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/45 mb-3">
                  {livCmds.length} commande{livCmds.length > 1 ? 's' : ''}
                </div>

                {/* Cartes livraison */}
                {livCmds.length === 0
                  ? <div className="py-16 text-center font-body text-paper/55 text-sm">Aucune commande.</div>
                  : (
                    <div className="space-y-3">
                      {livCmds.map(cmd => {
                        const livEdit: LivEdit = livEdits[cmd.id] ?? {
                          statut:        cmd.livraison?.statut ?? 'EN_ATTENTE',
                          livreur:       cmd.livraison?.livreur_nom ?? '',
                          tel:           cmd.livraison?.livreur_telephone ?? '',
                          suivi:         cmd.livraison?.numero_suivi ?? '',
                          datePlanifiee: cmd.livraison?.date_planifiee?.slice(0, 10) ?? '',
                        }
                        return (
                          <div key={cmd.id} className="bg-surface border border-paper/6 rounded-2xl p-5">
                            {/* En-tête */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="font-mono text-xs font-medium text-brass-light">{cmd.reference}</span>
                                  <span className="font-mono text-[10px] text-paper/40">·</span>
                                  <span className="font-body text-xs text-paper/70">{cmd.produit?.nom ?? '—'}</span>
                                </div>
                                <div className="font-body text-sm text-paper font-medium">
                                  {cmd.client?.prenom} {cmd.client?.nom}
                                  <span className="font-mono text-xs text-paper/50 ml-2">{cmd.client?.telephone}</span>
                                </div>
                              </div>
                              <Badge statut={livEdit.statut} s={LIV_STYLE} l={LIV_LBL} />
                            </div>

                            {/* Info livreur si existante */}
                            {cmd.livraison?.livreur_nom && (
                              <div className="flex flex-wrap gap-3 mb-3 text-paper/55 font-mono text-[10px]">
                                <span>🚚 {cmd.livraison.livreur_nom}</span>
                                {cmd.livraison.livreur_telephone && <span>📞 {cmd.livraison.livreur_telephone}</span>}
                                {cmd.livraison.numero_suivi && <span>📦 {cmd.livraison.numero_suivi}</span>}
                                {cmd.livraison.date_planifiee && <span>📅 {fmt(cmd.livraison.date_planifiee)}</span>}
                                {cmd.livraison.date_livraison_effective && (
                                  <span className="text-spruce-light">✓ Livré le {fmt(cmd.livraison.date_livraison_effective)}</span>
                                )}
                              </div>
                            )}

                            {/* Formulaire inline */}
                            <div className="border-t border-paper/6 pt-3 mt-1">
                              <div className="flex gap-1.5 flex-wrap mb-3">
                                {LIV_STEPS.map(({ key, lbl }) => (
                                  <button key={key} type="button"
                                    onClick={() => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, statut: key } }))}
                                    className={`font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1 rounded-full border transition-colors ${
                                      livEdit.statut === key
                                        ? 'bg-brass/15 border-brass/40 text-brass'
                                        : 'border-paper/10 text-paper/50 hover:border-paper/25 hover:text-paper/70'
                                    }`}>
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                <input placeholder="Nom livreur" value={livEdit.livreur}
                                  onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, livreur: e.target.value } }))}
                                  className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors" />
                                <input placeholder="Tél livreur" value={livEdit.tel}
                                  onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, tel: e.target.value } }))}
                                  className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors" />
                                <input placeholder="N° suivi" value={livEdit.suivi}
                                  onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, suivi: e.target.value } }))}
                                  className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/40 focus:border-brass/40 outline-none transition-colors" />
                                <input type="date" title="Date planifiée" value={livEdit.datePlanifiee}
                                  onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, datePlanifiee: e.target.value } }))}
                                  className="bg-surface-2 border border-paper/12 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper/70 focus:border-brass/40 outline-none transition-colors" />
                              </div>
                              <button onClick={() => handleUpdateLivraison(cmd.id, livEdit)}
                                disabled={savingLiv === cmd.id}
                                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-spruce-light border border-spruce/30 rounded-full px-3 py-1.5 hover:bg-spruce/10 transition-colors disabled:opacity-50">
                                {savingLiv === cmd.id
                                  ? <Loader2 className="w-3 h-3 animate-spin" />
                                  : <Truck className="w-3 h-3" />}
                                {cmd.livraison ? 'Mettre à jour' : 'Créer la livraison'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                }
              </>
            )
          }
        </>
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/12 text-center mt-10">
        SEMOU GROUP × CFA CUSEMS Authentique · Tableau de bord administrateur · Usage interne
      </p>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
