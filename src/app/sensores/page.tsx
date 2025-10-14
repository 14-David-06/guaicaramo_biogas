'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

export default function SensoresPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para ver los sensores.</p>
        </div>
      </div>
    );
  }

  const sensores = [
    { id: 1, nombre: 'Temperatura Digestor 1', valor: '38.5°C', estado: 'normal', icono: '🌡️' },
    { id: 2, nombre: 'pH Digestor 1', valor: '7.2', estado: 'normal', icono: '⚗️' },
    { id: 3, nombre: 'Presión de Gas', valor: '1.2 bar', estado: 'alerta', icono: '📊' },
    { id: 4, nombre: 'Flujo de Metano', valor: '245 m³/h', estado: 'normal', icono: '💨' },
    { id: 5, nombre: 'Nivel de Agua', valor: '85%', estado: 'normal', icono: '💧' },
    { id: 6, nombre: 'Temperatura Ambiente', valor: '24°C', estado: 'normal', icono: '🌡️' },
  ];

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'normal': return 'from-green-500/20 to-emerald-600/10 border-green-400/30';
      case 'alerta': return 'from-yellow-500/20 to-amber-600/10 border-yellow-400/30';
      case 'critico': return 'from-red-500/20 to-red-600/10 border-red-400/30';
      default: return 'from-gray-500/20 to-gray-600/10 border-gray-400/30';
    }
  };

  const getEstadoBadge = (estado: string) => {
    switch (estado) {
      case 'normal': return 'bg-green-500/20 text-green-400';
      case 'alerta': return 'bg-yellow-500/20 text-yellow-400';
      case 'critico': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <Navbar 
        onLoginClick={() => setShowLogin(true)} 
        loggedInUser={loggedInUser}
        onLogout={logout}
      />
      
      <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
        <div className="max-w-7xl mx-auto py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Sensores en Tiempo Real</h1>
            <p className="text-gray-300 text-lg">Monitoreo continuo de parámetros del sistema</p>
          </div>

          {/* Estado general */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Estado General del Sistema</h2>
                <p className="text-gray-300">Última actualización: {new Date().toLocaleTimeString()}</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-green-400 font-medium">Sistema Operativo</span>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                  Actualizar
                </button>
              </div>
            </div>
          </div>

          {/* Grid de sensores */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {sensores.map((sensor) => (
              <div
                key={sensor.id}
                className={`bg-gradient-to-br ${getEstadoColor(sensor.estado)} rounded-xl p-6 border transition-all duration-300 hover:scale-105 cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="text-2xl">{sensor.icono}</div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getEstadoBadge(sensor.estado)}`}>
                    {sensor.estado.toUpperCase()}
                  </span>
                </div>
                <h3 className="text-white font-semibold mb-2">{sensor.nombre}</h3>
                <p className="text-2xl font-bold text-white mb-2">{sensor.valor}</p>
                <div className="flex items-center text-gray-400 text-sm">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Actualizado hace 1 min
                </div>
              </div>
            ))}
          </div>

          {/* Gráficos de tendencias */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-xl font-bold text-white mb-4">Tendencia de Temperatura</h3>
              <div className="h-48 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm">Gráfico próximamente</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-xl font-bold text-white mb-4">Historial de Alertas</h3>
              <div className="space-y-3">
                <div className="flex items-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                  <div className="flex-1">
                    <p className="text-white text-sm">Presión elevada en digestor</p>
                    <p className="text-gray-400 text-xs">Hace 15 min</p>
                  </div>
                  <button className="text-yellow-400 hover:text-yellow-300 text-sm">Ver</button>
                </div>
                <div className="flex items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                  <div className="flex-1">
                    <p className="text-white text-sm">Temperatura normalizada</p>
                    <p className="text-gray-400 text-xs">Hace 1 hora</p>
                  </div>
                  <button className="text-green-400 hover:text-green-300 text-sm">Ver</button>
                </div>
                <div className="flex items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  <div className="flex-1">
                    <p className="text-white text-sm">Calibración automática completada</p>
                    <p className="text-gray-400 text-xs">Hace 2 horas</p>
                  </div>
                  <button className="text-blue-400 hover:text-blue-300 text-sm">Ver</button>
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