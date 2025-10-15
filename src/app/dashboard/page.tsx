'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';

export default function DashboardPage() {
  const { user: loggedInUser, logout } = useAuth();

  if (!loggedInUser) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-xl p-8 border border-white/20">
            <h1 className="text-2xl mb-4">Acceso Requerido</h1>
            <p>Debes iniciar sesión para acceder al dashboard.</p>
          </div>
        </div>
      </BackgroundLayout>
    );
  }

  return (
    <TurnoGuard>
      <BackgroundLayout>
        <div className="min-h-screen flex flex-col">
          <Navbar 
            onLoginClick={() => {}} 
            loggedInUser={loggedInUser}
            onLogout={logout}
          />
        
        <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
        <div className="max-w-7xl mx-auto py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Dashboard Principal</h1>
            <p className="text-gray-300 text-lg">Vista general del sistema de biogás</p>
          </div>

          {/* Métricas generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-600/10 rounded-xl p-6 border border-green-400/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-400 text-sm font-medium">Producción Diaria</p>
                  <p className="text-white text-2xl font-bold">245 m³</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/10 rounded-xl p-6 border border-blue-400/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-400 text-sm font-medium">Eficiencia</p>
                  <p className="text-white text-2xl font-bold">87%</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-600/10 rounded-xl p-6 border border-amber-400/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-400 text-sm font-medium">Temperatura</p>
                  <p className="text-white text-2xl font-bold">38°C</p>
                </div>
                <div className="w-12 h-12 bg-amber-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-1v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-1c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-1" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/20 to-pink-600/10 rounded-xl p-6 border border-purple-400/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-400 text-sm font-medium">pH</p>
                  <p className="text-white text-2xl font-bold">7.2</p>
                </div>
                <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3C5.5 3 5.5 5 7 5s1.5-2 0-2zM19 17V5a2 2 0 00-2-2H9v18a4 4 0 004-4z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Gráfico placeholder */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-12">
            <h3 className="text-xl font-bold text-white mb-6">Producción de Biogás - Últimas 24 horas</h3>
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p>Gráfico de producción (próximamente)</p>
              </div>
            </div>
          </div>

          {/* Alertas recientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-lg font-bold text-white mb-4">Alertas Recientes</h3>
              <div className="space-y-3">
                <div className="flex items-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-white text-sm">Temperatura ligeramente elevada</p>
                    <p className="text-gray-400 text-xs">Hace 2 horas</p>
                  </div>
                </div>
                <div className="flex items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  <div>
                    <p className="text-white text-sm">Sistema funcionando normalmente</p>
                    <p className="text-gray-400 text-xs">Hace 4 horas</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-lg font-bold text-white mb-4">Actividad Reciente</h3>
              <div className="space-y-3">
                <div className="flex items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-blue-400 text-xs font-bold">JH</span>
                  </div>
                  <div>
                    <p className="text-white text-sm">Turno iniciado por Juan Hernández</p>
                    <p className="text-gray-400 text-xs">Hace 1 hora</p>
                  </div>
                </div>
                <div className="flex items-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mr-3">
                    <span className="text-purple-400 text-xs font-bold">MG</span>
                  </div>
                  <div>
                    <p className="text-white text-sm">Registro completado por María García</p>
                    <p className="text-gray-400 text-xs">Hace 3 horas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}