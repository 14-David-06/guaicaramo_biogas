'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { airtableService, MedicionBiodigestores, Biodigestor } from '@/utils/airtable';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';

export default function RegistroBiodigestoresPage() {
  const { user: loggedInUser, logout } = useAuth();

  // Estados del formulario
  const [ch4, setCh4] = useState<string>('');
  const [co2, setCo2] = useState<string>('');
  const [o2, setO2] = useState<string>('');
  const [h2s, setH2s] = useState<string>('');
  const [co, setCo] = useState<string>('');
  const [no, setNo] = useState<string>('');
  const [biodigestorSeleccionado, setBiodigestorSeleccionado] = useState<string>('');
  const [enviandoFormulario, setEnviandoFormulario] = useState(false);

  // Estados para datos
  const [biodigestores, setBiodigestores] = useState<Biodigestor[]>([]);
  const [mediciones, setMediciones] = useState<MedicionBiodigestores[]>([]);
  const [cargandoBiodigestores, setCargandoBiodigestores] = useState(true);
  const [cargandoMediciones, setCargandoMediciones] = useState(true);
  const [mostrarMediciones, setMostrarMediciones] = useState(false);

  // Hook para grabación de voz
  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording
  } = useVoiceRecording();

  // Cargar datos al montar el componente
  useEffect(() => {
    if (loggedInUser) {
      cargarBiodigestores();
      cargarMediciones();
      // Debug: explorar tabla desconocida
      airtableService.explorarTablaDesconocida();
    }
  }, [loggedInUser]);

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

  const cargarMediciones = async () => {
    setCargandoMediciones(true);
    try {
      const medicionesData = await airtableService.obtenerMedicionesBiodigestores();
      setMediciones(medicionesData);
    } catch (error) {
      console.error('Error cargando mediciones:', error);
    } finally {
      setCargandoMediciones(false);
    }
  };

  // Función para obtener el nombre del biodigestor a partir de su ID
  const obtenerNombreBiodigestor = (medicion: MedicionBiodigestores): string => {
    // Intentar obtener el ID del biodigestor desde el campo de relación
    const biodigestorId = medicion.fields['Biodigestor Monitoreado']?.[0];
    
    if (!biodigestorId) {
      return 'No especificado';
    }
    
    // Buscar el biodigestor en el listado cargado
    const biodigestor = biodigestores.find(b => b.id === biodigestorId);
    
    return biodigestor?.fields['Nombre Biodigestores'] || 'Biodigestor desconocido';
  };

  if (!loggedInUser) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 max-w-md w-full">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">Acceso Requerido</h1>
            <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder al registro de biodigestores.</p>
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
    );
  }

  // Manejar selección de biodigestor
  const handleBiodigestorChange = (biodigestorId: string) => {
    setBiodigestorSeleccionado(biodigestorId);
  };

  // Validar formulario
  const isFormValid = () => {
    return ch4.trim() !== '' && 
           co2.trim() !== '' && 
           o2.trim() !== '' && 
           h2s.trim() !== '' && 
           co.trim() !== '' && 
           no.trim() !== '' &&
           biodigestorSeleccionado.trim() !== '';
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      alert('Todos los campos de medición son obligatorios');
      return;
    }

    setEnviandoFormulario(true);

    try {
      await airtableService.crearMedicionBiodigestores(
        parseFloat(ch4),
        parseFloat(co2),
        parseFloat(o2),
        parseFloat(h2s),
        parseFloat(co),
        parseFloat(no),
        loggedInUser.nombre,
        biodigestorSeleccionado ? [biodigestorSeleccionado] : []
      );

      alert('✅ Medición de biodigestores registrada exitosamente');
      
      // Limpiar formulario
      setCh4('');
      setCo2('');
      setO2('');
      setH2s('');
      setCo('');
      setNo('');
      setBiodigestorSeleccionado('');
      
      // Recargar mediciones
      await cargarMediciones();

    } catch (error) {
      console.error('Error al registrar medición:', error);
      alert('❌ Error al registrar la medición. Intenta nuevamente.');
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
    console.log('Transcripción completa:', transcripcion);
    const texto = transcripcion.toLowerCase();
    
    // Patrones para extraer valores numéricos de gases
    const patrones = {
      ch4: /(?:ch4|metano)[^\d]*(\d+(?:[.,]\d+)?)/i,
      co2: /(?:co2|di[óo]xido|carbono)[^\d]*(\d+(?:[.,]\d+)?)/i,
      o2: /(?:o2|ox[íi]geno)[^\d]*(\d+(?:[.,]\d+)?)/i,
      h2s: /(?:h2s|h dos s|[áa]cido sulfh[íi]drico|sulfh[íi]drico|sulfuro(?: de hidr[óo]geno)?|gas sulfh[íi]drico)[^\d]*(\d+(?:[.,]\d+)?)/i,
      co: /\bco\b[^\d]*(\d+(?:[.,]\d+)?)/i,
      no: /(?:no|[óo]xido n[íi]trico)[^\d]*(\d+(?:[.,]\d+)?)/i
    };

    // Patrones alternativos si los primeros no funcionan
    const patronesAlternativos = {
      ch4: /(\d+(?:[.,]\d+)?)[^\d]*(?:ch4|metano)/i,
      co2: /(\d+(?:[.,]\d+)?)[^\d]*(?:co2|di[óo]xido|carbono)/i,
      o2: /(\d+(?:[.,]\d+)?)[^\d]*(?:o2|ox[íi]geno)/i,
      h2s: /(\d+(?:[.,]\d+)?)[^\d]*(?:h2s|h dos s|[áa]cido sulfh[íi]drico|sulfh[íi]drico|sulfuro(?: de hidr[óo]geno)?)/i,
      co: /(\d+(?:[.,]\d+)?)[^\d]*\bco\b/i,
      no: /(\d+(?:[.,]\d+)?)[^\d]*(?:no|[óo]xido n[íi]trico)/i
    };

    const valoresExtraidos: Record<string, string> = {};
    
    // Intentar con patrones principales
    Object.entries(patrones).forEach(([campo, patron]) => {
      const match = texto.match(patron);
      if (match && match[1]) {
        valoresExtraidos[campo] = match[1].replace(',', '.');
        console.log(`Encontrado ${campo}:`, match[1]);
      }
    });

    // Si no encontró suficientes valores, intentar con patrones alternativos
    if (Object.keys(valoresExtraidos).length < 3) {
      Object.entries(patronesAlternativos).forEach(([campo, patron]) => {
        if (!valoresExtraidos[campo]) {
          const match = texto.match(patron);
          if (match && match[1]) {
            valoresExtraidos[campo] = match[1].replace(',', '.');
            console.log(`Encontrado alternativo ${campo}:`, match[1]);
          }
        }
      });
    }

    console.log('Valores extraídos:', valoresExtraidos);

    // Buscar biodigestor mencionado en la transcripción
    let biodigestorEncontrado: Biodigestor | null = null;
    
    // Primero intentar coincidencia exacta
    for (const biodigestor of biodigestores) {
      const nombreBiodigestor = biodigestor.fields['Nombre Biodigestores']?.toLowerCase();
      if (nombreBiodigestor && texto.includes(nombreBiodigestor)) {
        biodigestorEncontrado = biodigestor;
        break;
      }
    }
    
    // Si no encontró coincidencia exacta, intentar con patrones más flexibles
    if (!biodigestorEncontrado) {
      const patronesBiodigestor = [
        /biodigestor\s*(\d+)/i,  // "biodigestor 1", "biodigestor 2", etc.
        /digestor\s*(\d+)/i,     // "digestor 1", "digestor 2", etc.
        /tanque\s*(\d+)/i,       // "tanque 1", "tanque 2", etc.
        /(\d+)/i                 // Solo números
      ];
      
      for (const patron of patronesBiodigestor) {
        const match = texto.match(patron);
        if (match && match[1]) {
          const numero = match[1];
          // Buscar biodigestor que contenga ese número en su nombre
          for (const biodigestor of biodigestores) {
            const nombreBiodigestor = biodigestor.fields['Nombre Biodigestores']?.toLowerCase();
            if (nombreBiodigestor && (nombreBiodigestor.includes(numero) || nombreBiodigestor.includes(` ${numero}`))) {
              biodigestorEncontrado = biodigestor;
              break;
            }
          }
          if (biodigestorEncontrado) break;
        }
      }
    }

    // Actualizar los campos con los valores encontrados
    if (Object.keys(valoresExtraidos).length > 0) {
      if (valoresExtraidos.ch4) setCh4(valoresExtraidos.ch4);
      if (valoresExtraidos.co2) setCo2(valoresExtraidos.co2);
      if (valoresExtraidos.o2) setO2(valoresExtraidos.o2);
      if (valoresExtraidos.h2s) setH2s(valoresExtraidos.h2s);
      if (valoresExtraidos.co) setCo(valoresExtraidos.co);
      if (valoresExtraidos.no) setNo(valoresExtraidos.no);
    }

    // Seleccionar biodigestor si se encontró uno
    if (biodigestorEncontrado) {
      setBiodigestorSeleccionado(biodigestorEncontrado.id);
    }
  };

  return (
    <BackgroundLayout>
      <div className="min-h-screen flex flex-col">
        <Navbar 
          onLoginClick={() => {}} 
          loggedInUser={loggedInUser}
          onLogout={logout}
        />
        
        <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
          <div className="max-w-6xl mx-auto py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-white mb-4">Registro de Medición de Biodigestores</h1>
              <p className="text-gray-300 text-lg">Registro de mediciones de gases en biodigestores</p>
            </div>

            {/* Formulario de Medición */}
            <form onSubmit={handleSubmit} className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-8">
            
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
            
            {/* Mediciones de Gases */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              
              {/* CH4 (Max) % */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CH4 (Max) % *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ch4}
                  onChange={(e) => setCh4(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* CO2 % */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CO2 % *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={co2}
                  onChange={(e) => setCo2(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* O2 % */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  O2 % *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={o2}
                  onChange={(e) => setO2(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* H2S */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  H2S *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={h2s}
                  onChange={(e) => setH2s(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                  required
                />
              </div>

              {/* CO */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CO *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={co}
                  onChange={(e) => setCo(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                  required
                />
              </div>

              {/* NO */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  NO *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={no}
                  onChange={(e) => setNo(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.0"
                  required
                />
              </div>
            </div>

            {/* Selección de Biodigestor */}
            <div className="mb-8">
              <label className="block text-lg font-medium text-white mb-4">
                Biodigestor Monitoreado *
              </label>
              {cargandoBiodigestores ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-gray-300">Cargando biodigestores...</span>
                </div>
              ) : biodigestores.length === 0 ? (
                <p className="text-gray-400">No hay biodigestores disponibles</p>
              ) : (
                <select
                  value={biodigestorSeleccionado}
                  onChange={(e) => handleBiodigestorChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar biodigestor...</option>
                  {biodigestores.map((biodigestor) => (
                    <option key={biodigestor.id} value={biodigestor.id}>
                      {biodigestor.fields['Nombre Biodigestores'] || biodigestor.fields['ID'] || biodigestor.id}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Botón de Envío */}
            <button
              type="submit"
              disabled={enviandoFormulario || !isFormValid()}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-300 transform ${
                enviandoFormulario || !isFormValid()
                  ? 'bg-gray-600 cursor-not-allowed text-gray-300'
                  : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white hover:scale-105'
              }`}
            >
              {enviandoFormulario ? '📝 Registrando medición...' : '📊 Registrar Medición'}
            </button>
          </form>

          {/* Botón para mostrar mediciones anteriores */}
          <div className="mb-6">
            <button
              onClick={() => setMostrarMediciones(!mostrarMediciones)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
            >
              {mostrarMediciones ? '📁 Ocultar Mediciones' : '📂 Ver Mediciones Anteriores'}
            </button>
          </div>

          {/* Lista de Mediciones Anteriores */}
          {mostrarMediciones && (
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30">
              <h2 className="text-2xl font-bold text-white mb-6">Mediciones Anteriores</h2>
              
              {cargandoMediciones ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                  <span className="ml-3 text-gray-300">Cargando mediciones...</span>
                </div>
              ) : mediciones.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No hay mediciones anteriores</p>
              ) : (
                <div className="space-y-6">
                  {mediciones.map((medicion) => {
                    const nombreBiodigestor = obtenerNombreBiodigestor(medicion);
                    
                    return (
                      <div key={medicion.id} className="bg-gradient-to-br from-gray-700/40 to-gray-800/40 rounded-xl p-6 border border-gray-600/40 shadow-lg hover:shadow-xl transition-shadow duration-300">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-5 gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xl">📅</span>
                              <p className="text-sm font-medium text-gray-300">
                                {formatearFecha(medicion.fields['Fecha Medicion'])}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">👤</span>
                              <p className="text-sm text-green-400 font-medium">
                                {medicion.fields['Realiza Registro']}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🏭</span>
                              <p className="text-sm font-semibold text-blue-400">
                                {nombreBiodigestor}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                          <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 p-4 rounded-lg border border-blue-500/30 hover:border-blue-400/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">💨</span>
                              <p className="text-xs font-medium text-blue-300">CH4 (Max) %</p>
                            </div>
                            <p className="text-xl font-bold text-blue-400">{medicion.fields['CH4 (Max) %']}</p>
                          </div>
                          <div className="bg-gradient-to-br from-green-600/20 to-green-500/10 p-4 rounded-lg border border-green-500/30 hover:border-green-400/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🌿</span>
                              <p className="text-xs font-medium text-green-300">CO2 %</p>
                            </div>
                            <p className="text-xl font-bold text-green-400">{medicion.fields['CO2 %']}</p>
                          </div>
                          <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-500/10 p-4 rounded-lg border border-yellow-500/30 hover:border-yellow-400/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">💡</span>
                              <p className="text-xs font-medium text-yellow-300">O2 %</p>
                            </div>
                            <p className="text-xl font-bold text-yellow-400">{medicion.fields['02 %']}</p>
                          </div>
                          <div className="bg-gradient-to-br from-red-600/20 to-red-500/10 p-4 rounded-lg border border-red-500/30 hover:border-red-400/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">⚠️</span>
                              <p className="text-xs font-medium text-red-300">H2S</p>
                            </div>
                            <p className="text-xl font-bold text-red-400">{medicion.fields['H2S']}</p>
                          </div>
                          <div className="bg-gradient-to-br from-orange-600/20 to-orange-500/10 p-4 rounded-lg border border-orange-500/30 hover:border-orange-400/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">🔥</span>
                              <p className="text-xs font-medium text-orange-300">CO</p>
                            </div>
                            <p className="text-xl font-bold text-orange-400">{medicion.fields['CO']}</p>
                          </div>
                          <div className="bg-gradient-to-br from-purple-600/20 to-purple-500/10 p-4 rounded-lg border border-purple-500/30 hover:border-purple-400/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">⚗️</span>
                              <p className="text-xs font-medium text-purple-300">NO</p>
                            </div>
                            <p className="text-xl font-bold text-purple-400">{medicion.fields['NO']}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

        <Footer />
      </div>
    </BackgroundLayout>
  );
}
