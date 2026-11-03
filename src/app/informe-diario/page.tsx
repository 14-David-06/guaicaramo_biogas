'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import RoleGuard from '@/components/RoleGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { ayerBogota, hoyBogota, sumarDias } from '@/lib/informe/fechas';
import type { InformeDiario, Severidad } from '@/lib/informe/tipos';

const ESTILO_SEVERIDAD: Record<Severidad, { caja: string; marca: string; etiqueta: string }> = {
  critica: { caja: 'bg-rojo-claro border-rojo-borde', marca: 'text-rojo', etiqueta: 'Crítica' },
  advertencia: { caja: 'bg-ambar-claro border-ambar-borde', marca: 'text-ambar', etiqueta: 'Advertencia' },
  informativa: { caja: 'bg-superficie-2 border-linea-fuerte', marca: 'text-tinta-suave', etiqueta: 'Informativa' }
};

function plural(n: number, uno: string, varios: string): string {
  return `${n.toLocaleString('es-CO')} ${n === 1 ? uno : varios}`;
}

function valor(v: number | null, unidad = ''): string {
  if (v === null) return '—';
  return `${v.toLocaleString('es-CO')}${unidad ? ' ' + unidad : ''}`;
}

/** Descarga un archivo de una API route y lo guarda con el nombre indicado. */
async function descargar(url: string, nombre: string) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new Error(datos?.detalle || datos?.error || 'No se pudo generar el archivo.');
  }
  const blob = await respuesta.blob();
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(enlace.href);
}

function Dato({ titulo, dato, sufijo }: { titulo: string; dato: number | null; sufijo?: string }) {
  return (
    <div className="bg-superficie-2 border border-linea rounded-lg px-4 py-3">
      <dt className="text-sm font-semibold text-tinta-suave">{titulo}</dt>
      <dd className="mt-1 font-condensada font-bold text-2xl text-tinta tabular-nums">{valor(dato, sufijo)}</dd>
    </div>
  );
}

