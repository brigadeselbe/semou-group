"use client";

const ITEMS = [
  "iPhone 12 Pro", "Salon 7 places", "Téléviseur 55\"", "Réfrigérateur",
  "Ordinateur Dell", "Congélateur", "Mouton Tabaski", "Chambre à coucher",
  "Climatiseur", "Moto Jakarta",
];

export default function Ticker() {
  const loop = [...ITEMS, ...ITEMS];
  return (
    <div className="border-y border-ink/10 bg-spruce text-paper overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap py-3">
        {loop.map((item, i) => (
          <span key={i} className="flex items-center font-mono text-xs md:text-sm tracking-wide px-6">
            <span className="text-brass mr-6">✦</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
