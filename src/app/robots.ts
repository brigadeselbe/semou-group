import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow:    ['/', '/produits', '/produits/', '/inscription', '/suivi'],
        disallow: ['/admin', '/admin/', '/mon-compte', '/api/', '/recu/'],
      },
    ],
    sitemap: 'https://semou-group.vercel.app/sitemap.xml',
  }
}
