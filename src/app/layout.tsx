import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import "./globals.css";

// Barlow nace de la señalización vial: se lee bien de lejos, al sol y en
// pantallas pequeñas, y sus cifras tabulares alinean las columnas de datos.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const barlowCondensada = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensada",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Biogas Guaicaramo - Energía Sostenible",
  description: "Transformando residuos en energía limpia para una comunidad más verde",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4b5a32',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensada.variable}`}>
      <head>
        {/* Preconectar a APIs externas */}
        <link rel="preconnect" href="https://api.airtable.com" />
        <link rel="dns-prefetch" href="https://api.airtable.com" />
        {/* Prefetch de rutas críticas */}
        <link rel="prefetch" href="/dashboard" />
        <link rel="prefetch" href="/turnos" />
        <link rel="prefetch" href="/monitoreo-motores" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
