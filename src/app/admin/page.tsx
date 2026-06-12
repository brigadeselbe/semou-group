'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { CFAClient } from '@/lib/supabase'
import {
  Lock, LogOut, Search, CheckCircle2, XCircle,
  Loader2, ChevronDown, Users, Clock, BadgeCheck, Ban,
} from 'lucide-react'

/* ── Constantes ── */
const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? 'SEMOU2026'
const SESSION_KEY = 'sg_admin_session'

type Filter = 'TOUS' | 'EN_ATTENTE' | 'VALIDE' | 'REJETE'

const FILTERS: { key: Filter; label: string; color: string }[] = [
  { key: 'TOUS',       label: 'Tous',        color: 'text-paper/60' },
  { key: 'EN_ATTENTE', label: 'En attente',  color: 'text-brass-light' },
  { key: 'VALIDE',     label: 'Validés',     color: 'text-spruce-light' },
  { key: 'REJETE',     label: 'Rejetés',     color: 'text-clay' },
]

const STATUT_STYLE: Record<string, string> = {
  EN_ATTENTE: 'text-brass bg-brass/10 border-brass/20',
  VALIDE:     'text-spruce-light bg-spruce/15 border-spruce/25',
  REJETE:     'text-clay bg-clay/10 border-clay/20',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-SN', {
    day: '2-digit', month: '2-digit', year: '2-digit',
  })
}

