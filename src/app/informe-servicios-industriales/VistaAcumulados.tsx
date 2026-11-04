'use client';

import { useEffect, useMemo, useState } from 'react';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { hoyBogota } from '@/lib/informe/fechas';
import {
  INDICADORES, TOTAL, etiquetaTotal, formatear, valoresDeFila,
  type DefinicionIndicador, type InformeServiciosIndustriales
} from '@/lib/servicios-industriales/indicadores';
import { Cargando, ListaObservaciones, useConsulta, useDescarga } from './comun';

const PRODUCCION = INDICADORES.filter((d) => d.grupo === 'Operación' || d.grupo === 'Eficiencia');
const LECTURAS = INDICADORES.filter((d) => d.grupo !== 'Operación' && d.grupo !== 'Eficiencia');

function rotulo(d: DefinicionIndicador) {
  return d.unidad ? `${d.nombre} (${d.unidad})` : d.nombre;
}

function resumen(informe: InformeServiciosIndustriales): Indicador[] {
  const v = valoresDeFila(informe.total.acumuladores, informe.motores)[TOTAL];
  const faltantes = informe.observaciones.filter((o) => o.detalle.includes('No se suma') || o.detalle.includes('sin valores')).length;
  return [
    { etiqueta: 'Energía generada', valor: formatear(v.kwh, 0), unidad: 'kWh', detalle: `${etiquetaTotal(informe.motores)} en el año` },
    { etiqueta: 'Biogás consumido', valor: formatear(v.m3, 0), unidad: 'm³', detalle: `${formatear(v.horas, 0)} h de motor` },
    { etiqueta: 'kWh por m³', valor: formatear(v.kwhPorM3, 2), detalle: `${formatear(v.kwhPorHora, 0)} kWh por hora de motor` },
    {
      etiqueta: 'Lecturas sin sumar',
      valor: faltantes,
      unidad: faltantes === 1 ? 'registro' : 'registros',
      detalle: 'de contador, por error de digitación',
      tono: faltantes > 0 ? 'alerta' : 'ok'
    }
  ];
}

