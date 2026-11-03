'use client';

import Link from 'next/link';
import TurnoGuard from '@/components/TurnoGuard';
import VoiceRecorder from '@/components/VoiceRecorder';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useCallback } from 'react';
import { airtableService, BitacoraBiogas } from '@/utils/airtable';

const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Resumen con los registros ya cargados, que llegan del más reciente al más antiguo. */
function indicadoresBitacora(registros: BitacoraBiogas[]): Indicador[] {
  const fechas = registros
    .map((r) => (r.fields['Fecha de creacion'] ? new Date(r.fields['Fecha de creacion']) : null))
    .filter((f): f is Date => f !== null && !Number.isNaN(f.getTime()));
  const ultimo = registros[0];
  const fechaUltimo = ultimo?.fields['Fecha de creacion'] ? new Date(ultimo.fields['Fecha de creacion']) : null;
  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ahora.getDate() - 1);
  const hace7Dias = ahora.getTime() - 7 * 24 * 3600_000;
  const hoy = fechas.filter((f) => mismoDia(f, ahora)).length;
  const semana = fechas.filter((f) => f.getTime() >= hace7Dias).length;

  return [
    {
      etiqueta: 'Último registro',
      valor: fechaUltimo
        ? mismoDia(fechaUltimo, ahora)
          ? 'Hoy'
          : mismoDia(fechaUltimo, ayer)
            ? 'Ayer'
            : fechaUltimo.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
        : '—',
      detalle: fechaUltimo
        ? `${fechaUltimo.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}, ${ultimo.fields['Realiza Registro']}`
        : 'Aún no hay registros'
    },
    { etiqueta: 'Registros hoy', valor: hoy },
    { etiqueta: 'Últimos 7 días', valor: semana, unidad: semana === 1 ? 'registro' : 'registros' }
  ];
}