function StatutBadge({ statut }: { statut: string }) {
  const cls = STATUT_STYLE[statut] ?? 'text-paper/30 bg-white/5 border-white/8'
  const labels: Record<string, string> = { EN_ATTENTE: 'En attente', VALIDE: 'Validé', REJETE: 'Rejeté' }
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${cls}`}>
      {labels[statut] ?? statut}
    </span>
  )
}

/* ── Page principale ── */
export default function Admin() {
  const [stage, setStage]     = useState<'login' | 'loading' | 'dashboard'>('login')
  const [pwd,   setPwd]       = useState('')
  const [pwdErr, setPwdErr]   = useState('')
  const [clients, setClients] = useState<CFAClient[]>([])
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<Filter>('TOUS')
  const [updating, setUpdating] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [adminPwd, setAdminPwd] = useState('')

  /* Restaurer session */
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) : null
    if (saved) { setAdminPwd(saved); loadClients() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadClients = useCallback(async () => {
    setStage('loading')
    const { data, error } = await supabase
      .from('cfa_clients')
      .select('*')
      .order('created_at', { ascending: false })
    if (error || !data) { setStage('login'); return }
    setClients(data as CFAClient[])
    setStage('dashboard')
  }, [])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (pwd !== ADMIN_PASSWORD) {
      setPwdErr('Mot de passe incorrect.')
      return
    }
    localStorage.setItem(SESSION_KEY, pwd)
    setAdminPwd(pwd)
    loadClients()
  }

  function handleLogout() {
    localStorage.removeItem(SESSION_KEY)
    setAdminPwd('')
    setClients([])
    setStage('login')
    setPwd('')
  }

  async function handleUpdateStatut(clientId: string, newStatut: string) {
    setUpdating(clientId)
    const { error } = await supabase.rpc('admin_update_client_statut', {
      p_client_id: clientId,
      p_statut:    newStatut,
      p_password:  adminPwd,
    })
    if (error) {
      alert('Erreur : ' + (error.message.includes('28P01') ? 'Mot de passe incorrect' : error.message))
    } else {
      setClients(prev =>
        prev.map(c => c.id === clientId ? { ...c, statut: newStatut } : c)
      )
    }
    setUpdating(null)
  }

  /* ── Filtrage + recherche ── */
  const filtered = clients.filter(c => {
    const matchFilter = filter === 'TOUS' || c.statut === filter
    const q = search.toLowerCase()
    const matchSearch = !q || (
      c.prenom.toLowerCase().includes(q) ||
      c.nom.toLowerCase().includes(q) ||
      c.telephone.includes(q) ||
      (c.matricule ?? '').toLowerCase().includes(q) ||
      (c.region ?? '').toLowerCase().includes(q)
    )
    return matchFilter && matchSearch
  })

  const stats = {
    total:      clients.length,
    en_attente: clients.filter(c => c.statut === 'EN_ATTENTE').length,
    valide:     clients.filter(c => c.statut === 'VALIDE').length,
    rejete:     clients.filter(c => c.statut === 'REJETE').length,
  }

  /* ── Login ── */
  if (stage === 'login') {
    return (
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
                <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30 block mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={pwd}
                  onChange={e => { setPwd(e.target.value); setPwdErr('') }}
                  placeholder="••••••••"
                  className="w-full bg-void border-b border-white/10 focus:border-brass outline-none font-mono text-base text-paper pb-2 transition-colors placeholder:text-paper/15"
                />
                {pwdErr && (
                  <p className="font-mono text-[10px] text-clay mt-2">{pwdErr}</p>
                )}
              </div>
              <button
                type="submit"
                className="w-full font-body font-medium bg-spruce-light text-paper py-3 rounded-full hover:bg-spruce transition-colors"
              >
                Accéder au tableau de bord
              </button>
            </form>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/15 text-center mt-6">
            Semou Group × CFA CUSEMS · Accès admin
          </p>
        </div>
      </div>
    )
  }

  /* ── Loading ── */
  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brass animate-spin" />
      </div>
    )
  }

  /* ── Dashboard ── */
  return (
    <div className="min-h-screen px-4 md:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-brass">CFA CUSEMS</div>
          <h1 className="font-display text-2xl md:text-3xl text-paper mt-0.5">
            Tableau de bord <span className="italic text-brass-light">admin</span>
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 font-mono text-xs text-paper/35 hover:text-clay border border-white/8 rounded-full px-4 py-2 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Déconnexion
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Users,       val: stats.total,      lbl: 'Total clients',   color: 'text-paper' },
          { icon: Clock,       val: stats.en_attente, lbl: 'En attente',      color: 'text-brass-light' },
          { icon: BadgeCheck,  val: stats.valide,     lbl: 'Validés',         color: 'text-spruce-light' },
          { icon: Ban,         val: stats.rejete,     lbl: 'Rejetés',         color: 'text-clay' },
        ].map(({ icon: Icon, val, lbl, color }) => (
          <div key={lbl} className="bg-surface border border-white/6 rounded-xl p-4">
            <Icon className={`w-4 h-4 ${color} mb-2 opacity-60`} />
            <div className={`font-display text-2xl md:text-3xl ${color}`}>{val}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30 mt-0.5">{lbl}</div>
          </div>
        ))}
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-paper/25" />
          <input
            type="text"
            placeholder="Nom, téléphone, matricule, région…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-surface border border-white/8 rounded-xl pl-9 pr-4 py-2.5 font-body text-sm text-paper placeholder:text-paper/20 focus:border-brass/40 outline-none transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-surface border border-white/8 rounded-xl p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-void text-brass border border-brass/20'
                  : 'text-paper/35 hover:text-paper/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Résultat count */}
      <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/25 mb-3">
        {filtered.length} dossier{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
      </div>

      {/* Table clients */}
      <div className="bg-surface border border-white/6 rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center font-body text-paper/30 text-sm">
            Aucun dossier trouvé.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {['Nom & Prénom', 'Téléphone', 'Matricule', 'Corps / Région', 'Date', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="text-left font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25 px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, i) => (
                  <>
                    <tr
                      key={client.id}
                      className={`border-b border-white/4 hover:bg-white/2 transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-void/30'}`}
                      onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
                    >
                      {/* Nom */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-body text-sm font-medium text-paper">
                          {client.prenom} {client.nom}
                        </div>
                      </td>

                      {/* Téléphone */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-paper/55">
                          {client.telephone.replace(/^221/, '')}
                        </span>
                      </td>

                      {/* Matricule */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-paper/55">
                          {client.matricule ?? '—'}
                        </span>
                      </td>

                      {/* Corps / Région */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-body text-xs text-paper/45">
                          {client.corps ?? client.type_fonctionnaire ?? '—'}
                          {client.region ? ` · ${client.region}` : ''}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-xs text-paper/35">
                          {formatDate(client.created_at)}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatutBadge statut={client.statut} />
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {updating === client.id ? (
                            <Loader2 className="w-4 h-4 text-brass animate-spin" />
                          ) : (
                            <>
                              {client.statut !== 'VALIDE' && (
                                <button
                                  onClick={() => handleUpdateStatut(client.id, 'VALIDE')}
                                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-spruce-light border border-spruce/30 rounded-full px-2.5 py-1 hover:bg-spruce/15 transition-colors"
                                >
                                  <CheckCircle2 className="w-3 h-3" /> Valider
                                </button>
                              )}
                              {client.statut !== 'REJETE' && (
                                <button
                                  onClick={() => handleUpdateStatut(client.id, 'REJETE')}
                                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-clay border border-clay/30 rounded-full px-2.5 py-1 hover:bg-clay/10 transition-colors"
                                >
                                  <XCircle className="w-3 h-3" /> Rejeter
                                </button>
                              )}
                              <ChevronDown className={`w-3.5 h-3.5 text-paper/20 transition-transform ${expandedId === client.id ? 'rotate-180' : ''}`} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Détail expandé */}
                    {expandedId === client.id && (
                      <tr key={`${client.id}-detail`} className="bg-void/50 border-b border-white/4">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            {[
                              { lbl: 'IA / Académie', val: client.ia },
                              { lbl: 'IEF', val: client.ief },
                              { lbl: 'École / Poste', val: client.ecole },
                              { lbl: 'Type agent', val: client.type_enseignant },
                              { lbl: 'Ministère', val: client.ministere },
                              { lbl: 'Grade', val: client.grade },
                              { lbl: 'Source', val: client.source },
                              { lbl: 'Notes', val: client.notes },
                            ].map(({ lbl, val }) => val ? (
                              <div key={lbl}>
                                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-0.5">{lbl}</div>
                                <div className="font-body text-paper/55 text-xs break-words">{val}</div>
                              </div>
                            ) : null)}

                            {/* Pièces */}
                            {client.cni_url && (
                              <div>
                                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-0.5">CNI Recto</div>
                                <a
                                  href={`https://idgwekhrwbljdyhfabxx.supabase.co/storage/v1/object/public/documents/${client.cni_url}`}
                                  target="_blank" rel="noreferrer"
                                  className="font-mono text-[10px] text-brass-light underline underline-offset-2"
                                >
                                  Voir le document ↗
                                </a>
                              </div>
                            )}
                            {client.bulletin_url && (
                              <div>
                                <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/25 mb-0.5">Bulletin salaire</div>
                                <a
                                  href={`https://idgwekhrwbljdyhfabxx.supabase.co/storage/v1/object/public/documents/${client.bulletin_url}`}
                                  target="_blank" rel="noreferrer"
                                  className="font-mono text-[10px] text-brass-light underline underline-offset-2"
                                >
                                  Voir le document ↗
                                </a>
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

      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/12 text-center mt-8">
        Semou Group × CFA CUSEMS · Tableau de bord administrateur · Usage interne
      </p>
    </div>
  )
}
