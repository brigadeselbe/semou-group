'use client'

import { useState, useMemo } from 'react'
import { Calculator, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { CFAProduit } from '@/lib/supabase'

function fcfa(n: number) { return n.toLocaleString('fr-SN') + ' F' }

export default function Calculateur({ produits }: { produits: CFAProduit[] }) {
  const actifs = produits.filter(p => p.actif && (p.stock_illimite || p.stock > 0))

  const [produitId, setProduitId] = useState(actifs[0]?.id ?? '')
  const [apport,    setApport]    = useState('')
  const [mois,      setMois]      = useState(6)

  const produit = actifs.find(p => p.id === produitId) ?? actifs[0]

  const calcul = useMemo(() => {
    if (!produit) return null
    const apportVal = Math.max(produit.apport_minimum, Number(apport) || produit.apport_minimum)
    const reste     = produit.prix_vente - apportVal
    if (reste < 0) return null
    const nbMois    = Math.min(mois, produit.nb_mensualites_max)
    const mensual   = nbMois > 0 ? Math.ceil(reste / nbMois) : reste
    return { apportVal, reste, mensual, nbMois }
  }, [produit, apport, mois])

  if (actifs.length === 0) return null

  return (
    <section className="px-6 md:px-10 py-20 md:py-28 relative z-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">

          {/* Titre */}
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass flex items-center gap-2 mb-5">
              <Calculator className="w-3.5 h-3.5" /> Simulateur
            </span>
            <h2 className="font-display text-3xl md:text-5xl leading-[1.05] text-paper">
              Combien allez-vous<br />
              <span className="italic text-brass-light">payer par mois ?</span>
            </h2>
            <p className="font-body text-paper/60 text-sm mt-5 leading-relaxed max-w-sm">
              Choisissez un produit, entrez votre apport disponible et le nombre de mois souhaité — calculez votre mensualité en un clic.
            </p>
          </div>

          {/* Formulaire */}
          <div className="bg-surface border border-paper/6 rounded-2xl p-6 md:p-8">
            {/* Produit */}
            <div className="mb-5">
              <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45 block mb-2">Produit</label>
              <select
                value={produitId}
                onChange={e => { setProduitId(e.target.value); setApport('') }}
                className="w-full bg-surface-2 border border-paper/12 rounded-xl px-4 py-3 font-body text-sm text-paper focus:outline-none focus:border-brass/40 transition-colors">
                {actifs.map(p => (
                  <option key={p.id} value={p.id}>{p.nom} — {fcfa(p.prix_vente)}</option>
                ))}
              </select>
            </div>

            {produit && (
              <>
                {/* Apport */}
                <div className="mb-5">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45 block mb-2">
                    Votre apport initial <span className="text-paper/30">(min {fcfa(produit.apport_minimum)})</span>
                  </label>
                  <input
                    type="number" min={produit.apport_minimum} max={produit.prix_vente}
                    placeholder={String(produit.apport_minimum)}
                    value={apport}
                    onChange={e => setApport(e.target.value)}
                    className="w-full bg-surface-2 border border-paper/12 rounded-xl px-4 py-3 font-mono text-sm text-paper focus:outline-none focus:border-brass/40 transition-colors placeholder:text-paper/40"
                  />
                </div>

                {/* Nombre de mois */}
                <div className="mb-6">
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/45 block mb-3">
                    Nombre de mensualités — <span className="text-brass-light">{mois} mois</span>
                  </label>
                  <input
                    type="range" min={1} max={produit.nb_mensualites_max} value={mois}
                    onChange={e => setMois(+e.target.value)}
                    className="w-full accent-brass"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-paper/35 mt-1">
                    <span>1 mois</span><span>{produit.nb_mensualites_max} mois max</span>
                  </div>
                </div>

                {/* Résultat */}
                {calcul && (
                  <div className="bg-surface-2 rounded-2xl border border-paper/10 p-5 mb-5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/40 mb-1">Apport</div>
                        <div className="font-mono text-sm font-medium text-paper">{fcfa(calcul.apportVal)}</div>
                      </div>
                      <div className="border-x border-paper/6">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/40 mb-1">Reste dû</div>
                        <div className="font-mono text-sm font-medium text-paper">{fcfa(calcul.reste)}</div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/40 mb-1">/ mois</div>
                        <div className="font-display text-2xl text-brass-light">{fcfa(calcul.mensual)}</div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-paper/6 text-center font-mono text-[10px] text-paper/45">
                      {calcul.nbMois}× {fcfa(calcul.mensual)} = {fcfa(calcul.reste)} en {calcul.nbMois} mois
                    </div>
                  </div>
                )}
              </>
            )}

            <Link href="/inscription"
              className="flex items-center justify-center gap-2 w-full font-body text-sm font-medium bg-spruce-light text-paper px-6 py-3.5 rounded-full hover:bg-spruce transition-colors glow-green">
              Commander ce produit <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
