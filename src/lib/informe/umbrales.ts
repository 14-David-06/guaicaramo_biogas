// Umbrales operativos del informe diario.
//
// ⚠️ VALORES PRELIMINARES. Los rangos de CH4, O2 y H2S provienen del checklist
// "Protocolo Encendido Motores" ya existente en la aplicación (CH4 > 50%,
// O2 < 3%, H2S < 300 ppm, carga < 1000 kW). Los demás son estimaciones a partir
// del histórico y DEBEN validarse con la Ing. Jimena antes de automatizar el
// envío de las 06:00 — ese es justamente el propósito del informe bajo demanda.
//
// Este archivo es el único lugar donde se ajustan: cambiar un número aquí
// cambia la sección de excepciones del PDF, de la vista previa y del Excel.

import type { Severidad } from './tipos';
import type { Gas, PuntoMedicion } from '../planilla/tipos';

export interface Umbral {
  /** Nombre exacto del campo en "Registros Diarios Jenbacher". */
  campo: string;
  nombre: string;
  unidad: string;
  minimo?: number;
  maximo?: number;
  severidad: Severidad;
  referencia: string;
}

export const UMBRALES_CALIDAD_GAS: Umbral[] = [
  { campo: 'METANO(CH4)%', nombre: 'Metano (CH4)', unidad: '%', minimo: 50, severidad: 'critica', referencia: '> 50 %' },
  { campo: 'OXIGENO(O2) %', nombre: 'Oxígeno (O2)', unidad: '%', maximo: 3, severidad: 'critica', referencia: '< 3 %' },
  { campo: 'DIOXIDO DE CARBONO(CO2) %', nombre: 'Dióxido de carbono (CO2)', unidad: '%', maximo: 45, severidad: 'advertencia', referencia: '< 45 %' },
  { campo: 'ACIDO SULFIDRICO(H2S)', nombre: 'Ácido sulfhídrico (H2S)', unidad: 'ppm', maximo: 300, severidad: 'critica', referencia: '< 300 ppm' }
];

export const UMBRALES_BIOFILTRO: Umbral[] = [
  { campo: 'PRESION BIOFILTRO ENTRADA (cm de h20)', nombre: 'Presión entrada biofiltro', unidad: 'cm H2O', severidad: 'informativa', referencia: '—' },
  { campo: 'PRESION BIOFILTRO SALIDA (cm de h2o)', nombre: 'Presión salida biofiltro', unidad: 'cm H2O', severidad: 'informativa', referencia: '—' },
  { campo: 'TEMP. ENTRADA BIOFILTRO', nombre: 'Temperatura entrada biofiltro', unidad: '°C', severidad: 'informativa', referencia: '—' },
  { campo: 'TEMP. SALIDA BIOFILTRO', nombre: 'Temperatura salida biofiltro', unidad: '°C', severidad: 'informativa', referencia: '—' }
];

export const UMBRAL_POTENCIA: Umbral = {
  campo: 'POTENCIA GENERADA(Kw)',
  nombre: 'Potencia generada',
  unidad: 'kW',
  maximo: 1000,
  severidad: 'advertencia',
  referencia: '< 1000 kW'
};

/**
 * % mínimo de remoción de H2S de todo el tren de filtrado (entrada → salida
 * final). Por debajo se reporta como posible agotamiento del medio filtrante.
 * Preliminar: definir con la Ing. Jimena (pregunta 16 del levantamiento).
 */
export const REMOCION_H2S_MINIMA = 80;

/**
 * Límites físicos de un registro de "Monitoreo Motores". Un delta por encima de
 * estos valores no puede venir del contador: es un error de digitación (p. ej. el
 * 14/10/2026 se escribió la potencia instantánea, 401, como "Kw de Inicio" en vez
 * de la lectura del contador, ~29.580, y el día sumó 29.194 MWh).
 * Un J320 entrega ~1 MW; se deja margen hasta 1,2 MWh por hora de horómetro.
 */
export const MAX_ENERGIA_POR_HORA = 1.2;
/** El histórico ronda 240 m³ por hora de motor; 600 deja margen amplio. */
export const MAX_M3_POR_HORA = 600;
export const MAX_HORAS_POR_REGISTRO = 24;
export const MAX_ARRANQUES_POR_REGISTRO = 20;

/**
 * Horas máximas sin ningún registro Jenbacher antes de considerarlo un vacío
 * de monitoreo. La operación es 24 h en dos turnos de 12 h y el histórico
 * muestra registros aproximadamente cada hora.
 */
