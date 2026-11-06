'use client'

export default function RecuActions() {
  return (
    <div className="no-print fixed top-4 right-4 z-50 flex gap-3">
      <button onClick={() => window.print()}
        className="bg-spruce-light text-paper font-body text-sm px-5 py-2.5 rounded-full hover:bg-spruce transition-colors shadow-lg">
        Imprimer / Télécharger PDF
      </button>
      <button onClick={() => window.close()}
        className="bg-paper/8 text-paper font-body text-sm px-5 py-2.5 rounded-full hover:bg-paper/15 transition-colors">
        Fermer
      </button>
    </div>
  )
}
