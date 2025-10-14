'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

export default function RegistroJerbacherPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [parametros, setParametros] = useState({
    presionGas: '',
    temperaturaDigestor: '',
    phDigestor: '',
    nivelLiquido: '',
    caudal: '',
    humedadBiogas: '',
    observaciones: ''
  });

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para acceder al registro Jerbacher.</p>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: string) => {
    setParametros(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Parámetros registrados:', parametros);
    alert('Parámetros registrados exitosamente');
  };

  return (
    <TurnoGuard>
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Navbar 
          onLoginClick={() => {}} 
          loggedInUser={loggedInUser}
          onLogout={logout}
        />
        
        <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
          <div className="max-w-4xl mx-auto py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-white mb-4">Registro Jerbacher</h1>
              <p className="text-gray-300 text-lg">Parámetros diarios del sistema de biogás</p>
            </div>

            {/* Formulario de Registro */}
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Presión del Gas */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Presión del Gas (mbar)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.presionGas}
                    onChange={(e) => handleInputChange('presionGas', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 15.5"
                  />
                </div>

                {/* Temperatura Digestor */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Temperatura Digestor (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.temperaturaDigestor}
                    onChange={(e) => handleInputChange('temperaturaDigestor', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 38.5"
                  />
                </div>

                {/* pH Digestor */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    pH del Digestor
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    value={parametros.phDigestor}
                    onChange={(e) => handleInputChange('phDigestor', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 7.2"
                  />
                </div>

                {/* Nivel de Líquido */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Nivel de Líquido (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={parametros.nivelLiquido}
                    onChange={(e) => handleInputChange('nivelLiquido', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 75"
                  />
                </div>

                {/* Caudal */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Caudal (m³/h)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={parametros.caudal}
                    onChange={(e) => handleInputChange('caudal', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 12.5"
                  />
                </div>

                {/* Humedad Biogás */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Humedad Biogás (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={parametros.humedadBiogas}
                    onChange={(e) => handleInputChange('humedadBiogas', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 85.2"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Observaciones
                </label>
                <textarea
                  rows={4}
                  value={parametros.observaciones}
                  onChange={(e) => handleInputChange('observaciones', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Registra cualquier observación relevante sobre el funcionamiento del sistema..."
                />
              </div>

              {/* Botón de Envío */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
              >
                📊 Registrar Parámetros Diarios
              </button>
            </form>

            {/* Resumen de Parámetros Actuales */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h2 className="text-xl font-bold text-white mb-4">Parámetros de Referencia</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center p-3 bg-gray-700/30 rounded-lg">
                  <p className="text-gray-400">Presión Óptima</p>
                  <p className="text-green-400 font-medium">10-20 mbar</p>
                </div>
                <div className="text-center p-3 bg-gray-700/30 rounded-lg">
                  <p className="text-gray-400">Temperatura Óptima</p>
                  <p className="text-green-400 font-medium">35-40°C</p>
                </div>
                <div className="text-center p-3 bg-gray-700/30 rounded-lg">
                  <p className="text-gray-400">pH Óptimo</p>
                  <p className="text-green-400 font-medium">6.8-7.2</p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </TurnoGuard>
  );
}