export const MAX_HORAS_SIN_REGISTRO = 4;

/** Mínimo de registros Jenbacher esperados en un día completo de operación. */
export const MIN_REGISTROS_DIARIOS = 12;

// ── Planilla horaria ────────────────────────────────────────────────────────
//
// ⚠️ PRELIMINARES. Son los rangos de la fila "PARÁMETROS" del formato nuevo
// "Control diario a composición del biogás y potencia de Jenbacher". Hoy hay
// tres juegos distintos para el mismo gas (este formato, el informe de
// producción y UMBRALES_CALIDAD_GAS); los oficiales los define la Ing. Jimena.
// Estos solo colorean la planilla: el informe diario sigue con los de arriba.

export type UmbralPlanilla = Omit<Umbral, 'campo'>;

const CH4: UmbralPlanilla = { nombre: 'Metano (CH4)', unidad: '%', minimo: 50, severidad: 'critica', referencia: '> 50 %' };
const O2: UmbralPlanilla = { nombre: 'Oxígeno (O2)', unidad: '%', maximo: 2.5, severidad: 'critica', referencia: '< 2,5 %' };
const CO2: UmbralPlanilla = { nombre: 'Dióxido de carbono (CO2)', unidad: '%', maximo: 40, severidad: 'advertencia', referencia: '< 40 %' };

function h2s(maximo: number, severidad: Severidad): UmbralPlanilla {
  return { nombre: 'Ácido sulfhídrico (H2S)', unidad: 'ppm', maximo, severidad, referencia: `< ${maximo} ppm` };
}

/** El H2S se exige más a medida que el gas avanza hacia el motor. */
export const UMBRALES_PLANILLA_GAS: Record<PuntoMedicion, Record<Gas, UmbralPlanilla>> = {
  entrada_biofiltro: { ch4: CH4, o2: O2, co2: CO2, h2s: h2s(1000, 'advertencia') },
  salida_biofiltro: { ch4: CH4, o2: O2, co2: CO2, h2s: h2s(500, 'advertencia') },
  salida_biochar: { ch4: CH4, o2: O2, co2: CO2, h2s: h2s(300, 'critica') }
};

export const UMBRALES_PLANILLA_BIOFILTRO = {
  presionEntrada: { nombre: 'Presión entrada', unidad: 'cm H2O', maximo: 6, severidad: 'advertencia', referencia: '< 6 cm H2O' },
  presionSalida: { nombre: 'Presión salida', unidad: 'cm H2O', maximo: 10, severidad: 'advertencia', referencia: '< 10 cm H2O' },
  tempEntrada: { nombre: 'Temperatura entrada biofiltro', unidad: '°C', maximo: 38, severidad: 'advertencia', referencia: '< 38 °C' },
  tempSalida: { nombre: 'Temperatura salida biofiltro', unidad: '°C', maximo: 35, severidad: 'advertencia', referencia: '< 35 °C' }
} satisfies Record<string, UmbralPlanilla>;

/**
 * Límites físicos de una lectura de la planilla. Lo que los supera no puede
 * venir del analizador ni del tablero: es un error de digitación y se rechaza
 * antes de guardar. Preliminares, con margen amplio sobre la operación normal.
 * El m³ por hora de cada motor usa MAX_M3_POR_HORA.
 */
export const LIMITES_PLANILLA = {
  /** CH4 + O2 + CO2 de un mismo punto. El resto es N2, vapor y trazas; el margen cubre el error del analizador. */
  maxSumaGases: 105,
  /** Rango de los analizadores portátiles de biogás; 10× el umbral de entrada al biofiltro. */
  maxH2S: 10000,
  /** Un J320 entrega ~1 MW. */
  maxPotenciaKw: 1200,
  maxTemperatura: 80,
  maxPresion: 100
};

/** Evalúa un valor contra un umbral. Devuelve null si está dentro de rango. */
export function fueraDeRango(valor: number, umbral: Pick<Umbral, 'unidad' | 'minimo' | 'maximo'>): string | null {
  if (umbral.minimo !== undefined && valor < umbral.minimo) {
    return `${valor} ${umbral.unidad} (mínimo esperado ${umbral.minimo})`;
  }
  if (umbral.maximo !== undefined && valor > umbral.maximo) {
    return `${valor} ${umbral.unidad} (máximo esperado ${umbral.maximo})`;
  }
  return null;
}
