import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt     = 'SEMOU GROUP — Paiement échelonné pour fonctionnaires sénégalais'
export const size    = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%',
          background: '#0A2018',
          display: 'flex', flexDirection: 'column',
          alignItems: 'flex-start', justifyContent: 'flex-end',
          padding: '64px 72px',
          fontFamily: 'Georgia, serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background accent circles */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(13, 59, 46, 0.8)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -80, right: 200,
          width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(201, 162, 39, 0.08)',
          display: 'flex',
        }} />

        {/* Top-right SG badge */}
        <div style={{
          position: 'absolute', top: 56, right: 72,
          width: 120, height: 130,
          background: '#0D3B2E',
          borderRadius: 24,
          border: '4px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            fontSize: 72, fontWeight: 900, color: '#C9A227',
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
            display: 'flex',
          }}>SG</div>
        </div>

        {/* Gold accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: 4, background: '#C9A227',
          display: 'flex',
        }} />

        {/* Label */}
        <div style={{
          fontSize: 14, fontWeight: 700, color: '#C9A227',
          letterSpacing: '0.25em', textTransform: 'uppercase',
          fontFamily: 'Arial, sans-serif',
          marginBottom: 20,
          display: 'flex',
        }}>
          BORDEREAU CFA · CUSEMS Authentique
        </div>

        {/* Main title */}
        <div style={{
          fontSize: 72, fontWeight: 900, color: '#F7F3EC',
          lineHeight: 1.05, marginBottom: 24,
          fontFamily: 'Georgia, serif',
          display: 'flex', flexDirection: 'column',
        }}>
          <span>SEMOU</span>
          <span style={{ color: '#C9A227' }}>GROUP.</span>
        </div>

        {/* Description */}
        <div style={{
          fontSize: 22, color: 'rgba(247,243,236,0.60)',
          fontFamily: 'Arial, sans-serif', fontWeight: 400,
          lineHeight: 1.5, maxWidth: 620,
          display: 'flex',
        }}>
          Commandez aujourd&apos;hui, payez à votre rythme.
          Réservé aux fonctionnaires sénégalais.
        </div>

        {/* Bottom strip */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 56, background: '#061E18',
          display: 'flex', alignItems: 'center',
          padding: '0 72px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            fontSize: 13, color: 'rgba(247,243,236,0.35)',
            fontFamily: 'Arial, sans-serif', letterSpacing: '0.1em',
            display: 'flex',
          }}>
            semou-group.vercel.app  ·  Récépissé N. 0413/MINT/DGAT/DLP
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
