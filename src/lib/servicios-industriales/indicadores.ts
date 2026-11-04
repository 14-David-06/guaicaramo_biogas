// Indicadores del informe de Servicios Industriales — Biogás.
//
// Todo indicador se calcula desde un Acumulador: las sumas de un motor (o de
// varios) en un período. Así un mes, una semana, un año o el total de J1+J2 se
// arman sumando acumuladores y recalculando, nunca promediando promedios ni
// sumando razones ya calculadas:
//   - los totales (horas, kWh, m³, arranques) se suman;
//   - las razones (kWh/m³, kWh/h…) se recalculan sobre los totales;
//   - los promedios del gas se calculan sobre todas las lecturas del período,
//     de modo que un día sin lecturas no cuenta como cero.
//
// No importa nada del servidor: lo comparten la API, el PDF, el Excel y la página.

export const VARIABLES_GAS = [
  'ch4', 'o2', 'co2', 'h2s', 'potencia', 'm3Hora', 'presionEntrada', 'presionSalida', 'tempEntrada', 'tempSalida'
] as const;
export type VariableGas = (typeof VARIABLES_GAS)[number];

/** Campo de "Registros Diarios Jenbacher" de cada variable (el gas es el que entra al motor). */
export const CAMPO_VARIABLE: Record<VariableGas, string> = {
  ch4: 'METANO(CH4)%',
  o2: 'OXIGENO(O2) %',
  co2: 'DIOXIDO DE CARBONO(CO2) %',
  h2s: 'ACIDO SULFIDRICO(H2S)',
  potencia: 'POTENCIA GENERADA(Kw)',
  m3Hora: 'M3 DE BIOGAS (M3)',
  presionEntrada: 'PRESION BIOFILTRO ENTRADA (cm de h20)',
  presionSalida: 'PRESION BIOFILTRO SALIDA (cm de h2o)',
  tempEntrada: 'TEMP. ENTRADA BIOFILTRO',
  tempSalida: 'TEMP. SALIDA BIOFILTRO'
};

export interface SumaLecturas {
  suma: number;
  n: number;
}

/** Numerador y denominador de una razón, sumados solo donde ambos son válidos. */
export interface Par {
  a: number;
  b: number;
}

/** Sumas de un período: lo mínimo para recalcular cualquier indicador. */
export interface Acumulador {
  /** Δ horómetro. null si no hubo ninguna lectura válida de contador. */
  horas: number | null;
  /** Δ contador de energía, en kWh (el contador está en MWh). */
  kwh: number | null;
  m3: number | null;
  arranques: number | null;
  /**
   * Las razones se calculan con los registros en que ambos contadores son
   * válidos: si un día el horómetro se descarta pero la energía no, ese día no
   * debe inflar el kWh/h.
   */
  pares: { kwhHoras: Par; m3Horas: Par; kwhM3: Par };
  gas: Record<VariableGas, SumaLecturas>;
}

export function acumuladorVacio(): Acumulador {
  return {
    horas: null,
    kwh: null,
    m3: null,
    arranques: null,
    pares: { kwhHoras: { a: 0, b: 0 }, m3Horas: { a: 0, b: 0 }, kwhM3: { a: 0, b: 0 } },
    gas: Object.fromEntries(VARIABLES_GAS.map((v) => [v, { suma: 0, n: 0 }])) as Record<VariableGas, SumaLecturas>
  };
}