function Tabla({ encabezados, filas }: { encabezados: string[]; filas: React.ReactNode[][] }) {
  return (
    <div className="bg-superficie border border-linea rounded-xl overflow-x-auto">
      <table className="w-full text-sm text-tinta">
        <thead className="bg-superficie-2">
          <tr>
            {encabezados.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left font-condensada font-semibold text-base text-tinta whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t border-linea">
              {fila.map((celda, j) => (
                <td key={j} className="px-3 py-2 align-top tabular-nums">{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Resumen de arriba: novedades, producción y calidad del gas del día consultado. */
function indicadoresInforme(informe: InformeDiario, criticas: number, advertencias: number): Indicador[] {
  const p = informe.produccion;
  const fuera = informe.calidadGas.reduce((total, v) => total + (v.fueraDeRango ?? 0), 0);
  const lecturas = informe.calidadGas.filter((v) => v.fueraDeRango !== undefined).reduce((total, v) => total + v.muestras, 0);
  return [
    {
      etiqueta: 'Novedades',
      valor: informe.excepciones.length,
      detalle: `${plural(criticas, 'crítica', 'críticas')}, ${plural(advertencias, 'advertencia', 'advertencias')}`,
      tono: criticas > 0 ? 'critico' : advertencias > 0 ? 'alerta' : 'ok'
    },
    {
      etiqueta: 'Energía generada',
      valor: p.energiaGenerada === null ? '—' : p.energiaGenerada.toLocaleString('es-CO'),
      unidad: p.energiaGenerada === null ? undefined : p.unidadEnergia,
      detalle: p.m3Biogas === null ? 'Biogás consumido sin dato' : `${valor(p.m3Biogas, 'm³')} de biogás`
    },
    {
      etiqueta: 'Horas de operación',
      valor: p.horasOperacion === null ? '—' : p.horasOperacion.toLocaleString('es-CO'),
      unidad: p.horasOperacion === null ? undefined : 'h',
      detalle: p.arranques === null ? 'Arranques sin dato' : plural(p.arranques, 'arranque', 'arranques')
    },
    {
      etiqueta: 'Gas fuera de rango',
      valor: fuera,
      unidad: fuera === 1 ? 'lectura' : 'lecturas',
      detalle: `de ${lecturas.toLocaleString('es-CO')} con rango definido`,
      tono: fuera > 0 ? 'alerta' : lecturas > 0 ? 'ok' : 'neutro'
    }
  ];
}

function ContenidoInformeDiario() {
  const { user: loggedInUser } = useAuth();
  const [fecha, setFecha] = useState(ayerBogota());
  const [informe, setInforme] = useState<InformeDiario | null>(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState(sumarDias(ayerBogota(), -6));
  const [hasta, setHasta] = useState(ayerBogota());
  const [exportando, setExportando] = useState(false);

  const generar = useCallback(async (dia: string) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/informe-diario?fecha=${dia}&formato=json`);
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.detalle || datos.error || 'No se pudo generar el informe.');
      }
      setInforme(datos);
    } catch (e) {
      setInforme(null);
      setError(e instanceof Error ? e.message : 'Error desconocido al generar el informe.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    generar(ayerBogota());
  }, [generar]);

  const descargarPdf = async () => {
    setDescargando(true);
    setError(null);
    try {
      const quien = loggedInUser?.nombre ? `Descargado por ${loggedInUser.nombre}` : 'Generación bajo demanda';
      await descargar(
        `/api/informe-diario?fecha=${fecha}&formato=pdf&generadoPor=${encodeURIComponent(quien)}`,
        `informe-biogas-${fecha}.pdf`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al descargar el PDF.');
    } finally {
      setDescargando(false);
    }
  };

  const exportarExcel = async () => {
    setExportando(true);
    setError(null);
    try {
      await descargar(
        `/api/consolidado?desde=${desde}&hasta=${hasta}`,
        desde === hasta ? `consolidado-biogas-${desde}.xlsx` : `consolidado-biogas-${desde}_a_${hasta}.xlsx`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al exportar a Excel.');
    } finally {
      setExportando(false);
    }
  };

  const rangoRapido = (dias: number) => {
    setHasta(ayerBogota());
    setDesde(sumarDias(ayerBogota(), -(dias - 1)));
  };

  const criticas = informe?.excepciones.filter((e) => e.severidad === 'critica').length ?? 0;
  const advertencias = informe?.excepciones.filter((e) => e.severidad === 'advertencia').length ?? 0;

  const campoFecha = `${claseCampo} min-h-[46px]`;
  const chipRango = `${claseBoton('secundario', 'sm')} min-h-[44px]`;

  return (
    <Pagina ancho="amplio">
      <EncabezadoPagina
        titulo="Informe diario"
        descripcion="Consolidado de la operación de un día, de 00:00 a 23:59 hora de Colombia. Es el mismo que llega por correo a las 6:00 a. m."
        acciones={
          <>
            <div>
              <label htmlFor="fecha" className={claseEtiqueta}>Informe del</label>
              <input
                id="fecha"
                type="date"
                value={fecha}
                max={hoyBogota()}
                onChange={(e) => setFecha(e.target.value)}
                className={`${campoFecha} w-auto`}
              />
            </div>
            <button type="button" onClick={() => generar(fecha)} disabled={cargando} className={`${claseBoton('primario')} min-h-[46px]`}>
              {cargando ? 'Consultando…' : 'Ver informe'}
            </button>
            <button
              type="button"
              onClick={descargarPdf}
              disabled={descargando || cargando || !informe}
              className={`${claseBoton('secundario')} min-h-[46px]`}
            >
              {descargando ? 'Preparando PDF…' : 'Descargar PDF'}
            </button>
          </>
        }
      >
        {informe && (
          <>
            <span className="font-semibold text-tinta">{informe.fechaLarga.replace(/^./, (c) => c.toUpperCase())}</span>
            <span className="tabular-nums">
              {plural(informe.conteos.registrosJenbacher, 'registro Jenbacher', 'registros Jenbacher')} ·{' '}
              {plural(informe.conteos.monitoreosMotor, 'monitoreo', 'monitoreos')} ·{' '}
              {plural(informe.conteos.cambiosEstado, 'cambio de estado', 'cambios de estado')} ·{' '}
              {plural(informe.conteos.entradasBitacora, 'entrada de bitácora', 'entradas de bitácora')}
            </span>
          </>
        )}
      </EncabezadoPagina>

      {informe && !informe.sinDatos && <Indicadores items={indicadoresInforme(informe, criticas, advertencias)} />}

      {error && <Aviso tono="error" titulo="No se pudo completar la operación">{error}</Aviso>}

      {cargando && !informe && (
        <div className="flex items-center gap-3 py-16 justify-center text-tinta-suave" role="status">
          <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
          Consultando el informe…
        </div>
      )}

      {informe && (
        <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-50' : ''}`}>
          {informe.sinDatos ? (
            <Panel titulo="Sin registros operativos para esta fecha">
              <p className="text-tinta-suave">
                No se encontró ningún turno, registro de operación ni bitácora en el día consultado. Elija otra fecha.
              </p>
            </Panel>
          ) : (
            <>
              <Panel
                titulo="Novedades y excepciones"
                descripcion={
                  informe.excepciones.length > 0
                    ? `${plural(criticas, 'crítica', 'críticas')}, ${plural(advertencias, 'advertencia', 'advertencias')}, ${informe.excepciones.length} en total.`
                    : undefined
                }
              >
                {informe.excepciones.length === 0 ? (
                  <Aviso tono="exito">Sin novedades: todos los parámetros dentro de rango y los registros completos.</Aviso>
                ) : (
                  <ul className="space-y-2">
                    {informe.excepciones.map((e, i) => {
                      const estilo = ESTILO_SEVERIDAD[e.severidad];
                      return (
                        <li key={i} className={`border border-l-4 rounded-lg px-4 py-3 ${estilo.caja}`}>
                          <p className="flex flex-wrap items-center gap-x-2 text-sm">
                            <span className={`font-semibold ${estilo.marca}`}>{estilo.etiqueta}</span>
                            <span className="text-tinta-suave">· {e.categoria}</span>
                            {e.hora && <span className="text-tinta-suave tabular-nums">· {e.hora}</span>}
                          </p>
                          <p className="mt-0.5 font-semibold text-tinta">{e.titulo}</p>
                          <p className="mt-0.5 text-tinta-suave">{e.detalle}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel titulo="Producción del día">
                <dl className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <Dato titulo="Energía generada" dato={informe.produccion.energiaGenerada} sufijo={informe.produccion.unidadEnergia} />
                  <Dato titulo="Biogás consumido" dato={informe.produccion.m3Biogas} sufijo="m³" />
                  <Dato titulo="Horas de operación" dato={informe.produccion.horasOperacion} sufijo="h" />
                  <Dato titulo="Arranques" dato={informe.produccion.arranques} />
                  <Dato titulo="Potencia promedio" dato={informe.produccion.potenciaPromedio} sufijo="kW" />
                  <Dato titulo="Potencia máxima" dato={informe.produccion.potenciaMaxima} sufijo="kW" />
                </dl>
                <p className="mt-3 text-sm text-tinta-suave">{informe.produccion.notaUnidades}</p>
              </Panel>

              <Panel titulo="Calidad del biogás">
                <Tabla
                  encabezados={['Variable', 'Promedio', 'Mínimo', 'Máximo', 'Lecturas', 'Rango esperado', 'Fuera de rango']}
                  filas={informe.calidadGas.map((v) => [
                    <span key="v" className="font-semibold whitespace-nowrap">{`${v.nombre} (${v.unidad})`}</span>,
                    valor(v.promedio),
                    valor(v.minimo),
                    valor(v.maximo),
                    v.muestras,
                    <span key="r" className="text-tinta-suave whitespace-nowrap">{v.referencia ?? '—'}</span>,
                    v.fueraDeRango === undefined ? '—' : v.fueraDeRango > 0 ? (
                      <span key="f" className="inline-block px-2 rounded bg-rojo-claro text-rojo font-semibold">{v.fueraDeRango}</span>
                    ) : (
                      v.fueraDeRango
                    )
                  ])}
                />
              </Panel>

              <Panel titulo="Biofiltro">
                <Tabla
                  encabezados={['Variable', 'Promedio', 'Mínimo', 'Máximo', 'Lecturas']}
                  filas={informe.biofiltro.map((v) => [
                    <span key="v" className="font-semibold whitespace-nowrap">{`${v.nombre} (${v.unidad})`}</span>,
                    valor(v.promedio),
                    valor(v.minimo),
                    valor(v.maximo),
                    v.muestras
                  ])}
                />
              </Panel>

              <Panel titulo="Remoción de H2S">
                {informe.remocionH2S.length === 0 ? (
                  <p className="text-tinta-suave">
                    Sin mediciones de entrada y salida del filtro en este día. Se registran en{' '}
                    <Link href="/remocion-h2s" className="font-semibold text-bosque underline underline-offset-2">Remoción H2S</Link>.
                  </p>
                ) : (
                  <Tabla
                    encabezados={['Hora', 'Entrada ppm', 'Salida biofiltro', 'Salida biochar', '% biofiltro', '% biochar', '% total', 'Operador']}
                    filas={informe.remocionH2S.map((m) => [
                      m.hora,
                      valor(m.entradaBiofiltro),
                      valor(m.salidaBiofiltro),
                      valor(m.salidaBiochar),
                      valor(m.remocionBiofiltro, '%'),
                      valor(m.remocionBiochar, '%'),
                      <strong key="t">{valor(m.remocionTotal, '%')}</strong>,
                      m.operador || '—'
                    ])}
                  />
                )}
              </Panel>

              {informe.motores.length > 0 && (
                <Panel titulo="Motores">
                  <Tabla
                    encabezados={['Motor', 'Horas', 'Arranques', informe.produccion.unidadEnergia, 'm³', 'Estado final', 'Cambios de estado']}
                    filas={informe.motores.map((m) => [
                      <span key="n" className="font-semibold whitespace-nowrap">
                        {m.nombre}
                        {m.registroIncompleto && (
                          <span className="text-ambar" title="Producción parcial: registros sin cierre">{' '}*</span>
                        )}
                      </span>,
                      valor(m.horasOperacion),
                      valor(m.arranques),
                      valor(m.energiaGenerada),
                      valor(m.m3Consumidos),
                      m.estadoFinal ?? 'Sin cambios',
                      m.cambiosEstado.map((c) => `${c.hora} ${c.estado}`).join(' · ') || '—'
                    ])}
                  />
                  {informe.motores.some((m) => m.registroIncompleto) && (
                    <p className="mt-2 text-sm text-tinta-suave">
                      * Producción parcial: hay registros de monitoreo sin valores de cierre.
                    </p>
                  )}
                </Panel>
              )}

              {informe.turnos.length > 0 && (
                <Panel titulo="Turnos">
                  <Tabla
                    encabezados={['Operador', 'Inicio', 'Fin', 'Duración', 'Estado']}
                    filas={informe.turnos.map((t) => [
                      t.operador || '—',
                      t.inicio ?? '—',
                      t.fin ?? '—',
                      t.duracionHoras === null ? '—' : `${t.duracionHoras} h`,
                      t.cerrado ? (
                        <span key="e" className="text-tinta-suave">Cerrado</span>
                      ) : (
                        <span key="e" className="inline-block px-2 rounded bg-ambar-claro text-ambar font-semibold">Abierto</span>
                      )
                    ])}
                  />
                </Panel>
              )}

              {informe.medicionesBiodigestores.length > 0 && (
                <Panel titulo="Mediciones de biodigestores">
                  <Tabla
                    encabezados={['Hora', 'Biodigestor', 'CH4 %', 'CO2 %', 'O2 %', 'H2S ppm', 'CO', 'NO', 'Operador']}
                    filas={informe.medicionesBiodigestores.map((m) => [
                      m.hora,
                      m.biodigestor || '—',
                      valor(m.ch4),
                      valor(m.co2),
                      valor(m.o2),
                      valor(m.h2s),
                      valor(m.co),
                      valor(m.no),
                      m.operador || '—'
                    ])}
                  />
                </Panel>
              )}

              {informe.bitacora.length > 0 && (
                <Panel titulo="Bitácora de operadores">
                  <ul className="divide-y divide-linea">
                    {informe.bitacora.map((b, i) => (
                      <li key={i} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-sm text-tinta-suave">
                          <span className="tabular-nums">{b.hora}</span> · {b.operador || 'Operador no identificado'}
                        </p>
                        <p className="mt-0.5 text-tinta">{b.informeEjecutivo || b.transcripcion}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </>
          )}
        </div>
      )}

      <Panel
        titulo="Consolidado de varios días en Excel"
        descripcion="Una fila por día con energía, m³, horas, calidad del gas y remoción de H2S, más hojas de detalle. Máximo 62 días."
      >
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div className="grid grid-cols-2 gap-3 lg:w-96">
            <div>
              <label htmlFor="desde" className={claseEtiqueta}>Desde</label>
              <input id="desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={campoFecha} />
            </div>
            <div>
              <label htmlFor="hasta" className={claseEtiqueta}>Hasta</label>
              <input id="hasta" type="date" value={hasta} min={desde} max={hoyBogota()} onChange={(e) => setHasta(e.target.value)} className={campoFecha} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => rangoRapido(1)} className={chipRango}>Ayer</button>
            <button type="button" onClick={() => rangoRapido(7)} className={chipRango}>Últimos 7 días</button>
            <button type="button" onClick={() => rangoRapido(30)} className={chipRango}>Últimos 30 días</button>
          </div>
          <button type="button" onClick={exportarExcel} disabled={exportando} className={`${claseBoton('primario')} min-h-[46px] lg:ml-auto`}>
            {exportando ? 'Preparando Excel…' : 'Descargar Excel'}
          </button>
        </div>
      </Panel>
    </Pagina>
  );
}

export default function InformeDiarioPage() {
  return (
    <RoleGuard
      allowedRoles={['Ingeniera - Jefe de planta', 'Jefe director de planta', 'Desarrollador', 'CTO', 'CEO']}
      fallbackMessage="El informe diario está disponible solo para jefatura y dirección."
    >
      <ContenidoInformeDiario />
    </RoleGuard>
  );
}
