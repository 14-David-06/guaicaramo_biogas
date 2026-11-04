'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, type ChartOptions
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { formatearFechaCorta, hoyBogota } from '@/lib/informe/fechas';
import {
  DEFINICION, GRUPOS, INDICADORES, TOTAL, etiquetaTotal, formatear, valoresDeFila,
  type ClaveIndicador, type InformeServiciosIndustriales
} from '@/lib/servicios-industriales/indicadores';
import { MESES, finDeMes, semanaIso, semanasDelMes } from '@/lib/servicios-industriales/periodos';
import { Cargando, ListaObservaciones, useConsulta, useDescarga } from './comun';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

// Colores de la serie: J1, J2 y el combinado (los tonos de la marca, sin azul ni morado).
const COLORES = ['#7a9c4b', '#d9a33f', '#3a4626', '#b42318'];

function mesesDisponibles(): string[] {
  const hoy = hoyBogota();
  const meses: string[] = [];
  const [anio, mes] = hoy.split('-').map(Number);
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(anio, mes - 1 - i, 1));
    meses.push(d.toISOString().slice(0, 7));
  }
  return meses;
}

function etiquetaMes(mes: string): string {
  const nombre = MESES[Number(mes.slice(5, 7)) - 1];
  return `${nombre.charAt(0)}${nombre.slice(1).toLowerCase()} ${mes.slice(0, 4)}`;
}

