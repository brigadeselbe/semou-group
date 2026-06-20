'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ChevronRight, X, Play,
  ArrowLeft, Bell, CheckCircle2, Loader2, ChevronRight as ArrowRight,
} from 'lucide-react'
import type { CFAProduit, CFAProduitMedia } from '@/lib/supabase'

function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

/* ── Galerie ─────────────────────────────────────────── */
function Gallery({ medias, photo_url }: { medias: CFAProduitMedia[]; photo_url: string | null }) {
  const [idx, setIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  if (medias.length === 0 && !photo_url) {
    return (
      <div className="w-full aspect-[4/3] bg-surface border border-paper/8 rounded-2xl flex items-center justify-center">
        <span className="font-mono text-xs text-paper/30">Pas de photo</span>
      </div>
    )
  }

  if (medias.length === 0 && photo_url) {
    return (
      <div className="w-full aspect-[4/3] bg-surface border border-paper/8 rounded-2xl overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo_url} alt="" className="w-full h-full object-cover" />
      </div>
    )
  }

  const cur = medias[idx]
  const prev = () => setIdx(i => (i - 1 + medias.length) % medias.length)
  const next = () => setIdx(i => (i + 1) % medias.length)

  return (
    <>
      <div className="space-y-3">
        {/* Main */}
        <div
          className="relative w-full rounded-2xl overflow-hidden bg-surface border border-paper/8 cursor-zoom-in"
          style={{ aspectRatio: '4/3' }}
          onClick={() => setLightbox(true)}
        >
          {cur.type === 'VIDEO' ? (
            <video src={cur.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.url} alt="" className="w-full h-full object-cover" />
          )}
          {medias.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); prev() }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-void/55 backdrop-blur-sm border border-paper/15 flex items-center justify-center hover:bg-void/80 transition-colors">
                <ChevronLeft className="w-5 h-5 text-paper" />
              </button>
              <button onClick={e => { e.stopPropagation(); next() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-void/55 backdrop-blur-sm border border-paper/15 flex items-center justify-center hover:bg-void/80 transition-colors">
                <ChevronRight className="w-5 h-5 text-paper" />
              </button>
              <div className="absolute bottom-3 right-3 font-mono text-[10px] text-paper/70 bg-void/50 backdrop-blur-sm px-2.5 py-0.5 rounded-full">
                {idx + 1} / {medias.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {medias.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {medias.map((m, i) => (
              <button key={m.id} onClick={() => setIdx(i)}
                className={`flex-shrink-0 w-16 h-12 rounded-xl overflow-hidden border-2 transition-colors ${i === idx ? 'border-brass' : 'border-paper/10 hover:border-paper/30'}`}>
                {m.type === 'VIDEO' ? (
                  <div className="w-full h-full bg-paper/8 flex items-center justify-center">
                    <Play className="w-3 h-3 text-paper/60 fill-paper/40" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-void/95 backdrop-blur-md flex flex-col items-center justify-center p-4 [--color-paper:#F7F3EC]"
          onClick={() => setLightbox(false)}
        >
          <button onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-paper/65 hover:text-paper transition-colors">
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <div className="w-full rounded-2xl overflow-hidden bg-paper/4 border border-paper/8" style={{ aspectRatio: '16/9' }}>
              {cur.type === 'VIDEO' ? (
                <video src={cur.url} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.url} alt="" className="w-full h-full object-contain" />
              )}
            </div>
            {medias.length > 1 && (
              <>
                <button onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-void/70 border border-paper/10 flex items-center justify-center hover:bg-void transition-colors">
                  <ChevronLeft className="w-5 h-5 text-paper" />
                </button>
                <button onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-void/70 border border-paper/10 flex items-center justify-center hover:bg-void transition-colors">
                  <ChevronRight className="w-5 h-5 text-paper" />
                </button>
              </>
            )}
          </div>
          {medias.length > 1 && (
            <div className="flex gap-2 mt-4">
              {medias.map((m, i) => (
                <button key={m.id} onClick={() => setIdx(i)}
                  className={`w-14 h-10 rounded-lg overflow-hidden border-2 transition-colors ${i === idx ? 'border-brass' : 'border-paper/10 hover:border-paper/30'}`}>
                  {m.type === 'VIDEO' ? (
                    <div className="w-full h-full bg-paper/8 flex items-center justify-center">
                      <Play className="w-3 h-3 text-paper/60" />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ── Calculateur ─────────────────────────────────────── */
function Calculateur({ p }: { p: CFAProduit }) {
  const [apport, setApport] = useState(p.apport_minimum)
  const [nbMois, setNbMois] = useState(p.nb_mensualites_max)

  const reste      = p.prix_vente - apport
  const mensualite = Math.ceil(reste / Math.max(nbMois, 1))
  const pctApport  = Math.round((apport / p.prix_vente) * 100)
  const maxApport  = Math.round(p.prix_vente * 0.9)

  return (
    <div className="bg-surface border border-paper/8 rounded-2xl p-5 space-y-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Simuler mon paiement</div>

      {/* Apport */}
      <div>
        <div className="flex justify-between items-baseline mb-2.5">
          <span className="font-mono text-xs text-paper/55">Apport initial</span>
          <span className="font-display text-xl text-brass-light">
            {fcfa(apport)}{' '}
            <span className="font-mono text-[10px] text-paper/40">({pctApport}%)</span>
          </span>
        </div>
        <input
          type="range"
          min={p.apport_minimum}
          max={maxApport}
          step={1000}
          value={apport}
          onChange={e => setApport(Number(e.target.value))}
          className="w-full accent-brass cursor-pointer"
        />
        <div className="flex justify-between font-mono text-[9px] text-paper/30 mt-1">
          <span>{fcfa(p.apport_minimum)} min</span>
          <span>{fcfa(maxApport)} max</span>
        </div>
      </div>

      {/* Nb mensualités */}
      <div>
        <div className="font-mono text-xs text-paper/55 mb-2.5">Nombre de mensualités</div>
        <div className="flex gap-2 flex-wrap">
          {Array.from({ length: p.nb_mensualites_max }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setNbMois(n)}
              className={`w-10 h-10 rounded-xl font-mono text-sm border transition-colors ${
                n === nbMois
                  ? 'bg-brass text-void border-brass'
                  : 'bg-surface-2 text-paper/65 border-paper/10 hover:border-brass/40'
              }`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Résultat */}
      <div className="bg-surface-2 border border-paper/8 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/35 mb-1">Mensualité</div>
            <div className="font-display text-2xl text-paper">
              {fcfa(mensualite)}<span className="font-mono text-[10px] text-paper/40"> /mois</span>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/35 mb-1">Durée</div>
            <div className="font-display text-2xl text-paper">
              {nbMois}<span className="font-mono text-[10px] text-paper/40"> mois</span>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-paper/8 flex justify-between font-mono text-xs text-paper/45">
          <span>Reste après apport</span>
          <span className="text-paper/65">{fcfa(reste)}</span>
        </div>
      </div>
    </div>
  )
}

/* ── Page principale ─────────────────────────────────── */
export default function ProduitDetail({ produit: p, medias }: { produit: CFAProduit; medias: CFAProduitMedia[] }) {
  const stockOk = p.stock_illimite || p.stock > 0
  const [waitPhone,   setWaitPhone]   = useState('')
  const [waitState,   setWaitState]   = useState<'idle' | 'open' | 'done'>('idle')
  const [waitLoading, setWaitLoading] = useState(false)

  async function rejoindreWaitlist(e: React.FormEvent) {
    e.preventDefault()
    setWaitLoading(true)
    await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ produit_id: p.id, telephone: waitPhone }),
    })
    setWaitLoading(false)
    setWaitState('done')
  }

  return (
    <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 py-10 pb-24">
      {/* Back */}
      <Link href="/produits"
        className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/45 hover:text-brass-light transition-colors mb-8">
        <ArrowLeft className="w-3.5 h-3.5" /> Retour au catalogue
      </Link>

      <div className="grid md:grid-cols-[1fr_420px] gap-10 items-start">

        {/* Galerie */}
        <Gallery medias={medias} photo_url={p.photo_url} />

        {/* Infos + Calc + CTA */}
        <div className="space-y-5">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${
              p.etat === 'NEUF'     ? 'text-spruce-light bg-spruce/15 border-spruce/25'
              : p.etat === 'OCCASION' ? 'text-paper/65 bg-paper/4 border-paper/8'
              : 'text-brass bg-brass/10 border-brass/20'
            }`}>
              {p.etat === 'NEUF' ? 'Neuf' : p.etat === 'OCCASION' ? 'Occasion' : 'Bon état'}
            </span>
            {p.en_vedette && (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border text-brass-light bg-brass/10 border-brass/20">
                ★ En vedette
              </span>
            )}
            {!stockOk && (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border text-paper/55 bg-paper/4 border-paper/8">
                Épuisé
              </span>
            )}
          </div>

          {/* Nom + description */}
          <div>
            <h1 className="font-display text-3xl md:text-4xl text-paper leading-tight">{p.nom}</h1>
            {p.description && (
              <p className="font-body text-sm text-paper/65 mt-3 leading-relaxed">{p.description}</p>
            )}
          </div>

          {/* Prix rapide */}
          <div className="grid grid-cols-2 gap-px bg-paper/5 rounded-2xl overflow-hidden border border-paper/5">
            <div className="bg-surface px-4 py-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 mb-1">Prix total</div>
              <div className="font-display text-2xl text-brass-light">{fcfa(p.prix_vente)}</div>
            </div>
            <div className="bg-surface px-4 py-4">
              <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/40 mb-1">Apport minimum</div>
              <div className="font-mono text-base font-medium text-paper/70 mt-0.5">{fcfa(p.apport_minimum)}</div>
            </div>
          </div>

          {/* Calculateur */}
          <Calculateur p={p} />

          {/* CTA */}
          {stockOk ? (
            <Link href={`/inscription?produit=${p.id}`}
              className="flex items-center justify-center gap-2 w-full font-body text-base font-medium bg-spruce-light text-paper px-6 py-4 rounded-2xl hover:bg-spruce transition-colors glow-green">
              Commander ce produit <ArrowRight className="w-4 h-4" />
            </Link>
          ) : waitState === 'done' ? (
            <div className="flex items-center justify-center gap-2 w-full font-body text-sm text-spruce-light px-6 py-4 rounded-2xl border border-spruce/25 bg-spruce/8">
              <CheckCircle2 className="w-4 h-4" /> Vous serez notifié par SMS !
            </div>
          ) : waitState === 'open' ? (
            <form onSubmit={rejoindreWaitlist} className="flex gap-2">
              <input
                required type="tel"
                value={waitPhone} onChange={e => setWaitPhone(e.target.value)}
                placeholder="77 XXX XX XX" autoFocus
                className="flex-1 min-w-0 bg-surface border border-paper/12 rounded-xl px-4 py-3 font-mono text-sm text-paper placeholder:text-paper/40 focus:outline-none focus:border-brass/40"
              />
              <button type="submit" disabled={waitLoading}
                className="flex-shrink-0 bg-brass/15 border border-brass/25 text-brass-light px-4 py-3 rounded-xl font-mono text-sm hover:bg-brass/25 transition-colors disabled:opacity-50">
                {waitLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'OK'}
              </button>
            </form>
          ) : (
            <button onClick={() => setWaitState('open')}
              className="flex items-center justify-center gap-2 w-full font-body text-sm text-brass/80 px-6 py-4 rounded-2xl border border-brass/15 hover:border-brass/35 hover:text-brass-light transition-colors">
              <Bell className="w-4 h-4" /> Me notifier quand disponible
            </button>
          )}

          <p className="font-mono text-[10px] text-paper/25 text-center leading-relaxed">
            Réservé aux fonctionnaires sénégalais titulaires d&apos;un matricule officiel.
            <br />Dossier validé sous 24 à 48h.
          </p>
        </div>
      </div>
    </div>
  )
}
