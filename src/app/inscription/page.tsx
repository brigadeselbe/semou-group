'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, AlertCircle, Loader2, ChevronRight, CreditCard, CheckCircle2 } from 'lucide-react'
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
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true })
  return error ? `ERREUR:${error.message}` : data.path
}

function formatFcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

type Stage = 'form' | 'submitting' | 'paiement' | 'success' | 'error'

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

  /* ── Pièces ── */
  const [cniRecto, setCniRecto] = useState<File | null>(null)
  const [cniVerso, setCniVerso] = useState<File | null>(null)
  const [bulletin, setBulletin] = useState<File | null>(null)
  const rectoRef  = useRef<HTMLInputElement>(null)
  const versoRef  = useRef<HTMLInputElement>(null)
  const bulletRef = useRef<HTMLInputElement>(null)

  /* ── Produit ── */
  const [produits,      setProduits]      = useState<CFAProduit[]>([])
  const [produitId,     setProduitId]     = useState('')
  const [nbMensualites, setNbMensualites] = useState(6)

  /* ── State ── */
  const [stage,     setStage]     = useState<Stage>('form')
  const [errMsg,    setErrMsg]    = useState('')
  const [refCode,   setRefCode]   = useState('')
  const [commandeId,setCommandeId]= useState('')
  const [payLoading,setPayLoading]= useState<'wave' | 'orange' | null>(null)
  const [payError,  setPayError]  = useState('')

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

  const produitChoisi = produits.find(p => p.id === produitId) ?? null
  const apport = produitChoisi?.apport_minimum ?? 0
  const mensualite = produitChoisi
    ? Math.ceil((produitChoisi.prix_vente - apport) / Math.max(nbMensualites, 1))
    : 0

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
        ia:                 ia.trim()    || null,
        ief:                ief.trim()   || null,
        region:             region       || null,
        ecole:              ecole.trim() || null,
        statut:             'EN_ATTENTE',
        source:             'INSCRIPTION',
        cni_url:            cniRectoPath.startsWith('ERREUR') ? null : cniRectoPath,
        bulletin_url:       bulletinPath.startsWith('ERREUR') ? null : bulletinPath,
        notes:              cniVersoPath.startsWith('ERREUR') ? null : `CNI_VERSO:${cniVersoPath}`,
      })
      .select('id')
      .single()

    if (error) {
      setErrMsg(
        error.code === '23505'
          ? 'Ce numéro de téléphone est déjà enregistré. Rendez-vous sur /suivi pour retrouver votre dossier.'
          : `Erreur lors de l'enregistrement : ${error.message}`
      )
      setStage('error')
      return
    }

    const cid = data.id as string
    const ref = `SG-${new Date().getFullYear()}-${cid.slice(-8).toUpperCase()}`
    setRefCode(ref)

    // SMS de confirmation (non bloquant)
    fetch('/api/sms/inscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telephone: normalizePhone(telephone), prenom: prenom.trim(), ref }),
    }).catch(() => null)

    /* Si produit sélectionné → créer commande et aller au paiement */
    if (produitId) {
      const { data: cmdId, error: cmdErr } = await supabase.rpc('inscription_creer_commande', {
        p_client_id:      cid,
        p_produit_id:     produitId,
        p_nb_mensualites: nbMensualites,
      })
      if (cmdErr || !cmdId) {
        setErrMsg(`Dossier créé mais erreur commande : ${cmdErr?.message ?? '—'}`)
        setStage('success') // dossier existe quand même
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
      body: JSON.stringify({
        type: 'APPORT',
        id: commandeId,
        telephone: normalizePhone(telephone),
      }),
    })
    const json = await res.json()
    if (!res.ok) { setPayError(json.error ?? 'Erreur'); setPayLoading(null); return }
    window.location.href = json.checkout_url
  }

  /* ── Étape paiement ── */
  if (stage === 'paiement') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <div className="relative max-w-sm w-full">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-60 h-40 bg-brass/10 blur-[80px] rounded-full pointer-events-none" />
          <div className="relative bg-surface border border-paper/6 rounded-2xl p-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/45 mb-1">Étape 2 / 2</div>
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
                    <div className="text-paper/45 text-[10px] uppercase tracking-[0.12em]">Apport</div>
                    <div className="text-brass-light mt-0.5">{formatFcfa(apport)}</div>
                  </div>
                  <div>
                    <div className="text-paper/45 text-[10px] uppercase tracking-[0.12em]">Mensualité</div>
                    <div className="text-paper/60 mt-0.5">{formatFcfa(mensualite)} × {nbMensualites}</div>
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
              <div className="font-mono text-[10px] text-paper/65 tracking-[0.08em]">Réf. dossier : {refCode}</div>
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
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/45 mb-8">
              Bordereau · Dossier enregistré
            </div>
            <div className="w-14 h-14 rounded-full bg-spruce-light/20 border border-spruce-light/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-6 h-6 text-spruce-light" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl leading-[1.05] mb-4 text-paper">
              Dossier <span className="italic text-brass-light">reçu.</span>
            </h1>
            <p className="font-body text-paper/45 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
              Votre dossier est en cours de traitement. Vous recevrez un SMS de confirmation dans les{' '}
              <strong className="text-paper/70">24 à 48 heures</strong>.
            </p>
            <div className="bg-surface-2 border border-paper/10 rounded-xl p-4 mb-10 inline-block">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/55 mb-1.5">Référence dossier</div>
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

  /* ── Formulaire ── */
  const isEnseignant = corps === 'ENSEIGNANT'

  return (
    <div className="min-h-screen px-6 md:px-10 py-12 md:py-20">
      <div className="max-w-2xl mx-auto">

        <Link href="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/65 hover:text-brass-light transition-colors mb-10">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="mb-10">
          <LogoSG size={52} className="mb-4" />
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">CFA CUSEMS Authentique</span>
          <h1 className="font-display text-4xl md:text-5xl mt-2 leading-[1.05] text-paper">
            Formulaire<br /><span className="italic text-brass-light">d&apos;inscription.</span>
          </h1>
          <p className="font-body text-paper/65 text-sm mt-4 max-w-sm leading-relaxed">
            Remplissez ce bordereau en ligne. Validation sous 24 à 48 heures.
          </p>
        </div>

        <div className="relative bg-surface border border-paper/6 rounded-2xl overflow-hidden">

          <div className="px-6 md:px-8 pt-8 pb-5 border-b border-paper/5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper/45">Bordereau d&apos;inscription</div>
                <div className="font-display text-lg mt-0.5 text-paper">SEMOU GROUP <span className="text-brass-light">× CFA CUSEMS Authentique</span></div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45">Date</div>
                <div className="font-mono text-xs text-paper/70">
                  {new Date().toLocaleDateString('fr-SN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 md:px-8 pb-8">

            {/* ── Section I ── */}
            <SectionBar>Section I — Identité civile</SectionBar>
            <Field n="01" label="Prénom">
              <input required value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="ex : Aminata"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>
            <Field n="02" label="Nom de famille">
              <input required value={nom} onChange={e => setNom(e.target.value)} placeholder="ex : Diallo"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>
            <Field n="03" label="Téléphone">
              <input required type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="77 XXX XX XX"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-mono text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>
            <Field n="04" label="N° Matricule">
              <input required value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="ex : 300501163/E"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-mono text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>

            {/* ── Section II ── */}
            <SectionBar>Section II — Situation professionnelle</SectionBar>
            <Field n="05" label="Corps / Fonction">
              <select required value={corps} onChange={e => setCorps(e.target.value)}
                className="w-full bg-surface border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors">
                <option value="" className="bg-surface">— Sélectionner —</option>
                {CORPS_LIST.map(c => <option key={c.value} value={c.value} className="bg-surface">{c.label}</option>)}
              </select>
            </Field>
            {isEnseignant && (
              <Field n="06" label="Type d'agent">
                <div className="flex items-center gap-6 py-0.5">
                  {(['FONCTIONNAIRE', 'CONTRACTUEL'] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="typeAgent" value={t} checked={typeAgent === t} onChange={() => setTypeAgent(t)} className="accent-brass" />
                      <span className="font-body text-sm text-paper/60">{t.charAt(0) + t.slice(1).toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <Field n="07" label="Académie (IA)">
              <input value={ia} onChange={e => setIa(e.target.value)} placeholder="ex : Kolda"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>
            <Field n="08" label="IEF">
              <input value={ief} onChange={e => setIef(e.target.value)} placeholder="ex : Médina-Yoro-Foulah"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>
            <Field n="09" label="Région">
              <select value={region} onChange={e => setRegion(e.target.value)}
                className="w-full bg-surface border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors">
                <option value="" className="bg-surface">— Sélectionner —</option>
                {REGIONS_SN.map(r => <option key={r} value={r} className="bg-surface">{r}</option>)}
              </select>
            </Field>
            <Field n="10" label="École / Poste">
              <input value={ecole} onChange={e => setEcole(e.target.value)} placeholder="ex : Lycée Ely Manel Fall"
                className="w-full bg-transparent border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors placeholder:text-paper/60" />
            </Field>

            {/* ── Section III ── */}
            <SectionBar>Section III — Pièces justificatives</SectionBar>
            <div className="font-mono text-[10px] text-paper/45 tracking-[0.1em] pt-2 pb-1 border-b border-dashed border-paper/5">
              Formats acceptés : JPEG, PNG, PDF — 10 Mo max par fichier
            </div>
            <FileField n="11" label="CNI · Recto" file={cniRecto} onPick={() => rectoRef.current?.click()} onClear={() => setCniRecto(null)} />
            <input ref={rectoRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setCniRecto(e.target.files?.[0] ?? null)} />
            <FileField n="12" label="CNI · Verso" file={cniVerso} onPick={() => versoRef.current?.click()} onClear={() => setCniVerso(null)} />
            <input ref={versoRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setCniVerso(e.target.files?.[0] ?? null)} />
            <FileField n="13" label="Bulletin salaire" file={bulletin} onPick={() => bulletRef.current?.click()} onClear={() => setBulletin(null)} />
            <input ref={bulletRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setBulletin(e.target.files?.[0] ?? null)} />

            {/* ── Section IV — Produit ── */}
            {produits.length > 0 && (
              <>
                <SectionBar>Section IV — Produit souhaité (optionnel)</SectionBar>
                <Field n="14" label="Produit">
                  <select value={produitId} onChange={e => setProduitId(e.target.value)}
                    className="w-full bg-surface border-b border-paper/10 focus:border-brass outline-none font-body text-sm text-paper pb-0.5 transition-colors">
                    <option value="" className="bg-surface">— Choisir plus tard —</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id} className="bg-surface">
                        {p.nom} — {formatFcfa(p.prix_vente)}
                      </option>
                    ))}
                  </select>
                </Field>

                {produitChoisi && (
                  <>
                    <Field n="15" label="Mensualités">
                      <div className="flex items-center gap-4">
                        <input type="range" min={1} max={produitChoisi.nb_mensualites_max} value={nbMensualites}
                          onChange={e => setNbMensualites(Number(e.target.value))}
                          className="flex-1 accent-brass" />
                        <span className="font-mono text-sm text-paper/70 w-16 text-right">{nbMensualites} mois</span>
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-px bg-paper/5 border border-paper/6 rounded-xl overflow-hidden mx-0 my-3">
                      <div className="bg-surface-2 px-4 py-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45">Apport à verser</div>
                        <div className="font-mono text-sm font-medium text-brass-light mt-0.5">{formatFcfa(apport)}</div>
                      </div>
                      <div className="bg-surface-2 px-4 py-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/45">Mensualité</div>
                        <div className="font-mono text-sm font-medium text-paper/70 mt-0.5">{formatFcfa(mensualite)} / mois</div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── Soumission ── */}
            <div className="mt-8 pt-6 border-t border-dashed border-paper/8">
              <p className="font-mono text-[10px] text-paper/65 tracking-[0.1em] leading-relaxed mb-6">
                Je certifie sur l&apos;honneur l&apos;exactitude des informations fournies et
                m&apos;engage à respecter les conditions de remboursement du CFA CUSEMS Authentique.
              </p>

              {errMsg && (
                <div className="flex items-start gap-3 bg-clay/10 border border-clay/25 rounded-xl p-4 mb-5">
                  <AlertCircle className="w-4 h-4 text-clay flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-clay leading-snug">{errMsg}</p>
                </div>
              )}

              <button type="submit" disabled={stage === 'submitting'}
                className="w-full flex items-center justify-center gap-2 font-body font-medium bg-spruce-light text-paper px-8 py-4 rounded-full hover:bg-spruce transition-colors disabled:opacity-50 disabled:cursor-not-allowed glow-green">
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
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-paper/60 text-center mt-10">
          © 2026 SEMOU GROUP × CFA CUSEMS Authentique · Récépissé N. 0413/MINT/DGAT/DLP
        </p>
      </div>
    </div>
  )
}

/* ── Sous-composants ── */
function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-spruce-dark border-y border-spruce/25 -mx-6 md:-mx-8 px-6 md:px-8 py-2.5 mt-6 mb-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-brass/70">{children}</span>
    </div>
  )
}
function Field({ n, label, children }: { n: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-dashed border-paper/5 last:border-0">
      <span className="font-mono text-[10px] text-paper/65 w-5 flex-shrink-0 select-none">{n}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60 w-28 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
function FileField({ n, label, file, onPick, onClear }: {
  n: string; label: string; file: File | null; onPick: () => void; onClear: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-dashed border-paper/5">
      <span className="font-mono text-[10px] text-paper/65 w-5 flex-shrink-0 select-none">{n}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-paper/60 w-28 flex-shrink-0 leading-tight">{label}</span>
      <div className="flex-1 min-w-0">
        {file ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-brass-light truncate">{file.name}</span>
            <button type="button" onClick={onClear} className="font-mono text-sm text-paper/65 hover:text-clay transition-colors flex-shrink-0">×</button>
          </div>
        ) : (
          <button type="button" onClick={onPick}
            className="flex items-center gap-1.5 border border-dashed border-paper/10 rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-paper/55 hover:border-brass/40 hover:text-brass-light transition-colors">
            <Upload className="w-3 h-3" /> Joindre
          </button>
        )}
      </div>
    </div>
  )
}
