import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function Inscription() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-spruce mb-8">
          <ArrowLeft className="w-4 h-4" /> Retour
        </Link>
        <h1 className="font-display text-4xl md:text-5xl mb-4">
          Formulaire d&apos;inscription
        </h1>
        <p className="font-body text-ink/60">
          Le formulaire d&apos;inscription complet arrive bientôt. En attendant, contactez-nous au 77 645 15 20.
        </p>
      </div>
    </div>
  );
}
