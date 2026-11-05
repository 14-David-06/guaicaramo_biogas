'use client';

import { useCallback, useEffect, useState } from 'react';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { ORIGEN_CORTO, ahoraEnBogota, duracionMinutos, formatoDuracion, type Apagon, type RespuestaApagones } from '@/lib/apagones/tipos';
import CierreApagon from './CierreApagon';
import FormularioApagon from './FormularioApagon';
import TablaApagones from './TablaApagones';
import { formatoMomento, indicadoresApagones, nombreMes } from './resumen';

// Reporte de apagones de Guaicaramo: cuándo se fue la energía, cuándo volvió,
// por qué y qué quedó afectado. Un apagón se reporta en curso y se cierra
// después, o se reporta completo cuando ya pasó.

type Abierto = { tipo: 'reportar' } | { tipo: 'cerrar'; apagon: Apagon } | null;

function ApagonEnCurso({ apagon, ahora, puedeCerrar, onCerrar }: {
  apagon: Apagon;
  ahora: string;
  puedeCerrar: boolean;
  onCerrar: () => void;
}) {
  const detalles = [
    apagon.origen && `Origen: ${ORIGEN_CORTO[apagon.origen]}`,
    apagon.alcance,
    apagon.reporta && `reportó ${apagon.reporta.split(' ')[0]}`
  ].filter(Boolean);
  return (
    <div role="alert" className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between bg-rojo-claro border border-rojo-borde border-l-4 border-l-rojo rounded-xl px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="relative mt-2 flex h-3 w-3 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-rojo opacity-60 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rojo" />
        </span>
        <div>
          <p className="font-condensada font-bold text-2xl text-rojo leading-tight">
            Sin energía desde el {formatoMomento(apagon.inicio)}
          </p>
          <p className="text-tinta">
            Lleva <span className="font-semibold tabular-nums">{formatoDuracion(duracionMinutos(apagon, ahora))}</span>
            {detalles.length > 0 && <span className="text-tinta-suave"> · {detalles.join(' · ')}</span>}
          </p>
        </div>
      </div>
      {puedeCerrar && (
        <button type="button" onClick={onCerrar} className={`${claseBoton('primario', 'lg')} shrink-0`}>
          Ya volvió la energía
        </button>
      )}
    </div>
  );
}

export default function ApagonesPage() {
  const { user } = useAuth();
  /** null = el mes en curso. */
  const [mes, setMes] = useState<string | null>(null);
  const [datos, setDatos] = useState<RespuestaApagones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const [ahora, setAhora] = useState(() => ahoraEnBogota());

  // La duración de un apagón en curso avanza sola.
  useEffect(() => {
    const reloj = setInterval(() => setAhora(ahoraEnBogota()), 30_000);
    return () => clearInterval(reloj);
  }, []);

  const cargar = useCallback(async (m: string | null) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/apagones${m ? `?mes=${m}` : ''}`);
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.detalle || resultado.error);
      setDatos(resultado);
      setAhora(ahoraEnBogota());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los apagones.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(mes);
  }, [cargar, mes]);

  const mesActual = ahora.slice(0, 7);
  const operador = user?.nombre ?? '';

  const abrir = (nuevo: Abierto) => {
    setMensaje(null);
    setAbierto(nuevo);
    if (nuevo) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const guardado = (texto: string, mesDelApagon?: string) => {
    setMensaje(texto);
    setAbierto(null);
    if (mesDelApagon && datos && mesDelApagon !== datos.mes) setMes(mesDelApagon);
    else cargar(mes);
  };

  return (
    <TurnoGuard>
      <Pagina ancho="amplio">
        <EncabezadoPagina
          titulo="Apagones"
          descripcion="Cortes de energía en Guaicaramo: cuándo se fue, cuándo volvió, por qué y qué quedó afectado."
          acciones={
            <>
              <div>
                <label htmlFor="mes" className={claseEtiqueta}>Apagones de</label>
                <input
                  id="mes"
                  type="month"
                  value={datos?.mes ?? ''}
                  max={mesActual}
                  onChange={(e) => {
                    setAbierto(null);
                    setMensaje(null);
                    setMes(e.target.value || null);
                  }}
                  className={`${claseCampo} w-auto`}
                />
              </div>
              {datos && abierto === null && (
                <button type="button" onClick={() => abrir({ tipo: 'reportar' })} disabled={!user} className={claseBoton('primario')}>
                  Reportar apagón
                </button>
              )}
            </>
          }
        >
          {datos && (
            <>
              <span className="font-semibold text-tinta">Apagones de {nombreMes(datos.mes)}</span>
              <span>
                Turno:{' '}
                {datos.turno ? <span className="font-semibold text-tinta">{datos.turno.operador || 'abierto'}</span> : 'sin turno abierto'}
              </span>
            </>
          )}
        </EncabezadoPagina>

        {mensaje && <Aviso tono="exito">{mensaje}</Aviso>}
        {error && <Aviso tono="error" titulo="No se pudieron cargar los apagones">{error}</Aviso>}

        {datos?.enCurso
          .filter((a) => !(abierto?.tipo === 'cerrar' && abierto.apagon.id === a.id))
          .map((a) => (
            <ApagonEnCurso key={a.id} apagon={a} ahora={ahora} puedeCerrar={!!user} onCerrar={() => abrir({ tipo: 'cerrar', apagon: a })} />
          ))}

        {datos && abierto?.tipo === 'reportar' && (
          <FormularioApagon
            motores={datos.motores}
            hayEnCurso={datos.enCurso.length > 0}
            operador={operador}
            onCancelar={() => setAbierto(null)}
            onGuardado={guardado}
          />
        )}
        {abierto?.tipo === 'cerrar' && (
          <CierreApagon
            key={abierto.apagon.id}
            apagon={abierto.apagon}
            operador={operador}
            onCancelar={() => setAbierto(null)}
            onGuardado={(texto) => guardado(texto)}
          />
        )}

        {datos && <Indicadores items={indicadoresApagones(datos, ahora)} />}

        {cargando && !datos ? (
          <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
            <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
            Cargando los apagones…
          </div>
        ) : datos ? (
          <Panel titulo={`Apagones de ${nombreMes(datos.mes)}`} descripcion="Del más reciente al más antiguo. Los que siguen en curso aparecen en rojo.">
            <TablaApagones
              apagones={datos.apagones}
              motores={datos.motores}
              ahora={ahora}
              puedeCerrar={!!user}
              onCerrar={(a) => abrir({ tipo: 'cerrar', apagon: a })}
            />
          </Panel>
        ) : null}
      </Pagina>
    </TurnoGuard>
  );
}
