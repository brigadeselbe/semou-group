'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Package, Search, UserCircle2, PenLine } from 'lucide-react'

const LINKS = [
  { href: '/produits',   icon: Package,     label: 'Catalogue'  },
  { href: '/suivi',      icon: Search,      label: 'Suivi'      },
  { href: '/mon-compte', icon: UserCircle2, label: 'Mon espace' },
  { href: '/inscription',icon: PenLine,     label: 'S\'inscrire' },
]

export default function MobileNav() {
  const path = usePathname()
  if (path.startsWith('/admin')) return null

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FAF8F3]/95 backdrop-blur-md border-t border-paper/8 safe-area-bottom">
      <div className="grid grid-cols-4 h-16">
        {LINKS.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== '/' && path.startsWith(href))
          return (
            <Link key={href} href={href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active ? 'text-brass-light' : 'text-paper/40 hover:text-paper/70'
              }`}>
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.5} />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
