'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { airtableService, TurnoOperador } from '@/utils/airtable';

// Field IDs desde variables de entorno
const FIELD_IDS = {
  ID_OPERADOR: process.env.NEXT_PUBLIC_FIELD_ID_OPERADOR!,
  REALIZA_REGISTRO: process.env.NEXT_PUBLIC_FIELD_REALIZA_REGISTRO!,
  FECHA_INICIO: process.env.NEXT_PUBLIC_FIELD_FECHA_INICIO!
};

// Debug: Mostrar field IDs
console.log('🔍 DEBUG FIELD IDS en turnos/page.tsx:', FIELD_IDS);

export default function TurnosPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [turnoActivo, setTurnoActivo] = useState<TurnoOperador | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      
      console.log('🚀 Llamando a airtableService.crearTurno con:');
      console.log('- ID Usuario:', loggedInUser.id);
      console.log('- Nombre Usuario:', loggedInUser.nombre);
      
      const nuevoTurno = await airtableService.crearTurno(
        loggedInUser.id, 
        loggedInUser.nombre
      );
      
      console.log('✅ Turno creado exitosamente:', nuevoTurno);
      setTurnoActivo(nuevoTurno);
      
      // Mostrar mensaje de éxito
      alert(`Turno abierto exitosamente a las ${new Date().toLocaleTimeString()}`);
    } catch (error) {
      console.error('❌ Error al abrir turno:', error);
      setError('Error al abrir el turno. Por favor, intenta nuevamente.');
      alert('Error al abrir el turno. Verifica tu conexión e intenta nuevamente.');
    } finally {
      setIsLoading(false);
      console.log('=== ABRIR TURNO - FIN ===\n');
    }
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
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para gestionar turnos.</p>
        </div>
      </div>
    );
  }

  return (
    <TurnoGuard allowTurnosPage={true}>
      <div className="min-h-screen bg-gray-900 flex flex-col">
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

      <Footer />
      </div>
    </TurnoGuard>
  );
}