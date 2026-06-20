import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const BASE_URL = 'https://semou-group.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  'SEMOU GROUP — Paiement échelonné pour fonctionnaires',
    template: '%s | SEMOU GROUP',
  },
  description:
    'SEMOU GROUP × CFA CUSEMS Authentique — Commandez des équipements et payez en plusieurs mensualités sur salaire. Réservé aux fonctionnaires sénégalais.',
  keywords: [
    'paiement échelonné', 'fonctionnaire Sénégal', 'CFA CUSEMS', 'SEMOU GROUP',
    'mensualité salaire', 'crédit fonctionnaire', 'équipement enseignant',
  ],
  authors: [{ name: 'SEMOU GROUP' }],
  openGraph: {
    type:        'website',
    locale:      'fr_SN',
    url:         BASE_URL,
    siteName:    'SEMOU GROUP',
    title:       'SEMOU GROUP — Paiement échelonné pour fonctionnaires',
    description: 'Commandez aujourd\'hui, payez à votre rythme. Réservé aux fonctionnaires sénégalais.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'SEMOU GROUP' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:       'SEMOU GROUP — Paiement échelonné pour fonctionnaires',
    description: 'Commandez aujourd\'hui, payez à votre rythme. Réservé aux fonctionnaires sénégalais.',
    images:      ['/opengraph-image'],
  },
  robots: {
    index:          true,
    follow:         true,
    googleBot: {
      index:             true,
      follow:            true,
      'max-image-preview': 'large',
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable} font-body bg-[#FAF8F3] text-paper antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
