'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Upload, AlertCircle, Loader2, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import StampMark from '@/components/StampMark'

const REGIONS_SN = [
  'Dakar', 'Thiès', 'Saint-Louis', 'Diourbel', 'Louga', 'Kaolack',
  'Fatick', 'Tambacounda', 'Ziguinchor', 'Kolda', 'Matam', 'Kaffrine',
  'Kédougou', 'Sédhiou',
]

const CORPS_LIST = [
  { value: 'ENSEIGNANT',      label: 'Enseignement' },
  { value: 'SANTE',           label: 'Santé' },
  { value: 'POLICE',          label: 'Police nationale' },
  { value: 'GENDARMERIE',     label: 'Gendarmerie' },
  { value: 'JUSTICE',         label: 'Justice' },
  { value: 'ARMEE',           label: 'Armée' },
  { value: 'IMPOTS',          label: 'Impôts' },
  { value: 'DOUANES',         label: 'Douanes' },
  { value: 'TRESOR',          label: 'Trésor public' },
  { value: 'MAIRIE',          label: 'Mairie / Collectivité' },
  { value: 'AUTRE',           label: 'Autre corps d\'État' },
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

type Stage = 'form' | 'submitting' | 'success' | 'error'

export default function Inscription() {
  const [prenom,     setPrenom]     = useState('')
  const [nom,        setNom]        = useState('')
  const [telephone,  setTelephone]  = useState('')
  const [matricule,  setMatricule]  = useState('')
  const [corps,      setCorps]      = useState('')
  const [typeAgent,  setTypeAgent]  = useState('FONCTIONNAIRE')
  const [ia,         setIa]         = useState('')
  const [ief,        setIef]        = useState('')
  const [region,     setRegion]     = useState('')
  const [ecole,      setEcole]      = useState('')

  const [cniRecto,  setCniRecto]  = useState<File | null>(null)
  const [cniVerso,  setCniVerso]  = useState<File | null>(null)
  const [bulletin,  setBulletin]  = useState<File | null>(null)

  const [stage,  setStage]  = useState<Stage>('form')
  const [errMsg, setErrMsg] = useState('')
  const [refCode, setRefCode] = useState('')

  const rectoRef   = useRef<HTMLInputElement>(null)
  const versoRef   = useRef<HTMLInputElement>(null)
  const bulletRef  = useRef<HTMLInputElement>(null)

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
      uploadDoc(cniRecto,  `cni/${phone}/${ts}_recto.${ext(cniRecto)}`),
      uploadDoc(cniVerso,  `cni/${phone}/${ts}_verso.${ext(cniVerso)}`),
      uploadDoc(bulletin,  `bulletins/${phone}/${ts}.${ext(bulletin)}`),
    ])

    const notes = cniVersoPath.startsWith('ERREUR')
      ? null
      : `CNI_VERSO:${cniVersoPath}`

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
        notes,
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

    setRefCode(`SG-${new Date().getFullYear()}-${data.id.slice(-8).toUpperCase()}`)
    setStage('success')
  }

  /* ── Succès ─────────────────────────────────────────────────────────── */
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-20">
        <div className="relative max-w-md w-full bg-white border border-ink/10 rounded-sm shadow-[0_20px_60px_-30px_rgba(13,59,46,0.3)] p-8 md:p-12 perforated text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/35 mb-8">
            Bordereau · Dossier enregistré
          </div>

          <div className="font-display text-4xl md:text-5xl leading-[1.05] mb-4">
            Dossier <span className="italic text-spruce">reçu.</span>
          </div>

          <p className="font-body text-ink/60 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            Votre dossier est en cours de traitement. Vous recevrez un SMS de confirmation dans les{' '}
            <strong className="text-ink/80">24 à 48 heures</strong>.
          </p>

          <div className="bg-parchment border border-ink/10 rounded-sm p-4 mb-10 inline-block">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40 mb-1.5">
              Référence dossier
            </div>
            <div className="font-mono text-base md:text-lg font-medium text-spruce">
              {refCode}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/suivi"
              className="font-body text-sm font-medium bg-spruce text-paper px-6 py-3 rounded-full hover:bg-spruce-dark transition-colors"
            >
              Suivre mon dossier
            </Link>
            <Link
              href="/"
              className="font-body text-sm font-medium border border-ink/15 px-6 py-3 rounded-full hover:border-spruce hover:text-spruce transition-colors"
            >
              Retour à l&apos;accueil
            </Link>
          </div>

          <div className="absolute -bottom-10 -right-6 opacity-80">
            <StampMark />
          </div>
        </div>
      </div>
    )
  }

  /* ── Formulaire ─────────────────────────────────────────────────────── */
  const isEnseignant = corps === 'ENSEIGNANT'

  return (
    <div className="min-h-screen px-6 md:px-10 py-12 md:py-20">
      <div className="max-w-2xl mx-auto">

        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-spruce mb-10"
        >
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>

        <div className="mb-8">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass-dark">
            CFA CUSEMS
          </span>
          <h1 className="font-display text-4xl md:text-5xl mt-2 leading-[1.05]">
            Formulaire<br />
            <span className="italic text-spruce">d&apos;inscription.</span>
          </h1>
          <p className="font-body text-ink/60 text-sm mt-4 max-w-sm leading-relaxed">
            Remplissez ce bordereau en ligne. Votre dossier sera validé sous 24 à 48 heures.
          </p>
        </div>

        {/* ── Bordereau card ── */}
        <div className="relative bg-white border border-ink/10 rounded-sm shadow-[0_20px_60px_-30px_rgba(13,59,46,0.25)] perforated">

          {/* En-tête bordereau */}
          <div className="px-6 md:px-8 pt-10 pb-5 border-b border-ink/10">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink/35">
                  Bordereau d&apos;inscription
                </div>
                <div className="font-display text-lg mt-0.5">
                  Semou Group <span className="text-spruce">× CFA CUSEMS</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/35">Date</div>
                <div className="font-mono text-xs text-ink/60">
                  {new Date().toLocaleDateString('fr-SN', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 md:px-8 pb-8">

            {/* ── Section I ── */}
            <SectionBar>Section I — Identité civile</SectionBar>

            <Field n="01" label="Prénom">
              <input
                required
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                placeholder="ex : Aminata"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            <Field n="02" label="Nom de famille">
              <input
                required
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="ex : Diallo"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            <Field n="03" label="Téléphone">
              <input
                required
                type="tel"
                value={telephone}
                onChange={e => setTelephone(e.target.value)}
                placeholder="77 XXX XX XX"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-mono text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            <Field n="04" label="N° Matricule">
              <input
                required
                value={matricule}
                onChange={e => setMatricule(e.target.value)}
                placeholder="ex : 300501163/E"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-mono text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            {/* ── Section II ── */}
            <SectionBar>Section II — Situation professionnelle</SectionBar>

            <Field n="05" label="Corps / Fonction">
              <select
                required
                value={corps}
                onChange={e => setCorps(e.target.value)}
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors text-ink/80"
              >
                <option value="">— Sélectionner —</option>
                {CORPS_LIST.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>

            {isEnseignant && (
              <Field n="06" label="Type d'agent">
                <div className="flex items-center gap-6 py-0.5">
                  {(['FONCTIONNAIRE', 'CONTRACTUEL'] as const).map(t => (
                    <label key={t} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="typeAgent"
                        value={t}
                        checked={typeAgent === t}
                        onChange={() => setTypeAgent(t)}
                        className="accent-spruce"
                      />
                      <span className="font-body text-sm text-ink/70">
                        {t.charAt(0) + t.slice(1).toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
            )}

            <Field n="07" label="Académie (IA)">
              <input
                value={ia}
                onChange={e => setIa(e.target.value)}
                placeholder="ex : Kolda"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            <Field n="08" label="IEF">
              <input
                value={ief}
                onChange={e => setIef(e.target.value)}
                placeholder="ex : Médina-Yoro-Foulah"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            <Field n="09" label="Région">
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors text-ink/80"
              >
                <option value="">— Sélectionner —</option>
                {REGIONS_SN.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>

            <Field n="10" label="École / Poste">
              <input
                value={ecole}
                onChange={e => setEcole(e.target.value)}
                placeholder="ex : Lycée Ely Manel Fall"
                className="w-full bg-transparent border-b border-ink/15 focus:border-spruce outline-none font-body text-sm pb-0.5 transition-colors placeholder:text-ink/25"
              />
            </Field>

            {/* ── Section III ── */}
            <SectionBar>Section III — Pièces justificatives</SectionBar>

            <div className="font-mono text-[10px] text-ink/40 tracking-[0.1em] leading-relaxed pt-2 pb-1 border-b border-dashed border-ink/10">
              Formats acceptés : JPEG, PNG, PDF — 10 Mo max par fichier.
            </div>

            <FileField
              n="11"
              label="CNI · Recto"
              file={cniRecto}
              onPick={() => rectoRef.current?.click()}
              onClear={() => setCniRecto(null)}
            />
            <input
              ref={rectoRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => setCniRecto(e.target.files?.[0] ?? null)}
            />

            <FileField
              n="12"
              label="CNI · Verso"
              file={cniVerso}
              onPick={() => versoRef.current?.click()}
              onClear={() => setCniVerso(null)}
            />
            <input
              ref={versoRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => setCniVerso(e.target.files?.[0] ?? null)}
            />

            <FileField
              n="13"
              label="Bulletin salaire"
              file={bulletin}
              onPick={() => bulletRef.current?.click()}
              onClear={() => setBulletin(null)}
            />
            <input
              ref={bulletRef}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={e => setBulletin(e.target.files?.[0] ?? null)}
            />

            {/* ── Bas de bordereau ── */}
            <div className="mt-8 pt-6 border-t border-dashed border-ink/15">
              <p className="font-mono text-[10px] text-ink/35 tracking-[0.1em] leading-relaxed mb-6">
                Je certifie sur l&apos;honneur l&apos;exactitude des informations fournies et
                m&apos;engage à respecter les conditions de remboursement du CFA CUSEMS.
              </p>

              {errMsg && (
                <div className="flex items-start gap-3 bg-clay/8 border border-clay/20 rounded-sm p-4 mb-5">
                  <AlertCircle className="w-4 h-4 text-clay flex-shrink-0 mt-0.5" />
                  <p className="font-body text-sm text-clay leading-snug">{errMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={stage === 'submitting'}
                className="w-full flex items-center justify-center gap-2 font-body font-medium bg-spruce text-paper px-8 py-4 rounded-full hover:bg-spruce-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {stage === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Envoi en cours…
                  </>
                ) : (
                  <>
                    Déposer mon dossier
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/30 text-center mt-10">
          © 2026 Semou Group × CFA CUSEMS · Récépissé N. 0413/MINT/DGAT/DLP
        </p>
      </div>
    </div>
  )
}

/* ── Sous-composants ─────────────────────────────────────────────────── */

function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-ink text-paper -mx-6 md:-mx-8 px-6 md:px-8 py-2.5 mt-6 mb-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.25em]">{children}</span>
    </div>
  )
}

function Field({
  n,
  label,
  children,
}: {
  n: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-dashed border-ink/10 last:border-0">
      <span className="font-mono text-[10px] text-ink/30 w-5 flex-shrink-0 select-none">{n}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 w-28 flex-shrink-0 leading-tight">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}

function FileField({
  n,
  label,
  file,
  onPick,
  onClear,
}: {
  n: string
  label: string
  file: File | null
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-4 py-3.5 border-b border-dashed border-ink/10">
      <span className="font-mono text-[10px] text-ink/30 w-5 flex-shrink-0 select-none">{n}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 w-28 flex-shrink-0 leading-tight">
        {label}
      </span>
      <div className="flex-1 min-w-0">
        {file ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-spruce truncate">{file.name}</span>
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-sm text-ink/30 hover:text-clay transition-colors leading-none flex-shrink-0"
              aria-label="Retirer le fichier"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="flex items-center gap-1.5 border border-dashed border-ink/20 rounded-sm px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40 hover:border-spruce hover:text-spruce transition-colors"
          >
            <Upload className="w-3 h-3" />
            Joindre
          </button>
        )}
      </div>
    </div>
  )
}
