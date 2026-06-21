'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Upload, AlertCircle, Loader2, ChevronRight,
  CreditCard, CheckCircle2, X, Check,
} from 'lucide-react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { CFAProduit } from '@/lib/supabase'
import StampMark from '@/components/StampMark'

const REGIONS_SN = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Diourbel', 'Louga', 'Kaolack',
  'Fatick', 'Tambacounda', 'Ziguinchor', 'Kolda', 'Matam', 'Kaffrine',
  'Kédougou', 'Sédhiou',
]
const CORPS_LIST = [
  { value: 'ENSEIGNANT',  label: 'Enseignement' },
  { value: 'SANTE',       label: 'Santé' },
  { value: 'POLICE',      label: 'Police nationale' },
  { value: 'GENDARMERIE', label: 'Gendarmerie' },
  { value: 'JUSTICE',     label: 'Justice' },
  { value: 'ARMEE',       label: 'Armée' },
  { value: 'IMPOTS',      label: 'Impôts' },
  { value: 'DOUANES',     label: 'Douanes' },
  { value: 'TRESOR',      label: 'Trésor public' },
  { value: 'MAIRIE',      label: 'Mairie / Collectivité' },
  { value: 'AUTRE',       label: "Autre corps d'État" },
]

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('221')) return digits
  return '221' + (digits.startsWith('0') ? digits.slice(1) : digits)
}
async function uploadDoc(file: File, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
  return error ? `ERREUR:${error.message}` : data.path
}
function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

type Stage = 'form' | 'submitting' | 'paiement' | 'success' | 'error'

