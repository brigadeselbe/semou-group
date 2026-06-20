import { ImageResponse } from 'next/og'
import { supabase } from '@/lib/supabase'

export const runtime     = 'edge'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

function fcfa(n: number) { return n.toLocaleString('fr-FR') + ' F CFA' }

export default async function ProductOGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: p } = await supabase
    .from('cfa_produits')
    .select('nom, prix_vente, apport_minimum, nb_mensualites_max, photo_url, etat')
    .eq('id', id)
    .single()

  const nom        = p?.nom ?? 'Produit'
  const prix       = p ? fcfa(p.prix_vente) : ''
  const apport     = p ? fcfa(p.apport_minimum) : ''
  const mensualite = p ? fcfa(Math.ceil((p.prix_vente - p.apport_minimum) / p.nb_mensualites_max)) : ''

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%',
        background: '#0A2018',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '64px 72px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top gold bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#C9A227', display: 'flex' }} />

        {/* Background accent */}
        <div style={{
          position: 'absolute', top: -120, right: -120,
          width: 500, height: 500, borderRadius: '50%',
          background: 'rgba(13,59,46,0.9)', display: 'flex',
        }} />

        {/* Product image if exists */}
        {p?.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.photo_url}
            style={{
              position: 'absolute', right: 72, top: '50%',
              transform: 'translateY(-50%)',
              width: 280, height: 280,
              borderRadius: 24,
              objectFit: 'cover',
              border: '2px solid rgba(255,255,255,0.1)',
            }}
            alt=""
          />
        )}

        {/* SG badge (only if no photo) */}
        {!p?.photo_url && (
          <div style={{
            position: 'absolute', top: 56, right: 72,
            width: 110, height: 120,
            background: '#0D3B2E',
            borderRadius: 20,
            border: '4px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 64, fontWeight: 900, color: '#C9A227', display: 'flex' }}>SG</div>
          </div>
        )}

        {/* Label */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#C9A227',
          letterSpacing: '0.25em', textTransform: 'uppercase',
          fontFamily: 'Arial, sans-serif', marginBottom: 16, display: 'flex',
        }}>
          SEMOU GROUP · CFA CUSEMS Authentique
        </div>

        {/* Product name */}
        <div style={{
          fontSize: p && nom.length > 30 ? 48 : 60,
          fontWeight: 900, color: '#F7F3EC',
          lineHeight: 1.1, marginBottom: 28,
          fontFamily: 'Georgia, serif',
          maxWidth: p?.photo_url ? 720 : 900,
          display: 'flex',
        }}>
          {nom}
        </div>

        {/* Price pills */}
        {p && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            {[
              { label: 'Prix total',   value: prix,       gold: true  },
              { label: 'Apport dès',   value: apport,     gold: false },
              { label: 'Mensualité',   value: `${mensualite}/mois`, gold: false },
            ].map(({ label, value, gold }) => (
              <div key={label} style={{
                background: gold ? 'rgba(201,162,39,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${gold ? 'rgba(201,162,39,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 12, padding: '10px 18px', display: 'flex', flexDirection: 'column',
              }}>
                <span style={{ fontSize: 10, color: 'rgba(247,243,236,0.4)', letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: 'Arial', display: 'flex' }}>
                  {label}
                </span>
                <span style={{ fontSize: 20, fontWeight: 700, color: gold ? '#C9A227' : 'rgba(247,243,236,0.75)', fontFamily: 'Arial', marginTop: 4, display: 'flex' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom strip */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 52,
          background: '#061E18', display: 'flex', alignItems: 'center',
          padding: '0 72px', borderTop: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(247,243,236,0.3)', fontFamily: 'Arial', letterSpacing: '0.1em', display: 'flex' }}>
            semou-group.vercel.app/produits
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  )
}
