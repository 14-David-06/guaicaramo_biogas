'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useCallback } from 'react';
import { airtableService, Motor, Biodigestor } from '@/utils/airtable';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useRouter } from 'next/navigation';

export default function RegistroJerbacherPage() {
  const { user: loggedInUser, logout } = useAuth();
  const router = useRouter();

  // Estado para motores
  const [motoresValidos, setMotoresValidos] = useState<Motor[]>([]);
  const [motorSeleccionado, setMotorSeleccionado] = useState<string>('');
  const [cargandoMotores, setCargandoMotores] = useState(true);
  const [mensajeValidacion, setMensajeValidacion] = useState<string>('');
  const [enviandoFormulario, setEnviandoFormulario] = useState(false);

  // Estados para biodigestores
  const [biodigestores, setBiodigestores] = useState<Biodigestor[]>([]);
  const [biodigestoresSeleccionados, setBiodigestoresSeleccionados] = useState<string[]>([]);
  const [cargandoBiodigestores, setCargandoBiodigestores] = useState(true);

  // Hook para grabación de voz
  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording
  } = useVoiceRecording();

  const [parametros, setParametros] = useState({
    metano: '',
    oxigeno: '',
    dioxidoCarbono: '',
    acidoSulfidrico: '',
    potenciaGenerada: '',
    m3Biogas: '',
    presionBiofiltroEntrada: '',
    presionBiofiltroSalida: '',
    tempEntradaBiofiltro: '',
    tempSalidaBiofiltro: ''
  });

  // Función para verificar si un motor está encendido
  const verificarMotorEncendido = async (motorId: string): Promise<boolean> => {
    try {
      const ultimoEstado = await airtableService.obtenerUltimoEstadoMotor(motorId);
      return ultimoEstado?.fields['Estado Motor'] === 'Encendido';
    } catch (error) {
      console.error('Error verificando estado del motor:', error);
      return false;
    }
  };

  // Función para verificar si un motor tiene datos de monitoreo
  const verificarDatosMonitoreo = async (motorId: string): Promise<boolean> => {
    try {
      const ultimoMonitoreo = await airtableService.obtenerUltimoMonitoreoMotor(motorId);
      console.log(`🔍 Verificando monitoreo para motor ${motorId}:`, ultimoMonitoreo);
      return ultimoMonitoreo !== null;
    } catch (error) {
      console.error('Error verificando datos de monitoreo:', error);
      return false;
    }
  };

  // Función para validar motores
  const validarMotores = useCallback(async () => {
    setCargandoMotores(true);
    setMensajeValidacion('');
    
    try {
      const todosLosMotores = await airtableService.obtenerMotores();
      console.log('🔍 Total de motores encontrados:', todosLosMotores.length);
      
      const motoresCalificados: Motor[] = [];
      
      for (const motor of todosLosMotores) {
        const estaEncendido = await verificarMotorEncendido(motor.id);
        const tieneMonitoreo = await verificarDatosMonitoreo(motor.id);
        
        console.log(`🔍 Motor ${motor.fields['Nombre Motor']}:`, {
          id: motor.id,
          encendido: estaEncendido,
          tieneMonitoreo: tieneMonitoreo
        });
        
        if (estaEncendido && tieneMonitoreo) {
          motoresCalificados.push(motor);
        }
      }
      
      console.log('✅ Motores calificados:', motoresCalificados.length);
      setMotoresValidos(motoresCalificados);
      
      if (motoresCalificados.length === 0) {
        setMensajeValidacion(
          'No hay motores disponibles para registro. Para realizar el registro diario de Jenbacher, es necesario:'
        );
      } else {
        setMensajeValidacion('');
      }
      
    } catch (error) {
      console.error('Error validando motores:', error);
      setMensajeValidacion('Error al cargar información de los motores.');
    } finally {
      setCargandoMotores(false);
    }
  }, []);

  // useEffect para cargar motores al montar el componente
  useEffect(() => {
    validarMotores();
    cargarBiodigestores();
  }, [validarMotores]);

  // Función para cargar biodigestores
  const cargarBiodigestores = async () => {
    setCargandoBiodigestores(true);
    try {
      const biodigestoresData = await airtableService.obtenerBiodigestores();
      setBiodigestores(biodigestoresData);
    } catch (error) {
      console.error('Error cargando biodigestores:', error);
    } finally {
      setCargandoBiodigestores(false);
    }
  };

  // Función para manejar la selección de biodigestores
  const handleBiodigestorChange = (biodigestorId: string, isSelected: boolean) => {
    if (isSelected) {
      setBiodigestoresSeleccionados(prev => [...prev, biodigestorId]);
    } else {
      setBiodigestoresSeleccionados(prev => prev.filter(id => id !== biodigestorId));
    }
  };

  // Función para manejar la grabación de voz
  const handleVoiceRecording = async () => {
    if (isRecording) {
      try {
        const transcripcion = await stopRecording();
        procesarTranscripcion(transcripcion);
      } catch (error) {
        console.error('Error al detener grabación:', error);
      }
    } else {
      try {
        await startRecording();
      } catch (error) {
        console.error('Error al iniciar grabación:', error);
      }
    }
  };

  // Función para procesar la transcripción y extraer valores
  const procesarTranscripcion = (transcripcion: string) => {
    const texto = transcripcion.toLowerCase();
    
    // Patrones más amplios para extraer valores numéricos
    const patrones = {
      metano: /(?:metano|ch4)[^\d]*(\d+(?:[.,]\d+)?)/i,
      oxigeno: /(?:ox[íi]geno|o2)[^\d]*(\d+(?:[.,]\d+)?)/i,
      dioxidoCarbono: /(?:di[óo]xido|co2|carbono)[^\d]*(\d+(?:[.,]\d+)?)/i,
      acidoSulfidrico: /(?:[áa]cido|h2s|sulfh[íi]drico|sulfuro)[^\d]*(\d+(?:[.,]\d+)?)/i,
      potenciaGenerada: /(?:potencia|kw|kilovatios?)[^\d]*(\d+(?:[.,]\d+)?)/i,
      m3Biogas: /(?:m3|metros c[úu]bicos|biogas|biog[áa]s)[^\d]*(\d+(?:[.,]\d+)?)/i,
      presionBiofiltroEntrada: /(?:presi[óo]n[^\d]*(?:entrada|ingreso|biofiltro entrada))[^\d]*(\d+(?:[.,]\d+)?)/i,
      presionBiofiltroSalida: /(?:presi[óo]n[^\d]*(?:salida|egreso|biofiltro salida))[^\d]*(\d+(?:[.,]\d+)?)/i,
      tempEntradaBiofiltro: /(?:temperatura[^\d]*(?:entrada|ingreso|biofiltro entrada))[^\d]*(\d+(?:[.,]\d+)?)/i,
      tempSalidaBiofiltro: /(?:temperatura[^\d]*(?:salida|egreso|biofiltro salida))[^\d]*(\d+(?:[.,]\d+)?)/i
    };

    // Patrones alternativos si los primeros no funcionan
    const patronesAlternativos = {
      metano: /(\d+(?:[.,]\d+)?)[^\d]*(?:metano|ch4)/i,
      oxigeno: /(\d+(?:[.,]\d+)?)[^\d]*(?:ox[íi]geno|o2)/i,
      dioxidoCarbono: /(\d+(?:[.,]\d+)?)[^\d]*(?:di[óo]xido|co2|carbono)/i,
      acidoSulfidrico: /(\d+(?:[.,]\d+)?)[^\d]*(?:[áa]cido|h2s|sulfh[íi]drico)/i,
      potenciaGenerada: /(\d+(?:[.,]\d+)?)[^\d]*(?:potencia|kw|kilovatios?)/i,
      m3Biogas: /(\d+(?:[.,]\d+)?)[^\d]*(?:m3|metros c[úu]bicos|biogas)/i
    };

    const valoresExtraidos: Record<string, string> = {};
    
    // Intentar con patrones principales
    Object.entries(patrones).forEach(([campo, patron]) => {
      const match = texto.match(patron);
      if (match && match[1]) {
        valoresExtraidos[campo] = match[1].replace(',', '.');
      }
    });

    // Si no encontró suficientes valores, intentar con patrones alternativos
    if (Object.keys(valoresExtraidos).length < 3) {
      Object.entries(patronesAlternativos).forEach(([campo, patron]) => {
        if (!valoresExtraidos[campo]) {
          const match = texto.match(patron);
          if (match && match[1]) {
            valoresExtraidos[campo] = match[1].replace(',', '.');
          }
        }
      });
    }

    // Actualizar los campos con los valores encontrados
    if (Object.keys(valoresExtraidos).length > 0) {
      setParametros(prev => ({
        ...prev,
        ...valoresExtraidos
      }));
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
              <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder al registro Jerbacher.</p>
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

  const handleInputChange = (field: string, value: string) => {
    setParametros(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!motorSeleccionado) {
      alert('Por favor selecciona un motor antes de continuar.');
      return;
    }
    
    if (motoresValidos.length === 0) {
      alert('No hay motores válidos disponibles para el registro.');
      return;
    }
    
    setEnviandoFormulario(true);
    
    const motorSeleccionadoInfo = motoresValidos.find(m => m.id === motorSeleccionado);
    
    try {
      // Convertir strings a números para la validación
      const parametrosNumericos = {
        metano: parseFloat(parametros.metano) || 0,
        oxigeno: parseFloat(parametros.oxigeno) || 0,
        dioxidoCarbono: parseFloat(parametros.dioxidoCarbono) || 0,
        acidoSulfidrico: parseFloat(parametros.acidoSulfidrico) || 0,
        potenciaGenerada: parseFloat(parametros.potenciaGenerada) || 0,
        m3Biogas: parseFloat(parametros.m3Biogas) || 0,
        presionBiofiltroEntrada: parseFloat(parametros.presionBiofiltroEntrada) || 0,
        presionBiofiltroSalida: parseFloat(parametros.presionBiofiltroSalida) || 0,
        tempEntradaBiofiltro: parseFloat(parametros.tempEntradaBiofiltro) || 0,
        tempSalidaBiofiltro: parseFloat(parametros.tempSalidaBiofiltro) || 0
      };

      // Validar que los valores estén en rangos apropiados
      if (parametrosNumericos.metano < 0 || parametrosNumericos.metano > 100) {
        alert('El porcentaje de metano debe estar entre 0 y 100%');
        return;
      }
      
      if (parametrosNumericos.oxigeno < 0 || parametrosNumericos.oxigeno > 100) {
        alert('El porcentaje de oxígeno debe estar entre 0 y 100%');
        return;
      }
      
      if (parametrosNumericos.dioxidoCarbono < 0 || parametrosNumericos.dioxidoCarbono > 100) {
        alert('El porcentaje de dióxido de carbono debe estar entre 0 y 100%');
        return;
      }

      console.log('Enviando registro a Airtable...');
      
      // Obtener los IDs necesarios para el registro
      const ultimoEstado = await airtableService.obtenerUltimoEstadoMotor(motorSeleccionado);
      const ultimoMonitoreo = await airtableService.obtenerUltimoMonitoreoMotor(motorSeleccionado);
      
      if (!ultimoEstado || !ultimoMonitoreo) {
        alert('❌ Error: No se pueden obtener los datos necesarios del motor');
        return;
      }

      if (biodigestoresSeleccionados.length === 0) {
        alert('❌ Debes seleccionar al menos un biodigestor');
        return;
      }
      
      const resultado = await airtableService.crearRegistroDiariosJenbacher(
        loggedInUser?.nombre || 'Usuario desconocido',
        ultimoEstado.id!,
        ultimoMonitoreo.id!,
        biodigestoresSeleccionados,
        parametrosNumericos
      );

      console.log('Registro exitoso:', resultado);
      
      alert(`✅ Parámetros registrados exitosamente para el motor: ${motorSeleccionadoInfo?.fields['Nombre Motor']}`);
      
      // Limpiar el formulario
      setParametros({
        metano: '',
        oxigeno: '',
        dioxidoCarbono: '',
        acidoSulfidrico: '',
        potenciaGenerada: '',
        m3Biogas: '',
        presionBiofiltroEntrada: '',
        presionBiofiltroSalida: '',
        tempEntradaBiofiltro: '',
        tempSalidaBiofiltro: ''
      });
      setMotorSeleccionado('');
      setBiodigestoresSeleccionados([]);
      
    } catch (error) {
      console.error('Error al registrar parámetros:', error);
      alert('❌ Error al registrar los parámetros. Por favor intenta nuevamente.');
    } finally {
      setEnviandoFormulario(false);
    }
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
              <h1 className="text-4xl font-bold text-white mb-4">Registro Jerbacher</h1>
              <p className="text-gray-300 text-lg">Parámetros diarios del sistema de biogás</p>
            </div>

            {/* Formulario de Registro */}
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-8">
              
              {/* Selector de Motor */}
              <div className="mb-8 p-6 bg-gradient-to-r from-blue-800/20 to-blue-900/20 rounded-lg border border-blue-600/30">
                <h3 className="text-lg font-semibold text-white mb-4">🏭 Selección de Motor</h3>
                
                {cargandoMotores ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                    <span className="ml-3 text-gray-300">Validando motores disponibles...</span>
                  </div>
                ) : mensajeValidacion ? (
                  <div className="bg-yellow-800/50 border border-yellow-600/50 rounded-lg p-6">
                    <div className="flex items-start">
                      <svg className="w-6 h-6 text-yellow-400 mr-3 mt-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                      </svg>
                      <div>
                        <p className="text-yellow-200 font-medium mb-3">{mensajeValidacion}</p>
                        <div className="space-y-2">
                          <div className="flex items-center text-sm text-yellow-100">
                            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                            <span>Verificar que al menos un motor esté <strong>encendido</strong></span>
                          </div>
                          <div className="flex items-center text-sm text-yellow-100">
                            <span className="inline-block w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                            <span>Completar el <strong>registro de monitoreo</strong> del motor</span>
                          </div>
                          <div className="mt-4 p-3 bg-blue-800/30 border border-blue-600/30 rounded-lg">
                            <p className="text-blue-200 text-sm mb-3">
                              💡 <strong>Sugerencia:</strong> Ve primero a &quot;Monitoreo de Motores&quot; para encender un motor y registrar sus datos de monitoreo.
                            </p>
                            <button
                              type="button"
                              onClick={() => router.push('/monitoreo-motores')}
                              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
                            >
                              🚀 Ir a Monitoreo de Motores
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Motor para registro diario *
                    </label>
                    <select
                      value={motorSeleccionado}
                      onChange={(e) => setMotorSeleccionado(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Selecciona un motor</option>
                      {motoresValidos.map((motor) => (
                        <option key={motor.id} value={motor.id}>
                          {motor.fields['Nombre Motor']} - Encendido ✅
                        </option>
                      ))}
                    </select>
                    {motoresValidos.length > 0 && (
                      <p className="text-sm text-green-400 mt-2">
                        ✅ {motoresValidos.length} motor(es) disponible(s) para registro
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Selector de Biodigestores - Solo mostrar si hay motores válidos */}
              {motoresValidos.length > 0 && (
                <div className="mb-8 p-6 bg-gradient-to-r from-green-800/20 to-green-900/20 rounded-lg border border-green-600/30">
                  <h3 className="text-lg font-semibold text-white mb-4">🏭 Selección de Biodigestores</h3>
                  
                  {cargandoBiodigestores ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
                      <span className="ml-3 text-gray-300">Cargando biodigestores...</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-300 mb-4">
                        Selecciona los biodigestores que están siendo utilizados para este registro:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {biodigestores.map((biodigestor) => (
                          <label 
                            key={biodigestor.id} 
                            className="flex items-center p-3 bg-gray-700/50 rounded-lg hover:bg-gray-600/50 transition-colors cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={biodigestoresSeleccionados.includes(biodigestor.id)}
                              onChange={(e) => handleBiodigestorChange(biodigestor.id, e.target.checked)}
                              className="mr-3 h-4 w-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                            />
                            <span className="text-white text-sm">
                              {biodigestor.fields['Nombre Biodigestores']}
                            </span>
                          </label>
                        ))}
                      </div>
                      {biodigestoresSeleccionados.length > 0 && (
                        <p className="text-sm text-green-400 mt-3">
                          ✅ {biodigestoresSeleccionados.length} biodigestor(es) seleccionado(s)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Mostrar micrófono y campos solo si hay motores válidos */}
              {motoresValidos.length > 0 && (
                <>
                  {/* Botón de Micrófono */}
                  <div className="mb-6 flex justify-center">
                    <button
                      type="button"
                      onClick={handleVoiceRecording}
                      disabled={enviandoFormulario}
                      className={`flex items-center justify-center w-16 h-16 rounded-full transition-all duration-300 transform hover:scale-105 ${
                        isRecording 
                          ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
                          : isTranscribing
                            ? 'bg-yellow-600 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-500'
                      }`}
                    >
                      {isRecording ? (
                        <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/>
                        </svg>
                      ) : isTranscribing ? (
                        <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                      ) : (
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
                        </svg>
                      )}
                    </button>
                  </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Metano (CH4) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Metano (CH4) %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={parametros.metano}
                    onChange={(e) => handleInputChange('metano', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 65.50"
                  />
                </div>

                {/* Oxígeno (O2) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Oxígeno (O2) %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={parametros.oxigeno}
                    onChange={(e) => handleInputChange('oxigeno', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 2.50"
                  />
                </div>

                {/* Dióxido de Carbono (CO2) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Dióxido de Carbono (CO2) %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={parametros.dioxidoCarbono}
                    onChange={(e) => handleInputChange('dioxidoCarbono', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 30.25"
                  />
                </div>

                {/* Ácido Sulfhídrico (H2S) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Ácido Sulfhídrico (H2S) ppm
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parametros.acidoSulfidrico}
                    onChange={(e) => handleInputChange('acidoSulfidrico', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 150.75"
                  />
                </div>

                {/* Potencia Generada (Kw) */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Potencia Generada (Kw)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parametros.potenciaGenerada}
                    onChange={(e) => handleInputChange('potenciaGenerada', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 950.50"
                  />
                </div>

                {/* M3 de Biogás */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    M3 de Biogás (M3)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parametros.m3Biogas}
                    onChange={(e) => handleInputChange('m3Biogas', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 125.75"
                  />
                </div>

                {/* Presión Biofiltro Entrada */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Presión Biofiltro Entrada (cm de H2O)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parametros.presionBiofiltroEntrada}
                    onChange={(e) => handleInputChange('presionBiofiltroEntrada', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 15.25"
                  />
                </div>

                {/* Presión Biofiltro Salida */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Presión Biofiltro Salida (cm de H2O)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={parametros.presionBiofiltroSalida}
                    onChange={(e) => handleInputChange('presionBiofiltroSalida', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 12.50"
                  />
                </div>

                {/* Temperatura Entrada Biofiltro */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Temperatura Entrada Biofiltro (°C)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={parametros.tempEntradaBiofiltro}
                    onChange={(e) => handleInputChange('tempEntradaBiofiltro', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 38.75"
                  />
                </div>

                {/* Temperatura Salida Biofiltro */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Temperatura Salida Biofiltro (°C)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={parametros.tempSalidaBiofiltro}
                    onChange={(e) => handleInputChange('tempSalidaBiofiltro', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: 35.25"
                  />
                </div>
              </div>
                </>
              )}

              {/* Botón de Envío */}
              <button
                type="submit"
                disabled={cargandoMotores || motoresValidos.length === 0 || !motorSeleccionado || biodigestoresSeleccionados.length === 0 || enviandoFormulario}
                className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-300 transform ${
                  cargandoMotores || motoresValidos.length === 0 || !motorSeleccionado || biodigestoresSeleccionados.length === 0 || enviandoFormulario
                    ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white hover:scale-105'
                }`}
              >
                {enviandoFormulario
                  ? '📤 Enviando registro...'
                  : cargandoMotores 
                    ? '⏳ Validando motores...' 
                    : motoresValidos.length === 0 
                      ? '❌ No hay motores disponibles'
                      : !motorSeleccionado
                        ? '⚠️ Selecciona un motor'
                        : biodigestoresSeleccionados.length === 0
                          ? '⚠️ Selecciona biodigestores'
                          : '📊 Registrar Parámetros Diarios'
                }
              </button>
            </form>
          </div>
        </main>

        <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}