import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import LogoSG from '@/components/LogoSG'
import { supabase } from '@/lib/supabase'
import type { Metadata } from 'next'
import type { CFAProduit, CFAProduitMedia } from '@/lib/supabase'
import ProduitDetail from './ProduitDetail'

export const revalidate = 60

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const { data: p } = await supabase.from('cfa_produits').select('nom, prix_vente, description').eq('id', id).single()
  if (!p) return {}
  const fcfa = (n: number) => n.toLocaleString('fr-SN') + ' F'
  return {
    title:       `${p.nom} — ${fcfa(p.prix_vente)}`,
    description: p.description ?? `Commandez le ${p.nom} en plusieurs fois. Prix : ${fcfa(p.prix_vente)}. Réservé aux fonctionnaires sénégalais.`,
    openGraph: {
      title:       `${p.nom} | SEMOU GROUP`,
      description: `Payez le ${p.nom} en mensualités. ${fcfa(p.prix_vente)} — fonctionnaires sénégalais uniquement.`,
    },
  }
}

export default async function ProduitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ data: produit }, { data: medias }] = await Promise.all([
    supabase.from('cfa_produits').select('*').eq('id', id).eq('actif', true).single(),
    supabase.from('cfa_produit_medias').select('*').eq('produit_id', id).order('ordre'),
  ])

  if (!produit) notFound()

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-15%] left-[5%] w-[500px] h-[500px] rounded-full bg-spruce/15 blur-[120px]" />
        <div className="absolute top-[40%] right-[-5%] w-[350px] h-[350px] rounded-full bg-brass/6 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-30 bg-[#FAF8F3]/90 backdrop-blur-md border-b border-paper/8">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoSG size={34} />
            <span className="font-display text-base tracking-tight text-paper">SEMOU <span className="text-brass-light">GROUP</span></span>
          </Link>
          <Link href="/produits"
            className="hidden md:flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.15em] text-paper/50 hover:text-brass-light transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Catalogue
          </Link>
          <Link href="/inscription"
            className="font-body text-sm font-medium bg-spruce-light text-paper px-4 py-2 rounded-full hover:bg-spruce transition-colors flex items-center gap-1.5 ring-1 ring-paper/10">
            S&apos;inscrire <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <ProduitDetail produit={produit as CFAProduit} medias={(medias ?? []) as CFAProduitMedia[]} />
    </div>
  )
}
