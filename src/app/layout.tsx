import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Optimiza la carga de fuentes
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap", // Optimiza la carga de fuentes
});

export const metadata: Metadata = {
  title: "Biogas Guaicaramo - Energía Sostenible",
  description: "Transformando residuos en energía limpia para una comunidad más verde",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#10b981',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Preconectar a APIs externas */}
        <link rel="preconnect" href="https://api.airtable.com" />
        <link rel="dns-prefetch" href="https://api.airtable.com" />
        {/* Prefetch de rutas críticas */}
        <link rel="prefetch" href="/dashboard" />
        <link rel="prefetch" href="/turnos" />
        <link rel="prefetch" href="/monitoreo-motores" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
