'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { formatearFechaCorta, formatearFechaLarga } from '@/lib/informe/fechas';
import { mensajeBloqueo } from '@/lib/planilla/operacion';
import type { FranjaPlanilla, HoraPlanilla, RespuestaPlanilla } from '@/lib/planilla/tipos';
import DatosOperacion from './DatosOperacion';
import FormularioHora from './FormularioHora';
import { indicadoresPlanilla } from './indicadores';
import TablaPlanilla from './TablaPlanilla';

// Registro Jenbacher como planilla horaria: reemplaza el formato en papel
// "Control diario a composición del biogás y potencia de Jenbacher" y al
// formulario anterior de un motor por envío.

function estiloFranja(f: FranjaPlanilla, actual: boolean, seleccionada: boolean): string {
  const base = 'rounded-lg border-2 px-1 py-2.5 text-center font-condensada font-bold text-lg tabular-nums transition-colors';
  const anillo = actual ? ' ring-2 ring-offset-2 ring-offset-superficie ring-bosque' : '';
  if (seleccionada) return `${base} bg-bosque border-bosque text-white${anillo}`;
  if (f.estado === 'registrada') return `${base} bg-hoja-claro border-hoja text-bosque-oscuro${anillo}`;
  if (f.registrable) return `${base} bg-ambar-claro border-ambar-borde text-ambar hover:bg-[#f7e4b5]${anillo}`;
  if (f.estado === 'pendiente') return `${base} bg-rojo-claro border-rojo-borde text-rojo${anillo}`;
  return `${base} bg-superficie border-dashed border-linea text-tinta-tenue${anillo}`;
}

const LEYENDA = [
  { texto: 'Registrada', clase: 'bg-hoja-claro border-hoja' },
  { texto: 'Por registrar', clase: 'bg-ambar-claro border-ambar-borde' },
  { texto: 'No se registró', clase: 'bg-rojo-claro border-rojo-borde' },
  { texto: 'Todavía no llega', clase: 'bg-superficie border-dashed border-linea' }
];

