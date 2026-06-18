"use client";

export default function StampMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`stamp-ring text-brass w-32 h-32 md:w-40 md:h-40 flex items-center justify-center animate-stamp ${className}`}
      style={{ animationDelay: "0.3s" }}
      aria-hidden="true"
    >
      <div className="text-center leading-none">
        <div className="font-display text-[10px] md:text-xs tracking-[0.25em] uppercase mb-1">
          SEMOU GROUP
        </div>
        <div className="font-display italic text-xl md:text-2xl">Validé</div>
        <div className="font-mono text-[9px] md:text-[10px] tracking-widest mt-1">
          CFA · CUSEMS
        </div>
      </div>
    </div>
  );
}
