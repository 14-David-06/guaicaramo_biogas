'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

export default function TurnosPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [turnoActivo, setTurnoActivo] = useState(false);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para gestionar turnos.</p>
        </div>
      </div>
    );
  }

  const handleAbrirTurno = () => {
    setTurnoActivo(true);
    // Aquí iría la lógica para abrir el turno
    alert('Turno abierto exitosamente');
  };

  const handleCerrarTurno = () => {
    setTurnoActivo(false);
    // Aquí iría la lógica para cerrar el turno
    alert('Turno cerrado exitosamente');
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar 
        onLoginClick={() => setShowLogin(true)} 
        loggedInUser={loggedInUser}
        onLogout={logout}
      />
      
      <main className="pt-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Gestión de Turnos</h1>
            <p className="text-gray-300 text-lg">Controla los turnos operativos del sistema</p>
          </div>

          {/* Estado actual del turno */}
          <div className="mb-8">
            <div className={`bg-gradient-to-br ${turnoActivo 
              ? 'from-green-500/20 to-emerald-600/10 border-green-400/30' 
              : 'from-red-500/20 to-red-600/10 border-red-400/30'
            } rounded-xl p-8 border text-center`}>
              <div className="flex items-center justify-center mb-4">
                <div className={`w-4 h-4 rounded-full mr-3 ${turnoActivo ? 'bg-green-400' : 'bg-red-400'} animate-pulse`}></div>
                <h2 className="text-2xl font-bold text-white">
                  Estado del Turno: {turnoActivo ? 'ACTIVO' : 'INACTIVO'}
                </h2>
              </div>
              {turnoActivo && (
                <div className="text-gray-300">
                  <p>Turno iniciado por: {loggedInUser.nombre}</p>
                  <p>Hora de inicio: {new Date().toLocaleTimeString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Controles de turno */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-xl font-bold text-white mb-4">Abrir Turno</h3>
              <p className="text-gray-300 mb-6">Inicia un nuevo turno operativo registrando el operador responsable.</p>
              <button
                onClick={handleAbrirTurno}
                disabled={turnoActivo}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
              >
                {turnoActivo ? 'Turno Ya Activo' : 'Abrir Turno'}
              </button>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-xl font-bold text-white mb-4">Cerrar Turno</h3>
              <p className="text-gray-300 mb-6">Finaliza el turno actual y registra las observaciones finales.</p>
              <button
                onClick={handleCerrarTurno}
                disabled={!turnoActivo}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
              >
                {!turnoActivo ? 'No Hay Turno Activo' : 'Cerrar Turno'}
              </button>
            </div>
          </div>

          {/* Historial de turnos */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
            <h3 className="text-xl font-bold text-white mb-6">Historial de Turnos Recientes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-600/50">
                    <th className="text-gray-300 font-medium py-3 px-4">Fecha</th>
                    <th className="text-gray-300 font-medium py-3 px-4">Operador</th>
                    <th className="text-gray-300 font-medium py-3 px-4">Inicio</th>
                    <th className="text-gray-300 font-medium py-3 px-4">Fin</th>
                    <th className="text-gray-300 font-medium py-3 px-4">Duración</th>
                    <th className="text-gray-300 font-medium py-3 px-4">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-700/30">
                    <td className="text-white py-3 px-4">2025-10-14</td>
                    <td className="text-white py-3 px-4">Juan Hernández</td>
                    <td className="text-white py-3 px-4">08:00</td>
                    <td className="text-white py-3 px-4">16:00</td>
                    <td className="text-white py-3 px-4">8h</td>
                    <td className="py-3 px-4">
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm">Completado</span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-700/30">
                    <td className="text-white py-3 px-4">2025-10-13</td>
                    <td className="text-white py-3 px-4">María García</td>
                    <td className="text-white py-3 px-4">16:00</td>
                    <td className="text-white py-3 px-4">00:00</td>
                    <td className="text-white py-3 px-4">8h</td>
                    <td className="py-3 px-4">
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm">Completado</span>
                    </td>
                  </tr>
                  <tr className="border-b border-slate-700/30">
                    <td className="text-white py-3 px-4">2025-10-13</td>
                    <td className="text-white py-3 px-4">Carlos López</td>
                    <td className="text-white py-3 px-4">00:00</td>
                    <td className="text-white py-3 px-4">08:00</td>
                    <td className="text-white py-3 px-4">8h</td>
                    <td className="py-3 px-4">
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm">Completado</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}