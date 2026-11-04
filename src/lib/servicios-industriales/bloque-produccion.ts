// Bloque de biogás para el informe "Datos Producción y Pérdidas" de la
// extractora. Hoy alguien transcribe a mano, cada día, la "Información Calidad
// Biogás", las horas Jenbacher y la fila "KWH/M3 Biogás" del mes; este bloque
// los entrega listos para copiar y pegar en su Excel.
//
// En ese informe el kWh/m³ del día es potencia promedio ÷ m³/h promedio de las
// lecturas horarias (585,88 ÷ 432,18 = 1,36 el 28/10/2026), no el cociente de
// los contadores. Se respeta esa definición para que los números cuadren.
//
// No importa nada del servidor.

import { NORMAS_INFORME_PRODUCCION } from '../informe/umbrales';
import { formatearFechaCorta } from '../informe/fechas';
import { calcular, formatear, sumarAcumuladores, type Acumulador } from './indicadores';
import { semanaIso } from './periodos';

export interface FilaBloque {
  variable: string;
  valor: number | null;
  decimales: number;
  referencia: string;
  /** null cuando la variable no tiene norma o no hay dato. */
  estado: 'OK' | 'Atención' | null;
}

export interface BloqueProduccion {
  fecha: string;
  calidad: FilaBloque[];
  horas: { motor: string; horas: number | null }[];
  horasTotal: number | null;
  /** kWh/m³ de cada día del mes hasta la fecha (1 … día de la fecha). */
  kwhPorM3Dias: { fecha: string; valor: number | null }[];
  kwhPorM3Semanas: { semana: number; valor: number | null }[];
  kwhPorM3Mes: number | null;
  lecturas: number;
}

function kwhPorM3Instantaneo(a: Acumulador): number | null {
  const v = calcular(a);
  return v.potencia !== null && v.m3Hora !== null && v.m3Hora > 0 ? v.potencia / v.m3Hora : null;
}

function estado(valor: number | null, norma: { minimo?: number; maximo?: number }): FilaBloque['estado'] {
  if (valor === null) return null;
  if (norma.minimo !== undefined && valor < norma.minimo) return 'Atención';
  if (norma.maximo !== undefined && valor > norma.maximo) return 'Atención';
  return 'OK';
}

/**
 * `porDia` debe cubrir del 1 del mes a `fecha`, con un acumulador por motor y día.
 */
export function construirBloque(
  fecha: string,
  porDia: Map<string, Record<string, Acumulador>>,
  motores: string[]
): BloqueProduccion {
  const combinado = (dia: string) => sumarAcumuladores(...Object.values(porDia.get(dia) ?? {}));
  const delDia = combinado(fecha);
  const v = calcular(delDia);
  const kwhM3 = kwhPorM3Instantaneo(delDia);
  const N = NORMAS_INFORME_PRODUCCION;

  const calidad: FilaBloque[] = [
    { variable: '% Metano', valor: v.ch4, decimales: 2, referencia: N.ch4.referencia, estado: estado(v.ch4, N.ch4) },
    { variable: '% O2', valor: v.o2, decimales: 2, referencia: N.o2.referencia, estado: estado(v.o2, N.o2) },
    { variable: '% CO2', valor: v.co2, decimales: 2, referencia: N.co2.referencia, estado: estado(v.co2, N.co2) },
    { variable: 'H2S (ppm)', valor: v.h2s, decimales: 2, referencia: N.h2s.referencia, estado: estado(v.h2s, N.h2s) },
    { variable: 'Potencia eléctrica (kW)', valor: v.potencia, decimales: 2, referencia: 'Promedio horario', estado: null },
    { variable: 'M3 Biogás (m³/h)', valor: v.m3Hora, decimales: 2, referencia: 'Promedio horario', estado: null },
    { variable: 'kWh/m³ Biogás', valor: kwhM3, decimales: 2, referencia: N.kwhPorM3.referencia, estado: estado(kwhM3, N.kwhPorM3) }
  ];

  const horas = motores.map((m) => ({ motor: m, horas: porDia.get(fecha)?.[m]?.horas ?? null }));
  const horasValidas = horas.map((h) => h.horas).filter((h): h is number => h !== null);

  const dias = [...porDia.keys()].filter((d) => d <= fecha).sort();
  const semanas = new Map<number, string[]>();
  for (const d of dias) semanas.set(semanaIso(d), [...(semanas.get(semanaIso(d)) ?? []), d]);

  return {
    fecha,
    calidad,
    horas,
    horasTotal: horasValidas.length ? horasValidas.reduce((a, b) => a + b, 0) : null,
    kwhPorM3Dias: dias.map((d) => ({ fecha: d, valor: kwhPorM3Instantaneo(combinado(d)) })),
    kwhPorM3Semanas: [...semanas].map(([semana, ds]) => ({
      semana,
      valor: kwhPorM3Instantaneo(sumarAcumuladores(...ds.map(combinado)))
    })),
    kwhPorM3Mes: kwhPorM3Instantaneo(sumarAcumuladores(...dias.map(combinado))),
    lecturas: delDia.gas.ch4.n
  };
}

/** Texto separado por tabuladores, para pegar directo en el Excel de la extractora. */
export function bloqueComoTexto(b: BloqueProduccion): string {
  const lineas = [
    `Información Calidad Biogás\t${formatearFechaCorta(b.fecha)}`,
    ...b.calidad.map((f) => `${f.variable} (${f.referencia})\t${formatear(f.valor, f.decimales)}\t${f.estado ?? ''}`),
    ...b.horas.map((h) => `Horas Jenbacher ${h.motor}\t${formatear(h.horas, 2)}`),
    `Total horas Jenbacher\t${formatear(b.horasTotal, 2)}`
  ];
  return lineas.join('\n');
}

/** La fila "KWH/M3 Biogás" del mes: un valor por día, separados por tabulador. */
export function filaKwhPorM3ComoTexto(b: BloqueProduccion): string {
  return b.kwhPorM3Dias.map((d) => formatear(d.valor, 2).replace('—', '')).join('\t');
}