/* ── Zone upload drag-and-drop ── */
function DropZone({ label, file, onFile, onClear }: {
  label: string; file: File | null; onFile: (f: File) => void; onClear: () => void
}) {
  const ref  = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  if (file) {
    return (
      <div className="flex items-center justify-between bg-spruce/10 border border-spruce/25 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-spruce-light flex-shrink-0" />
          <span className="font-mono text-xs text-spruce-light truncate max-w-[200px]">{file.name}</span>
        </div>
        <button type="button" onClick={onClear} className="text-paper/70 hover:text-clay transition-colors ml-2 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      onClick={() => ref.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors ${
        drag ? 'border-brass/60 bg-brass/5' : 'border-paper/12 hover:border-paper/25 hover:bg-paper/2'
      }`}
    >
      <Upload className="w-5 h-5 text-paper/65 mx-auto mb-2" />
      <div className="font-mono text-xs text-paper/75">{label}</div>
      <div className="font-mono text-xs text-paper/55 mt-1">JPEG · PNG · PDF — 10 Mo max</div>
      <input ref={ref} type="file" accept="image/*,.pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
    </div>
  )
}

/* ── Carte produit ── */
function ProduitCard({ p, selected, onSelect }: { p: CFAProduit; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect}
      className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
        selected ? 'border-brass bg-brass/6' : 'border-paper/10 hover:border-paper/25 bg-surface'
      }`}>
      <div className="flex items-start gap-3">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photo_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-paper/5" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-paper/5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="font-body text-sm font-medium text-paper leading-snug">{p.nom}</div>
            {selected && <Check className="w-4 h-4 text-brass-light flex-shrink-0 mt-0.5" />}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="font-display text-base text-brass-light">{fcfa(p.prix_vente)}</span>
            <span className="font-mono text-xs text-paper/70">apport min {fcfa(p.apport_minimum)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

/* ── Barre de progression ── */
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Identité', 'Commande', 'Documents']
  return (
    <div className="flex items-center gap-0 mb-10">
      {steps.map((label, i) => {
        const n    = i + 1
        const done = n < step
        const cur  = n === step
        return (
          <div key={label} className="flex items-center gap-0 flex-1">
            <div className={`flex items-center gap-2 flex-shrink-0 ${cur ? 'text-paper' : done ? 'text-brass-light' : 'text-paper/60'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs border transition-all ${
                done ? 'bg-brass text-void border-brass'
                : cur ? 'bg-surface-2 border-brass text-brass-light'
                : 'bg-surface-2 border-paper/15 text-paper/65'
              }`}>
                {done ? <Check className="w-3 h-3" /> : n}
              </div>
              <span className={`font-mono text-xs uppercase tracking-[0.15em] hidden sm:block ${cur ? 'text-paper/80' : done ? 'text-brass/70' : 'text-paper/60'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 transition-colors ${done ? 'bg-brass/40' : 'bg-paper/8'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Inscription() {
  /* ── Identité ── */
  const [prenom,    setPrenom]    = useState('')
  const [nom,       setNom]       = useState('')
  const [telephone, setTelephone] = useState('')
  const [matricule, setMatricule] = useState('')
  const [corps,     setCorps]     = useState('')
  const [typeAgent, setTypeAgent] = useState('FONCTIONNAIRE')
  const [ia,        setIa]        = useState('')
  const [ief,       setIef]       = useState('')
  const [region,    setRegion]    = useState('')
  const [ecole,     setEcole]     = useState('')

  /* ── Documents ── */
  const [cniRecto, setCniRecto] = useState<File | null>(null)
  const [cniVerso, setCniVerso] = useState<File | null>(null)
  const [bulletin, setBulletin] = useState<File | null>(null)

  /* ── Produit ── */
  const [produits,      setProduits]      = useState<CFAProduit[]>([])
  const [produitId,     setProduitId]     = useState('')
  const [nbMensualites, setNbMensualites] = useState(6)

  /* ── Navigation ── */
  const [step,      setStep]      = useState<1 | 2 | 3>(1)
  const [stepErr,   setStepErr]   = useState('')

  /* ── Submission ── */
  const [stage,      setStage]      = useState<Stage>('form')
  const [errMsg,     setErrMsg]     = useState('')
  const [refCode,    setRefCode]    = useState('')
  const [commandeId, setCommandeId] = useState('')
  const [payLoading, setPayLoading] = useState<'wave' | 'orange' | null>(null)
  const [payError,   setPayError]   = useState('')

  useEffect(() => {
    const preselect = new URLSearchParams(window.location.search).get('produit')
    supabase.from('cfa_produits').select('*').eq('actif', true).order('prix_vente')
      .then(({ data }) => {
        if (data) {
          setProduits(data as CFAProduit[])
          if (preselect && data.find((p: CFAProduit) => p.id === preselect)) {
            setProduitId(preselect)
          }
        }
      })
  }, [])

  const produitChoisi  = produits.find(p => p.id === produitId) ?? null
  const apport         = produitChoisi?.apport_minimum ?? 0
  const mensualite     = produitChoisi
    ? Math.ceil((produitChoisi.prix_vente - apport) / Math.max(nbMensualites, 1))
    : 0

  function goToStep2() {
    if (!prenom.trim() || !nom.trim() || !telephone.trim() || !matricule.trim() || !corps) {
      setStepErr('Veuillez remplir tous les champs obligatoires (Prénom, Nom, Téléphone, Matricule, Corps).')
      return
    }
    setStepErr('')
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function goToStep3() {
    setStepErr('')
    setStep(3)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function goBack(s: 1 | 2) {
    setStepErr('')
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')

    if (!cniRecto || !cniVerso || !bulletin) {
      setErrMsg('Veuillez joindre les trois pièces : CNI recto, CNI verso et bulletin de salaire.')
      return
    }

    setStage('submitting')

    const phone = normalizePhone(telephone)
    const ts    = Date.now()
    const ext   = (f: File) => f.name.split('.').pop() ?? 'jpg'

    const [cniRectoPath, cniVersoPath, bulletinPath] = await Promise.all([
      uploadDoc(cniRecto, `cni/${phone}/${ts}_recto.${ext(cniRecto)}`),
      uploadDoc(cniVerso, `cni/${phone}/${ts}_verso.${ext(cniVerso)}`),
      uploadDoc(bulletin, `bulletins/${phone}/${ts}.${ext(bulletin)}`),
    ])

    const { data, error } = await supabase
      .from('cfa_clients')
      .insert({
        prenom:             prenom.trim().toUpperCase(),
        nom:                nom.trim().toUpperCase(),
        telephone:          phone,
        matricule:          matricule.trim().toUpperCase(),
        type_fonctionnaire: corps,
        type_enseignant:    corps === 'ENSEIGNANT' ? typeAgent : null,
        corps,
        ia:          ia.trim()    || null,
        ief:         ief.trim()   || null,
        region:      region       || null,
        ecole:       ecole.trim() || null,
        statut:      'EN_ATTENTE',
        source:      'INSCRIPTION',
        cni_url:     cniRectoPath.startsWith('ERREUR') ? null : cniRectoPath,
        bulletin_url: bulletinPath.startsWith('ERREUR') ? null : bulletinPath,
        notes:       cniVersoPath.startsWith('ERREUR') ? null : `CNI_VERSO:${cniVersoPath}`,
      })
      .select('id')
      .single()

    if (error) {
      setErrMsg(
        error.code === '23505'
          ? 'Ce numéro est déjà enregistré. Rendez-vous sur /suivi pour retrouver votre dossier.'
          : `Erreur : ${error.message}`
      )
      setStage('error')
      return
    }

    const cid = data.id as string
    const ref = `SG-${new Date().getFullYear()}-${cid.slice(-8).toUpperCase()}`
    setRefCode(ref)

    fetch('/api/sms/inscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telephone: normalizePhone(telephone), prenom: prenom.trim(), ref }),
    }).catch(() => null)

    if (produitId) {
      const { data: cmdId, error: cmdErr } = await supabase.rpc('inscription_creer_commande', {
        p_client_id:      cid,
        p_produit_id:     produitId,
        p_nb_mensualites: nbMensualites,
      })
      if (cmdErr || !cmdId) {
        setErrMsg(`Dossier créé mais erreur commande : ${cmdErr?.message ?? '—'}`)
        setStage('success')
        return
      }
      setCommandeId(cmdId as string)
      setStage('paiement')
    } else {
      setStage('success')
    }
  }

  async function handlePay(moyen: 'wave' | 'orange') {
    setPayLoading(moyen); setPayError('')
    const res = await fetch(`/api/pay/${moyen}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'APPORT', id: commandeId, telephone: normalizePhone(telephone) }),
    })
    const json = await res.json()
    if (!res.ok) { setPayError(json.error ?? 'Erreur'); setPayLoading(null); return }
    window.location.href = json.checkout_url
  }

  /* ── Paiement ── */
  if (stage === 'paiement') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <div className="relative max-w-sm w-full">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-60 h-40 bg-brass/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative bg-surface border border-paper/6 rounded-2xl p-8">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-paper/75 mb-1">Étape finale</div>
            <div className="font-display text-2xl text-paper mb-1">
              Payer <span className="italic text-brass-light">l&apos;apport</span>
            </div>
            <p className="font-body text-paper/65 text-sm mb-6 leading-relaxed">
              Verrouillez votre commande en réglant l&apos;apport initial.
            </p>
            {produitChoisi && (
              <div className="bg-surface-2 border border-paper/10 rounded-xl p-4 mb-6 space-y-2">
                <div className="font-body text-sm font-medium text-paper">{produitChoisi.nom}</div>
                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div>
                    <div className="text-paper/75 text-[10px] uppercase tracking-[0.12em]">Apport</div>
                    <div className="text-brass-light mt-0.5">{fcfa(apport)}</div>
                  </div>
                  <div>
                    <div className="text-paper/75 text-[10px] uppercase tracking-[0.12em]">Mensualité</div>
                    <div className="text-paper/60 mt-0.5">{fcfa(mensualite)} × {nbMensualites}</div>
                  </div>
                </div>
              </div>
            )}
            {payError && (
              <div className="flex items-start gap-2 bg-clay/10 border border-clay/25 rounded-xl p-3 mb-4 text-clay text-xs font-body">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{payError}
              </div>
            )}
            <div className="space-y-3">
              <button onClick={() => handlePay('wave')} disabled={!!payLoading}
                className="w-full flex items-center justify-between bg-[#1B75D0] hover:bg-[#1565BA] text-white font-body font-medium px-5 py-3.5 rounded-xl transition-colors disabled:opacity-50">
                <span className="flex items-center gap-3"><CreditCard className="w-4 h-4" /><span>Payer avec Wave</span></span>
                {payLoading === 'wave' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm opacity-70">→</span>}
              </button>
              <button onClick={() => handlePay('orange')} disabled={!!payLoading}
                className="w-full flex items-center justify-between bg-[#F66B00] hover:bg-[#E05C00] text-white font-body font-medium px-5 py-3.5 rounded-xl transition-colors disabled:opacity-50">
                <span className="flex items-center gap-3"><CreditCard className="w-4 h-4" /><span>Payer avec Orange Money</span></span>
                {payLoading === 'orange' ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-sm opacity-70">→</span>}
              </button>
              <button onClick={() => setStage('success')}
                className="w-full font-body text-sm text-paper/60 hover:text-paper/55 py-2 transition-colors">
                Payer plus tard → accéder à mon suivi
              </button>
            </div>
            <div className="mt-5 pt-4 border-t border-dashed border-paper/6">
              <div className="font-mono text-xs text-paper/65 tracking-[0.08em]">Réf. dossier : {refCode}</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Succès ── */
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <div className="relative max-w-md w-full bg-surface border border-paper/6 rounded-2xl glow-green p-8 md:p-12 text-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-spruce-light/30 blur-[50px] rounded-full" />
          <div className="relative">
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-paper/75 mb-8">Bordereau · Dossier enregistré</div>
            <div className="w-14 h-14 rounded-full bg-spruce-light/20 border border-spruce-light/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-6 h-6 text-spruce-light" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.05] mb-4 text-paper">
              Dossier <span className="italic text-brass-light">reçu.</span>
            </h1>
            <p className="font-body text-paper/75 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
              Votre dossier est en cours de traitement. Vous recevrez un SMS de confirmation dans les{' '}
              <strong className="text-paper/70">24 à 48 heures</strong>.
            </p>
            <div className="bg-surface-2 border border-paper/10 rounded-xl p-4 mb-10 inline-block">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-paper/55 mb-1.5">Référence dossier</div>
              <div className="font-mono text-base md:text-lg font-medium text-brass-light">{refCode}</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/suivi"
                className="font-body text-sm font-medium bg-spruce-light text-paper px-6 py-3 rounded-full hover:bg-spruce transition-colors">
                Suivre mon dossier
              </Link>
              <Link href="/"
                className="font-body text-sm font-medium border border-paper/10 text-paper/60 px-6 py-3 rounded-full hover:border-brass/30 hover:text-brass-light transition-colors">
                Retour à l&apos;accueil
              </Link>
            </div>
            <div className="absolute -bottom-10 -right-6 opacity-60"><StampMark /></div>
          </div>
        </div>
      </div>
    )
  }

  /* ── Formulaire multi-étapes ── */
  return (
    <div className="min-h-screen px-6 md:px-10 py-12 md:py-20">
      <div className="max-w-xl mx-auto">

        {/* Back */}
        <Link href="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/65 hover:text-brass-light transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        {/* Titre */}
        <div className="mb-8">
          <LogoSG size={44} className="mb-4" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">CUSEMS Authentique</span>
          <h1 className="font-display text-4xl md:text-5xl mt-2 leading-[1.05] text-paper">
            {step === 1 && <>Mon <span className="italic text-brass-light">identité.</span></>}
            {step === 2 && <>Ma <span className="italic text-brass-light">commande.</span></>}
            {step === 3 && <>Mes <span className="italic text-brass-light">documents.</span></>}
          </h1>
        </div>

        {/* Progress */}
        <StepBar step={step} />

        {/* ── Étape 1 — Identité ── */}
        {step === 1 && (
          <div className="space-y-0">
            <div className="bg-surface border border-paper/6 rounded-2xl overflow-hidden">
              <SectionHeader>Identité civile</SectionHeader>
              <div className="px-6 py-2 divide-y divide-dashed divide-paper/6">
                <FieldRow label="Prénom *">
                  <input required value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="ex : Aminata"
                    className={INPUT} />
                </FieldRow>
                <FieldRow label="Nom *">
                  <input required value={nom} onChange={e => setNom(e.target.value)} placeholder="ex : Diallo"
                    className={INPUT} />
                </FieldRow>
                <FieldRow label="Téléphone *">
                  <input required type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="77 XXX XX XX"
                    className={`${INPUT} font-mono`} />
                </FieldRow>
                <FieldRow label="Matricule *">
                  <input required value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="ex : 300501163/E"
                    className={`${INPUT} font-mono`} />
                </FieldRow>
              </div>

              <SectionHeader>Situation professionnelle</SectionHeader>
              <div className="px-6 py-2 divide-y divide-dashed divide-paper/6">
                <FieldRow label="Corps *">
                  <select required value={corps} onChange={e => setCorps(e.target.value)} className={SELECT}>
                    <option value="" className="bg-surface">— Sélectionner —</option>
                    {CORPS_LIST.map(c => <option key={c.value} value={c.value} className="bg-surface">{c.label}</option>)}
                  </select>
                </FieldRow>
                {corps === 'ENSEIGNANT' && (
                  <FieldRow label="Type d'agent">
                    <div className="flex gap-6 py-0.5">
                      {(['FONCTIONNAIRE', 'CONTRACTUEL'] as const).map(t => (
                        <label key={t} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="typeAgent" value={t} checked={typeAgent === t} onChange={() => setTypeAgent(t)} className="accent-brass" />
                          <span className="font-body text-sm text-paper/60">{t.charAt(0) + t.slice(1).toLowerCase()}</span>
                        </label>
                      ))}
                    </div>
                  </FieldRow>
                )}
                <FieldRow label="Région">
                  <select value={region} onChange={e => setRegion(e.target.value)} className={SELECT}>
                    <option value="" className="bg-surface">— Sélectionner —</option>
                    {REGIONS_SN.map(r => <option key={r} value={r} className="bg-surface">{r}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Académie (IA)">
                  <input value={ia} onChange={e => setIa(e.target.value)} placeholder="ex : Kolda"
                    className={INPUT} />
                </FieldRow>
                <FieldRow label="IEF">
                  <input value={ief} onChange={e => setIef(e.target.value)} placeholder="ex : Médina-Yoro-Foulah"
                    className={INPUT} />
                </FieldRow>
                <FieldRow label="École / Poste">
                  <input value={ecole} onChange={e => setEcole(e.target.value)} placeholder="ex : Lycée Ely Manel Fall"
                    className={INPUT} />
                </FieldRow>
              </div>
            </div>

            {stepErr && <ErrBanner msg={stepErr} />}

            <div className="pt-6">
              <button type="button" onClick={goToStep2}
                className="w-full flex items-center justify-center gap-2 font-body font-medium bg-spruce-light text-paper px-8 py-4 rounded-2xl hover:bg-spruce transition-colors glow-green">
                Continuer <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 2 — Commande ── */}
        {step === 2 && (
          <div className="space-y-5">
            {produits.length === 0 ? (
              <div className="text-center py-10">
                <Loader2 className="w-5 h-5 text-paper/70 animate-spin mx-auto" />
              </div>
            ) : (
              <div className="space-y-3">
                {produits.map(p => (
                  <ProduitCard key={p.id} p={p}
                    selected={produitId === p.id}
                    onSelect={() => {
                      setProduitId(produitId === p.id ? '' : p.id)
                      setNbMensualites(p.nb_mensualites_max)
                    }} />
                ))}
              </div>
            )}

            {/* Calculateur inline */}
            {produitChoisi && (
              <div className="bg-surface border border-brass/20 rounded-2xl p-5 space-y-4">
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-brass/60">Plan de paiement</div>
                <div>
                  <div className="font-mono text-xs text-paper/55 mb-2.5">Nombre de mensualités</div>
                  <div className="flex gap-2 flex-wrap">
                    {Array.from({ length: produitChoisi.nb_mensualites_max }, (_, i) => i + 1).map(n => (
                      <button key={n} type="button" onClick={() => setNbMensualites(n)}
                        className={`w-10 h-10 rounded-xl font-mono text-sm border transition-colors ${
                          n === nbMensualites ? 'bg-brass text-void border-brass' : 'bg-surface-2 text-paper/65 border-paper/10 hover:border-brass/40'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { lbl: 'Apport',      val: fcfa(apport),     hi: true  },
                    { lbl: 'Mensualité',  val: fcfa(mensualite), hi: false },
                    { lbl: 'Durée',       val: `${nbMensualites} mois`, hi: false },
                  ].map(({ lbl, val, hi }) => (
                    <div key={lbl} className="bg-surface-2 rounded-xl px-3 py-3">
                      <div className="font-mono text-xs uppercase tracking-[0.1em] text-paper/65 mb-1">{lbl}</div>
                      <div className={`font-mono text-sm font-medium ${hi ? 'text-brass-light' : 'text-paper/70'}`}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="font-mono text-xs text-paper/65 text-center">
              La commande est optionnelle — vous pouvez choisir un produit plus tard.
            </p>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => goBack(1)}
                className="flex items-center gap-2 font-body text-sm font-medium border border-paper/10 text-paper/60 px-5 py-3.5 rounded-2xl hover:border-paper/25 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <button type="button" onClick={goToStep3}
                className="flex-1 flex items-center justify-center gap-2 font-body font-medium bg-spruce-light text-paper px-6 py-3.5 rounded-2xl hover:bg-spruce transition-colors glow-green">
                Continuer <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 — Documents ── */}
        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-surface border border-paper/6 rounded-2xl overflow-hidden">
              <SectionHeader>Pièces justificatives obligatoires</SectionHeader>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.15em] text-paper/75 mb-2">CNI · Recto</div>
                  <DropZone label="Glissez ou cliquez pour ajouter le recto de votre pièce d'identité"
                    file={cniRecto} onFile={setCniRecto} onClear={() => setCniRecto(null)} />
                </div>
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.15em] text-paper/75 mb-2">CNI · Verso</div>
                  <DropZone label="Glissez ou cliquez pour ajouter le verso de votre pièce d'identité"
                    file={cniVerso} onFile={setCniVerso} onClear={() => setCniVerso(null)} />
                </div>
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.15em] text-paper/75 mb-2">Bulletin de salaire</div>
                  <DropZone label="Glissez ou cliquez pour ajouter votre dernier bulletin de salaire"
                    file={bulletin} onFile={setBulletin} onClear={() => setBulletin(null)} />
                </div>
              </div>
            </div>

            {/* Récap */}
            <div className="bg-surface border border-paper/6 rounded-2xl p-5 space-y-2">
              <div className="font-mono text-xs uppercase tracking-[0.15em] text-paper/70 mb-3">Récapitulatif</div>
              <RecapLine label="Nom" value={`${prenom.trim()} ${nom.trim()}`} />
              <RecapLine label="Téléphone" value={telephone} />
              <RecapLine label="Matricule" value={matricule} />
              <RecapLine label="Corps" value={CORPS_LIST.find(c => c.value === corps)?.label ?? corps} />
              {produitChoisi && (
                <>
                  <div className="border-t border-paper/6 mt-2 pt-2" />
                  <RecapLine label="Produit" value={produitChoisi.nom} />
                  <RecapLine label="Plan" value={`${fcfa(apport)} apport · ${fcfa(mensualite)}/mois × ${nbMensualites}`} />
                </>
              )}
            </div>

            <p className="font-mono text-xs text-paper/75 leading-relaxed">
              Je certifie l&apos;exactitude des informations et m&apos;engage à respecter les conditions du CFA CUSEMS Authentique.
            </p>

            {(errMsg) && <ErrBanner msg={errMsg} />}

            <div className="flex gap-3">
              <button type="button" onClick={() => goBack(2)}
                className="flex items-center gap-2 font-body text-sm font-medium border border-paper/10 text-paper/60 px-5 py-3.5 rounded-2xl hover:border-paper/25 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <button type="submit" disabled={stage === 'submitting'}
                className="flex-1 flex items-center justify-center gap-2 font-body font-medium bg-spruce-light text-paper px-6 py-3.5 rounded-2xl hover:bg-spruce transition-colors disabled:opacity-50 glow-green">
                {stage === 'submitting' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
                ) : produitId ? (
                  <>Déposer et payer l&apos;apport <ChevronRight className="w-4 h-4" /></>
                ) : (
                  <>Déposer mon dossier <ChevronRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </form>
        )}

        <p className="font-mono text-xs uppercase tracking-[0.1em] text-paper/55 text-center mt-10">
          © 2026 SEMOU GROUP × CFA CUSEMS Authentique · Récépissé N. 0413/MINT/DGAT/DLP
        </p>
      </div>
    </div>
  )
}

/* ── Sous-composants ── */
const INPUT  = 'w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/65'
const SELECT = 'w-full bg-surface border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors'

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-void/30 border-b border-paper/6 px-6 py-3">
      <span className="font-mono text-xs uppercase tracking-[0.25em] text-paper/75">{children}</span>
    </div>
  )
}
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      <span className="font-mono text-xs uppercase tracking-[0.1em] text-paper/75 w-28 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 bg-clay/10 border border-clay/25 rounded-xl p-4 mt-4">
      <AlertCircle className="w-4 h-4 text-clay flex-shrink-0 mt-0.5" />
      <p className="font-body text-sm text-clay leading-snug">{msg}</p>
    </div>
  )
}
function RecapLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="font-mono text-xs uppercase tracking-[0.1em] text-paper/70">{label}</span>
      <span className="font-mono text-xs text-paper/70 text-right">{value}</span>
    </div>
  )
}
