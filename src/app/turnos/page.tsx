'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { airtableService, TurnoOperador, Motor, EstadoMotor } from '@/utils/airtable';

// Field IDs desde variables de entorno
const FIELD_IDS = {
  ID_OPERADOR: process.env.NEXT_PUBLIC_FIELD_ID_OPERADOR!,
  REALIZA_REGISTRO: process.env.NEXT_PUBLIC_FIELD_REALIZA_REGISTRO!,
  FECHA_INICIO: process.env.NEXT_PUBLIC_FIELD_FECHA_INICIO!
};

interface MotorConEstado {
  motor: Motor;
  ultimoEstado: EstadoMotor | null;
}

// Debug: Mostrar field IDs
console.log('🔍 DEBUG FIELD IDS en turnos/page.tsx:', FIELD_IDS);

export default function TurnosPage() {
  const { user: loggedInUser, logout } = useAuth();
  const router = useRouter();
  const [turnoActivo, setTurnoActivo] = useState<TurnoOperador | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [motoresConEstado, setMotoresConEstado] = useState<MotorConEstado[]>([]);
  const [mostrarResumenMotores, setMostrarResumenMotores] = useState(false);
  const [cargandoMotores, setCargandoMotores] = useState(false);

  // Verificar si hay un turno activo al cargar la página
  useEffect(() => {
    if (loggedInUser) {
      verificarTurnoActivo();
    }
  }, [loggedInUser]);

  // Debug: Mostrar datos del turno activo cuando cambien
  useEffect(() => {
    console.log('🔍 DEBUG - Turno activo actualizado:');
    console.log('- Turno completo:', turnoActivo);
    if (turnoActivo) {
      console.log('- Fields completos:', turnoActivo.fields);
      console.log('- Todas las propiedades del fields:', Object.keys(turnoActivo.fields));
      console.log('- REALIZA_REGISTRO field ID:', FIELD_IDS.REALIZA_REGISTRO);
      console.log('- REALIZA_REGISTRO valor:', turnoActivo.fields[FIELD_IDS.REALIZA_REGISTRO]);
      console.log('- FECHA_INICIO field ID:', FIELD_IDS.FECHA_INICIO);
      console.log('- FECHA_INICIO valor:', turnoActivo.fields[FIELD_IDS.FECHA_INICIO]);
      console.log('- ID_OPERADOR field ID:', FIELD_IDS.ID_OPERADOR);
      console.log('- ID_OPERADOR valor:', turnoActivo.fields[FIELD_IDS.ID_OPERADOR]);
      console.log('- Usuario logueado:', loggedInUser);
      
      // Mostrar TODOS los campos disponibles
      console.log('🆘 TODOS LOS CAMPOS DISPONIBLES:');
      Object.keys(turnoActivo.fields).forEach(key => {
        console.log(`  ${key}: ${turnoActivo.fields[key]}`);
      });
    }
  }, [turnoActivo, loggedInUser]);

  const verificarTurnoActivo = async () => {
    try {
      setIsLoading(true);
      const turno = await airtableService.obtenerTurnoActivo();
      setTurnoActivo(turno);
    } catch (error) {
      console.error('Error al verificar turno activo:', error);
      setError('Error al verificar el estado del turno');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAbrirTurno = async () => {
    console.log('\n=== ABRIR TURNO - INICIO ===');
    console.log('Usuario logueado:', loggedInUser);
    
    if (!loggedInUser) {
      console.log('❌ No hay usuario logueado');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      setCargandoMotores(true);
      
      console.log('🚀 Llamando a airtableService.crearTurno con:');
      console.log('- ID Usuario:', loggedInUser.id);
      console.log('- Nombre Usuario:', loggedInUser.nombre);
      
      const nuevoTurno = await airtableService.crearTurno(
        loggedInUser.id, 
        loggedInUser.nombre
      );
      
      console.log('✅ Turno creado exitosamente:', nuevoTurno);
      setTurnoActivo(nuevoTurno);
      
      // Obtener el estado actual de los motores
      console.log('🔍 Obteniendo estado actual de los motores...');
      const motores = await airtableService.obtenerMotores();
      
      const motoresData: MotorConEstado[] = [];
      for (const motor of motores) {
        try {
          const ultimoEstado = await airtableService.obtenerUltimoEstadoMotor(motor.id);
          motoresData.push({ motor, ultimoEstado });
        } catch (err) {
          console.error(`Error al obtener estado del motor ${motor.id}:`, err);
          motoresData.push({ motor, ultimoEstado: null });
        }
      }
      
      setMotoresConEstado(motoresData);
      setCargandoMotores(false);
      setMostrarResumenMotores(true);
      
    } catch (error) {
      console.error('❌ Error al abrir turno:', error);
      setError('Error al abrir el turno. Por favor, intenta nuevamente.');
      alert('Error al abrir el turno. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsLoading(false);
      console.log('=== ABRIR TURNO - FIN ===\n');
    }
  };

  const handleIrAMonitoreoMotores = () => {
    // Guardar información del resumen en sessionStorage para mostrar en monitoreo-motores
    const resumenMotores = {
      fechaTurno: new Date().toISOString(),
      operador: loggedInUser?.nombre,
      motoresEncendidos: motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Encendido').map(m => ({
        nombre: m.motor.fields['Nombre Motor'],
        modelo: m.motor.fields['Modelo Motor'],
        serie: m.motor.fields['Número Serie']
      })),
      motoresApagados: motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Apagado' || !m.ultimoEstado).map(m => ({
        nombre: m.motor.fields['Nombre Motor'],
        modelo: m.motor.fields['Modelo Motor'],
        serie: m.motor.fields['Número Serie']
      }))
    };
    
    sessionStorage.setItem('resumenInicioTurno', JSON.stringify(resumenMotores));
    router.push('/monitoreo-motores');
  };

  const handleCerrarTurno = async () => {
    if (!turnoActivo?.id || !loggedInUser) {
      console.log('❌ No se puede cerrar: turno o usuario no disponible');
      return;
    }
    
    // VERIFICACIÓN ESTRICTA: Solo el operador que abrió el turno puede cerrarlo
    const nombreOperadorTurno = turnoActivo.fields['Realiza Registro'] || turnoActivo.fields['Nombre del Operador'];
    const nombreUsuarioLogueado = loggedInUser.nombre;
    
    console.log('🔍 DEBUG - Verificando permisos para cerrar:');
    console.log('- Operador del turno:', nombreOperadorTurno);
    console.log('- Usuario actual:', nombreUsuarioLogueado);
    console.log('- Coinciden?:', nombreOperadorTurno === nombreUsuarioLogueado);
    
    if (nombreOperadorTurno !== nombreUsuarioLogueado) {
      alert(`❌ ACCESO DENEGADO: Solo ${nombreOperadorTurno} puede cerrar este turno.`);
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      await airtableService.cerrarTurno(turnoActivo.id);
      
      // Limpiar el turno activo
      setTurnoActivo(null);
      
      // Mostrar mensaje de éxito
      alert(`✅ Turno cerrado exitosamente a las ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('Error al cerrar turno:', error);
      setError('Error al cerrar el turno. Por favor, intenta nuevamente.');
      alert('❌ Error al cerrar el turno. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
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
            <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para gestionar turnos.</p>
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

  return (
    <TurnoGuard allowTurnosPage={true}>
      <BackgroundLayout>
        <div className="min-h-screen flex flex-col">
          <Navbar 
            onLoginClick={() => {}} 
            loggedInUser={loggedInUser}
            onLogout={logout}
          />
      
      <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
        <div className="max-w-7xl mx-auto py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">Gestión de Turnos</h1>
            <p className="text-gray-300 text-lg">Controla los turnos operativos del sistema</p>
          </div>

          {/* Mensajes de error */}
          {error && (
            <div className="mb-8 bg-red-500/20 border border-red-400/30 rounded-xl p-4 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}

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
              {turnoActivo && turnoActivo.fields && (
                <div className="text-gray-300 space-y-2">
                  <p><span className="font-semibold text-green-400">👤 Operador en turno:</span> 
                    <span className="text-white text-lg ml-2">
                      {turnoActivo.fields['Realiza Registro'] || turnoActivo.fields['Nombre del Operador'] || 'ERROR: Sin operador'}
                    </span>
                  </p>
                  <p><span className="font-semibold text-blue-400">🕒 Hora de inicio:</span> 
                    <span className="text-white ml-2">
                      {turnoActivo.fields['Fecha Inicio']
                        ? new Date(turnoActivo.fields['Fecha Inicio'] as string).toLocaleString()
                        : 'ERROR: Sin fecha'
                      }
                    </span>
                  </p>
                </div>
              )}
              {isLoading && (
                <div className="text-gray-300">
                  <p>Cargando información del turno...</p>
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
                disabled={!!turnoActivo || isLoading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
              >
                {isLoading ? 'Procesando...' : turnoActivo ? 'Turno Ya Activo' : 'Abrir Turno'}
              </button>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-xl font-bold text-white mb-4">Cerrar Turno</h3>
              <p className="text-gray-300 mb-6">Finaliza el turno actual y registra las observaciones finales.</p>
              
              {/* Botón para cerrar turno - SOLO para el operador en turno */}
              {turnoActivo && loggedInUser && (() => {
                const nombreOperadorTurno = turnoActivo.fields['Realiza Registro'] || turnoActivo.fields['Nombre del Operador'];
                const nombreUsuarioLogueado = loggedInUser.nombre;
                const esElOperadorDelTurno = nombreOperadorTurno === nombreUsuarioLogueado;
                
                console.log('🔍 DEBUG - Botón cerrar turno:');
                console.log('- Operador del turno:', nombreOperadorTurno);
                console.log('- Usuario logueado:', nombreUsuarioLogueado);
                console.log('- Es el operador del turno?:', esElOperadorDelTurno);
                
                return (
                  <button
                    onClick={handleCerrarTurno}
                    disabled={!esElOperadorDelTurno || isLoading}
                    className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-300 transform ${
                      esElOperadorDelTurno && !isLoading
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 hover:scale-105 text-white'
                        : 'bg-gray-600 cursor-not-allowed text-gray-300'
                    }`}
                  >
                    {isLoading 
                      ? 'Cerrando Turno...' 
                      : esElOperadorDelTurno 
                        ? 'Cerrar Mi Turno' 
                        : `Solo ${nombreOperadorTurno || 'el operador'} puede cerrar`
                    }
                  </button>
                );
              })()}
              
              {!turnoActivo && (
                <button
                  disabled={true}
                  className="w-full bg-gray-600 cursor-not-allowed text-gray-300 px-6 py-3 rounded-lg font-medium"
                >
                  No Hay Turno Activo
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Resumen de Motores al Iniciar Turno */}
      {mostrarResumenMotores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-slate-600/50 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 rounded-t-2xl">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">¡Turno Iniciado Exitosamente!</h2>
                  <p className="text-green-100 text-sm">
                    {new Date().toLocaleString('es-CO', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Información del operador */}
              <div className="bg-slate-700/30 rounded-xl p-4 border border-slate-600/30">
                <p className="text-gray-300">
                  <span className="font-medium text-white">Operador en turno:</span> {loggedInUser?.nombre}
                </p>
              </div>

              {cargandoMotores ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-400 mr-4"></div>
                  <span className="text-white">Cargando estado de motores...</span>
                </div>
              ) : (
                <>
                  {/* Resumen rápido */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 rounded-xl p-4 border border-green-400/30 text-center">
                      <div className="text-3xl font-bold text-green-400">
                        {motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Encendido').length}
                      </div>
                      <p className="text-green-300 text-sm font-medium">Motores Encendidos</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl p-4 border border-red-400/30 text-center">
                      <div className="text-3xl font-bold text-red-400">
                        {motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Apagado' || !m.ultimoEstado).length}
                      </div>
                      <p className="text-red-300 text-sm font-medium">Motores Apagados</p>
                    </div>
                  </div>

                  {/* Lista de motores encendidos */}
                  <div>
                    <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center">
                      <span className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                      Motores que recibes ENCENDIDOS:
                    </h3>
                    <div className="space-y-2">
                      {motoresConEstado
                        .filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Encendido')
                        .map((m, idx) => (
                          <div key={idx} className="bg-green-500/10 border border-green-400/20 rounded-lg p-3 flex items-center">
                            <svg className="w-5 h-5 text-green-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-white font-medium">
                              {m.motor.fields['Nombre Motor']} - {m.motor.fields['Modelo Motor']} ({m.motor.fields['Número Serie']})
                            </span>
                          </div>
                        ))}
                      {motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Encendido').length === 0 && (
                        <p className="text-gray-400 italic text-sm">No hay motores encendidos actualmente</p>
                      )}
                    </div>
                  </div>

                  {/* Lista de motores apagados */}
                  <div>
                    <h3 className="text-lg font-semibold text-red-400 mb-3 flex items-center">
                      <span className="w-3 h-3 bg-red-400 rounded-full mr-2"></span>
                      Motores que recibes APAGADOS:
                    </h3>
                    <div className="space-y-2">
                      {motoresConEstado
                        .filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Apagado' || !m.ultimoEstado)
                        .map((m, idx) => (
                          <div key={idx} className="bg-red-500/10 border border-red-400/20 rounded-lg p-3 flex items-center">
                            <svg className="w-5 h-5 text-red-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="text-white font-medium">
                              {m.motor.fields['Nombre Motor']} - {m.motor.fields['Modelo Motor']} ({m.motor.fields['Número Serie']})
                            </span>
                          </div>
                        ))}
                      {motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Apagado' || !m.ultimoEstado).length === 0 && (
                        <p className="text-gray-400 italic text-sm">No hay motores apagados actualmente</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer con botones */}
            <div className="p-6 border-t border-slate-600/30 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleIrAMonitoreoMotores}
                className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span>Ir a Monitoreo de Motores</span>
              </button>
              <button
                onClick={() => setMostrarResumenMotores(false)}
                className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-xl font-medium transition-all duration-300"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}