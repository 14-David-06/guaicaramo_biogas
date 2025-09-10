'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

interface User {
  id: string;
  nombre: string;
  cargo: string;
  cedula: string;
}

interface RegistroBitacora {
  id: string;
  fecha: string;
  hora: string;
  operador: string;
  tipoEvento: 'mantenimiento' | 'incidencia' | 'observacion' | 'alarma' | 'reparacion';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  descripcion: string;
  accionesTomadas: string;
  estado: 'abierto' | 'en_proceso' | 'resuelto' | 'cerrado';
  equipoAfectado?: string;
}

interface NuevoBitacora {
  fecha: string;
  hora: string;
  tipoEvento: 'mantenimiento' | 'incidencia' | 'observacion' | 'alarma' | 'reparacion';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  descripcion: string;
  accionesTomadas: string;
  equipoAfectado: string;
}

export default function BitacoraBiogas() {
  const router = useRouter();
  const [loggedInUser] = useState<User | null>({
    id: '1',
    nombre: 'Usuario Demo',
    cargo: 'Operador',
    cedula: '12345678'
  });

  const [vista, setVista] = useState<'lista' | 'nuevo'>('lista');
  const [filtros, setFiltros] = useState({
    tipoEvento: '',
    prioridad: '',
    estado: '',
    fechaDesde: '',
    fechaHasta: ''
  });

  // Datos de ejemplo para la bitácora
  const [registros, setRegistros] = useState<RegistroBitacora[]>([
    {
      id: '1',
      fecha: '2024-12-10',
      hora: '14:30',
      operador: 'Juan Pérez',
      tipoEvento: 'mantenimiento',
      prioridad: 'media',
      descripcion: 'Mantenimiento preventivo del generador eléctrico',
      accionesTomadas: 'Cambio de aceite y filtros, revisión general del sistema',
      estado: 'resuelto',
      equipoAfectado: 'Generador Principal'
    },
    {
      id: '2',
      fecha: '2024-12-10',
      hora: '09:15',
      operador: 'María González',
      tipoEvento: 'alarma',
      prioridad: 'alta',
      descripcion: 'Alarma por alta presión en digestor 1',
      accionesTomadas: 'Se liberó presión manualmente y se verificó el sistema de seguridad',
      estado: 'resuelto',
      equipoAfectado: 'Digestor 1'
    },
    {
      id: '3',
      fecha: '2024-12-09',
      hora: '16:45',
      operador: 'Carlos Rodríguez',
      tipoEvento: 'incidencia',
      prioridad: 'media',
      descripcion: 'Fuga menor en tubería de gas',
      accionesTomadas: 'Aplicación de sellador temporal, programada reparación definitiva',
      estado: 'en_proceso',
      equipoAfectado: 'Sistema de Tuberías'
    }
  ]);

  const [formData, setFormData] = useState<NuevoBitacora>({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    tipoEvento: 'observacion',
    prioridad: 'baja',
    descripcion: '',
    accionesTomadas: '',
    equipoAfectado: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFiltroChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFiltros(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Crear nuevo registro
      const nuevoRegistro: RegistroBitacora = {
        id: (registros.length + 1).toString(),
        ...formData,
        operador: loggedInUser?.nombre || '',
        estado: 'abierto'
      };

      // Agregar a la lista de registros
      setRegistros(prev => [nuevoRegistro, ...prev]);
      
      setMensaje('¡Registro agregado a la bitácora exitosamente!');
      
      // Limpiar formulario y volver a la vista de lista
      setTimeout(() => {
        setFormData({
          fecha: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().slice(0, 5),
          tipoEvento: 'observacion',
          prioridad: 'baja',
          descripcion: '',
          accionesTomadas: '',
          equipoAfectado: ''
        });
        setMensaje('');
        setVista('lista');
      }, 2000);
      
    } catch (error) {
      console.error('Error al guardar registro:', error);
      setMensaje('Error al guardar el registro. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTipoEventoColor = (tipo: string) => {
    switch (tipo) {
      case 'alarma': return 'bg-red-100 text-red-800';
      case 'incidencia': return 'bg-orange-100 text-orange-800';
      case 'mantenimiento': return 'bg-blue-100 text-blue-800';
      case 'reparacion': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPrioridadColor = (prioridad: string) => {
    switch (prioridad) {
      case 'critica': return 'bg-red-500 text-white';
      case 'alta': return 'bg-orange-500 text-white';
      case 'media': return 'bg-yellow-500 text-white';
      default: return 'bg-green-500 text-white';
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'resuelto': return 'bg-green-100 text-green-800';
      case 'cerrado': return 'bg-gray-100 text-gray-800';
      case 'en_proceso': return 'bg-blue-100 text-blue-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Filtrar registros
  const registrosFiltrados = registros.filter(registro => {
    return (
      (!filtros.tipoEvento || registro.tipoEvento === filtros.tipoEvento) &&
      (!filtros.prioridad || registro.prioridad === filtros.prioridad) &&
      (!filtros.estado || registro.estado === filtros.estado) &&
      (!filtros.fechaDesde || registro.fecha >= filtros.fechaDesde) &&
      (!filtros.fechaHasta || registro.fecha <= filtros.fechaHasta)
    );
  });

  return (
    <div className="relative min-h-screen">
      {/* Background Image */}
      <div className="fixed inset-0 w-full h-full z-0">
        <Image
          src="/DSC_3884-Mejorado-NR_ghtz72.jpg"
          alt="Background Biogas"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/50"></div>
      </div>

      {/* Navigation */}
      <Navbar 
        onLoginClick={() => {}} 
        loggedInUser={loggedInUser}
        onLogout={() => router.push('/')}
      />

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="backdrop-blur-lg bg-white/10 rounded-2xl p-6 border border-white/20 shadow-2xl">
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center text-green-400 hover:text-green-300 mb-4 transition-colors"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver al Dashboard
              </button>
              
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                <span className="text-purple-400">Bitácora Biogás</span>
              </h1>
              <p className="text-lg text-gray-300">
                Registro de eventos, mantenimientos e incidencias del sistema
              </p>

              {/* Botones de navegación */}
              <div className="flex justify-center gap-4 mt-6">
                <button
                  onClick={() => setVista('lista')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                    vista === 'lista' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Ver Bitácora
                </button>
                <button
                  onClick={() => setVista('nuevo')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 ${
                    vista === 'nuevo' 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Nuevo Registro
                </button>
              </div>
            </div>
          </div>

          {vista === 'lista' ? (
            /* Vista de Lista */
            <div className="space-y-6">
              {/* Filtros */}
              <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl">
                <h3 className="text-xl font-semibold text-white mb-4">Filtros</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-white font-medium mb-2 text-sm">Tipo de Evento</label>
                    <select
                      name="tipoEvento"
                      value={filtros.tipoEvento}
                      onChange={handleFiltroChange}
                      className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="" className="bg-gray-800">Todos</option>
                      <option value="mantenimiento" className="bg-gray-800">Mantenimiento</option>
                      <option value="incidencia" className="bg-gray-800">Incidencia</option>
                      <option value="observacion" className="bg-gray-800">Observación</option>
                      <option value="alarma" className="bg-gray-800">Alarma</option>
                      <option value="reparacion" className="bg-gray-800">Reparación</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2 text-sm">Prioridad</label>
                    <select
                      name="prioridad"
                      value={filtros.prioridad}
                      onChange={handleFiltroChange}
                      className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="" className="bg-gray-800">Todas</option>
                      <option value="baja" className="bg-gray-800">Baja</option>
                      <option value="media" className="bg-gray-800">Media</option>
                      <option value="alta" className="bg-gray-800">Alta</option>
                      <option value="critica" className="bg-gray-800">Crítica</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2 text-sm">Estado</label>
                    <select
                      name="estado"
                      value={filtros.estado}
                      onChange={handleFiltroChange}
                      className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="" className="bg-gray-800">Todos</option>
                      <option value="abierto" className="bg-gray-800">Abierto</option>
                      <option value="en_proceso" className="bg-gray-800">En Proceso</option>
                      <option value="resuelto" className="bg-gray-800">Resuelto</option>
                      <option value="cerrado" className="bg-gray-800">Cerrado</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2 text-sm">Desde</label>
                    <input
                      type="date"
                      name="fechaDesde"
                      value={filtros.fechaDesde}
                      onChange={handleFiltroChange}
                      className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2 text-sm">Hasta</label>
                    <input
                      type="date"
                      name="fechaHasta"
                      value={filtros.fechaHasta}
                      onChange={handleFiltroChange}
                      className="w-full px-3 py-2 rounded-lg bg-white/20 border border-white/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Lista de Registros */}
              <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-white">
                    Registros ({registrosFiltrados.length})
                  </h3>
                  <button
                    onClick={() => {
                      setFiltros({
                        tipoEvento: '',
                        prioridad: '',
                        estado: '',
                        fechaDesde: '',
                        fechaHasta: ''
                      });
                    }}
                    className="px-4 py-2 bg-gray-600/20 text-white rounded-lg hover:bg-gray-600/30 transition-all duration-300"
                  >
                    Limpiar Filtros
                  </button>
                </div>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {registrosFiltrados.map((registro) => (
                    <div key={registro.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getTipoEventoColor(registro.tipoEvento)}`}>
                              {registro.tipoEvento.charAt(0).toUpperCase() + registro.tipoEvento.slice(1)}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getPrioridadColor(registro.prioridad)}`}>
                              {registro.prioridad.charAt(0).toUpperCase() + registro.prioridad.slice(1)}
                            </span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getEstadoColor(registro.estado)}`}>
                              {registro.estado.replace('_', ' ').charAt(0).toUpperCase() + registro.estado.replace('_', ' ').slice(1)}
                            </span>
                          </div>
                          <h4 className="font-semibold text-white mb-1">{registro.descripcion}</h4>
                          <p className="text-gray-300 text-sm mb-2">{registro.accionesTomadas}</p>
                          {registro.equipoAfectado && (
                            <p className="text-blue-400 text-sm font-medium">Equipo: {registro.equipoAfectado}</p>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-300">
                          <p>{registro.fecha}</p>
                          <p>{registro.hora}</p>
                          <p className="font-medium">{registro.operador}</p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {registrosFiltrados.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-300">No se encontraron registros con los filtros seleccionados.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Vista de Nuevo Registro */
            <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 md:p-8 border border-white/20 shadow-xl">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Información General */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">Fecha</label>
                    <input
                      type="date"
                      name="fecha"
                      value={formData.fecha}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">Hora</label>
                    <input
                      type="time"
                      name="hora"
                      value={formData.hora}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">Equipo Afectado</label>
                    <input
                      type="text"
                      name="equipoAfectado"
                      value={formData.equipoAfectado}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                      placeholder="Ej: Digestor 1, Generador Principal..."
                    />
                  </div>
                </div>

                {/* Categorización */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">Tipo de Evento</label>
                    <select
                      name="tipoEvento"
                      value={formData.tipoEvento}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                      required
                    >
                      <option value="observacion" className="bg-gray-800">Observación</option>
                      <option value="mantenimiento" className="bg-gray-800">Mantenimiento</option>
                      <option value="incidencia" className="bg-gray-800">Incidencia</option>
                      <option value="alarma" className="bg-gray-800">Alarma</option>
                      <option value="reparacion" className="bg-gray-800">Reparación</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">Prioridad</label>
                    <select
                      name="prioridad"
                      value={formData.prioridad}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm"
                      required
                    >
                      <option value="baja" className="bg-gray-800">Baja</option>
                      <option value="media" className="bg-gray-800">Media</option>
                      <option value="alta" className="bg-gray-800">Alta</option>
                      <option value="critica" className="bg-gray-800">Crítica</option>
                    </select>
                  </div>
                </div>

                {/* Descripción */}
                <div>
                  <label className="block text-white font-medium mb-2">Descripción del Evento</label>
                  <textarea
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm resize-none"
                    placeholder="Describe detalladamente el evento, incidencia o mantenimiento..."
                    required
                  />
                </div>

                {/* Acciones Tomadas */}
                <div>
                  <label className="block text-white font-medium mb-2">Acciones Tomadas</label>
                  <textarea
                    name="accionesTomadas"
                    value={formData.accionesTomadas}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm resize-none"
                    placeholder="Describe las acciones que se tomaron o se tomarán..."
                    required
                  />
                </div>

                {/* Mensaje */}
                {mensaje && (
                  <div className={`p-4 rounded-lg text-center font-medium ${
                    mensaje.includes('Error') 
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30' 
                      : 'bg-green-500/20 text-green-300 border border-green-500/30'
                  }`}>
                    {mensaje}
                  </div>
                )}

                {/* Botones */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setVista('lista')}
                    className="flex-1 px-6 py-3 rounded-lg bg-gray-600/20 border border-gray-500/30 text-white font-medium hover:bg-gray-600/30 transition-all duration-300"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Guardando...
                      </div>
                    ) : (
                      'Guardar en Bitácora'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
