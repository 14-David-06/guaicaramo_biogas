'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

export default function MonitoreoBiodigestoresPage() {
  const { user: loggedInUser, logout } = useAuth();

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para acceder al monitoreo de biodigestores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar 
        onLoginClick={() => {}} 
        loggedInUser={loggedInUser}
        onLogout={logout}
      />
      
      <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
        <div className="max-w-6xl mx-auto py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Monitoreo de Biodigestores</h1>
            <p className="text-gray-300 text-lg">Monitoreo y control en tiempo real de biodigestores</p>
          </div>

          {/* Contenido principal */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30">
            <div className="text-center py-12">
              <div className="text-6xl mb-6">📊</div>
              <h2 className="text-2xl font-bold text-white mb-4">Monitoreo de Biodigestores</h2>
              <p className="text-gray-400 mb-8">
                Esta página estará disponible próximamente para el monitoreo en tiempo real de biodigestores.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Placeholders para futuras funcionalidades */}
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                  <h3 className="text-white font-semibold mb-2">Estado en Tiempo Real</h3>
                  <p className="text-gray-400 text-sm">Monitoreo del estado actual de los biodigestores</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                  <h3 className="text-white font-semibold mb-2">Sensores</h3>
                  <p className="text-gray-400 text-sm">Lecturas de sensores de presión, temperatura y pH</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                  <h3 className="text-white font-semibold mb-2">Alertas</h3>
                  <p className="text-gray-400 text-sm">Sistema de alertas y notificaciones</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                  <h3 className="text-white font-semibold mb-2">Producción de Gas</h3>
                  <p className="text-gray-400 text-sm">Medición de producción de biogás</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                  <h3 className="text-white font-semibold mb-2">Análisis</h3>
                  <p className="text-gray-400 text-sm">Análisis de eficiencia y rendimiento</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                  <h3 className="text-white font-semibold mb-2">Reportes</h3>
                  <p className="text-gray-400 text-sm">Generación de reportes de monitoreo</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
