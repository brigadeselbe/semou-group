import type { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'

const BASE = 'https://semou-group.vercel.app'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: produits } = await supabase
    .from('cfa_produits')
    .select('id, created_at')
    .eq('actif', true)

  const produitUrls = (produits ?? []).map(p => ({
    url:             `${BASE}/produits/${p.id}`,
    lastModified:    new Date(p.created_at),
    changeFrequency: 'weekly' as const,
    priority:        0.8,
  }))

  return [
    { url: BASE,               lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/produits`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/inscription`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/suivi`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...produitUrls,
  ]
}
