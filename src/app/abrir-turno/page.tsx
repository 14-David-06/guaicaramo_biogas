'use client';

import { useState } from 'react';
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

interface TurnoData {
  fecha: string;
  horaInicio: string;
  operador: string;
  turno: 'mañana' | 'tarde' | 'noche';
  observaciones: string;
}

export default function AbrirTurno() {
  const router = useRouter();
  const [loggedInUser] = useState<User | null>({
    id: '1',
    nombre: 'Usuario Demo',
    cargo: 'Operador',
    cedula: '12345678'
  });

  const [formData, setFormData] = useState<TurnoData>({
    fecha: new Date().toISOString().split('T')[0],
    horaInicio: new Date().toTimeString().slice(0, 5),
    operador: loggedInUser?.nombre || '',
    turno: 'mañana',
    observaciones: ''
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulación de envío de datos
    try {
      // Aquí integrarías con tu API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMensaje('¡Turno abierto exitosamente!');
      
      // Limpiar formulario después de 2 segundos
      setTimeout(() => {
        setFormData({
          fecha: new Date().toISOString().split('T')[0],
          horaInicio: new Date().toTimeString().slice(0, 5),
          operador: loggedInUser?.nombre || '',
          turno: 'mañana',
          observaciones: ''
        });
        setMensaje('');
      }, 2000);
      
    } catch (error) {
      console.error('Error al abrir turno:', error);
      setMensaje('Error al abrir el turno. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

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
        <div className="max-w-4xl mx-auto">
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
                <span className="text-green-400">Abrir Turno</span>
              </h1>
              <p className="text-lg text-gray-300">
                Registro de inicio de turno operativo
              </p>
            </div>
          </div>

          {/* Formulario */}
          <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 md:p-8 border border-white/20 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Información del Operador */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Operador
                  </label>
                  <input
                    type="text"
                    name="operador"
                    value={formData.operador}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
                    readOnly
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Fecha
                  </label>
                  <input
                    type="date"
                    name="fecha"
                    value={formData.fecha}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
                    required
                  />
                </div>
              </div>

              {/* Información del Turno */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-white font-medium mb-2">
                    Hora de Inicio
                  </label>
                  <input
                    type="time"
                    name="horaInicio"
                    value={formData.horaInicio}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white font-medium mb-2">
                    Turno
                  </label>
                  <select
                    name="turno"
                    value={formData.turno}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm"
                    required
                  >
                    <option value="mañana" className="bg-gray-800">Mañana (6:00 - 14:00)</option>
                    <option value="tarde" className="bg-gray-800">Tarde (14:00 - 22:00)</option>
                    <option value="noche" className="bg-gray-800">Noche (22:00 - 6:00)</option>
                  </select>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Observaciones Iniciales
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent backdrop-blur-sm resize-none"
                  placeholder="Ingresa cualquier observación relevante para el inicio del turno..."
                />
              </div>

              {/* Mensaje de confirmación */}
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
                  onClick={() => router.push('/')}
                  className="flex-1 px-6 py-3 rounded-lg bg-gray-600/20 border border-gray-500/30 text-white font-medium hover:bg-gray-600/30 transition-all duration-300"
                >
                  Cancelar
                </button>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Abriendo turno...
                    </div>
                  ) : (
                    'Abrir Turno'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
