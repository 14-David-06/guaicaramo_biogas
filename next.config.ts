import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Configuración para que las imágenes funcionen en producción
    unoptimized: false,
    remotePatterns: [],
    // Formatos optimizados para mejor rendimiento
    formats: ['image/avif', 'image/webp'],
  },
  // Asegurar que los assets estáticos se manejen correctamente
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  // Trailing slash consistency
  trailingSlash: false,
  // Optimizaciones de rendimiento
  experimental: {
    // Optimizar paquetes para carga más rápida
    optimizePackageImports: ['chart.js', 'react-chartjs-2', 'date-fns', 'jspdf'],
  },
  // Comprimir respuestas
  compress: true,
  // Generar sourcemaps solo en desarrollo
  productionBrowserSourceMaps: false,
  // Optimizar el build
  poweredByHeader: false,
};

export default nextConfig;
