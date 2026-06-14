export default function LogoSG({ size = 48, className = '' }: { size?: number; className?: string }) {
  const h = Math.round(size * 1.075)
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 200 215"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Semou Group"
    >
      <defs>
        <path id="sg-arc" d="M24,86 Q100,16 176,86" />
      </defs>

      {/* Drop shadow */}
      <rect x="11" y="13" width="184" height="196" rx="26" fill="#000" opacity="0.22" />

      {/* Main badge */}
      <rect x="7"  y="7"  width="186" height="198" rx="26" fill="#0D3B2E" />
      <rect x="7"  y="7"  width="186" height="198" rx="26" stroke="white" strokeWidth="5.5" />

      {/* Inner secondary border */}
      <rect x="14" y="14" width="172" height="184" rx="20" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />

      {/* Top-right corner tag */}
      <path d="M165,7 L193,7 L193,35 Z" fill="#C9A227" />
      <path d="M165,7 L193,7 L193,35" stroke="white" strokeWidth="3" strokeLinejoin="round" />
      {/* Mini bolt in tag */}
      <path d="M181,11 L177,20 L181,20 L176,30 L186,19 L182,19 L187,11 Z" fill="#0D3B2E" />

      {/* SEMOU GROUP — curved */}
      <text
        fontSize="14"
        fontWeight="800"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="4"
        textAnchor="middle"
      >
        <textPath href="#sg-arc" startOffset="50%">SEMOU GROUP</textPath>
      </text>

      {/* Vertical accent lines */}
      <line x1="38" y1="100" x2="38" y2="162" stroke="#C9A227" strokeWidth="2" strokeOpacity="0.45" />
      <line x1="162" y1="100" x2="162" y2="162" stroke="#C9A227" strokeWidth="2" strokeOpacity="0.45" />

      {/* Left lightning bolt */}
      <path d="M43,97 L36,113 L42,113 L34,129 L48,114 L42,114 L49,97 Z" fill="#C9A227" />

      {/* Right lightning bolt */}
      <path d="M151,97 L144,114 L151,114 L145,129 L158,113 L152,113 L159,97 Z" fill="#C9A227" />

      {/* SG monogram */}
      <text
        x="100"
        y="160"
        fontSize="96"
        fontWeight="900"
        fill="#C9A227"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        stroke="#0A2E22"
        strokeWidth="6"
        paintOrder="stroke"
      >SG</text>

      {/* Bottom banner */}
      <rect x="13" y="173" width="174" height="28" rx="9" fill="#061E18" stroke="white" strokeWidth="3.5" />

      {/* Tagline line 1 */}
      <text
        x="100" y="185"
        fontSize="9"
        fontWeight="900"
        fill="#C9A227"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="2"
      >ÉQUIPEZ-VOUS À</text>

      {/* Tagline line 2 */}
      <text
        x="100" y="197"
        fontSize="9"
        fontWeight="900"
        fill="#C9A227"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="1.5"
      >À VOTRE RYTHME ——</text>
    </svg>
  )
}