export default function VistaDiaria() {
  const hoy = hoyBogota();
  const meses = useMemo(mesesDisponibles, []);
  const [mes, setMes] = useState(meses[0]);
  // null = el mes completo; si no, el número de semana ISO.
  const [semana, setSemana] = useState<number | null>(semanaIso(hoy));
  const [indicador, setIndicador] = useState<ClaveIndicador>('kwh');
  const { datos: informe, cargando, error, setError, consultar } = useConsulta<InformeServiciosIndustriales>();
  const { descargando, iniciar } = useDescarga(setError);

  const semanas = useMemo(() => semanasDelMes(mes).filter((s) => s.desde <= hoy), [mes, hoy]);
  const elegida = semanas.find((s) => s.numero === semana) ?? null;
  const desde = elegida ? elegida.desde : `${mes}-01`;
  const hasta = elegida ? elegida.hasta : finDeMes(mes);
  const titulo = elegida ? `Informe diario — Biogás, semana ${elegida.numero}` : `Informe diario — Biogás, ${etiquetaMes(mes).toLowerCase()}`;
  const base = `/api/servicios-industriales?vista=diario&desde=${desde}&hasta=${hasta}&titulo=${encodeURIComponent(titulo)}`;

  useEffect(() => {
    consultar(base);
  }, [base, consultar]);

  const cambiarMes = (nuevo: string) => {
    setMes(nuevo);
    setSemana(null);
  };

  const def = DEFINICION[indicador];
  const vista = useMemo(() => {
    if (!informe) return null;
    const columnas = [...informe.motores, TOTAL];
    const nombre = (c: string) => (c === TOTAL ? etiquetaTotal(informe.motores) : c);
    const filas = informe.filas.map((f) => ({ fila: f, valores: valoresDeFila(f.acumuladores, informe.motores) }));
    const total = valoresDeFila(informe.total.acumuladores, informe.motores);
    return { columnas, nombre, filas, total };
  }, [informe]);

  const resumen: Indicador[] = useMemo(() => {
    if (!informe || !vista) return [];
    const t = vista.total[TOTAL];
    const conDatos = vista.filas.filter((f) => f.valores[TOTAL].horas !== null).length;
    return [
      { etiqueta: 'Energía generada', valor: formatear(t.kwh, 0), unidad: 'kWh', detalle: `${etiquetaTotal(informe.motores)} en el período` },
      { etiqueta: 'Biogás consumido', valor: formatear(t.m3, 0), unidad: 'm³', detalle: `${formatear(t.kwhPorM3, 2)} kWh por m³` },
      { etiqueta: 'Horas de motor', valor: formatear(t.horas, 1), unidad: 'h', detalle: `${conDatos} de ${vista.filas.length} días con contadores` },
      { etiqueta: 'Metano promedio', valor: formatear(t.ch4, 2), unidad: '%', detalle: `H2S ${formatear(t.h2s, 0)} ppm` }
    ];
  }, [informe, vista]);

  const grafica = useMemo(() => {
    if (!vista) return null;
    const datasets = vista.columnas.map((c, i) => ({
      label: vista.nombre(c),
      data: vista.filas.map((f) => f.valores[c][indicador]),
      borderColor: COLORES[i % COLORES.length],
      backgroundColor: COLORES[i % COLORES.length],
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.25,
      spanGaps: false
    }));
    return { labels: vista.filas.map((f) => f.fila.etiqueta.slice(0, 5)), datasets };
  }, [vista, indicador]);

  const opciones: ChartOptions<'bar' | 'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatear(ctx.parsed.y, def.decimales)} ${def.unidad}` } }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: def.tipo === 'total', grid: { color: '#d8dcd0' }, title: { display: Boolean(def.unidad), text: def.unidad } }
    }
  };

  return (
    <div className="space-y-6">
      {informe && <Indicadores items={resumen} />}

      <Panel
        titulo="Detalle por día"
        descripcion="Elija el mes y la semana (lunes a domingo, numeración ISO como en el informe de Servicios Industriales)."
        acciones={
          <>
            <button
              type="button"
              disabled={!informe || descargando !== null}
              onClick={() => iniciar('xlsx', `${base}&formato=xlsx`, 'informe-diario.xlsx')}
              className={`${claseBoton('primario')} min-h-[46px]`}
            >
              {descargando === 'xlsx' ? 'Preparando…' : 'Excel'}
            </button>
            <button
              type="button"
              disabled={!informe || descargando !== null}
              onClick={() => iniciar('pdf', `${base}&formato=pdf`, 'informe-diario.pdf')}
              className={`${claseBoton('secundario')} min-h-[46px]`}
            >
              {descargando === 'pdf' ? 'Preparando…' : 'PDF'}
            </button>
          </>
        }
      >
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          <div>
            <label htmlFor="mes" className={claseEtiqueta}>Mes</label>
            <select id="mes" value={mes} onChange={(e) => cambiarMes(e.target.value)} className={`${claseCampo} min-h-[46px] w-auto`}>
              {meses.map((m) => (
                <option key={m} value={m}>{etiquetaMes(m)}</option>
              ))}
            </select>
          </div>
          <div>
            <span className={claseEtiqueta}>Semana</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Semana">
              <button
                type="button"
                aria-pressed={semana === null}
                onClick={() => setSemana(null)}
                className={`${claseBoton(semana === null ? 'primario' : 'secundario', 'sm')} min-h-[44px]`}
              >
                Mes completo
              </button>
              {semanas.map((s) => (
                <button
                  key={s.numero}
                  type="button"
                  aria-pressed={semana === s.numero}
                  onClick={() => setSemana(s.numero)}
                  className={`${claseBoton(semana === s.numero ? 'primario' : 'secundario', 'sm')} min-h-[44px]`}
                  title={`${formatearFechaCorta(s.desde)} al ${formatearFechaCorta(s.hasta)}`}
                >
                  Sem. {s.numero}
                  <span className="font-normal tabular-nums">{s.desde.slice(8)}/{s.desde.slice(5, 7)}–{s.hasta.slice(8)}/{s.hasta.slice(5, 7)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <Aviso tono="error" titulo="No se pudo completar la operación" className="mt-4">{error}</Aviso>}
        {cargando && !informe && <Cargando texto="Consultando el período…" />}
      </Panel>

      {informe && vista && grafica && (
        <Panel
          titulo={def.nombre}
          descripcion={informe.subtitulo}
          acciones={
            <div>
              <label htmlFor="indicador" className="sr-only">Indicador</label>
              <select
                id="indicador"
                value={indicador}
                onChange={(e) => setIndicador(e.target.value as ClaveIndicador)}
                className={`${claseCampo} min-h-[46px] w-auto`}
              >
                {GRUPOS.map((g) => (
                  <optgroup key={g} label={g}>
                    {INDICADORES.filter((d) => d.grupo === g).map((d) => (
                      <option key={d.clave} value={d.clave}>{d.unidad ? `${d.nombre} (${d.unidad})` : d.nombre}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          }
        >
          <div className={`space-y-5 transition-opacity ${cargando ? 'opacity-50' : ''}`}>
            <div className="h-64 sm:h-72">
              {def.tipo === 'total' ? (
                <Bar data={grafica} options={opciones as ChartOptions<'bar'>} />
              ) : (
                <Line data={grafica} options={opciones as ChartOptions<'line'>} />
              )}
            </div>
            <div className="border border-linea rounded-xl overflow-x-auto">
              <table className="w-full text-sm text-tinta">
                <thead className="bg-superficie-2">
                  <tr>
                    {['Mes', 'Semana', 'Fecha', ...vista.columnas.map(vista.nombre)].map((h, i) => (
                      <th key={h} className={`px-3 py-2.5 font-condensada font-semibold text-base whitespace-nowrap ${i > 2 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vista.filas.map(({ fila, valores }) => (
                    <tr key={fila.clave} className="border-t border-linea">
                      <td className="px-3 py-1.5 text-tinta-suave">{fila.mes}</td>
                      <td className="px-3 py-1.5 tabular-nums">{fila.semana}</td>
                      <td className="px-3 py-1.5 tabular-nums whitespace-nowrap">{fila.etiqueta}</td>
                      {vista.columnas.map((c) => (
                        <td key={c} className="px-3 py-1.5 text-right tabular-nums">{formatear(valores[c][indicador], def.decimales)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-linea-fuerte bg-superficie-2 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>Total general</td>
                    {vista.columnas.map((c) => (
                      <td key={c} className="px-3 py-2 text-right tabular-nums">{formatear(vista.total[c][indicador], def.decimales)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-tinta-suave">
              {def.tipo === 'total' && 'Total general: suma de los días.'}
              {def.tipo === 'razon' && 'Total general: recalculado sobre los totales del período, no promedio de los días.'}
              {def.tipo === 'promedio' && 'Total general: promedio de todas las lecturas del período; los días sin lecturas no cuentan como cero.'}
            </p>
          </div>
        </Panel>
      )}

      {informe && (
        <Panel titulo="Correcciones y lecturas no sumadas">
          <ListaObservaciones observaciones={informe.observaciones} />
        </Panel>
      )}
    </div>
  );
}
