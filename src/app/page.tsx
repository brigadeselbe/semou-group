import StampMark from "@/components/StampMark";
import Ticker from "@/components/Ticker";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { CFAProduit } from "@/lib/supabase";
import {
  ArrowUpRight, ShieldCheck, Smartphone, Wallet,
  Bell, Truck, FileCheck2, ChevronRight, Tag,
} from "lucide-react";

const CORPS = [
  { label: "Enseignants",     icon: "🎓" },
  { label: "Santé",           icon: "🏥" },
  { label: "Police",          icon: "👮" },
  { label: "Gendarmerie",     icon: "🪖" },
  { label: "Justice",         icon: "⚖️" },
  { label: "Armée",           icon: "🛡️" },
  { label: "Impôts & Douanes",icon: "🏦" },
  { label: "Mairies",         icon: "🏛️" },
];

const STEPS = [
  { n: "01", title: "Inscription",           icon: FileCheck2, desc: "Matricule officiel, CNI recto-verso et bulletin de salaire. Votre dossier est examiné sous 24 à 48h." },
  { n: "02", title: "Validation",            icon: ShieldCheck, desc: "Notre équipe vérifie vos informations auprès des registres. Vous recevez un SMS de confirmation." },
  { n: "03", title: "Commande & acompte",    icon: Wallet,      desc: "Choisissez votre produit, versez un acompte via Wave ou Orange Money." },
  { n: "04", title: "Mensualités & livraison", icon: Truck,     desc: "Remboursez en plusieurs fois avec rappels SMS automatiques. Livraison sous 10 jours." },
];

function fcfa(n: number) { return n.toLocaleString("fr-SN") + " F"; }

function ProduitCard({ p }: { p: CFAProduit }) {
  const menMin = Math.ceil((p.prix_vente - p.apport_minimum) / p.nb_mensualites_max);
  const stockOk = p.stock_illimite || p.stock > 0;

  return (
    <div className="relative bg-surface border border-white/6 rounded-2xl overflow-hidden flex flex-col hover:border-brass/20 transition-colors group">
      {/* Badges */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <span className={`font-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1 rounded-full border ${
          p.etat === "NEUF"
            ? "text-spruce-light bg-spruce/15 border-spruce/25"
            : "text-brass bg-brass/10 border-brass/20"
        }`}>
          {p.etat === "NEUF" ? "Neuf" : p.etat === "OCCASION" ? "Occasion" : "Bon état"}
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
          <Link
            href="/inscription"
            className="flex items-center justify-center gap-2 w-full font-body text-sm font-medium bg-spruce-light text-paper px-4 py-3 rounded-full hover:bg-spruce transition-colors group-hover:glow-green"
          >
            Commander <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full font-body text-sm text-paper/25 px-4 py-3 rounded-full border border-white/5">
            Stock épuisé
          </div>
        )}
      </div>
    </div>
  );
}

