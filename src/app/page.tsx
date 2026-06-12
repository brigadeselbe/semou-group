import StampMark from "@/components/StampMark";
import Ticker from "@/components/Ticker";
import Link from "next/link";
import {
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  Wallet,
  Bell,
  Truck,
  FileCheck2,
  ChevronRight,
} from "lucide-react";

const CORPS = [
  { label: "Enseignants", icon: "🎓" },
  { label: "Santé", icon: "🏥" },
  { label: "Police", icon: "👮" },
  { label: "Gendarmerie", icon: "🪖" },
  { label: "Justice", icon: "⚖️" },
  { label: "Armée", icon: "🛡️" },
  { label: "Impôts & Douanes", icon: "🏦" },
  { label: "Mairies", icon: "🏛️" },
];

const STEPS = [
  {
    n: "01",
    title: "Inscription",
    desc: "Matricule officiel, CNI recto-verso et bulletin de salaire. Votre dossier est examiné sous 24 à 48h.",
    icon: FileCheck2,
  },
  {
    n: "02",
    title: "Validation",
    desc: "Notre équipe vérifie vos informations auprès des registres. Vous recevez un SMS de confirmation.",
    icon: ShieldCheck,
  },
  {
    n: "03",
    title: "Commande & acompte",
    desc: "Choisissez votre produit, versez un acompte de 30% via Wave ou Orange Money.",
    icon: Wallet,
  },
  {
    n: "04",
    title: "Mensualités & livraison",
    desc: "Remboursez en plusieurs fois avec rappels SMS automatiques. Livraison sous 10 jours.",
    icon: Truck,
  },
];

