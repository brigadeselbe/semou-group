import Link from 'next/link'
import { ArrowUpRight, ArrowLeft, Sparkles } from 'lucide-react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { CFAProduit, CFAProduitMedia } from '@/lib/supabase'
import ProduitsClient from './ProduitsClient'

export const revalidate = 60

export default async function ProduitsPage() {
  const [{ data: produits }, { data: allMedias }] = await Promise.all([
    supabase.from('cfa_produits').select('*').eq('actif', true).order('en_vedette', { ascending: false }).order('prix_vente'),
    supabase.from('cfa_produit_medias').select('*').order('ordre'),
  ])

  const mediasByProduit: Record<string, CFAProduitMedia[]> = {}
  ;(allMedias ?? []).forEach((m: CFAProduitMedia) => {
    if (!mediasByProduit[m.produit_id]) mediasByProduit[m.produit_id] = []
    mediasByProduit[m.produit_id].push(m)
  })

  const list = (produits ?? []) as CFAProduit[]
  const nbVedette = list.filter(p => p.en_vedette).length

  return (
    <div className="min-h-screen relative overflow-x-hidden">

      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-15%] left-[5%] w-[500px] h-[500px] rounded-full bg-spruce/15 blur-[120px]" />
        <div className="absolute top-[40%] right-[-5%] w-[350px] h-[350px] rounded-full bg-brass/6 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#FAF8F3]/90 backdrop-blur-md border-b border-paper/8">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoSG size={34} />
            <span className="font-display text-base tracking-tight text-paper">SEMOU <span className="text-brass-light">GROUP</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 font-body text-sm text-paper/65">
            <Link href="/#parcours"  className="hover:text-paper transition-colors">Parcours</Link>
            <Link href="/#syndicat"  className="hover:text-paper transition-colors">CUSEMS</Link>
            <Link href="/suivi"      className="hover:text-paper transition-colors">Suivi commande</Link>
          </nav>
          <Link href="/inscription"
            className="font-body text-sm font-medium bg-spruce-light text-paper px-4 py-2 rounded-full hover:bg-spruce transition-colors flex items-center gap-1.5 ring-1 ring-paper/10">
            S&apos;inscrire <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-10 pt-14 pb-12">
        <div className="max-w-7xl mx-auto">
          <Link href="/"
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-paper/45 hover:text-brass-light transition-colors mb-10">
            <ArrowLeft className="w-3.5 h-3.5" /> Accueil
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-brass/80 mb-5 border border-brass/20 rounded-full px-4 py-1.5 bg-brass/5">
                <Sparkles className="w-3 h-3" /> Catalogue officiel · CUSEMS
              </div>
              <h1 className="font-display text-5xl md:text-7xl leading-[0.95] tracking-tight text-paper">
                Nos <span className="italic text-brass-light">produits.</span>
              </h1>
            </div>
            <p className="font-body text-paper/60 text-sm md:text-base max-w-xs leading-relaxed">
              Payez en plusieurs fois sans intérêt — uniquement réservé aux fonctionnaires détenteurs d&apos;un matricule officiel.
            </p>
          </div>

          {/* Stats rapides */}
          <div className="flex gap-6 mt-8 font-mono text-xs text-paper/45">
            <span><span className="text-paper/80 text-sm font-medium">{list.length}</span> produits disponibles</span>
            {nbVedette > 0 && (
              <span><span className="text-brass-light text-sm font-medium">{nbVedette}</span> en vedette</span>
            )}
          </div>
        </div>
      </section>

      {/* Catalogue */}
      <section className="relative z-10 px-6 md:px-10 pb-24">
        <div className="max-w-7xl mx-auto">
          {list.length === 0 ? (
            <div className="text-center py-32">
              <p className="font-body text-paper/45 text-sm">Le catalogue sera disponible très prochainement.</p>
              <Link href="/" className="inline-block mt-6 font-body text-sm text-brass-light underline underline-offset-4">Retour à l&apos;accueil</Link>
            </div>
          ) : (
            <ProduitsClient produits={list} mediasByProduit={mediasByProduit} />
          )}
        </div>
      </section>

      {/* Footer CTA */}
      <div className="relative z-10 border-t border-paper/5 px-6 md:px-10 py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-display text-xl text-paper">Prêt à commander ?</p>
            <p className="font-body text-sm text-paper/55 mt-1">Votre dossier validé en 24 à 48h.</p>
          </div>
          <Link href="/inscription"
            className="font-body font-medium bg-spruce-light text-paper px-7 py-3.5 rounded-full hover:bg-spruce transition-colors flex items-center gap-2 glow-green">
            Déposer mon dossier <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
