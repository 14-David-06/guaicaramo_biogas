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
      <TurnoGuard>
        <BackgroundLayout>
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 max-w-md w-full">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mb-3">Acceso Requerido</h1>
              <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder al registro de limpiezas.</p>
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                <span>Iniciar Sesión</span>
              </button>
            </div>
          </div>
        </BackgroundLayout>
      </TurnoGuard>
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
          
          <main className="pt-20 px-4 sm:px-6 lg:px-8 flex-grow">
            <div className="max-w-5xl mx-auto py-8">
              {/* Header profesional */}
              <div className="mb-8">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white">Control de Limpieza</h1>
                    <p className="text-gray-400 text-sm sm:text-base">Inspección y registro de áreas de la planta</p>
                  </div>
                </div>
              </div>

              {submitSuccess && (
                <div className="mb-6 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/30 rounded-xl text-green-400 flex items-center gap-3 shadow-lg">
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold">Registro enviado exitosamente</p>
                    <p className="text-sm text-green-300/70">El registro de limpieza ha sido guardado</p>
                  </div>
                </div>
              )}

              {/* Formulario de registro */}
              <form onSubmit={handleSubmit}>
                <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-slate-600/30 shadow-xl mb-8">
                  {/* Acciones rápidas */}
                  <div className="flex flex-wrap items-center gap-3 mb-8 pb-6 border-b border-slate-600/30">
                    <button
                      type="button"
                      onClick={marcarTodoComoSi}
                      className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 font-semibold flex items-center gap-2 shadow-lg hover:shadow-green-500/25 hover:scale-105"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Todo Conforme
                    </button>
                    <button
                      type="button"
                      onClick={limpiarFormulario}
                      className="px-5 py-2.5 bg-slate-600/50 text-white rounded-xl hover:bg-slate-500/50 transition-all duration-300 font-medium flex items-center gap-2 border border-slate-500/30"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reiniciar
                    </button>
                  </div>
                  
                  {/* Grid de inspecciones */}
                  <div className="space-y-4">
                    {/* Área 1: Pisos */}
                    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/20 hover:border-slate-500/40 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Pisos y Andén</p>
                            <p className="text-gray-400 text-xs sm:text-sm">Cuarto de control y área externa</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('pisosLimpios', 'Sí')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.pisosLimpios === 'Sí'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('pisosLimpios', 'No')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.pisosLimpios === 'No'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('pisosLimpios', 'Parcialmente')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.pisosLimpios === 'Parcialmente'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Área 2: Ventanas */}
                    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/20 hover:border-slate-500/40 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-cyan-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Ventanas</p>
                            <p className="text-gray-400 text-xs sm:text-sm">Limpieza con retal húmedo</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('ventanasLimpias', 'Sí')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.ventanasLimpias === 'Sí'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('ventanasLimpias', 'No')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.ventanasLimpias === 'No'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('ventanasLimpias', 'Parcialmente')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.ventanasLimpias === 'Parcialmente'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Área 3: Tableros */}
                    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/20 hover:border-slate-500/40 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Tableros Eléctricos</p>
                            <p className="text-gray-400 text-xs sm:text-sm">Precaución con perillas y controles</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('tablerosLimpios', 'Sí')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.tablerosLimpios === 'Sí'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('tablerosLimpios', 'No')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.tablerosLimpios === 'No'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('tablerosLimpios', 'Parcialmente')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.tablerosLimpios === 'Parcialmente'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Área 4: Estructuras */}
                    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/20 hover:border-slate-500/40 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Estructuras</p>
                            <p className="text-gray-400 text-xs sm:text-sm">Libres de polvo y telarañas</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('estructurasLibres', 'Sí')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.estructurasLibres === 'Sí'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('estructurasLibres', 'No')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.estructurasLibres === 'No'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('estructurasLibres', 'Parcialmente')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.estructurasLibres === 'Parcialmente'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Área 5: Equipos */}
                    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/20 hover:border-slate-500/40 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Equipos de Medición</p>
                            <p className="text-gray-400 text-xs sm:text-sm">Manómetros, tuberías, medidores</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('equiposLimpios', 'Sí')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.equiposLimpios === 'Sí'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('equiposLimpios', 'No')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.equiposLimpios === 'No'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('equiposLimpios', 'Parcialmente')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.equiposLimpios === 'Parcialmente'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Área 6: Jenbacher */}
                    <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/20 hover:border-slate-500/40 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">Equipos Jenbacher</p>
                            <p className="text-gray-400 text-xs sm:text-sm">Cuidado con controles sensibles</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleInputChange('jenbacherLimpios', 'Sí')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.jenbacherLimpios === 'Sí'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-green-500/20 hover:text-green-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('jenbacherLimpios', 'No')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.jenbacherLimpios === 'No'
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-red-500/20 hover:text-red-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            No
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInputChange('jenbacherLimpios', 'Parcialmente')}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                              formData.jenbacherLimpios === 'Parcialmente'
                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                                : 'bg-slate-600/50 text-gray-300 hover:bg-amber-500/20 hover:text-amber-400 border border-slate-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Parcial
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Observaciones */}
                  <div className="mt-6">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Observaciones <span className="text-gray-500">(Opcional)</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={formData.observaciones}
                        onChange={(e) => handleInputChange('observaciones', e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 pr-14 bg-slate-700/50 border border-slate-600/30 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all resize-none"
                        placeholder="Notas adicionales sobre la inspección..."
                      />
                      <button
                        type="button"
                        onClick={handleVoiceRecording}
                        disabled={isTranscribing}
                        className={`absolute right-3 top-3 p-2.5 rounded-xl transition-all duration-200 ${
                          isRecording 
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50' 
                            : isTranscribing
                            ? 'bg-amber-500 text-white'
                            : 'bg-blue-500/80 text-white hover:bg-blue-500 hover:shadow-lg'
                        } disabled:opacity-50`}
                        title={isRecording ? 'Detener' : isTranscribing ? 'Procesando...' : 'Grabar voz'}
                      >
                        {isRecording ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="6" width="12" height="12" rx="2"/>
                          </svg>
                        ) : isTranscribing ? (
                          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1c-1.66 0-3 1.34-3 3v8c0 1.66 1.34 3 3 3s3-1.34 3-3V4c0-1.66-1.34-3-3-3z"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 10v2a7 7 0 01-14 0v-2"/>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19v4M8 23h8"/>
                          </svg>
                        )}
                      </button>
                    </div>
                    {isRecording && (
                      <p className="text-red-400 text-xs mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></span>
                        Grabando... Haz clic para detener
                      </p>
                    )}
                    {voiceError && (
                      <p className="text-red-400 text-xs mt-2">{voiceError}</p>
                    )}
                  </div>

                  {/* Progreso y botón enviar */}
                  <div className="mt-8 pt-6 border-t border-slate-600/30">
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
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4 w-full sm:w-auto">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-400">Progreso:</span>
                              <span className={`text-lg font-bold ${progreso === 100 ? 'text-green-400' : 'text-white'}`}>
                                {camposCompletos}/6
                              </span>
                            </div>
                            <div className="flex-1 sm:w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-500 ${
                                  progreso === 100 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 
                                  progreso >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 
                                  'bg-gradient-to-r from-amber-500 to-yellow-500'
                                }`}
                                style={{ width: `${progreso}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-500 disabled:to-gray-600 text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-green-500/25 hover:scale-105 disabled:hover:scale-100 flex items-center justify-center gap-2"
                          >
                            {isSubmitting ? (
                              <>
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Enviando...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Guardar Inspección
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </form>

              {/* Historial de registros */}
              <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-slate-600/30 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white">Historial de Inspecciones</h2>
                </div>
                
                {loading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-blue-400/30 border-t-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando registros...</p>
                  </div>
                ) : registros.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-700/50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-400">No hay registros de inspección disponibles</p>
                    <p className="text-gray-500 text-sm mt-1">Los registros aparecerán aquí una vez enviados</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-600/30">
                          <th className="px-4 py-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Operador</th>
                          <th className="px-4 py-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                          <th className="px-4 py-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Notas</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {registros.map((registro, index) => {
                          const fecha = new Date(registro.fields['Fecha de creacion']).toLocaleString();
                          const operador = registro.fields['Realiza Registro'];
                          const observaciones = registro.fields['Observaciones'] || 'Sin notas';
                          
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
                          
                          let estadoBg = 'bg-red-500/20 text-red-400';
                          let estadoTexto = 'Deficiente';
                          
                          if (porcentaje >= 80) {
                            estadoBg = 'bg-green-500/20 text-green-400';
                            estadoTexto = 'Excelente';
                          } else if (porcentaje >= 60) {
                            estadoBg = 'bg-yellow-500/20 text-yellow-400';
                            estadoTexto = 'Bueno';
                          } else if (porcentaje >= 40) {
                            estadoBg = 'bg-orange-500/20 text-orange-400';
                            estadoTexto = 'Regular';
                          }

                          return (
                            <tr key={registro.id || index} className="hover:bg-slate-700/20 transition-colors">
                              <td className="px-4 py-4 text-white text-sm">{fecha}</td>
                              <td className="px-4 py-4">
                                <span className="text-white font-medium">{operador}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${estadoBg}`}>
                                  {porcentaje >= 80 ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : porcentaje >= 40 ? (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                  {estadoTexto} ({Math.round(porcentaje)}%)
                                </span>
                              </td>
                              <td className="px-4 py-4 text-gray-400 text-sm max-w-xs truncate">
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