export default function RegistroJenbacherPage() {
  const { user: loggedInUser } = useAuth();
  /** null = la planilla en curso. */
  const [fecha, setFecha] = useState<string | null>(null);
  const [datos, setDatos] = useState<RespuestaPlanilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [horaAbierta, setHoraAbierta] = useState<HoraPlanilla | null>(null);
  const [vista, setVista] = useState<'captura' | 'planilla'>('captura');

  const cargar = useCallback(async (dia: string | null) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/planilla-horaria${dia ? `?fecha=${dia}` : ''}`);
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.detalle || resultado.error);
      setDatos(resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la planilla.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(fecha);
  }, [cargar, fecha]);

  const enCurso = datos !== null && datos.fecha === datos.fechaActual;

  const bloqueOperacion = datos && (
    <DatosOperacion
      datos={datos}
      operador={loggedInUser?.nombre ?? ''}
      onGuardado={(texto) => {
        setMensaje(texto);
        cargar(fecha);
      }}
    />
  );

  return (
    <TurnoGuard>
      <Pagina>
        <EncabezadoPagina
          titulo="Planilla horaria Jenbacher"
          descripcion="Composición del biogás en 3 puntos, biofiltro y potencia de cada motor, de 06:00 a 05:00."
          acciones={
            <>
              <div>
                <label htmlFor="fecha" className="block text-sm font-semibold text-tinta-suave mb-1">Planilla del</label>
                <input
                  id="fecha"
                  type="date"
                  value={datos?.fecha ?? ''}
                  max={datos?.fechaActual}
                  onChange={(e) => {
                    setHoraAbierta(null);
                    setMensaje(null);
                    setFecha(e.target.value || null);
                  }}
                  className={`${claseCampo} w-auto`}
                />
              </div>
              {!enCurso && datos && (
                <button type="button" onClick={() => setFecha(null)} className={claseBoton('secundario')}>
                  Volver a hoy
                </button>
              )}
            </>
          }
        >
          {datos && (
            <>
              <span className="font-semibold text-tinta">{formatearFechaLarga(datos.fecha).replace(/^./, (c) => c.toUpperCase())}</span>
              <span>
                Turno:{' '}
                {datos.turno ? <span className="font-semibold text-tinta">{datos.turno.operador || 'abierto'}</span> : 'sin turno abierto'}
              </span>
              {!datos.editable && <span>Planilla cerrada, solo consulta</span>}
            </>
          )}
        </EncabezadoPagina>

        {datos && <Indicadores items={indicadoresPlanilla(datos)} />}

        {datos?.bloqueo && (
          <Aviso tono="alerta" titulo="Esta planilla todavía no se puede empezar">
            <p>{mensajeBloqueo(datos.bloqueo.fechaAnterior, datos.bloqueo.motores)}</p>
            <button
              type="button"
              onClick={() => {
                setHoraAbierta(null);
                setMensaje(null);
                setFecha(datos.bloqueo!.fechaAnterior);
              }}
              className={`${claseBoton('secundario')} mt-3`}
            >
              Ir a la planilla del {formatearFechaCorta(datos.bloqueo.fechaAnterior)}
            </button>
          </Aviso>
        )}
        {mensaje && <Aviso tono="exito">{mensaje}</Aviso>}
        {error && <Aviso tono="error" titulo="No se pudo cargar la planilla">{error}</Aviso>}

        <div className="inline-flex p-1 bg-superficie border border-linea rounded-lg" role="tablist" aria-label="Vista">
          {([['captura', 'Registrar por hora'], ['planilla', 'Planilla del día']] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={vista === valor}
              onClick={() => setVista(valor)}
              className={`px-4 py-2 rounded-md font-semibold transition-colors ${
                vista === valor ? 'bg-bosque text-white' : 'text-tinta-suave hover:text-tinta hover:bg-superficie-2'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {cargando && !datos ? (
          <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
            <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
            Cargando la planilla…
          </div>
        ) : datos && vista === 'planilla' ? (
          <>
            <TablaPlanilla datos={datos} />
            {bloqueOperacion}
          </>
        ) : datos ? (
          <>
            <Panel
              titulo="Horas del día"
              descripcion={
                !datos.editable
                  ? 'Esta planilla ya cerró. Solo se registra en la planilla en curso y en la anterior.'
                  : datos.bloqueo
                    ? `Las horas se habilitan cuando se cierren los datos de operación del ${formatearFechaCorta(datos.bloqueo.fechaAnterior)}.`
                    : 'Toque una hora en ámbar para registrarla. El anillo verde marca la hora en curso.'
              }
            >
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                {datos.franjas.map((f) => {
                  const actual = enCurso && f.hora === datos.horaActual;
                  const titulo =
                    f.estado === 'registrada' && f.lectura
                      ? `Registrada por ${f.lectura.operador} a las ${f.lectura.guardadaA}`
                      : f.registrable ? 'Pendiente: toque para registrar'
                      : f.estado === 'pendiente' ? 'Sin registro'
                      : 'Todavía no llega';
                  return (
                    <button
                      key={f.hora}
                      type="button"
                      title={titulo}
                      aria-label={`${f.hora}: ${titulo}`}
                      aria-current={actual ? 'time' : undefined}
                      disabled={!f.registrable}
                      onClick={() => {
                        setMensaje(null);
                        setHoraAbierta(f.hora);
                      }}
                      className={`${estiloFranja(f, actual, horaAbierta === f.hora)} disabled:cursor-default`}
                    >
                      {f.hora}
                      <span className="block font-sans text-xs font-semibold">
                        {f.estado === 'registrada' ? 'Lista' : f.registrable ? 'Registrar' : f.estado === 'pendiente' ? 'Falta' : ' '}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-tinta-suave">
                {LEYENDA.map((item) => (
                  <li key={item.texto} className="flex items-center gap-2">
                    <span className={`w-4 h-4 rounded border-2 ${item.clase}`} aria-hidden="true" />
                    {item.texto}
                  </li>
                ))}
              </ul>
            </Panel>

            {horaAbierta && (
              <FormularioHora
                key={`${datos.fecha}-${horaAbierta}`}
                datos={datos}
                hora={horaAbierta}
                operador={loggedInUser?.nombre ?? ''}
                onCancelar={() => setHoraAbierta(null)}
                onGuardado={(texto) => {
                  setMensaje(texto);
                  setHoraAbierta(null);
                  cargar(fecha);
                }}
              />
            )}

            {bloqueOperacion}
          </>
        ) : null}

        <p className="text-tinta-suave">
          Las mediciones antes del biofiltro, por biodigestor, se registran en{' '}
          <Link href="/registro-biodigestores" className="font-semibold text-bosque underline underline-offset-2">registro de biodigestores</Link>.
        </p>
      </Pagina>
    </TurnoGuard>
  );
}