function sumarNulos(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

/** Suma de dos o más acumuladores (no modifica los originales). */
export function sumarAcumuladores(...acumuladores: (Acumulador | undefined)[]): Acumulador {
  const total = acumuladorVacio();
  for (const a of acumuladores) {
    if (!a) continue;
    total.horas = sumarNulos(total.horas, a.horas);
    total.kwh = sumarNulos(total.kwh, a.kwh);
    total.m3 = sumarNulos(total.m3, a.m3);
    total.arranques = sumarNulos(total.arranques, a.arranques);
    for (const p of ['kwhHoras', 'm3Horas', 'kwhM3'] as const) {
      total.pares[p].a += a.pares[p].a;
      total.pares[p].b += a.pares[p].b;
    }
    for (const v of VARIABLES_GAS) {
      total.gas[v].suma += a.gas[v].suma;
      total.gas[v].n += a.gas[v].n;
    }
  }
  return total;
}

export type ClaveIndicador =
  | 'horas' | 'kwh' | 'm3' | 'arranques'
  | 'kwhPorM3' | 'm3PorKwh' | 'kwhPorHora' | 'm3PorHora'
  | VariableGas;

export type GrupoIndicador = 'Operación' | 'Eficiencia' | 'Calidad del gas' | 'Potencia y flujo' | 'Biofiltro';

export interface DefinicionIndicador {
  clave: ClaveIndicador;
  nombre: string;
  unidad: string;
  grupo: GrupoIndicador;
  decimales: number;
  /** total: se suma · razon: se recalcula sobre totales · promedio: sobre lecturas. */
  tipo: 'total' | 'razon' | 'promedio';
}

export const INDICADORES: DefinicionIndicador[] = [
  { clave: 'horas', nombre: 'Horas trabajadas', unidad: 'h', grupo: 'Operación', decimales: 1, tipo: 'total' },
  { clave: 'kwh', nombre: 'Energía generada', unidad: 'kWh', grupo: 'Operación', decimales: 0, tipo: 'total' },
  { clave: 'm3', nombre: 'Biogás consumido', unidad: 'm³', grupo: 'Operación', decimales: 0, tipo: 'total' },
  { clave: 'arranques', nombre: 'N.º de arranques', unidad: '', grupo: 'Operación', decimales: 0, tipo: 'total' },
  { clave: 'kwhPorM3', nombre: 'kWh por m³', unidad: 'kWh/m³', grupo: 'Eficiencia', decimales: 2, tipo: 'razon' },
  { clave: 'm3PorKwh', nombre: 'm³ por kWh', unidad: 'm³/kWh', grupo: 'Eficiencia', decimales: 2, tipo: 'razon' },
  { clave: 'kwhPorHora', nombre: 'kWh por hora', unidad: 'kWh/h', grupo: 'Eficiencia', decimales: 0, tipo: 'razon' },
  { clave: 'm3PorHora', nombre: 'm³ por hora', unidad: 'm³/h', grupo: 'Eficiencia', decimales: 0, tipo: 'razon' },
  { clave: 'ch4', nombre: 'Metano (CH4)', unidad: '%', grupo: 'Calidad del gas', decimales: 2, tipo: 'promedio' },
  { clave: 'o2', nombre: 'Oxígeno (O2)', unidad: '%', grupo: 'Calidad del gas', decimales: 2, tipo: 'promedio' },
  { clave: 'co2', nombre: 'Dióxido de carbono (CO2)', unidad: '%', grupo: 'Calidad del gas', decimales: 2, tipo: 'promedio' },
  { clave: 'h2s', nombre: 'Ácido sulfhídrico (H2S)', unidad: 'ppm', grupo: 'Calidad del gas', decimales: 2, tipo: 'promedio' },
  { clave: 'potencia', nombre: 'Potencia generada', unidad: 'kW', grupo: 'Potencia y flujo', decimales: 2, tipo: 'promedio' },
  { clave: 'm3Hora', nombre: 'Flujo de biogás (lectura)', unidad: 'm³/h', grupo: 'Potencia y flujo', decimales: 2, tipo: 'promedio' },
  { clave: 'presionEntrada', nombre: 'Presión entrada biofiltro', unidad: 'cm H2O', grupo: 'Biofiltro', decimales: 2, tipo: 'promedio' },
  { clave: 'presionSalida', nombre: 'Presión salida biofiltro', unidad: 'cm H2O', grupo: 'Biofiltro', decimales: 2, tipo: 'promedio' },
  { clave: 'tempEntrada', nombre: 'Temperatura entrada biofiltro', unidad: '°C', grupo: 'Biofiltro', decimales: 2, tipo: 'promedio' },
  { clave: 'tempSalida', nombre: 'Temperatura salida biofiltro', unidad: '°C', grupo: 'Biofiltro', decimales: 2, tipo: 'promedio' }
];

export const GRUPOS: GrupoIndicador[] = ['Operación', 'Eficiencia', 'Calidad del gas', 'Potencia y flujo', 'Biofiltro'];

export const DEFINICION: Record<ClaveIndicador, DefinicionIndicador> = Object.fromEntries(
  INDICADORES.map((d) => [d.clave, d])
) as Record<ClaveIndicador, DefinicionIndicador>;

export type Valores = Record<ClaveIndicador, number | null>;

function razon(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/** Todos los indicadores de un acumulador. */
export function calcular(a: Acumulador): Valores {
  const valores = {
    horas: a.horas,
    kwh: a.kwh,
    m3: a.m3,
    arranques: a.arranques,
    kwhPorM3: razon(a.pares.kwhM3.a, a.pares.kwhM3.b),
    m3PorKwh: razon(a.pares.kwhM3.b, a.pares.kwhM3.a),
    kwhPorHora: razon(a.pares.kwhHoras.a, a.pares.kwhHoras.b),
    m3PorHora: razon(a.pares.m3Horas.a, a.pares.m3Horas.b)
  } as Valores;
  for (const v of VARIABLES_GAS) {
    const { suma, n } = a.gas[v];
    valores[v] = n > 0 ? suma / n : null;
  }
  return valores;
}

/** Clave de la columna con la suma de todos los motores. */
export const TOTAL = 'total';

/** "J1+J2" para la columna combinada. */
export function etiquetaTotal(motores: string[]): string {
  return motores.length > 1 ? motores.join('+') : 'Total';
}

/** Indicadores por motor y del total de una fila del informe. */
export function valoresDeFila(acumuladores: Record<string, Acumulador>, motores: string[]): Record<string, Valores> {
  const resultado: Record<string, Valores> = {};
  for (const m of motores) resultado[m] = calcular(acumuladores[m] ?? acumuladorVacio());
  resultado[TOTAL] = calcular(sumarAcumuladores(...motores.map((m) => acumuladores[m])));
  return resultado;
}

/** Formato colombiano con los decimales del indicador; "—" si no hay dato. */
export function formatear(valor: number | null, decimales: number): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

/** Redondeo para Excel: el número queda como número, no como texto. */
export function redondear(valor: number | null, decimales: number): number | null {
  if (valor === null || !Number.isFinite(valor)) return null;
  const f = 10 ** decimales;
  return Math.round(valor * f) / f;
}

// ------------------------------------------------------------------ Contrato

export interface FilaInforme {
  /** "2026-10" en los acumulados, "2026-10-26" en el diario, "total" en el total. */
  clave: string;
  etiqueta: string;
  /** Semana ISO (lunes a domingo), solo en el diario. */
  semana?: number;
  /** Nombre del mes, solo en el diario (la semana puede cruzar meses). */
  mes?: string;
  acumuladores: Record<string, Acumulador>;
}

export interface Observacion {
  fecha: string;
  motor: string;
  detalle: string;
}

export interface InformeServiciosIndustriales {
  tipo: 'acumulado' | 'diario';
  titulo: string;
  subtitulo: string;
  desde: string;
  hasta: string;
  generadoEn: string;
  /** Motores con datos en el período, en nombre corto ("J1", "J2"). */
  motores: string[];
  filas: FilaInforme[];
  total: FilaInforme;
  /** Lecturas que no se sumaron, con el motivo. */
  observaciones: Observacion[];
  conteos: { monitoreos: number; datosOperacion: number; lecturasJenbacher: number };
}