export default function Home() {
  return (
    <div className="relative overflow-x-hidden">
      <header className="absolute top-0 inset-x-0 z-20">
        <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-spruce flex items-center justify-center text-brass font-display italic text-lg">
              S
            </div>
            <span className="font-display text-lg tracking-tight">
              Semou <span className="text-spruce">Group</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-body text-sm">
            <a href="#corps" className="hover:text-spruce transition-colors">
              Qui peut s&apos;inscrire
            </a>
            <a href="#parcours" className="hover:text-spruce transition-colors">
              Le parcours
            </a>
            <a href="#syndicat" className="hover:text-spruce transition-colors">
              CUSEMS
            </a>
          </nav>
          <Link
            href="/inscription"
            className="font-body text-sm font-medium bg-ink text-paper px-5 py-2.5 rounded-full hover:bg-spruce transition-colors flex items-center gap-1.5"
          >
            S&apos;inscrire
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <section className="relative pt-32 md:pt-40 pb-20 md:pb-28 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[1.3fr_1fr] gap-12 items-start">
            <div>
              <div className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-spruce/70 mb-6 border border-spruce/20 rounded-full px-4 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brass" />
                Bordereau CFA · CUSEMS Authentique
              </div>
              <h1 className="font-display text-[13vw] leading-[0.95] md:text-7xl lg:text-8xl tracking-tight">
                Commandez
                <br />
                <span className="italic text-spruce">aujourd&apos;hui.</span>
                <br />
                Payez à votre
                <br />
                rythme.
              </h1>
              <p className="mt-8 max-w-md font-body text-base md:text-lg text-ink/70 leading-relaxed">
                Semou Group, en partenariat avec le CUSEMS, permet à tout
                fonctionnaire détenteur d&apos;un matricule officiel
                d&apos;acheter des équipements et de régler en plusieurs
                mensualités, prélevées en confiance sur le salaire.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <Link
                  href="/inscription"
                  className="group font-body font-medium bg-spruce text-paper px-7 py-4 rounded-full hover:bg-spruce-dark transition-colors flex items-center gap-2"
                >
                  Demander mon dossier
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/suivi"
                  className="font-body font-medium border border-ink/15 px-7 py-4 rounded-full hover:border-spruce hover:text-spruce transition-colors"
                >
                  Suivre ma commande
                </Link>
              </div>

              <div className="mt-14 grid grid-cols-3 gap-px bg-ink/10 rounded-2xl overflow-hidden max-w-lg border border-ink/10">
                {[
                  { val: "30%", lbl: "Acompte initial" },
                  { val: "≤ 6", lbl: "Mensualités" },
                  { val: "10 j", lbl: "Délai de livraison" },
                ].map((s) => (
                  <div key={s.lbl} className="bg-paper px-4 py-5">
                    <div className="font-display text-2xl md:text-3xl text-spruce">
                      {s.val}
                    </div>
                    <div className="font-mono text-[10px] md:text-xs uppercase tracking-wider text-ink/50 mt-1">
                      {s.lbl}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative md:pt-8">
              <div className="relative bg-white border border-ink/10 rounded-sm shadow-[0_20px_60px_-30px_rgba(13,59,46,0.4)] p-6 md:p-8 perforated">
                <div className="flex items-center justify-between border-b border-dashed border-ink/15 pb-4 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                      Bordereau N°
                    </div>
                    <div className="font-mono text-sm font-medium">
                      SG-2026-017731
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                      Statut
                    </div>
                    <div className="font-mono text-sm font-medium text-spruce">
                      En cours
                    </div>
                  </div>
                </div>

                <div className="space-y-3 font-mono text-sm">
                  <Row label="Bénéficiaire" value="A. Sagna" />
                  <Row label="Matricule" value="300501163/E" />
                  <Row label="Académie" value="Kolda" />
                  <Row label="Produit" value="iPhone XR 128 Go" />
                  <Row label="Prix total" value="145 000 F" />
                  <Row label="Acompte versé" value="40 000 F" highlight />
                </div>

                <div className="mt-5 pt-4 border-t border-dashed border-ink/15">
                  <div className="flex items-center justify-between font-mono text-xs text-ink/50 mb-2">
                    <span>Progression</span>
                    <span>3 / 6 mensualités</span>
                  </div>
                  <div className="h-2 bg-parchment rounded-full overflow-hidden">
                    <div className="h-full bg-spruce rounded-full w-1/2" />
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-10 -right-6 md:-right-10 rotate-[-12deg]">
                <StampMark />
              </div>
            </div>
          </div>
        </div>
      </section>

      <Ticker />

      <section id="corps" className="px-6 md:px-10 py-20 md:py-28">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 md:gap-16 items-end mb-12">
            <div>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass-dark">
                Éligibilité
              </span>
              <h2 className="font-display text-4xl md:text-6xl mt-3 leading-[1.05]">
                Un seul critère :{" "}
                <span className="italic text-spruce">votre matricule.</span>
              </h2>
            </div>
            <p className="font-body text-ink/65 text-base md:text-lg leading-relaxed">
              La plateforme s&apos;adresse à toute personne détenant un
              matricule officiel d&apos;agent de l&apos;État sénégalais —
              quel que soit le ministère ou le corps. Le bulletin de salaire
              confirme votre capacité de remboursement ; le matricule garantit
              votre identité.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/10 border border-ink/10 rounded-2xl overflow-hidden">
            {CORPS.map((c) => (
              <div
                key={c.label}
                className="bg-paper hover:bg-white transition-colors px-5 py-8 flex flex-col gap-3 group"
              >
                <span className="text-3xl">{c.icon}</span>
                <span className="font-display text-lg leading-tight">
                  {c.label}
                </span>
                <ArrowUpRight className="w-4 h-4 text-ink/20 group-hover:text-spruce group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="parcours" className="px-6 md:px-10 py-20 md:py-28 bg-spruce text-paper relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent, transparent 38px, currentColor 38px, currentColor 39px)",
          }}
        />
        <div className="max-w-7xl mx-auto relative">
          <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
            Le parcours
          </span>
          <h2 className="font-display text-4xl md:text-6xl mt-3 mb-16 leading-[1.05] max-w-2xl">
            Du dossier au produit livré,{" "}
            <span className="italic">quatre étapes.</span>
          </h2>

          <div className="grid md:grid-cols-4 gap-8 md:gap-6">
            {STEPS.map((step, i) => (
              <div key={step.n} className="relative">
                <div className="font-display italic text-5xl md:text-6xl text-brass/40 mb-6">
                  {step.n}
                </div>
                <step.icon className="w-7 h-7 mb-4 text-brass" strokeWidth={1.5} />
                <h3 className="font-display text-xl md:text-2xl mb-3">
                  {step.title}
                </h3>
                <p className="font-body text-sm text-paper/65 leading-relaxed">
                  {step.desc}
                </p>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-2 -right-3 w-6 h-px bg-paper/15" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-20 md:py-28">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass-dark">
              Paiement
            </span>
            <h2 className="font-display text-4xl md:text-5xl mt-3 mb-6 leading-[1.05]">
              Wave, Orange Money,{" "}
              <span className="italic text-spruce">Free Money.</span>
            </h2>
            <p className="font-body text-ink/65 text-base md:text-lg leading-relaxed mb-8">
              Chaque versement déclenche une mise à jour instantanée de votre
              dossier. Vous recevez un SMS de rappel 7 jours, 3 jours et le
              jour de l&apos;échéance — jamais de mauvaise surprise.
            </p>
            <ul className="space-y-4">
              {[
                { icon: Smartphone, text: "Paiement mobile en un geste, depuis votre téléphone" },
                { icon: Bell, text: "Rappels SMS automatiques avant chaque échéance" },
                { icon: ShieldCheck, text: "15% du bénéfice reversé au syndicat CUSEMS chaque mois" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-spruce/8 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4.5 h-4.5 text-spruce" strokeWidth={1.5} />
                  </div>
                  <span className="font-body text-sm md:text-base text-ink/75 pt-2">
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative h-[420px] md:h-[480px]">
            {[
              { rot: "-6deg", top: "0", color: "bg-white", z: 10 },
              { rot: "3deg", top: "40px", color: "bg-parchment", z: 5 },
              { rot: "-2deg", top: "80px", color: "bg-white", z: 1 },
            ].map((card, i) => (
              <div
                key={i}
                className={`absolute inset-x-4 md:inset-x-12 ${card.color} border border-ink/10 rounded-sm shadow-lg p-6 perforated`}
                style={{
                  top: card.top,
                  transform: `rotate(${card.rot})`,
                  zIndex: card.z,
                }}
              >
                {i === 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
                        Versement #3
                      </span>
                      <span className="font-mono text-[10px] bg-spruce text-paper px-2 py-1 rounded-full">
                        PAYÉ
                      </span>
                    </div>
                    <div className="font-display text-4xl md:text-5xl text-spruce mb-1">
                      33 000 F
                    </div>
                    <div className="font-mono text-xs text-ink/45">
                      Réglé via Wave · 11 juin 2026
                    </div>
                    <div className="mt-6 pt-4 border-t border-dashed border-ink/15 font-mono text-xs text-ink/50 flex justify-between">
                      <span>Reste à payer</span>
                      <span className="text-clay font-medium">99 000 F</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="syndicat" className="px-6 md:px-10 py-20 md:py-28">
        <div className="max-w-7xl mx-auto bg-ink text-paper rounded-3xl px-8 md:px-16 py-16 md:py-24 relative overflow-hidden">
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full border border-brass/20" />
          <div className="absolute -right-10 -top-10 w-60 h-60 rounded-full border border-brass/15" />
          <div className="relative max-w-2xl">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
              Partenariat officiel
            </span>
            <h2 className="font-display text-4xl md:text-6xl mt-3 mb-6 leading-[1.05]">
              Un engagement
              <br />
              <span className="italic">envers le syndicat.</span>
            </h2>
            <p className="font-body text-paper/65 text-base md:text-lg leading-relaxed mb-10">
              Semou Group reverse chaque mois 15% de son bénéfice net au
              Centre de Facilitation d&apos;Achats du CUSEMS — Centrale
              Unique des Syndicats de l&apos;Enseignement Moyen et Secondaire.
              Chaque commande honorée renforce directement la solidarité entre
              enseignants.
            </p>
            <div className="flex flex-wrap gap-10">
              <div>
                <div className="font-display text-3xl md:text-4xl text-brass">578</div>
                <div className="font-mono text-xs uppercase tracking-wider text-paper/50 mt-1">
                  Dossiers enregistrés
                </div>
              </div>
              <div>
                <div className="font-display text-3xl md:text-4xl text-brass">14</div>
                <div className="font-mono text-xs uppercase tracking-wider text-paper/50 mt-1">
                  Régions couvertes
                </div>
              </div>
              <div>
                <div className="font-display text-3xl md:text-4xl text-brass">15%</div>
                <div className="font-mono text-xs uppercase tracking-wider text-paper/50 mt-1">
                  Reversé au syndicat
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl md:text-7xl leading-[1.05] mb-8">
            Votre matricule
            <br />
            <span className="italic text-spruce">vous ouvre la porte.</span>
          </h2>
          <p className="font-body text-ink/60 text-base md:text-lg mb-10 max-w-xl mx-auto">
            Le dossier d&apos;inscription prend moins de cinq minutes.
            Validation sous 24 à 48h.
          </p>
          <Link
            href="/inscription"
            className="group inline-flex items-center gap-2 font-body font-medium bg-spruce text-paper px-9 py-5 rounded-full hover:bg-spruce-dark transition-colors text-lg"
          >
            Commencer mon inscription
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ink/10 px-6 md:px-10 py-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-ink/45">
          <span>© 2026 Semou Group × CFA CUSEMS Authentique</span>
          <span>Récépissé N. 0413/MINT/DGAT/DLP — 21 Novembre 2017</span>
        </div>
      </footer>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink/45">{label}</span>
      <span className={highlight ? "text-spruce font-medium" : "text-ink/85"}>
        {value}
      </span>
    </div>
  );
}