export default function BitacoraBiogasPage() {
  const { user: loggedInUser } = useAuth();

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
        <Pagina>
          <Aviso titulo="Inicie sesión para continuar">
            Para usar la bitácora, <Link href="/" className="font-semibold text-bosque underline underline-offset-2">ingrese con su cédula y contraseña</Link>.
          </Aviso>
        </Pagina>
      </TurnoGuard>
    );
  }

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!transcripcionOperador.trim()) {
      alert('Escriba o dicte lo que pasó en el turno antes de guardar.');
      return;
    }

    // Si no hay informe ejecutivo, intentamos generarlo una última vez rápido
    if (!informeEjecutivo.trim() && !generandoInforme) {
      const confirmSinInforme = confirm(
        'No se generó el informe ejecutivo.\n\n' +
        'Aceptar: guardar solo con la transcripción del operador.\n' +
        'Cancelar: volver y escribir el informe a mano.'
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

      alert('Registro guardado en la bitácora.');

      // Limpiar formulario
      setTranscripcionOperador('');
      setInformeEjecutivo('');

      // Recargar registros
      await cargarRegistros();

    } catch (error) {
      console.error('Error al crear registro:', error);
      alert('No se pudo guardar el registro. Revise la conexión e intente de nuevo.');
    } finally {
      setEnviandoFormulario(false);
    }
  };

  // Formatear fecha para mostrar
  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <TurnoGuard>
      <Pagina>
        <EncabezadoPagina
          titulo="Bitácora de biogás"
          descripcion="Lo que pasó en el turno: actividades, eventos y novedades de la planta."
        />

        {!cargandoRegistros && <Indicadores items={indicadoresBitacora(registrosBitacora)} />}

        {/* Formulario de registro */}
        <form onSubmit={handleSubmit}>
          <Panel as="div" titulo="Nuevo registro">
            <div className="space-y-6">
              {/* Transcripción del operador */}
              <div>
                <div className="flex items-end justify-between gap-4 mb-2">
                  <div>
                    <label htmlFor="transcripcion" className="block font-semibold text-tinta">
                      Qué pasó en el turno
                    </label>
                    <p className="text-sm text-tinta-suave">Dicte con el micrófono o escriba.</p>
                  </div>
                  <VoiceRecorder
                    onTranscription={handleTranscripcionOperador}
                    disabled={enviandoFormulario}
                    size="sm"
                  />
                </div>
                <textarea
                  id="transcripcion"
                  rows={6}
                  value={transcripcionOperador}
                  onChange={(e) => setTranscripcionOperador(e.target.value)}
                  className={claseCampo}
                  placeholder="Actividades, eventos y observaciones del turno"
                  required
                />
              </div>

              {/* Informe ejecutivo */}
              <div>
                <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 mb-2">
                  <div>
                    <label htmlFor="informe" className="block font-semibold text-tinta">
                      Informe ejecutivo
                    </label>
                    <p className="text-sm text-tinta-suave">
                      Se redacta solo a partir de lo que escribió arriba. Puede corregirlo antes de guardar.
                    </p>
                  </div>
                  {generandoInforme && (
                    <span className="flex items-center gap-2 text-sm font-semibold text-tinta-suave" role="status">
                      <span className="w-4 h-4 rounded-full border-2 border-linea border-t-bosque animate-spin" aria-hidden="true" />
                      Generando el informe…
                    </span>
                  )}
                </div>
                <textarea
                  id="informe"
                  rows={6}
                  value={informeEjecutivo}
                  onChange={(e) => setInformeEjecutivo(e.target.value)}
                  className={claseCampo}
                  placeholder="Aparece aquí cuando termine de escribir o dictar"
                  required
                />
              </div>

              <div className="pt-5 border-t border-linea flex justify-end">
                <button
                  type="submit"
                  disabled={enviandoFormulario || !transcripcionOperador.trim()}
                  className={`${claseBoton('primario', 'lg')} w-full sm:w-auto`}
                >
                  {enviandoFormulario ? 'Guardando…' : 'Guardar en la bitácora'}
                </button>
              </div>
            </div>
          </Panel>
        </form>

        {/* Registros anteriores */}
        <Panel
          titulo="Registros anteriores"
          acciones={
            <button
              type="button"
              onClick={() => setMostrarRegistros(!mostrarRegistros)}
              aria-expanded={mostrarRegistros}
              className={claseBoton('secundario')}
            >
              {mostrarRegistros ? 'Ocultar' : 'Ver registros'}
            </button>
          }
        >
          {!mostrarRegistros ? (
            <p className="text-tinta-suave">
              {cargandoRegistros
                ? 'Cargando registros…'
                : `${registrosBitacora.length} ${registrosBitacora.length === 1 ? 'registro' : 'registros'}. Toque “Ver registros” para leerlos.`}
            </p>
          ) : cargandoRegistros ? (
            <div className="flex items-center justify-center gap-3 py-8 text-tinta-suave" role="status">
              <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
              Cargando registros…
            </div>
          ) : registrosBitacora.length === 0 ? (
            <p className="text-tinta-suave py-6 text-center">Todavía no hay registros en la bitácora.</p>
          ) : (
            <div className="divide-y divide-linea border-t border-linea">
              {registrosBitacora.map((registro) => (
                <article key={registro.id} className="py-5">
                  <p className="flex flex-wrap gap-x-3 text-sm">
                    <span className="font-semibold text-tinta tabular-nums">
                      {formatearFecha(registro.fields['Fecha de creacion'])}
                    </span>
                    <span className="text-tinta-suave">{registro.fields['Realiza Registro']}</span>
                  </p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <h3 className={claseEtiqueta}>Transcripción del operador</h3>
                      <p className="text-tinta leading-relaxed whitespace-pre-line">
                        {registro.fields['Transcripción Operador']}
                      </p>
                    </div>
                    <div>
                      <h3 className={claseEtiqueta}>Informe ejecutivo</h3>
                      <p className="text-tinta leading-relaxed whitespace-pre-line">
                        {registro.fields['Informe ejecutivo']}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </Pagina>
    </TurnoGuard>
  );
}
