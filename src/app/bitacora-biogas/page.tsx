'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

interface Evento {
  id: string;
  fecha: string;
  hora: string;
  tipo: 'incidencia' | 'mantenimiento' | 'operacion' | 'alarma';
  descripcion: string;
  operador: string;
  estado: 'abierto' | 'en_proceso' | 'resuelto';
}

export default function BitacoraBiogasPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [nuevoEvento, setNuevoEvento] = useState<{
    tipo: 'incidencia' | 'mantenimiento' | 'operacion' | 'alarma';
    descripcion: string;
  }>({
    tipo: 'incidencia',
    descripcion: ''
  });

  // Datos simulados de eventos
  const [eventos] = useState<Evento[]>([
    {
      id: '1',
      fecha: '2025-10-14',
      hora: '14:30',
      tipo: 'alarma',
      descripcion: 'Presión de gas por debajo del límite mínimo',
      operador: 'David Hernandez',
      estado: 'resuelto'
    },
    {
      id: '2',
      fecha: '2025-10-14',
      hora: '13:15',
      tipo: 'mantenimiento',
      descripcion: 'Limpieza de filtros del sistema de gas',
      operador: 'David Hernandez',
      estado: 'resuelto'
    },
    {
      id: '3',
      fecha: '2025-10-14',
      hora: '12:00',
      tipo: 'operacion',
      descripcion: 'Inicio de turno - Revisión general del sistema',
      operador: 'David Hernandez',
      estado: 'resuelto'
    },
    {
      id: '4',
      fecha: '2025-10-13',
      hora: '16:45',
      tipo: 'incidencia',
      descripcion: 'Temperatura del digestor elevada',
      operador: 'María González',
      estado: 'resuelto'
    }
  ]);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para acceder a la bitácora de eventos.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEvento.descripcion.trim()) return;

    console.log('Nuevo evento registrado:', {
      ...nuevoEvento,
      fecha: new Date().toISOString().split('T')[0],
      hora: new Date().toLocaleTimeString().slice(0, 5),
      operador: loggedInUser.nombre,
      estado: 'abierto'
    });

    alert('Evento registrado exitosamente en la bitácora');
    setNuevoEvento({ tipo: 'incidencia', descripcion: '' });
  };

  const getTipoColor = (tipo: string) => {
    switch (tipo) {
      case 'alarma': return 'text-red-400 bg-red-400/20';
      case 'incidencia': return 'text-yellow-400 bg-yellow-400/20';
      case 'mantenimiento': return 'text-blue-400 bg-blue-400/20';
      case 'operacion': return 'text-green-400 bg-green-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'abierto': return 'text-red-400 bg-red-400/20';
      case 'en_proceso': return 'text-yellow-400 bg-yellow-400/20';
      case 'resuelto': return 'text-green-400 bg-green-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case 'alarma': return '🚨';
      case 'incidencia': return '⚠️';
      case 'mantenimiento': return '🔧';
      case 'operacion': return '⚙️';
      default: return '📝';
    }
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
          <div className="max-w-6xl mx-auto py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-white mb-4">Bitácora de Eventos</h1>
              <p className="text-gray-300 text-lg">Registro de incidencias y eventos del sistema de biogás</p>
            </div>

            {/* Formulario para Nuevo Evento */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30 mb-8">
              <h2 className="text-xl font-bold text-white mb-4">Registrar Nuevo Evento</h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Evento</label>
                    <select
                      value={nuevoEvento.tipo}
                      onChange={(e) => setNuevoEvento(prev => ({ ...prev, tipo: e.target.value as 'incidencia' | 'mantenimiento' | 'operacion' | 'alarma' }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="incidencia">⚠️ Incidencia</option>
                      <option value="alarma">🚨 Alarma</option>
                      <option value="mantenimiento">🔧 Mantenimiento</option>
                      <option value="operacion">⚙️ Operación</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Descripción del Evento</label>
                    <input
                      type="text"
                      value={nuevoEvento.descripcion}
                      onChange={(e) => setNuevoEvento(prev => ({ ...prev, descripcion: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe el evento o incidencia..."
                      required
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all duration-300"
                >
                  📝 Registrar Evento
                </button>
              </form>
            </div>

            {/* Lista de Eventos */}
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h2 className="text-xl font-bold text-white mb-6">Historial de Eventos</h2>
              
              <div className="space-y-4">
                {eventos.map((evento) => (
                  <div key={evento.id} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-lg">{getTipoIcon(evento.tipo)}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTipoColor(evento.tipo)}`}>
                            {evento.tipo.toUpperCase()}
                          </span>
                          <span className="text-gray-400 text-sm">
                            {evento.fecha} - {evento.hora}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(evento.estado)}`}>
                            {evento.estado.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                        
                        <p className="text-white mb-2">{evento.descripcion}</p>
                        
                        <p className="text-gray-400 text-sm">
                          Registrado por: <span className="text-blue-400">{evento.operador}</span>
                        </p>
                      </div>
                      
                      <div className="ml-4">
                        {evento.estado !== 'resuelto' && (
                          <button className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors">
                            Marcar Resuelto
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {eventos.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400">No hay eventos registrados</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </TurnoGuard>
  );
}