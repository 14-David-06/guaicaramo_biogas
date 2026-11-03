'use client';

import { useEffect, useState } from 'react';
import { airtableService } from '@/utils/airtable';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { claseBoton } from '@/components/ui/estilos';

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

export const PRIVILEGED_ROLES = [
  'Ingeniera - Jefe de planta',
  'Jefe director de planta',
  'Desarrollador',
  'CTO',
  'CEO'
];

// Pantallas de bloqueo: fondo claro, una tarjeta centrada y la acción que
// resuelve el bloqueo como botón principal.
function PantallaEstado({ titulo, children, acciones }: {
  titulo?: string;
  children: React.ReactNode;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-fondo text-tinta flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-superficie border border-linea rounded-xl p-6 sm:p-8">
        {titulo && <h1 className="font-condensada font-bold text-2xl sm:text-3xl mb-3">{titulo}</h1>}
        <div className="text-tinta-suave space-y-3">{children}</div>
        {acciones && <div className="mt-6 flex flex-col gap-2">{acciones}</div>}
      </div>
    </div>
  );
}

export default function TurnoGuard({ children, allowTurnosPage = false }: TurnoGuardProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [turnoActivo, setTurnoActivo] = useState<TurnoActivo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar si el usuario tiene rol privilegiado
  const isPrivilegedUser = user && PRIVILEGED_ROLES.includes(user.cargo);

  // Debug log
  console.log('🔒 TurnoGuard Debug:', {
    user: user?.nombre,
    cargo: user?.cargo,
    isPrivilegedUser,
    allowTurnosPage,
    authLoading,
    loading,
    turnoActivo: turnoActivo?.nombreOperador
  });

  useEffect(() => {
    const verificarTurnoActivo = async () => {
      if (!user) {
        console.log('🔒 TurnoGuard: No hay usuario, saltando verificación');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('🔒 TurnoGuard: Verificando turno activo...');
        const turno = await airtableService.obtenerTurnoActivo();
        console.log('🔒 TurnoGuard: Respuesta de turno:', turno);
        
        if (turno && turno.fields) {
          // Usar los nombres reales de campos de Airtable
          const nombreOperadorTurno = turno.fields['Realiza Registro'] || turno.fields['Nombre del Operador'];
          const operadorIds = turno.fields['ID_Operador'] || [];
          const operadorId = Array.isArray(operadorIds) ? operadorIds[0] : operadorIds;
          
          console.log('🔒 TurnoGuard: Turno activo encontrado para:', nombreOperadorTurno);
          
          setTurnoActivo({
            id: turno.id!,
            operadorId: String(operadorId),
            nombreOperador: String(nombreOperadorTurno || 'Operador desconocido'),
            fechaInicio: String(turno.fields['Fecha Inicio'] || new Date().toISOString())
          });
        } else {
          console.log('🔒 TurnoGuard: NO hay turno activo');
          setTurnoActivo(null);
        }
      } catch (error) {
        console.error('🔒 TurnoGuard Error:', error);
        setError('Error al verificar el estado del turno');
      } finally {
        setLoading(false);
      }
    };

    verificarTurnoActivo();
  }, [user]);

  // Mostrar loading mientras se verifica autenticación o turno
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-tinta-suave" role="status">
          <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
          {authLoading ? 'Verificando sesión…' : 'Verificando el turno…'}
        </div>
      </div>
    );
  }

  // Mostrar error
  if (error) {
    return (
      <PantallaEstado
        titulo="No se pudo verificar el turno"
        acciones={
          <button type="button" onClick={() => window.location.reload()} className={claseBoton('primario', 'lg')}>
            Reintentar
          </button>
        }
      >
        <p>{error}. Revise la conexión a internet y vuelva a intentar.</p>
      </PantallaEstado>
    );
  }

  // No hay usuario logueado - BLOQUEAR acceso y redirigir al login
  if (!user) {
    return (
      <PantallaEstado
        titulo="Inicie sesión para continuar"
        acciones={<Link href="/" className={claseBoton('primario', 'lg')}>Ir a iniciar sesión</Link>}
      >
        <p>Esta sección es solo para operadores registrados. Ingrese con su cédula y contraseña.</p>
      </PantallaEstado>
    );
  }

  // Si estamos en la página de turnos, siempre permitir acceso
  if (allowTurnosPage) {
    return <>{children}</>;
  }

  // Si el usuario tiene rol privilegiado, permitir acceso sin restricciones de turno
  if (isPrivilegedUser) {
    return <>{children}</>;
  }

  // No hay turno activo - BLOQUEAR acceso (nadie puede usar el sistema sin turno)
  if (!turnoActivo) {
    return (
      <PantallaEstado
        titulo="Abra un turno para empezar"
        acciones={
          <>
            <Link href="/turnos" className={claseBoton('primario', 'lg')}>Ir a turnos</Link>
            <Link href="/" className={claseBoton('secundario', 'lg')}>Volver al inicio</Link>
          </>
        }
      >
        <p>No hay un turno abierto en la planta. Los registros quedan a nombre del operador en turno, así que primero hay que abrirlo.</p>
      </PantallaEstado>
    );
  }

  // Hay turno activo - verificar si es el operador del turno
  const esElOperadorDelTurno = turnoActivo.operadorId === user.id;

  // Si no es el operador del turno activo, bloquear acceso
  if (!esElOperadorDelTurno) {
    return (
      <PantallaEstado
        titulo="Otro operador está en turno"
        acciones={
          <>
            <Link href="/turnos" className={claseBoton('primario', 'lg')}>Ver turnos</Link>
            <Link href="/" className={claseBoton('secundario', 'lg')}>Volver al inicio</Link>
          </>
        }
      >
        <dl className="bg-superficie-2 border border-linea rounded-lg p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-tinta-suave">En turno</dt>
          <dd className="font-semibold text-tinta">{turnoActivo.nombreOperador}</dd>
          <dt className="text-tinta-suave">Desde</dt>
          <dd className="text-tinta">{new Date(turnoActivo.fechaInicio).toLocaleString('es-CO')}</dd>
        </dl>
        <p>Solo quien está en turno puede registrar. Cuando cierre su turno, usted podrá abrir el suyo.</p>
      </PantallaEstado>
    );
  }

  // Es el operador del turno activo - permitir acceso
  return <>{children}</>;
}
