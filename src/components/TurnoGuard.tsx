'use client';

import { useEffect, useState } from 'react';
import { airtableService } from '@/utils/airtable';
import { useAuth } from '@/hooks/useAuth';

interface TurnoGuardProps {
  children: React.ReactNode;
  allowTurnosPage?: boolean; // Permitir acceso a la página de turnos
}

interface TurnoActivo {
  id: string;
  operadorId: string;
  nombreOperador: string;
  fechaInicio: string;
}

export default function TurnoGuard({ children, allowTurnosPage = false }: TurnoGuardProps) {
  const { user } = useAuth();
  const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verificarTurnoActivo = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const turno = await airtableService.obtenerTurnoActivo();
        
        if (turno && turno.fields) {
          // Usar los nombres reales de campos de Airtable
          const nombreOperadorTurno = turno.fields['Realiza Registro'] || turno.fields['Nombre del Operador'];
          const operadorIds = turno.fields['ID_Operador'] || [];
          const operadorId = Array.isArray(operadorIds) ? operadorIds[0] : operadorIds;
          
          setTurnoActivo({
            id: turno.id!,
            operadorId: String(operadorId),
            nombreOperador: String(nombreOperadorTurno || 'Operador desconocido'),
            fechaInicio: String(turno.fields['Fecha Inicio'] || new Date().toISOString())
          });
        } else {
          setTurnoActivo(null);
        }
      } catch (error) {
        console.error('Error verificando turno activo:', error);
        setError('Error al verificar el estado del turno');
      } finally {
        setLoading(false);
      }
    };

    verificarTurnoActivo();

    // Verificar cada 30 segundos
    const interval = setInterval(verificarTurnoActivo, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Mostrar loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-white">Verificando estado del turno...</p>
        </div>
      </div>
    );
  }

  // Mostrar error
  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // No hay usuario logueado - permitir acceso
  if (!user) {
    return <>{children}</>;
  }

  // Si estamos en la página de turnos, siempre permitir acceso
  if (allowTurnosPage) {
    return <>{children}</>;
  }

  // No hay turno activo - BLOQUEAR acceso (nadie puede usar el sistema sin turno)
  if (!turnoActivo) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-400/30 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-4">Sin Turno Activo</h1>
            
            <div className="text-gray-300 space-y-3 mb-6">
              <p className="font-semibold text-amber-400">Debes abrir un turno para acceder al sistema</p>
              <p className="text-sm">
                Todas las funciones de la plataforma requieren que haya un turno operativo activo. 
                Ve a la gestión de turnos para abrir un nuevo turno.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/turnos'}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                🚀 Ir a Gestión de Turnos
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Hay turno activo - verificar si es el operador del turno
  const esElOperadorDelTurno = turnoActivo.operadorId === user.id;

  // Si no es el operador del turno activo, bloquear acceso
  if (!esElOperadorDelTurno) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <div className="flex-grow flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-400/30 rounded-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-5V9m0 0V7m0 2h2M12 9H9m3-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-4">Acceso Restringido</h1>
            
            <div className="text-gray-300 space-y-3 mb-6">
              <p className="font-semibold">Hay un turno operativo activo</p>
              <div className="bg-gray-800/50 rounded-lg p-4 text-sm">
                <p><span className="text-gray-400">Operador en turno:</span> <span className="text-white font-medium">{turnoActivo.nombreOperador}</span></p>
                <p><span className="text-gray-400">Inicio del turno:</span> <span className="text-white">{new Date(turnoActivo.fechaInicio).toLocaleString()}</span></p>
              </div>
              <p className="text-sm">
                Solo el operador en turno puede acceder a las funciones del sistema. 
                Espera a que se cierre el turno actual para acceder.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => window.location.href = '/turnos'}
                className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Ver Estado de Turnos
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Es el operador del turno activo - permitir acceso
  return <>{children}</>;
}