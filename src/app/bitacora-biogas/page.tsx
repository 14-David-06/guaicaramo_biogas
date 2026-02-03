'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import VoiceRecorder from '@/components/VoiceRecorder';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useCallback } from 'react';
import { airtableService, BitacoraBiogas } from '@/utils/airtable';

export default function BitacoraBiogasPage() {
  const { user: loggedInUser, logout } = useAuth();

  // Estados del formulario
  const [transcripcionOperador, setTranscripcionOperador] = useState<string>('');
  const [informeEjecutivo, setInformeEjecutivo] = useState<string>('');
  const [enviandoFormulario, setEnviandoFormulario] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);

  // Estados para mostrar registros
  const [registrosBitacora, setRegistrosBitacora] = useState<BitacoraBiogas[]>([]);
  const [cargandoRegistros, setCargandoRegistros] = useState(true);
  const [mostrarRegistros, setMostrarRegistros] = useState(false);

  // Función para cargar registros
  const cargarRegistros = async () => {
    setCargandoRegistros(true);
    try {
      const registros = await airtableService.obtenerBitacoraBiogas();
      setRegistrosBitacora(registros);
    } catch (error) {
      console.error('Error cargando registros:', error);
    } finally {
      setCargandoRegistros(false);
    }
  };

  // Generar informe ejecutivo automáticamente usando IA
  const generarInformeEjecutivo = useCallback(async () => {
    if (!transcripcionOperador.trim() || !loggedInUser || generandoInforme) {
      return;
    }

    setGenerandoInforme(true);

    // Timeout de 10 segundos máximo
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: La IA tardó demasiado')), 10000)
    );

    const fetchPromise = fetch('/api/generar-informe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcripcion: transcripcionOperador,
        operador: loggedInUser.nombre,
        fecha: new Date().toISOString()
      }),
    });

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      if (!response.ok) {
        console.error('Error en la respuesta:', response.status, response.statusText);
        throw new Error(`Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      if (data.informe) {
        setInformeEjecutivo(data.informe);
      } else {
        throw new Error('No se recibió el informe en la respuesta');
      }

    } catch (error) {
      console.error('Error generando informe:', error);
      // En lugar de mostrar error, simplemente no poner nada para que el usuario pueda enviar sin informe
      setInformeEjecutivo('');
    } finally {
      setGenerandoInforme(false);
    }
  }, [transcripcionOperador, loggedInUser, generandoInforme]);

  // Cargar registros al montar el componente
  useEffect(() => {
    if (loggedInUser) {
      cargarRegistros();
    }
  }, [loggedInUser]);

  // Generar informe automáticamente cuando la transcripción cambie
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (transcripcionOperador.trim().length > 30 && !informeEjecutivo.trim() && !generandoInforme) {
        generarInformeEjecutivo();
      }
    }, 1500); // Reducido a 1.5 segundos

    return () => clearTimeout(timeoutId);
  }, [transcripcionOperador, informeEjecutivo, generandoInforme, generarInformeEjecutivo]);

  // Manejar transcripción de voz para transcripción del operador
  const handleTranscripcionOperador = (texto: string) => {
    setTranscripcionOperador(prev => prev + (prev ? ' ' : '') + texto);
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
              <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder a la bitácora de biogás.</p>
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

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transcripcionOperador.trim()) {
      alert('La transcripción del operador es obligatoria');
      return;
    }

    // Si no hay informe ejecutivo, intentamos generarlo una última vez rápido
    if (!informeEjecutivo.trim() && !generandoInforme) {
      const confirmSinInforme = confirm(
        '⚠️ No se ha generado el informe ejecutivo automáticamente. ¿Deseas:\n\n' +
        '• ACEPTAR: Enviar solo con la transcripción del operador\n' +
        '• CANCELAR: Escribir el informe ejecutivo manualmente'
      );
      
      if (!confirmSinInforme) {
        return; // Usuario decide escribir manualmente
      }
    }

    setEnviandoFormulario(true);

    try {
      // Si no hay informe ejecutivo, usar la transcripción como informe básico
      const informeFinal = informeEjecutivo.trim() || 
        `Informe basado en transcripción del operador:\n\n${transcripcionOperador.trim()}`;

      await airtableService.crearBitacoraBiogas(
        transcripcionOperador.trim(),
        informeFinal,
        loggedInUser.nombre
      );

      alert('✅ Registro de bitácora creado exitosamente');
      
      // Limpiar formulario
      setTranscripcionOperador('');
      setInformeEjecutivo('');
      
      // Recargar registros
      await cargarRegistros();

    } catch (error) {
      console.error('Error al crear registro:', error);
      alert(' Error al crear el registro. Intenta nuevamente.');
    } finally {
      setEnviandoFormulario(false);
    }
  };

  // Formatear fecha para mostrar
  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
              <h1 className="text-4xl font-bold text-white mb-4">Bitácora de Biogás</h1>
              <p className="text-gray-300 text-lg">Registro de actividades y eventos del sistema</p>
            </div>

            {/* Formulario de Registro */}
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-8">
              
              {/* Transcripción del Operador */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-lg font-medium text-white">
                    Transcripción del Operador *
                  </label>
                  <VoiceRecorder 
                    onTranscription={handleTranscripcionOperador}
                    disabled={enviandoFormulario}
                    size="md"
                  />
                </div>
                <textarea
                  rows={6}
                  value={transcripcionOperador}
                  onChange={(e) => setTranscripcionOperador(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Registra aquí las actividades, eventos y observaciones del turno..."
                  required
                />
                <p className="text-sm text-gray-400 mt-2">
                  Usa el micrófono para dictar directamente o escribe manualmente
                </p>
              </div>

              {/* Informe Ejecutivo */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-lg font-medium text-white">
                    Informe Ejecutivo *
                  </label>
                  <div className="flex items-center space-x-2">
                    {generandoInforme && (
                      <div className="flex items-center space-x-2 text-purple-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
                        <span className="text-sm">Generando informe...</span>
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={informeEjecutivo}
                  onChange={(e) => setInformeEjecutivo(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="El informe ejecutivo se generará automáticamente cuando completes la transcripción. Si no se genera, puedes enviar el registro sin él..."
                  required
                />
                <p className="text-sm text-gray-400 mt-2">
                  La IA generará automáticamente un resumen ejecutivo profesional basado en tu transcripción. Puedes editarlo después si es necesario.
                </p>
              </div>

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={enviandoFormulario || !transcripcionOperador.trim()}
                className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-300 transform ${
                  enviandoFormulario || !transcripcionOperador.trim()
                    ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white hover:scale-105'
                }`}
              >
                {enviandoFormulario ? '📝 Creando registro...' : '📋 Crear Registro de Bitácora'}
              </button>
            </form>

            {/* Botón para mostrar/ocultar registros anteriores */}
            <div className="mb-6">
              <button
                onClick={() => setMostrarRegistros(!mostrarRegistros)}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
              >
                {mostrarRegistros ? '📁 Ocultar Registros' : '📂 Ver Registros Anteriores'}
              </button>
            </div>

            {/* Lista de Registros Anteriores */}
            {mostrarRegistros && (
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30">
                <h2 className="text-2xl font-bold text-white mb-6">Registros Anteriores</h2>
                
                {cargandoRegistros ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                    <span className="ml-3 text-gray-300">Cargando registros...</span>
                  </div>
                ) : registrosBitacora.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No hay registros anteriores</p>
                ) : (
                  <div className="space-y-6">
                    {registrosBitacora.map((registro) => (
                      <div key={registro.id} className="bg-gray-700/30 rounded-lg p-6 border border-gray-600/30">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm text-gray-400">
                              {formatearFecha(registro.fields['Fecha de creacion'])}
                            </p>
                            <p className="text-sm text-green-400">
                              Operador: {registro.fields['Realiza Registro']}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <h4 className="text-white font-medium mb-2">Transcripción del Operador:</h4>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {registro.fields['Transcripción Operador']}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="text-white font-medium mb-2">Informe Ejecutivo:</h4>
                          <p className="text-gray-300 text-sm leading-relaxed">
                            {registro.fields['Informe ejecutivo']}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>

        <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}
