// Contrato de la planilla de consumo kW barraje #2.
//
// Lleva a la app el formato en papel "Planilla de consumo KW barraje #2" de la
// planta de beneficio (generación de energía): una fila por día del mes con
// el consumo del día de cada área. El operador escribe el consumo ya
// calculado; la app no resta lecturas. No importa nada del servidor: lo
// comparten la API y la página.

export const AREAS = [
  'barraje', 'recepcionL1', 'recepcionL2', 'clarificacionL1', 'clarificacionL2',
  'trituracionL1', 'trituracionL2', 'extraccionL1', 'extraccionL2',
  'tusas', 'desfibracion', 'pko', 'subestacion'
] as const;
export type Area = (typeof AREAS)[number];

/** Nombre corto (columna de la tabla) y nombre del campo en Airtable, en el orden del formato. */
export const DEFINICION_AREAS: Record<Area, { etiqueta: string; campo: string }> = {
  barraje: { etiqueta: 'Barraje #2', campo: 'KW Barraje 2' },
  recepcionL1: { etiqueta: 'Recepción L1', campo: 'KW Recepción L1' },
  recepcionL2: { etiqueta: 'Recepción L2', campo: 'KW Recepción L2' },
  clarificacionL1: { etiqueta: 'Clarificación L1', campo: 'KW Clarificación L1' },
  clarificacionL2: { etiqueta: 'Clarificación L2', campo: 'KW Clarificación L2' },
  trituracionL1: { etiqueta: 'Trituración L1', campo: 'KW Trituración L1' },
  trituracionL2: { etiqueta: 'Trituración L2', campo: 'KW Trituración L2' },
  extraccionL1: { etiqueta: 'Extracción L1', campo: 'KW Extracción L1' },
  extraccionL2: { etiqueta: 'Extracción L2', campo: 'KW Extracción L2' },
  tusas: { etiqueta: 'Tusas', campo: 'KW Tusas' },
  desfibracion: { etiqueta: 'Desfibración', campo: 'KW Desfibración' },
  pko: { etiqueta: 'PKO', campo: 'KW PKO' },
  subestacion: { etiqueta: 'Subestación', campo: 'KW Subestación' }
};

/**
 * Áreas de proceso de la planta. Barraje #2 y Subestación quedan aparte
 * porque no está confirmado si son totales que incluyen a las demás; hasta
 * saberlo no se comparan contra la suma de las áreas.
 */
export const AREAS_PROCESO: Area[] = AREAS.filter((a) => a !== 'barraje' && a !== 'subestacion');

export type ValoresConsumo = Record<Area, number | null>;

/** Un día ya guardado. */
export interface DiaConsumo {
  id: string;
  fecha: string;
  valores: ValoresConsumo;
  observaciones: string;
  operador: string;
  /** Fecha y hora local (DD/MM/YYYY HH:mm) en que se guardó. */
  guardadoEl: string;
}

export interface RespuestaConsumo {
  /** Mes consultado, YYYY-MM. */
  mes: string;
  /** Hoy en Bogotá, YYYY-MM-DD. */
  hoy: string;
  dias: DiaConsumo[];
  turno: { id: string; operador: string } | null;
}

/** Cuerpo del POST: un día de la planilla. */
export interface LecturaConsumo {
  fecha: string;
  operador: string;
  valores: ValoresConsumo;
  observaciones: string;
}