export default async function Home() {
  const [{ data: produits }, { count: nbClients }, { data: regionsRaw }] = await Promise.all([
    supabase.from("cfa_produits").select("*").eq("actif", true).order("prix_vente"),
    supabase.from("cfa_clients").select("*", { count: "exact", head: true }),
    supabase.from("cfa_clients").select("region").not("region", "is", null),
  ]);

  const nbRegions = new Set((regionsRaw ?? []).map((r: { region: string }) => r.region)).size;
  const nbDossiers = nbClients ?? 0;

  return (
    <div className="relative overflow-x-hidden">

      {/* ── Ambient glow ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-spruce/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[-10%] w-[400px] h-[400px] rounded-full bg-brass/8 blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-spruce-light flex items-center justify-center text-brass font-display italic text-lg ring-1 ring-white/10">S</div>
            <span className="font-display text-lg tracking-tight text-paper">Semou <span className="text-brass-light">Group</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-body text-sm text-paper/50">
            <a href="#produits"  className="hover:text-paper transition-colors">Catalogue</a>
            <a href="#parcours"  className="hover:text-paper transition-colors">Le parcours</a>
            <a href="#syndicat"  className="hover:text-paper transition-colors">CUSEMS</a>
          </nav>
          <Link href="/inscription"
            className="font-body text-sm font-medium bg-spruce-light text-paper px-5 py-2.5 rounded-full hover:bg-spruce transition-colors flex items-center gap-1.5 ring-1 ring-white/10">
            S&apos;inscrire <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative pt-32 md:pt-44 pb-20 md:pb-32 px-6 md:px-10 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[1.25fr_1fr] gap-16 items-start">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-brass/80 mb-8 border border-brass/20 rounded-full px-4 py-1.5 bg-brass/5">
                <span className="w-1.5 h-1.5 rounded-full bg-brass animate-glow-pulse" />
                Bordereau CFA · CUSEMS Authentique
              </div>
              <h1 className="font-display text-[13vw] leading-[0.92] md:text-7xl lg:text-8xl tracking-tight text-paper">
                Commandez<br />
                <span className="italic text-brass-light">aujourd&apos;hui.</span><br />
                Payez à votre<br />rythme.
              </h1>
              <p className="mt-8 max-w-md font-body text-base md:text-lg text-paper/50 leading-relaxed">
                Semou Group, en partenariat avec le CUSEMS, permet à tout fonctionnaire détenteur
                d&apos;un matricule officiel d&apos;acheter des équipements et de régler en plusieurs
                mensualités sur salaire.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link href="/inscription"
                  className="group font-body font-medium bg-spruce-light text-paper px-7 py-4 rounded-full hover:bg-spruce transition-all flex items-center gap-2 glow-green">
                  Demander mon dossier <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/suivi"
                  className="font-body font-medium border border-white/10 px-7 py-4 rounded-full hover:border-brass/40 hover:text-brass-light transition-colors text-paper/70">
                  Suivre ma commande
                </Link>
              </div>
              <div className="mt-14 grid grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden max-w-lg border border-white/5">
                {[
                  { val: "30%", lbl: "Acompte initial" },
                  { val: "≤ 6", lbl: "Mensualités" },
                  { val: "10 j", lbl: "Délai de livraison" },
                ].map(s => (
                  <div key={s.lbl} className="bg-surface px-4 py-5 hover:bg-surface-2 transition-colors">
                    <div className="font-display text-2xl md:text-3xl text-brass-light">{s.val}</div>
                    <div className="font-mono text-[10px] md:text-xs uppercase tracking-wider text-paper/35 mt-1">{s.lbl}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bordereau card */}
            <div className="relative md:pt-8">
              <div className="relative bg-surface border border-white/6 rounded-sm glow-green p-6 md:p-8 perforated">
                <div className="flex items-center justify-between border-b border-dashed border-white/8 pb-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30">Bordereau N°</div>
                    <div className="font-mono text-sm font-medium text-paper">SG-2026-017731</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30">Statut</div>
                    <div className="font-mono text-sm font-medium text-brass-light">En cours</div>
                  </div>
                </div>
                <div className="space-y-3 font-mono text-sm">
                  <Row label="Bénéficiaire" value="A. Sagna" />
                  <Row label="Matricule"    value="300501163/E" />
                  <Row label="Académie"     value="Kolda" />
                  <Row label="Produit"      value="iPhone XR 128 Go" />
                  <Row label="Prix total"   value="145 000 F" />
                  <Row label="Acompte versé" value="40 000 F" highlight />
                </div>
                <div className="mt-5 pt-4 border-t border-dashed border-white/8">
                  <div className="flex items-center justify-between font-mono text-xs text-paper/35 mb-2">
                    <span>Progression</span><span>3 / 6 mensualités</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-spruce-light to-brass-light rounded-full w-1/2" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-6 md:-right-10 rotate-[-12deg]"><StampMark /></div>
            </div>
          </div>
        </div>
      </section>

      <Ticker />

      {/* ── Catalogue produits ── */}
      {produits && produits.length > 0 && (
        <section id="produits" className="px-6 md:px-10 py-20 md:py-28 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-end justify-between mb-12 flex-wrap gap-6">
              <div>
                <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5" /> Catalogue
                </span>
                <h2 className="font-display text-4xl md:text-6xl mt-3 leading-[1.05] text-paper">
                  Nos <span className="italic text-brass-light">produits.</span>
                </h2>
              </div>
              <p className="font-body text-paper/40 text-sm md:text-base max-w-sm leading-relaxed">
                Payez en plusieurs fois sans intérêt — uniquement sur votre salaire fonctionnaire.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(produits as CFAProduit[]).map(p => <ProduitCard key={p.id} p={p} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── Corps éligibles ── */}
      <section id="corps" className="px-6 md:px-10 py-20 md:py-28 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16 items-end mb-12">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">Éligibilité</span>
              <h2 className="font-display text-4xl md:text-6xl mt-3 leading-[1.05] text-paper">
                Un seul critère : <span className="italic text-brass-light">votre matricule.</span>
              </h2>
            </div>
            <p className="font-body text-paper/45 text-base md:text-lg leading-relaxed">
              La plateforme s&apos;adresse à toute personne détenant un matricule officiel
              d&apos;agent de l&apos;État sénégalais — quel que soit le ministère ou le corps.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/4 border border-white/5 rounded-2xl overflow-hidden">
            {CORPS.map(c => (
              <div key={c.label} className="bg-surface hover:bg-surface-2 transition-all px-5 py-8 flex flex-col gap-3 group cursor-default">
                <span className="text-3xl">{c.icon}</span>
                <span className="font-display text-lg leading-tight text-paper">{c.label}</span>
                <ArrowUpRight className="w-4 h-4 text-paper/15 group-hover:text-brass group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Parcours ── */}
      <section id="parcours" className="px-6 md:px-10 py-20 md:py-28 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-spruce-dark border border-spruce/30 rounded-3xl p-10 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
              style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 38px, currentColor 38px, currentColor 39px)" }} />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] bg-spruce-light/20 blur-[80px] rounded-full" />
            <div className="relative">
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">Le parcours</span>
              <h2 className="font-display text-4xl md:text-6xl mt-3 mb-16 leading-[1.05] max-w-2xl text-paper">
                Du dossier au produit livré, <span className="italic text-brass-light">quatre étapes.</span>
              </h2>
              <div className="grid md:grid-cols-4 gap-8 md:gap-6">
                {STEPS.map((step, i) => (
                  <div key={step.n} className="relative">
                    <div className="font-display italic text-5xl md:text-6xl text-brass/30 mb-6">{step.n}</div>
                    <step.icon className="w-7 h-7 mb-4 text-brass" strokeWidth={1.5} />
                    <h3 className="font-display text-xl md:text-2xl mb-3 text-paper">{step.title}</h3>
                    <p className="font-body text-sm text-paper/50 leading-relaxed">{step.desc}</p>
                    {i < STEPS.length - 1 && <div className="hidden md:block absolute top-2 -right-3 w-6 h-px bg-white/10" />}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Paiement ── */}
      <section className="px-6 md:px-10 py-20 md:py-28 relative z-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">Paiement</span>
            <h2 className="font-display text-4xl md:text-5xl mt-3 mb-6 leading-[1.05] text-paper">
              Wave, <span className="italic text-brass-light">Orange Money.</span>
            </h2>
            <p className="font-body text-paper/45 text-base md:text-lg leading-relaxed mb-8">
              Chaque versement déclenche une mise à jour instantanée de votre dossier.
              Vous recevez un SMS de rappel 7 jours, 3 jours et le jour de l&apos;échéance.
            </p>
            <ul className="space-y-4">
              {[
                { icon: Smartphone, text: "Paiement mobile en un geste, depuis votre téléphone" },
                { icon: Bell,       text: "Rappels SMS automatiques avant chaque échéance" },
                { icon: ShieldCheck,text: "Partenariat officiel garanti par le syndicat CUSEMS" },
              ].map(item => (
                <li key={item.text} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-spruce/20 border border-spruce/30 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-brass-light" strokeWidth={1.5} />
                  </div>
                  <span className="font-body text-sm md:text-base text-paper/55 pt-2">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-[380px] md:h-[440px]">
            {[
              { rot: "-6deg", top: "0",    bg: "bg-surface",   z: 10 },
              { rot: "3deg",  top: "40px", bg: "bg-surface-2", z: 5 },
              { rot: "-2deg", top: "80px", bg: "bg-surface",   z: 1 },
            ].map((card, i) => (
              <div key={i}
                className={`absolute inset-x-4 md:inset-x-12 ${card.bg} border border-white/6 rounded-sm shadow-xl p-6 perforated`}
                style={{ top: card.top, transform: `rotate(${card.rot})`, zIndex: card.z }}>
                {i === 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper/30">Versement #3</span>
                      <span className="font-mono text-[10px] bg-spruce-light/20 text-brass-light px-2 py-1 rounded-full border border-brass/20">PAYÉ</span>
                    </div>
                    <div className="font-display text-4xl md:text-5xl text-brass-light mb-1">33 000 F</div>
                    <div className="font-mono text-xs text-paper/30">Réglé via Wave · 11 juin 2026</div>
                    <div className="mt-6 pt-4 border-t border-dashed border-white/8 font-mono text-xs text-paper/30 flex justify-between">
                      <span>Reste à payer</span><span className="text-clay font-medium">99 000 F</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Syndicat CTA ── */}
      <section id="syndicat" className="px-6 md:px-10 py-20 md:py-28 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-surface border border-white/6 rounded-3xl px-8 md:px-16 py-16 md:py-24 relative overflow-hidden">
            <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-brass/5 blur-[80px]" />
            <div className="absolute -right-20 -top-20 w-60 h-60 rounded-full border border-brass/10" />
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full border border-brass/8" />
            <div className="relative max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">Partenariat officiel</span>
              <h2 className="font-display text-4xl md:text-6xl mt-3 mb-6 leading-[1.05] text-paper">
                Un engagement<br /><span className="italic text-brass-light">envers le syndicat.</span>
              </h2>
              <p className="font-body text-paper/45 text-base md:text-lg leading-relaxed mb-10">
                Semou Group est le partenaire officiel du Centre de Facilitation d&apos;Achats du CUSEMS.
                Chaque commande honorée renforce directement la solidarité entre fonctionnaires sénégalais.
              </p>
              <div className="flex flex-wrap gap-10">
                {[
                  { val: nbDossiers.toLocaleString("fr-SN"), lbl: "Dossiers enregistrés" },
                  { val: String(nbRegions),                  lbl: "Régions couvertes" },
                  { val: "100%",                             lbl: "Fonctionnaires vérifiés" },
                ].map(({ val, lbl }) => (
                  <div key={lbl}>
                    <div className="font-display text-3xl md:text-4xl text-brass-light">{val}</div>
                    <div className="font-mono text-xs uppercase tracking-wider text-paper/35 mt-1">{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="px-6 md:px-10 py-20 md:py-32 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-7xl leading-[1.05] mb-8 text-paper">
            Votre matricule<br /><span className="italic text-brass-light">vous ouvre la porte.</span>
          </h2>
          <p className="font-body text-paper/40 text-base md:text-lg mb-10 max-w-xl mx-auto">
            Le dossier d&apos;inscription prend moins de cinq minutes. Validation sous 24 à 48h.
          </p>
          <Link href="/inscription"
            className="group inline-flex items-center gap-2 font-body font-medium bg-spruce-light text-paper px-9 py-5 rounded-full hover:bg-spruce transition-all text-lg glow-green">
            Commencer mon inscription
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 md:px-10 py-10 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-paper/25">
          <span>© 2026 Semou Group × CFA CUSEMS Authentique</span>
          <span>Récépissé N. 0413/MINT/DGAT/DLP — 21 Novembre 2017</span>
        </div>
      </footer>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-paper/30">{label}</span>
      <span className={highlight ? "text-brass-light font-medium" : "text-paper/70"}>{value}</span>
    </div>
  );
}
