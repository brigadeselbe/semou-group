'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronRight, ChevronLeft, X, Play, Images } from 'lucide-react'
import type { CFAProduit, CFAProduitMedia } from '@/lib/supabase'

function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

function MediaThumb({ m, onClick }: { m: CFAProduitMedia; onClick: () => void }) {
  if (m.type === 'VIDEO') {
    return (
      <button onClick={onClick} className="relative w-full h-44 bg-void overflow-hidden group/vid">
        <video src={m.url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
        <div className="absolute inset-0 flex items-center justify-center bg-void/40 group-hover/vid:bg-void/20 transition-colors">
          <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-5 h-5 text-paper fill-paper ml-0.5" />
          </div>
        </div>
      </button>
    )
  }
  return (
    <button onClick={onClick} className="w-full h-44 overflow-hidden bg-void">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.url} alt="" className="w-full h-full object-cover hover:scale-[1.03] transition-transform duration-500" />
    </button>
  )
}

function Lightbox({ medias, startIndex, onClose }: {
  medias: CFAProduitMedia[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const m = medias[idx]
  const prev = useCallback(() => setIdx(i => (i - 1 + medias.length) % medias.length), [medias.length])
  const next = useCallback(() => setIdx(i => (i + 1) % medias.length), [medias.length])

  return (
    <div className="fixed inset-0 z-50 bg-void/95 backdrop-blur-md flex flex-col items-center justify-center p-4"
      onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 text-paper/40 hover:text-paper transition-colors">
        <X className="w-6 h-6" />
      </button>

      <div className="relative w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        {/* Media principal */}
        <div className="w-full rounded-2xl overflow-hidden bg-white/4 border border-white/8"
          style={{ aspectRatio: '16/9' }}>
          {m.type === 'VIDEO' ? (
            <video src={m.url} controls autoPlay className="w-full h-full object-contain" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={m.url} alt="" className="w-full h-full object-contain" />
          )}
        </div>

        {/* Navigation */}
        {medias.length > 1 && (
          <>
            <button onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-void/70 border border-white/10 flex items-center justify-center hover:bg-void transition-colors">
              <ChevronLeft className="w-5 h-5 text-paper" />
            </button>
            <button onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-void/70 border border-white/10 flex items-center justify-center hover:bg-void transition-colors">
              <ChevronRight className="w-5 h-5 text-paper" />
            </button>
          </>
        )}

        {/* Compteur */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] text-paper/40 bg-void/60 px-2.5 py-1 rounded-full">
          {idx + 1} / {medias.length}
        </div>
      </div>

      {/* Miniatures */}
      {medias.length > 1 && (
        <div className="flex gap-2 mt-4 overflow-x-auto max-w-3xl pb-1">
          {medias.map((t, i) => (
            <button key={t.id} onClick={() => setIdx(i)}
              className={`flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-colors ${i === idx ? 'border-brass' : 'border-white/10 hover:border-white/30'}`}>
              {t.type === 'VIDEO' ? (
                <div className="w-full h-full bg-white/8 flex items-center justify-center">
                  <Play className="w-3 h-3 text-paper/50 fill-paper/50" />
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={t.url} alt="" className="w-full h-full object-cover" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProduitCard({ p, medias = [] }: { p: CFAProduit; medias?: CFAProduitMedia[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const menMin = Math.ceil((p.prix_vente - p.apport_minimum) / p.nb_mensualites_max)
  const stockOk = p.stock_illimite || p.stock > 0

  // Cover : premier média IMAGE, sinon VIDEO, sinon photo_url
  const cover = medias[0] ?? null
  const hasMedia = medias.length > 0
  const nbExtra = medias.length - 1

  return (
    <>
      <div className="relative bg-surface border border-white/6 rounded-2xl overflow-hidden flex flex-col hover:border-brass/20 transition-colors group">

        {/* Cover / galerie */}
        {hasMedia ? (
          <div className="relative">
            <MediaThumb m={cover} onClick={() => setLightboxIdx(0)} />
            {nbExtra > 0 && (
              <button onClick={() => setLightboxIdx(0)}
                className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-void/70 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1">
                <Images className="w-3 h-3 text-paper/50" />
                <span className="font-mono text-[10px] text-paper/50">+{nbExtra}</span>
              </button>
            )}
          </div>
        ) : p.photo_url ? (
          <div className="w-full h-44 overflow-hidden bg-void">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.photo_url} alt={p.nom}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
          </div>
        ) : null}

        {/* Badges */}
        <div className="flex items-center gap-2 px-5 pt-5 pb-3">
          <span className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${
            p.etat === 'NEUF' ? 'text-spruce-light bg-spruce/15 border-spruce/25' : 'text-brass bg-brass/10 border-brass/20'
          }`}>
            {p.etat === 'NEUF' ? 'Neuf' : p.etat === 'OCCASION' ? 'Occasion' : 'Bon état'}
          </span>
          {p.en_vedette && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border text-brass-light bg-brass/10 border-brass/20">
              ★ Vedette
            </span>
          )}
          {!stockOk && (
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border text-paper/30 bg-white/4 border-white/8 ml-auto">
              Épuisé
            </span>
          )}
        </div>

        {/* Nom */}
        <div className="px-5 pb-4">
          <h3 className="font-display text-xl md:text-2xl leading-tight text-paper">{p.nom}</h3>
          {p.description && (
            <p className="font-body text-sm text-paper/40 mt-1 leading-snug">{p.description}</p>
          )}
        </div>

        {/* Chiffres */}
        <div className="grid grid-cols-2 gap-px bg-white/5 border-t border-b border-white/5 mx-0">
          <div className="bg-surface-2 px-5 py-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25">Prix total</div>
            <div className="font-display text-2xl text-brass-light mt-0.5">{fcfa(p.prix_vente)}</div>
          </div>
          <div className="bg-surface-2 px-5 py-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25">Apport initial</div>
            <div className="font-mono text-sm font-medium text-paper/70 mt-1">{fcfa(p.apport_minimum)}</div>
          </div>
          <div className="bg-surface-2 px-5 py-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25">Mensualités</div>
            <div className="font-mono text-sm font-medium text-paper/70 mt-1">Jusqu&apos;à {p.nb_mensualites_max}×</div>
          </div>
          <div className="bg-surface-2 px-5 py-3.5">
            <div className="font-mono text-[9px] uppercase tracking-[0.15em] text-paper/25">Soit dès</div>
            <div className="font-mono text-sm font-medium text-paper/70 mt-1">{fcfa(menMin)} / mois</div>
          </div>
        </div>

        {/* CTA */}
        <div className="px-5 py-4 mt-auto">
          {stockOk ? (
            <Link href="/inscription"
              className="flex items-center justify-center gap-2 w-full font-body text-sm font-medium bg-spruce-light text-paper px-4 py-3 rounded-full hover:bg-spruce transition-colors group-hover:glow-green">
              Commander <ChevronRight className="w-4 h-4" />
            </Link>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full font-body text-sm text-paper/25 px-4 py-3 rounded-full border border-white/5">
              Stock épuisé
            </div>
          )}
        </div>
      </div>

      {lightboxIdx !== null && (
        <Lightbox medias={medias} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </>
  )
}
