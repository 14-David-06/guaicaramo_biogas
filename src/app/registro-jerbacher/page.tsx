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

interface RegistroJerbacher {
  fecha: string;
  hora: string;
  operador: string;
  temperaturaDigestor: number;
  presionGas: number;
  nivelLiquido: number;
  phDigestor: number;
  produccionGas: number;
  consumoElectricidad: number;
  observaciones: string;
  estado: 'normal' | 'alerta' | 'critico';
}

export default function RegistroJerbacher() {
  const router = useRouter();
  const [loggedInUser] = useState<User | null>({
    id: '1',
    nombre: 'Usuario Demo',
    cargo: 'Operador',
    cedula: '12345678'
  });

  const [formData, setFormData] = useState<RegistroJerbacher>({
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().slice(0, 5),
    operador: loggedInUser?.nombre || '',
    temperaturaDigestor: 0,
    presionGas: 0,
    nivelLiquido: 0,
    phDigestor: 7.0,
    produccionGas: 0,
    consumoElectricidad: 0,
    observaciones: '',
    estado: 'normal'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const evaluarEstado = (data: RegistroJerbacher): 'normal' | 'alerta' | 'critico' => {
    // Rangos críticos (ejemplo)
    if (data.temperaturaDigestor < 30 || data.temperaturaDigestor > 45) return 'critico';
    if (data.presionGas < 10 || data.presionGas > 100) return 'critico';
    if (data.phDigestor < 6.5 || data.phDigestor > 8.0) return 'alerta';
    if (data.nivelLiquido < 20 || data.nivelLiquido > 90) return 'alerta';
    
    return 'normal';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Evaluar estado automáticamente
    const estadoEvaluado = evaluarEstado(formData);
    const dataToSubmit = { ...formData, estado: estadoEvaluado };

    try {
      // Aquí integrarías con tu API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMensaje(`¡Registro guardado exitosamente! Estado: ${estadoEvaluado.toUpperCase()}`);
      
      // Limpiar formulario después de 3 segundos
      setTimeout(() => {
        setFormData({
          fecha: new Date().toISOString().split('T')[0],
          hora: new Date().toTimeString().slice(0, 5),
          operador: loggedInUser?.nombre || '',
          temperaturaDigestor: 0,
          presionGas: 0,
          nivelLiquido: 0,
          phDigestor: 7.0,
          produccionGas: 0,
          consumoElectricidad: 0,
          observaciones: '',
          estado: 'normal'
        });
        setMensaje('');
      }, 3000);
      
    } catch (error) {
      console.error('Error al guardar registro:', error);
      setMensaje('Error al guardar el registro. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'critico': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'alerta': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-green-400 bg-green-500/20 border-green-500/30';
    }
  };

  const estadoActual = evaluarEstado(formData);

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
        <div className="max-w-6xl mx-auto">
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
                <span className="text-blue-400">Registro Diario Jerbacher</span>
              </h1>
              <p className="text-lg text-gray-300">
                Monitoreo y registro de parámetros del sistema de biogás
              </p>

              {/* Estado Actual */}
              <div className={`inline-block mt-4 px-4 py-2 rounded-lg border font-medium ${getEstadoColor(estadoActual)}`}>
                Estado Actual: {estadoActual.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Formulario */}
          <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 md:p-8 border border-white/20 shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Información General */}
              <div className="border-b border-white/20 pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Información General</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Operador
                    </label>
                    <input
                      type="text"
                      name="operador"
                      value={formData.operador}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
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
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Hora
                    </label>
                    <input
                      type="time"
                      name="hora"
                      value={formData.hora}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Parámetros del Digestor */}
              <div className="border-b border-white/20 pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Parámetros del Digestor</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Temperatura (°C)
                      <span className="text-sm text-gray-400 block">Rango: 30-45°C</span>
                    </label>
                    <input
                      type="number"
                      name="temperaturaDigestor"
                      value={formData.temperaturaDigestor || ''}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="100"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Presión Gas (mbar)
                      <span className="text-sm text-gray-400 block">Rango: 10-100 mbar</span>
                    </label>
                    <input
                      type="number"
                      name="presionGas"
                      value={formData.presionGas || ''}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Nivel Líquido (%)
                      <span className="text-sm text-gray-400 block">Rango: 20-90%</span>
                    </label>
                    <input
                      type="number"
                      name="nivelLiquido"
                      value={formData.nivelLiquido || ''}
                      onChange={handleInputChange}
                      step="1"
                      min="0"
                      max="100"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      pH Digestor
                      <span className="text-sm text-gray-400 block">Rango: 6.5-8.0</span>
                    </label>
                    <input
                      type="number"
                      name="phDigestor"
                      value={formData.phDigestor || ''}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      max="14"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Producción y Consumo */}
              <div className="border-b border-white/20 pb-6">
                <h3 className="text-xl font-semibold text-white mb-4">Producción y Consumo</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Producción de Gas (m³/h)
                    </label>
                    <input
                      type="number"
                      name="produccionGas"
                      value={formData.produccionGas || ''}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-white font-medium mb-2">
                      Consumo Electricidad (kWh)
                    </label>
                    <input
                      type="number"
                      name="consumoElectricidad"
                      value={formData.consumoElectricidad || ''}
                      onChange={handleInputChange}
                      step="0.1"
                      min="0"
                      className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-white font-medium mb-2">
                  Observaciones
                </label>
                <textarea
                  name="observaciones"
                  value={formData.observaciones}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm resize-none"
                  placeholder="Ingresa cualquier observación relevante sobre el funcionamiento del sistema..."
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
                  className="flex-1 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Guardando registro...
                    </div>
                  ) : (
                    'Guardar Registro'
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
