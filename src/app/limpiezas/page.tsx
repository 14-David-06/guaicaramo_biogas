'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { airtableService } from '@/utils/airtable';
import type { LimpiezaRegistro } from '@/utils/airtable';

export default function LimpiezasPage() {
  const { user: loggedInUser, logout } = useAuth();
  const { isRecording, isTranscribing, startRecording, stopRecording, error: voiceError } = useVoiceRecording();
  const [formData, setFormData] = useState({
    pisosLimpios: '',
    ventanasLimpias: '',
    tablerosLimpios: '',
    estructurasLibres: '',
    equiposLimpios: '',
    jenbacherLimpios: '',
    observaciones: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registros, setRegistros] = useState<LimpiezaRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    cargarRegistros();
  }, []);

  const cargarRegistros = async () => {
    try {
      setLoading(true);
      const data = await airtableService.obtenerRegistrosLimpiezas();
      setRegistros(data);
    } catch (error) {
      console.error('Error al cargar registros de limpiezas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVoiceRecording = async () => {
    try {
      if (isRecording) {
        // Detener grabación y obtener transcripción
        const transcription = await stopRecording();
        
        // Agregar la transcripción al campo de observaciones
        const currentObservations = formData.observaciones;
        const newObservations = currentObservations 
          ? `${currentObservations} ${transcription}`
          : transcription;
        
        handleInputChange('observaciones', newObservations);
      } else {
        // Iniciar grabación
        await startRecording();
      }
    } catch (error) {
      console.error('Error con grabación de voz:', error);
    }
  };

  const marcarTodoComoSi = () => {
    setFormData(prev => ({
      ...prev,
      pisosLimpios: 'Sí',
      ventanasLimpias: 'Sí',
      tablerosLimpios: 'Sí',
      estructurasLibres: 'Sí',
      equiposLimpios: 'Sí',
      jenbacherLimpios: 'Sí'
    }));
  };

  const limpiarFormulario = () => {
    setFormData({
      pisosLimpios: '',
      ventanasLimpias: '',
      tablerosLimpios: '',
      estructurasLibres: '',
      equiposLimpios: '',
      jenbacherLimpios: '',
      observaciones: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loggedInUser) {
      alert('Debes estar logueado para enviar el registro');
      return;
    }

    // Validar que al menos un campo de limpieza esté completado
    const camposLimpieza = [
      formData.pisosLimpios,
      formData.ventanasLimpias,
      formData.tablerosLimpios,
      formData.estructurasLibres,
      formData.equiposLimpios,
      formData.jenbacherLimpios
    ];

    if (camposLimpieza.every(campo => !campo.trim())) {
      alert('Debes completar al menos uno de los campos de limpieza');
      return;
    }

    setIsSubmitting(true);

    try {
      const registroLimpieza = {
        fields: {
          'Pisos y andén limpios (cuarto de control y área externa)': formData.pisosLimpios,
          'Ventanas limpias con retal húmedo?': formData.ventanasLimpias,
          'Tableros limpios (con precaución en perillas y controles)?': formData.tablerosLimpios,
          'Estructuras libres de polvo y telarañas?': formData.estructurasLibres,
          'Equipos (manómetros, tuberías, medidores) limpios?': formData.equiposLimpios,
          'Equipos Jenbacher limpios (cuidado con controles)?': formData.jenbacherLimpios,
          'Observaciones': formData.observaciones,
          'Realiza Registro': loggedInUser.nombre,
          'ID': `LMP-${Date.now()}`,
          'Fecha de creacion': new Date().toISOString()
        }
      };

      await airtableService.crearRegistroLimpieza(registroLimpieza);
      
      // Limpiar formulario
      setFormData({
        pisosLimpios: '',
        ventanasLimpias: '',
        tablerosLimpios: '',
        estructurasLibres: '',
        equiposLimpios: '',
        jenbacherLimpios: '',
        observaciones: ''
      });

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);

      // Recargar registros
      await cargarRegistros();

    } catch (error) {
      console.error('Error al enviar registro de limpieza:', error);
      alert('Error al enviar el registro. Por favor, intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loggedInUser) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-xl p-8 border border-white/20">
            <h1 className="text-2xl mb-4">Acceso Requerido</h1>
            <p>Debes iniciar sesión para acceder al registro de limpiezas.</p>
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
            <div className="max-w-4xl mx-auto py-12">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-white mb-4">Registro de Limpiezas</h1>
                <p className="text-gray-300 text-lg">Control de limpiezas en la planta</p>
              </div>

              {submitSuccess && (
                <div className="mb-6 p-4 bg-green-500/20 border border-green-400/30 rounded-lg text-green-400 text-center">
                  ✅ Registro de limpieza enviado exitosamente
                </div>
              )}

              {/* Formulario de registro */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20 mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Nuevo Registro de Limpieza</h2>
                
                {/* Botones de acción rápida */}
                <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white/5 rounded-lg border border-white/10">
                  <h3 className="w-full text-lg font-semibold text-white mb-2">⚡ Acciones Rápidas:</h3>
                  <button
                    type="button"
                    onClick={marcarTodoComoSi}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                    Todo Limpio
                  </button>
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>
                    </svg>
                    Limpiar Todo
                  </button>
                  <div className="text-sm text-gray-300 flex items-center">
                    💡 Tip: Usa "Todo Limpio" si todas las áreas están en buen estado
                  </div>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Campos de limpieza con iconos */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        🏢 Pisos y andén limpios (cuarto de control y área externa)
                      </label>
                      <select
                        value={formData.pisosLimpios}
                        onChange={(e) => handleInputChange('pisosLimpios', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Sí">✅ Sí</option>
                        <option value="No">❌ No</option>
                        <option value="Parcialmente">⚠️ Parcialmente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        🪟 Ventanas limpias con retal húmedo?
                      </label>
                      <select
                        value={formData.ventanasLimpias}
                        onChange={(e) => handleInputChange('ventanasLimpias', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Sí">✅ Sí</option>
                        <option value="No">❌ No</option>
                        <option value="Parcialmente">⚠️ Parcialmente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        ⚡ Tableros limpios (con precaución en perillas y controles)?
                      </label>
                      <select
                        value={formData.tablerosLimpios}
                        onChange={(e) => handleInputChange('tablerosLimpios', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Sí">✅ Sí</option>
                        <option value="No">❌ No</option>
                        <option value="Parcialmente">⚠️ Parcialmente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        🏗️ Estructuras libres de polvo y telarañas?
                      </label>
                      <select
                        value={formData.estructurasLibres}
                        onChange={(e) => handleInputChange('estructurasLibres', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Sí">✅ Sí</option>
                        <option value="No">❌ No</option>
                        <option value="Parcialmente">⚠️ Parcialmente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        🔧 Equipos (manómetros, tuberías, medidores) limpios?
                      </label>
                      <select
                        value={formData.equiposLimpios}
                        onChange={(e) => handleInputChange('equiposLimpios', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Sí">✅ Sí</option>
                        <option value="No">❌ No</option>
                        <option value="Parcialmente">⚠️ Parcialmente</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                        🏭 Equipos Jenbacher limpios (cuidado con controles)?
                      </label>
                      <select
                        value={formData.jenbacherLimpios}
                        onChange={(e) => handleInputChange('jenbacherLimpios', e.target.value)}
                        className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Seleccionar...</option>
                        <option value="Sí">✅ Sí</option>
                        <option value="No">❌ No</option>
                        <option value="Parcialmente">⚠️ Parcialmente</option>
                      </select>
                    </div>
                  </div>

                  {/* Observaciones con micrófono */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      📝 Observaciones
                      <span className="text-xs text-gray-400">(Opcional - Usa el micrófono para dictar)</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={formData.observaciones}
                        onChange={(e) => handleInputChange('observaciones', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 pr-12 bg-white/5 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Agrega cualquier observación adicional sobre la limpieza... 🎤 ¡Prueba el micrófono!"
                      />
                      
                      {/* Botón de micrófono mejorado */}
                      <button
                        type="button"
                        onClick={handleVoiceRecording}
                        disabled={isTranscribing}
                        className={`absolute right-2 top-2 p-2 rounded-lg transition-all duration-200 ${
                          isRecording 
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                            : isTranscribing
                            ? 'bg-yellow-500 text-white animate-bounce'
                            : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          isRecording 
                            ? 'Detener grabación' 
                            : isTranscribing 
                            ? 'Transcribiendo...' 
                            : 'Grabar observación por voz'
                        }
                      >
                        {isRecording ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2"/>
                          </svg>
                        ) : isTranscribing ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v4"/>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 23h8"/>
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Mensajes de estado mejorados */}
                    {isRecording && (
                      <div className="text-red-400 text-sm mt-2 flex items-center bg-red-500/10 p-2 rounded border border-red-500/20">
                        <span className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></span>
                        🎙️ Grabando... Haz clic en el micrófono para detener
                      </div>
                    )}
                    
                    {isTranscribing && (
                      <div className="text-yellow-400 text-sm mt-2 flex items-center bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                        <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        🔄 Transcribiendo audio...
                      </div>
                    )}
                    
                    {voiceError && (
                      <div className="text-red-400 text-sm mt-2 flex items-center bg-red-500/10 p-2 rounded border border-red-500/20">
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                        </svg>
                        ⚠️ {voiceError}
                      </div>
                    )}
                  </div>

                  {/* Indicador de progreso */}
                  {(() => {
                    const camposCompletos = [
                      formData.pisosLimpios,
                      formData.ventanasLimpias,
                      formData.tablerosLimpios,
                      formData.estructurasLibres,
                      formData.equiposLimpios,
                      formData.jenbacherLimpios
                    ].filter(campo => campo.trim()).length;
                    
                    const progreso = (camposCompletos / 6) * 100;
                    
                    return (
                      <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-300">
                            📊 Progreso del formulario
                          </span>
                          <span className="text-sm text-white font-medium">
                            {camposCompletos}/6 campos completados
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3">
                          <div 
                            className={`h-3 rounded-full transition-all duration-300 ${
                              progreso === 100 ? 'bg-green-500' : 
                              progreso >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
                            }`}
                            style={{ width: `${progreso}%` }}
                          ></div>
                        </div>
                        {progreso === 100 && (
                          <p className="text-green-400 text-sm mt-2 flex items-center">
                            ✅ ¡Formulario completo! Listo para enviar
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Botón de envío mejorado */}
                  <div className="text-center">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-8 py-4 rounded-lg font-bold text-lg transition-all duration-200 ${
                        isSubmitting 
                          ? 'bg-gray-500 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 hover:shadow-lg hover:scale-105'
                      } text-white disabled:opacity-50`}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Enviando...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          🚀 Enviar Registro de Limpieza
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Historial de registros */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-8 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-6">Historial de Limpiezas</h2>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                    <p className="text-gray-300">Cargando registros...</p>
                  </div>
                ) : registros.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No hay registros de limpiezas disponibles
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/20">
                          <th className="px-4 py-3 text-gray-300 font-medium">Fecha</th>
                          <th className="px-4 py-3 text-gray-300 font-medium">Operador</th>
                          <th className="px-4 py-3 text-gray-300 font-medium">Estado General</th>
                          <th className="px-4 py-3 text-gray-300 font-medium">Observaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((registro, index) => {
                          const fecha = new Date(registro.fields['Fecha de creacion']).toLocaleString();
                          const operador = registro.fields['Realiza Registro'];
                          const observaciones = registro.fields['Observaciones'] || 'Sin observaciones';
                          
                          // Calcular estado general basado en las respuestas
                          const respuestas = [
                            registro.fields['Pisos y andén limpios (cuarto de control y área externa)'],
                            registro.fields['Ventanas limpias con retal húmedo?'],
                            registro.fields['Tableros limpios (con precaución en perillas y controles)?'],
                            registro.fields['Estructuras libres de polvo y telarañas?'],
                            registro.fields['Equipos (manómetros, tuberías, medidores) limpios?'],
                            registro.fields['Equipos Jenbacher limpios (cuidado con controles)?']
                          ].filter(r => r);

                          const sies = respuestas.filter(r => r === 'Sí').length;
                          const total = respuestas.length;
                          const porcentaje = total > 0 ? (sies / total) * 100 : 0;
                          
                          let estadoColor = 'text-red-400';
                          let estadoTexto = 'Deficiente';
                          
                          if (porcentaje >= 80) {
                            estadoColor = 'text-green-400';
                            estadoTexto = 'Excelente';
                          } else if (porcentaje >= 60) {
                            estadoColor = 'text-yellow-400';
                            estadoTexto = 'Bueno';
                          } else if (porcentaje >= 40) {
                            estadoColor = 'text-orange-400';
                            estadoTexto = 'Regular';
                          }

                          return (
                            <tr key={registro.id || index} className="border-b border-white/10">
                              <td className="px-4 py-3 text-white">{fecha}</td>
                              <td className="px-4 py-3 text-white">{operador}</td>
                              <td className={`px-4 py-3 font-medium ${estadoColor}`}>
                                {estadoTexto} ({Math.round(porcentaje)}%)
                              </td>
                              <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                                {observaciones}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </main>

          <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}