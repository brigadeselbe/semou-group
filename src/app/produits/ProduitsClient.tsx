'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'
import ProduitCard from '@/components/ProduitCard'
import type { CFAProduit, CFAProduitMedia } from '@/lib/supabase'

type Filter = 'tous' | 'vedette' | 'neuf' | 'occasion' | 'bon_etat'

const TABS: { key: Filter; label: string }[] = [
  { key: 'tous',     label: 'Tous' },
  { key: 'vedette',  label: '★ En vedette' },
  { key: 'neuf',     label: 'Neuf' },
  { key: 'occasion', label: 'Occasion' },
  { key: 'bon_etat', label: 'Bon état' },
]

export default function ProduitsClient({
  produits,
  mediasByProduit,
}: {
  produits: CFAProduit[]
  mediasByProduit: Record<string, CFAProduitMedia[]>
}) {
  const [filter,  setFilter]  = useState<Filter>('tous')
  const [search,  setSearch]  = useState('')

  const filtered = useMemo(() => {
    let list = produits
    if (filter === 'vedette')  list = list.filter(p => p.en_vedette)
    if (filter === 'neuf')     list = list.filter(p => p.etat === 'NEUF')
    if (filter === 'occasion') list = list.filter(p => p.etat === 'OCCASION')
    if (filter === 'bon_etat') list = list.filter(p => p.etat === 'BON_ETAT')
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(p =>
        p.nom.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [produits, filter, search])

  /* en vedette en tête dans la vue "tous" */
  const sorted = useMemo(() => {
    if (filter !== 'tous') return filtered
    return [...filtered].sort((a, b) => Number(b.en_vedette) - Number(a.en_vedette))
  }, [filtered, filter])

  return (
    <>
      {/* Barre filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-4 mb-10">
        {/* Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`font-mono text-[11px] uppercase tracking-[0.15em] px-3.5 py-1.5 rounded-full border transition-colors ${
                filter === t.key
                  ? 'bg-brass text-void border-brass'
                  : 'text-paper/55 border-white/10 hover:border-white/25 hover:text-paper/80'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-paper/40" />
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-52 pl-8 pr-4 py-1.5 bg-surface border border-white/10 rounded-full font-body text-sm text-paper placeholder:text-paper/35 focus:outline-none focus:border-brass/40 transition-colors"
          />
        </div>
      </div>

      {/* Compteur */}
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/40 mb-6 flex items-center gap-2">
        <SlidersHorizontal className="w-3 h-3" />
        {sorted.length} produit{sorted.length !== 1 ? 's' : ''}
      </div>

      {/* Grille */}
      {sorted.length === 0 ? (
        <div className="text-center py-24">
          <p className="font-body text-paper/50 text-sm">Aucun produit pour cette sélection.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map(p => (
            <ProduitCard key={p.id} p={p} medias={mediasByProduit[p.id] ?? []} />
          ))}
        </div>
      )}
    </>
  )
}
