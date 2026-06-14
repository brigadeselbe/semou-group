'use client'

import { useState, useEffect, useCallback } from 'react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { CFAClient, CFACommande, CFAVersement, CFAProduit, CFALivraison } from '@/lib/supabase'
import {
  Lock, LogOut, Search, CheckCircle2, XCircle, Loader2, ChevronDown,
  Users, FileText, ExternalLink, ShoppingBag,
  TrendingUp, AlertCircle, Package, Plus, Edit2, Trash2, ToggleLeft,
  ToggleRight, Star, MapPin, Download, Truck,
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
type Tab = 'dashboard' | 'clients' | 'commandes' | 'produits'

/* ── Constantes ── */
const SESSION_KEY = 'sg_admin_session'

const CLI_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  VALIDE:     'text-spruce-light bg-spruce/15 border-spruce/25',
  REJETE:     'text-clay bg-clay/10 border-clay/20',
  SUSPENDU:   'text-paper/65 bg-white/5 border-white/10',
}
const CMD_STYLE: Record<string, string> = {
  EN_COURS: 'text-brass bg-brass/10 border-brass/20',
  SOLDE:    'text-spruce-light bg-spruce/15 border-spruce/25',
  ANNULE:   'text-clay bg-clay/10 border-clay/20',
}
const VER_STYLE: Record<string, string> = {
  PAYE:       'text-spruce-light bg-spruce/15 border-spruce/25',
  EN_ATTENTE: 'text-paper/60 bg-white/4 border-white/8',
  EN_RETARD:  'text-clay bg-clay/10 border-clay/20',
}
const LIV_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  PLANIFIEE:  'text-paper/70 bg-white/5 border-white/10',
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
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${s[statut] ?? 'text-paper/55 bg-white/5 border-white/8'}`}>
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

/* ── Login rate-limiting (sessionStorage, réinitialisé à la fermeture de l'onglet) ── */
const MAX_ATTEMPTS = 5
const LOCKOUT_MS   = 5 * 60 * 1000

function getAttempts() {
  try { return JSON.parse(sessionStorage.getItem('sg_login_attempts') ?? '{"n":0,"t":0}') as { n: number; t: number } }
  catch { return { n: 0, t: 0 } }
}
function trackFail() {
  const { n, t } = getAttempts()
  const now = Date.now()
  sessionStorage.setItem('sg_login_attempts', JSON.stringify({
    n: now - t < LOCKOUT_MS ? n + 1 : 1,
    t: now - t < LOCKOUT_MS ? t      : now,
  }))
}
function clearAttempts() { sessionStorage.removeItem('sg_login_attempts') }
function lockoutMins(): number {
  const { n, t } = getAttempts()
  if (n >= MAX_ATTEMPTS) {
    const rem = LOCKOUT_MS - (Date.now() - t)
    if (rem > 0) return Math.ceil(rem / 60000)
  }
  return 0
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
    const [{ data, error }, { data: livs }] = await Promise.all([
      adminRpc('admin_get_stats'),
      adminRpc('admin_get_livraison_stats'),
    ])
    if (!error && data) setStats(data as DashStats)
    if (livs) setLivStats(livs as LivStats)
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
    const mins = lockoutMins()
    if (mins > 0) { setPwdErr(`Trop de tentatives — réessayez dans ${mins} min.`); return }
    setPwdErr('')
    setStage('loading')
    const res = await fetch('/api/admin/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password: pwd }),
    })
    if (!res.ok) {
      trackFail()
      const rem = lockoutMins()
      setPwdErr(rem > 0 ? `Trop de tentatives — réessayez dans ${rem} min.` : 'Mot de passe incorrect.')
      setStage('login')
      return
    }
    clearAttempts()
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

  /* Exports Excel */
  async function exportClients() {
    const XLSX = (await import('xlsx')).default
    const rows = filteredClients.map(c => ({
      Prénom:        c.prenom,
      Nom:           c.nom,
      Téléphone:     c.telephone,
      Matricule:     c.matricule ?? '',
      Corps:         c.corps ?? '',
      Région:        c.region ?? '',
      'IA/Académie': c.ia ?? '',
      IEF:           c.ief ?? '',
      École:         c.ecole ?? '',
      Grade:         c.grade ?? '',
      Ministère:     c.ministere ?? '',
      Statut:        c.statut,
      Date:          (c as CFAClient & { created_at: string }).created_at
                       ? new Date((c as CFAClient & { created_at: string }).created_at).toLocaleDateString('fr-FR') : '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clients')
    XLSX.writeFile(wb, `clients_semou_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  async function exportCommandes() {
    const XLSX = (await import('xlsx')).default
    const { data: raw } = await adminRpc('admin_get_commandes_full')
    const cmds = raw as CommandeAdmin[] | null
    if (!cmds?.length) return
    const rows: Record<string, string | number>[] = []
    cmds.forEach(cmd => {
      const base = {
        Référence:           cmd.reference ?? cmd.id,
        Client:              `${cmd.client?.prenom ?? ''} ${cmd.client?.nom ?? ''}`.trim(),
        Téléphone:           cmd.client?.telephone ?? '',
        Produit:             cmd.produit?.nom ?? '',
        'Statut commande':   cmd.statut,
        'Prix vente':        cmd.prix_vente,
        'Apport payé':       cmd.apport_paye,
        'Reste à payer':     cmd.reste_a_payer,
        Mensualités:         cmd.nb_mensualites,
        'Mensualité (FCFA)': cmd.montant_mensualite,
      }
      const versements = cmd.versements ?? []
      if (versements.length === 0) {
        rows.push(base)
      } else {
        versements.forEach(v => {
          rows.push({
            ...base,
            'N° vers.':         v.numero_versement,
            'Montant prévu':    v.montant_prevu,
            'Montant payé':     v.montant_paye,
            'Statut versement': v.statut,
            'Date échéance':    v.date_echeance ? new Date(v.date_echeance).toLocaleDateString('fr-FR') : '',
            'Date paiement':    v.date_paiement ? new Date(v.date_paiement).toLocaleDateString('fr-FR') : '',
            Moyen:              v.moyen_paiement ?? '',
          })
        })
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Commandes')
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
      stock: p.stock, stock_illimite: p.stock_illimite, actif: p.actif,
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
                className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-base text-paper pb-2 transition-colors placeholder:text-paper/60" />
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
          className="flex items-center gap-2 font-mono text-xs text-paper/60 hover:text-clay border border-white/8 rounded-full px-4 py-2 transition-colors">
          <LogOut className="w-3.5 h-3.5" /> Déconnexion
        </button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1 mb-6 overflow-x-auto max-w-full">
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
              <div key={lbl} className="bg-surface border border-white/6 rounded-xl px-4 py-3 flex items-center gap-4">
                <div className={`font-display text-2xl ${color}`}>{val}</div>
                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55">{lbl}</div>
              </div>
            ))}
          </div>

          {/* Graphiques */}
          {stats && !statsLoading && (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pie — dossiers */}
              <div className="bg-surface border border-white/6 rounded-2xl p-5">
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
              <div className="bg-surface border border-white/6 rounded-2xl p-5">
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
          <div className="bg-surface border border-white/6 rounded-2xl p-5 md:p-6">
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
                {Array(4).fill(0).map((_, i) => <div key={i} className="h-14 w-24 bg-void rounded-xl animate-pulse" />)}
              </div>
            ) : livStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { val: livStats.en_attente, lbl: 'En attente', color: livStats.en_attente > 0 ? 'text-brass-light' : 'text-paper/55' },
                  { val: livStats.planifiee,  lbl: 'Planifiées',  color: livStats.planifiee  > 0 ? 'text-paper/80'   : 'text-paper/55' },
                  { val: livStats.en_route,   lbl: 'En route',    color: livStats.en_route   > 0 ? 'text-spruce-light': 'text-paper/55' },
                  { val: livStats.livree,     lbl: 'Livrées',     color: 'text-spruce-light' },
                ].map(({ val, lbl, color }) => (
                  <div key={lbl} className="bg-void rounded-xl px-4 py-3">
                    <div className={`font-display text-2xl ${color}`}>{val}</div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45 mt-0.5">{lbl}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-mono text-[10px] text-paper/45">Aucune donnée.</p>
            )}
          </div>

          {/* Recherche fonctionnaire */}
          <div className="bg-surface border border-white/6 rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-brass" />
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/70">Recherche fonctionnaire</div>
            </div>

            {/* Sélecteur de critère */}
            <div className="flex gap-1 bg-void border border-white/8 rounded-xl p-1 mb-4 w-fit">
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
                className="flex-1 bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-sm text-paper pb-2 placeholder:text-paper/60 transition-colors" />
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
                      <div key={c.id} className="bg-void border border-white/6 rounded-xl p-4">
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
            <div className="bg-surface border border-white/6 rounded-2xl p-5 md:p-6">
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
                      <div className="flex-1 h-1.5 bg-void rounded-full overflow-hidden">
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
                className="w-full bg-surface border border-white/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/65 focus:border-brass/40 outline-none transition-colors" />
            </div>
            <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1">
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
            {filteredClients.length > 0 && (
              <button onClick={exportClients}
                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/65 hover:text-brass border border-white/8 hover:border-brass/30 rounded-lg px-3 py-1.5 transition-colors">
                <Download className="w-3 h-3" /> Excel
              </button>
            )}
          </div>
          <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
            {filteredClients.length === 0
              ? <div className="py-16 text-center font-body text-paper/55 text-sm">Aucun dossier trouvé.</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/5">
                        {['Nom & Prénom', 'Téléphone', 'Matricule', 'Corps / Région', 'Date', 'Statut', 'Actions'].map(h => (
                          <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.15em] text-paper/45 px-4 py-3 whitespace-nowrap">{h}</th>
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
                            <tr key={`${c.id}-d`} className="bg-void/50 border-b border-white/4">
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
                    { val: commandes.length,                                   lbl: 'Total commandes', color: 'text-paper' },
                    { val: commandes.filter(c => c.statut === 'EN_COURS').length, lbl: 'En cours',     color: 'text-brass-light' },
                    { val: commandes.filter(c => c.statut === 'SOLDE').length,    lbl: 'Soldées',      color: 'text-spruce-light' },
                    { val: fcfa(commandes.reduce((s, c) => s + c.apport_paye, 0)), lbl: 'Total versé', color: 'text-brass-light' },
                  ].map(({ val, lbl, color }) => (
                    <div key={lbl} className="bg-surface border border-white/6 rounded-xl p-4">
                      <div className={`font-display text-xl md:text-2xl ${color} leading-tight`}>{val}</div>
                      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55 mt-0.5">{lbl}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/45" />
                    <input type="text" placeholder="Référence, client, produit…"
                      value={cmdSearch} onChange={e => setCmdSearch(e.target.value)}
                      className="w-full bg-surface border border-white/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/65 focus:border-brass/40 outline-none transition-colors" />
                  </div>
                  <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1">
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
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/45">
                    {filteredCmds.length} commande{filteredCmds.length > 1 ? 's' : ''}
                  </span>
                  {commandes.length > 0 && (
                    <button onClick={exportCommandes}
                      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-paper/65 hover:text-brass border border-white/8 hover:border-brass/30 rounded-lg px-3 py-1.5 transition-colors">
                      <Download className="w-3 h-3" /> Excel
                    </button>
                  )}
                </div>
                <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
                  {filteredCmds.length === 0
                    ? <div className="py-16 text-center font-body text-paper/55 text-sm">Aucune commande.</div>
                    : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-white/5">
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
                                    className={`border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer ${i % 2 ? 'bg-void/30' : ''}`}
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
                                        <div className="w-16 h-1 bg-void rounded-full overflow-hidden">
                                          <div className="h-full bg-spruce-light rounded-full" style={{ width: total > 0 ? `${Math.round(payees/total*100)}%` : '0%' }} />
                                        </div>
                                        <span className="font-mono text-[10px] text-paper/65">{payees}/{total}</span>
                                        {retard > 0 && <AlertCircle className="w-3 h-3 text-clay" />}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap"><Badge statut={cmd.statut} s={CMD_STYLE} l={CMD_LBL} /></td>
                                  </tr>
                                  {cmdExpand === cmd.id && (
                                    <tr key={`${cmd.id}-d`} className="bg-void/50 border-b border-white/4">
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
                                        <div className="mt-4 pt-4 border-t border-white/8">
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
                                                    : 'border-white/10 text-paper/55 hover:border-white/20 hover:text-paper/60'
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
                                              className="bg-void border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/35 focus:border-brass/40 outline-none transition-colors" />
                                            <input
                                              placeholder="Tél livreur"
                                              value={livEdit.tel}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, tel: e.target.value } }))}
                                              className="bg-void border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/35 focus:border-brass/40 outline-none transition-colors" />
                                            <input
                                              placeholder="N° suivi"
                                              value={livEdit.suivi}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, suivi: e.target.value } }))}
                                              className="bg-void border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper placeholder:text-paper/35 focus:border-brass/40 outline-none transition-colors" />
                                            <input
                                              type="date"
                                              title="Date de livraison prévue"
                                              value={livEdit.datePlanifiee}
                                              onChange={e => setLivEdits(p => ({ ...p, [cmd.id]: { ...livEdit, datePlanifiee: e.target.value } }))}
                                              className="bg-void border border-white/10 rounded-lg px-2.5 py-1.5 font-mono text-xs text-paper/70 focus:border-brass/40 outline-none transition-colors" />
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
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-body text-sm text-paper pb-1.5 placeholder:text-paper/60 transition-colors" />
                  </FormField>
                  <FormField label="État">
                    <select value={prodForm.etat} onChange={e => setProdForm(p => ({ ...p, etat: e.target.value }))}
                      className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-body text-sm text-paper pb-1.5 transition-colors">
                      <option value="NEUF">Neuf</option>
                      <option value="BON_ETAT">Bon état</option>
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
                        <span className="font-mono text-xs text-paper/70">Illimité</span>
                      </label>
                    </div>
                  </FormField>
                </div>
                <FormField label="Description">
                  <textarea value={prodForm.description}
                    onChange={e => setProdForm(p => ({ ...p, description: e.target.value }))}
                    rows={2} placeholder="Description courte du produit…"
                    className="w-full bg-void border border-white/8 rounded-lg p-2.5 font-body text-sm text-paper placeholder:text-paper/60 focus:border-brass/40 outline-none resize-none transition-colors" />
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
                        <div key={m.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/8 bg-void group/m">
                          {m.type === 'IMAGE' ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-white/4">
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
                      <label className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] border border-dashed rounded-xl px-3 py-2 cursor-pointer transition-colors ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : 'border-white/15 hover:border-brass/40 text-paper/65 hover:text-brass'}`}>
                        {uploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 rotate-180" />}
                        + Images
                        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploadingMedia}
                          onChange={e => { if (e.target.files?.length) handleUploadMedias(e.target.files, 'IMAGE', editProd.id) }} />
                      </label>
                      <label className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.1em] border border-dashed rounded-xl px-3 py-2 cursor-pointer transition-colors ${uploadingMedia ? 'opacity-50 cursor-not-allowed' : 'border-white/15 hover:border-brass/40 text-paper/65 hover:text-brass'}`}>
                        {uploadingMedia ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 rotate-180" />}
                        + Vidéo MP4
                        <input type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" disabled={uploadingMedia}
                          onChange={e => { if (e.target.files?.length) handleUploadMedias(e.target.files, 'VIDEO', editProd.id) }} />
                      </label>
                      <span className="font-mono text-[9px] text-paper/60 self-center">max 50 Mo par vidéo · JPG/PNG/WebP pour images</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border border-dashed border-white/15 rounded-xl px-4 py-3 text-paper/50">
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
                    className="font-body text-sm text-paper/65 border border-white/8 px-6 py-2.5 rounded-full hover:text-paper/60 transition-colors">
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
                    <div key={p.id} className={`bg-surface border rounded-2xl p-5 transition-colors ${p.actif ? 'border-white/6' : 'border-white/3 opacity-60'}`}>
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
                        <div className="bg-void rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/45 mb-0.5">Prix</div>
                          <div className="font-mono text-xs text-brass-light">{fcfa(p.prix_vente)}</div>
                        </div>
                        <div className="bg-void rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/45 mb-0.5">Apport</div>
                          <div className="font-mono text-xs text-paper/60">{fcfa(p.apport_minimum)}</div>
                        </div>
                        <div className="bg-void rounded-lg px-3 py-2">
                          <div className="font-mono text-[9px] uppercase tracking-wider text-paper/45 mb-0.5">Mensualités</div>
                          <div className="font-mono text-xs text-paper/60">max {p.nb_mensualites_max}×</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded-full border ${
                            p.etat === 'NEUF' ? 'text-spruce-light border-spruce/25 bg-spruce/10'
                            : p.etat === 'BON_ETAT' ? 'text-brass border-brass/25 bg-brass/10'
                            : 'text-paper/65 border-white/10 bg-white/4'
                          }`}>
                            {p.etat === 'NEUF' ? 'Neuf' : p.etat === 'BON_ETAT' ? 'Bon état' : 'Occasion'}
                          </span>
                          <span className={`font-mono text-[10px] uppercase tracking-[0.1em] ${p.stock_illimite ? 'text-spruce-light' : p.stock > 0 ? 'text-paper/70' : 'text-clay'}`}>
                            {p.stock_illimite ? '∞ illimité' : `${p.stock} en stock`}
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
          <div className="bg-void border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg text-brass">Créer une commande</h2>
              <button onClick={() => setNewCmdClient(null)} className="text-paper/55 hover:text-paper/60 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Client info (lecture seule) */}
            <div className="bg-white/4 rounded-xl px-4 py-3 mb-5">
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
                    className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-paper text-sm focus:outline-none focus:border-brass/50 transition-colors">
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
                  className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-paper text-sm focus:outline-none focus:border-brass/50 transition-colors" />
              </div>

              {/* Moyen de paiement */}
              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.2em] text-paper/55 block mb-1.5">Moyen de paiement apport</label>
                <div className="grid grid-cols-3 gap-2">
                  {[['ESPECES', 'Espèces'], ['WAVE', 'Wave'], ['ORANGE', 'Orange']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setNewCmdMoyen(val)}
                      className={`font-mono text-[10px] uppercase py-2 rounded-xl border transition-colors ${newCmdMoyen === val ? 'bg-brass/15 border-brass/50 text-brass' : 'border-white/10 text-paper/65 hover:border-white/20'}`}>
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

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/12 text-center mt-10">
        Semou Group × CFA CUSEMS Authentique · Tableau de bord administrateur · Usage interne
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
