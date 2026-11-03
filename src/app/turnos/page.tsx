'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton } from '@/components/ui/estilos';
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

/** "5 h 20 min" desde el inicio del turno hasta ahora. */
function duracionDesde(inicio: Date): string {
  const minutos = Math.max(0, Math.floor((Date.now() - inicio.getTime()) / 60000));
  const horas = Math.floor(minutos / 60);
  return horas > 0 ? `${horas} h ${minutos % 60} min` : `${minutos} min`;
}

const mayuscula = (texto: string) => texto.replace(/^./, (c) => c.toUpperCase());

function FilaMotor({ motor, encendido }: { motor: Motor; encendido: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3 border-t border-linea first:border-t-0">
      <span
        className={`w-3 h-3 rounded-full shrink-0 ${encendido ? 'bg-hoja' : 'border-2 border-linea-fuerte'}`}
        aria-hidden="true"
      />
      <span className="font-semibold text-tinta">{motor.fields['Nombre Motor']}</span>
      <span className="text-tinta-suave text-sm">
        {motor.fields['Modelo Motor']} · Serie {motor.fields['Número Serie']}
      </span>
    </li>
  );
}

export default function TurnosPage() {
  const { user: loggedInUser, isLoading: authLoading } = useAuth();
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
      setError('No se pudo consultar el turno. Revise la conexión y recargue la página.');
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
      setError('No se pudo abrir el turno. Revise la conexión e intente de nuevo.');
      alert('No se pudo abrir el turno. Revise la conexión e intente de nuevo.');
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
      alert(`Solo ${nombreOperadorTurno} puede cerrar este turno.`);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      await airtableService.cerrarTurno(turnoActivo.id);

      // Limpiar el turno activo
      setTurnoActivo(null);

      // Mostrar mensaje de éxito
      alert(`Turno cerrado a las ${new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}.`);
    } catch (error) {
      console.error('Error al cerrar turno:', error);
      setError('No se pudo cerrar el turno. Revise la conexión e intente de nuevo.');
      alert('No se pudo cerrar el turno. Revise la conexión e intente de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!loggedInUser && authLoading) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-tinta-suave" role="status">
          <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
          Verificando sesión…
        </div>
      </div>
    );
  }

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-fondo text-tinta flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-superficie border border-linea rounded-xl p-6 sm:p-8">
          <h1 className="font-condensada font-bold text-2xl sm:text-3xl mb-3">Inicie sesión para continuar</h1>
          <p className="text-tinta-suave">Para abrir o cerrar un turno, ingrese con su cédula y contraseña.</p>
          <Link href="/" className={`${claseBoton('primario', 'lg')} w-full mt-6`}>Ir a iniciar sesión</Link>
        </div>
      </div>
    );
  }

  // Datos del turno para el resumen y la acción
  const nombreOperadorTurno = turnoActivo?.fields
    ? turnoActivo.fields['Realiza Registro'] || turnoActivo.fields['Nombre del Operador']
    : undefined;
  const esElOperadorDelTurno = !!turnoActivo && nombreOperadorTurno === loggedInUser.nombre;
  const inicioTexto = turnoActivo?.fields?.['Fecha Inicio'];
  const inicio = inicioTexto ? new Date(inicioTexto as string) : null;
  const consultando = isLoading && !turnoActivo;

  if (turnoActivo) {
    console.log('🔍 DEBUG - Botón cerrar turno:');
    console.log('- Operador del turno:', nombreOperadorTurno);
    console.log('- Usuario logueado:', loggedInUser.nombre);
    console.log('- Es el operador del turno?:', esElOperadorDelTurno);
  }

  const resumen: Indicador[] = [
    {
      etiqueta: 'Estado del turno',
      valor: consultando ? '…' : turnoActivo ? 'Abierto' : 'Cerrado',
      detalle: consultando ? 'Consultando…' : turnoActivo ? 'Hay un operador en turno' : 'Nadie está en turno',
      tono: consultando ? 'neutro' : turnoActivo ? 'ok' : 'alerta'
    },
    {
      etiqueta: 'En turno',
      valor: <span className="text-2xl sm:text-3xl">{turnoActivo ? String(nombreOperadorTurno || 'Sin nombre') : '—'}</span>,
      detalle: turnoActivo ? (esElOperadorDelTurno ? 'Usted' : 'Otro operador') : undefined
    },
    {
      etiqueta: 'Desde',
      valor: inicio ? inicio.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—',
      detalle: inicio ? mayuscula(inicio.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })) : undefined
    },
    {
      etiqueta: 'Tiempo en turno',
      valor: inicio ? duracionDesde(inicio) : '—'
    }
  ];

  const encendidos = motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Encendido');
  const apagados = motoresConEstado.filter(m => m.ultimoEstado?.fields['Estado Motor'] === 'Apagado' || !m.ultimoEstado);

  return (
    <TurnoGuard allowTurnosPage={true}>
      <Pagina>
        <EncabezadoPagina
          titulo="Turnos"
          descripcion="Abra su turno al llegar a la planta y ciérrelo al entregar. Los registros quedan a nombre de quien está en turno."
        />

        <Indicadores items={resumen} />

        {error && <Aviso tono="error">{error}</Aviso>}

        <Panel
          titulo={turnoActivo ? (esElOperadorDelTurno ? 'Su turno está abierto' : 'Otro operador está en turno') : 'Abrir turno'}
          descripcion={
            consultando
              ? 'Consultando el estado del turno…'
              : turnoActivo
                ? esElOperadorDelTurno
                  ? 'Al terminar, cierre el turno para que el siguiente operador pueda abrir el suyo.'
                  : `Solo ${nombreOperadorTurno || 'el operador en turno'} puede cerrar este turno. Cuando lo cierre, usted podrá abrir el suyo.`
                : `Queda a nombre de ${loggedInUser.nombre}. Al abrirlo verá qué motores recibe encendidos y apagados.`
          }
        >
          {!consultando && !turnoActivo && (
            <button
              type="button"
              onClick={handleAbrirTurno}
              disabled={isLoading}
              className={`${claseBoton('primario', 'lg')} w-full sm:w-auto`}
            >
              {isLoading ? 'Abriendo turno…' : 'Abrir turno'}
            </button>
          )}
          {turnoActivo && esElOperadorDelTurno && (
            <button
              type="button"
              onClick={handleCerrarTurno}
              disabled={isLoading}
              className={`${claseBoton('primario', 'lg')} w-full sm:w-auto`}
            >
              {isLoading ? 'Cerrando turno…' : 'Cerrar mi turno'}
            </button>
          )}
        </Panel>
      </Pagina>

      {/* Resumen de motores al abrir el turno */}
      {mostrarResumenMotores && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-tinta/40">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-resumen-motores"
            className="bg-superficie rounded-xl border border-linea max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-5 sm:p-6 border-b border-linea">
              <h2 id="titulo-resumen-motores" className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">
                Turno abierto
              </h2>
              <p className="text-tinta-suave mt-1">
                {mayuscula(new Date().toLocaleString('es-CO', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }))}
                {' · '}
                <span className="font-semibold text-tinta">{loggedInUser?.nombre}</span>
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-5">
              {cargandoMotores ? (
                <div className="flex items-center justify-center gap-3 py-8 text-tinta-suave" role="status">
                  <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
                  Consultando el estado de los motores…
                </div>
              ) : (
                <>
                  <Indicadores
                    items={[
                      { etiqueta: 'Motores encendidos', valor: encendidos.length },
                      { etiqueta: 'Motores apagados', valor: apagados.length }
                    ]}
                  />

                  <section>
                    <h3 className="font-condensada font-bold text-lg text-tinta mb-2">Motores que recibe encendidos</h3>
                    {encendidos.length > 0 ? (
                      <ul className="border border-linea rounded-lg">
                        {encendidos.map((m, idx) => <FilaMotor key={idx} motor={m.motor} encendido />)}
                      </ul>
                    ) : (
                      <p className="text-tinta-suave">Ningún motor está encendido.</p>
                    )}
                  </section>

                  <section>
                    <h3 className="font-condensada font-bold text-lg text-tinta mb-2">Motores que recibe apagados</h3>
                    {apagados.length > 0 ? (
                      <ul className="border border-linea rounded-lg">
                        {apagados.map((m, idx) => <FilaMotor key={idx} motor={m.motor} encendido={false} />)}
                      </ul>
                    ) : (
                      <p className="text-tinta-suave">Ningún motor está apagado.</p>
                    )}
                  </section>
                </>
              )}
            </div>

            <div className="p-5 sm:p-6 border-t border-linea flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleIrAMonitoreoMotores}
                className={`${claseBoton('primario', 'lg')} flex-1`}
              >
                Ir a monitoreo de motores
              </button>
              <button
                type="button"
                onClick={() => setMostrarResumenMotores(false)}
                className={claseBoton('secundario', 'lg')}
              >
                Quedarme en turnos
              </button>
            </div>
          </div>
        </div>
      )}
    </TurnoGuard>
  );
}