export default function VistaAcumulados() {
  const anioActual = Number(hoyBogota().slice(0, 4));
  const [anio, setAnio] = useState(anioActual);
  const { datos: informe, cargando, error, setError, consultar } = useConsulta<InformeServiciosIndustriales>();
  const { descargando, iniciar } = useDescarga(setError);

  useEffect(() => {
    consultar(`/api/servicios-industriales?vista=acumulado&anio=${anio}`);
  }, [anio, consultar]);

  const tabla = useMemo(() => {
    if (!informe) return null;
    const periodos = [...informe.filas, informe.total];
    const valores = periodos.map((p) => valoresDeFila(p.acumuladores, informe.motores));
    const columnas = [...informe.motores, TOTAL];
    const secciones: { titulo: string; filas: { rotulo: string; celdas: string[] }[] }[] = [];
    const bloque = (titulo: string, indicadores: DefinicionIndicador[]) => {
      for (const c of columnas) {
        secciones.push({
          titulo: `${titulo} — ${c === TOTAL ? `combinado ${etiquetaTotal(informe.motores)}` : `Jenbacher ${c.replace('J', '')}`}`,
          filas: indicadores.map((d) => ({ rotulo: rotulo(d), celdas: valores.map((v) => formatear(v[c][d.clave], d.decimales)) }))
        });
      }
    };
    bloque('Operación y eficiencia', PRODUCCION);
    secciones.push({ titulo: 'Extractora', filas: [{ rotulo: 'Fruto procesado (t RFF) — sin fuente', celdas: periodos.map(() => '—') }] });
    bloque('Calidad del gas, potencia y biofiltro', LECTURAS);
    return { periodos, secciones };
  }, [informe]);

  const base = `/api/servicios-industriales?vista=acumulado&anio=${anio}`;

  return (
    <div className="space-y-6">
      {informe && <Indicadores items={resumen(informe)} />}

      <Panel
        titulo="Tabla de acumulados"
        descripcion="Un mes por columna y el total del año, por motor y combinado. Es la misma tabla que hoy se lleva a mano en Excel."
        acciones={
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="anio" className={claseEtiqueta}>Año</label>
              <select id="anio" value={anio} onChange={(e) => setAnio(Number(e.target.value))} className={`${claseCampo} min-h-[46px] w-auto`}>
                {[anioActual, anioActual - 1].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={!informe || descargando !== null}
              onClick={() => iniciar('xlsx', `${base}&formato=xlsx`, `acumulado-${anio}.xlsx`)}
              className={`${claseBoton('primario')} min-h-[46px]`}
            >
              {descargando === 'xlsx' ? 'Preparando…' : 'Excel'}
            </button>
            <button
              type="button"
              disabled={!informe || descargando !== null}
              onClick={() => iniciar('pdf', `${base}&formato=pdf`, `acumulado-${anio}.pdf`)}
              className={`${claseBoton('secundario')} min-h-[46px]`}
            >
              {descargando === 'pdf' ? 'Preparando…' : 'PDF'}
            </button>
          </div>
        }
      >
        {error && <Aviso tono="error" titulo="No se pudo completar la operación" className="mb-4">{error}</Aviso>}
        {cargando && !informe && <Cargando texto="Consultando el año completo (puede tardar unos 15 segundos)…" />}
        {informe && tabla && (
          <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-50' : ''}`}>
            <p className="text-sm text-tinta-suave">
              {informe.subtitulo} · {informe.conteos.monitoreos.toLocaleString('es-CO')} monitoreos ·{' '}
              {informe.conteos.datosOperacion.toLocaleString('es-CO')} datos de operación ·{' '}
              {informe.conteos.lecturasJenbacher.toLocaleString('es-CO')} lecturas horarias
            </p>
            <div className="border border-linea rounded-xl overflow-auto max-h-[70vh]">
              <table className="w-full text-sm text-tinta">
                <thead className="bg-superficie-2 sticky top-0 z-10">
                  <tr>
                    <th className="sticky left-0 bg-superficie-2 px-3 py-2.5 text-left font-condensada font-semibold text-base">Indicador</th>
                    {tabla.periodos.map((p) => (
                      <th key={p.clave} className="px-3 py-2.5 text-right font-condensada font-semibold text-base whitespace-nowrap">
                        {p.clave === 'total' ? p.etiqueta : p.etiqueta.slice(0, 3)}
                      </th>
                    ))}
                  </tr>
                </thead>
                {tabla.secciones.map((s) => (
                  <tbody key={s.titulo}>
                    <tr className="bg-hoja-claro border-t border-linea">
                      <th colSpan={tabla.periodos.length + 1} className="sticky left-0 px-3 py-2 text-left font-semibold text-bosque-oscuro">
                        {s.titulo}
                      </th>
                    </tr>
                    {s.filas.map((f) => (
                      <tr key={f.rotulo} className="border-t border-linea">
                        <td className="sticky left-0 bg-superficie px-3 py-1.5 whitespace-nowrap">{f.rotulo}</td>
                        {f.celdas.map((celda, i) => (
                          <td
                            key={i}
                            className={`px-3 py-1.5 text-right tabular-nums whitespace-nowrap ${i === f.celdas.length - 1 ? 'font-semibold bg-superficie-2' : ''}`}
                          >
                            {celda}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
            <p className="text-sm text-tinta-suave">
              kWh = diferencia del contador del motor (en MWh) × 1.000. Las razones se recalculan sobre los totales; el gas, la potencia,
              el flujo, la presión y la temperatura son el promedio de todas las lecturas horarias del período (el gas es el que entra al
              motor). El fruto procesado queda vacío hasta definir de dónde se toma.
            </p>
          </div>
        )}
      </Panel>

      {informe && (
        <Panel titulo="Correcciones y lecturas no sumadas" descripcion="Cómo se trataron los contadores mal digitados en el año.">
          <ListaObservaciones observaciones={informe.observaciones} />
        </Panel>
      )}
    </div>
  );
}
