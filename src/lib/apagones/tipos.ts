// Contrato del reporte de apagones (cortes de energía) de Guaicaramo.
//
// Un apagón se reporta cuando se va la energía (queda "en curso") y se cierra
// con la hora en que volvió. También se puede reportar uno que ya pasó, con
// inicio y fin de una vez. No importa nada del servidor: lo comparten la API
// y la página.
//
// Las horas viajan como hora local de Bogotá en el formato del campo
// datetime-local ("YYYY-MM-DDTHH:mm"), sin importar la zona del dispositivo.
// Solo el servidor las convierte a instantes UTC para Airtable.

export const ORIGENES = [
  'Red externa',
  'Disparo de motores Jenbacher',
  'Subestación o transformador',
  'Falla interna',
  'Clima o descarga atmosférica',
  'Mantenimiento programado',
  'Desconocido',
  'Otro'
] as const;
export type Origen = (typeof ORIGENES)[number];

/** Ayuda breve debajo de cada origen en el formulario. */
export const AYUDA_ORIGEN: Record<Origen, string> = {
  'Red externa': 'Se cayó la red del operador',
  'Disparo de motores Jenbacher': 'Los motores salieron y se perdió la generación',
  'Subestación o transformador': 'Falla en la subestación de la planta',
  'Falla interna': 'Tablero, protección o cableado de la planta',
  'Clima o descarga atmosférica': 'Tormenta, rayo, viento',
  'Mantenimiento programado': 'Corte planeado',
  'Desconocido': 'Todavía no se sabe; se puede corregir al cerrar',
  'Otro': 'Explíquelo en la descripción'
};

/** Nombre corto para indicadores y la tabla. */
export const ORIGEN_CORTO: Record<Origen, string> = {
  'Red externa': 'Red externa',
  'Disparo de motores Jenbacher': 'Disparo Jenbacher',
  'Subestación o transformador': 'Subestación',
  'Falla interna': 'Falla interna',
  'Clima o descarga atmosférica': 'Clima',
  'Mantenimiento programado': 'Mantenimiento',
  'Desconocido': 'Desconocido',
  'Otro': 'Otro'
};

export const ALCANCES =['Toda la planta', 'Planta de beneficio', 'Planta de biogás', 'Áreas puntuales'] as const;
export type Alcance = (typeof ALCANCES)[number];

export const AREAS_BIOGAS = ['Motores Jenbacher', 'Biodigestores y sopladores', 'Biofiltro', 'Cuarto de control'] as const;
export const AREAS_BENEFICIO = [
  'Recepción', 'Clarificación', 'Trituración', 'Extracción', 'Tusas', 'Desfibración', 'PKO', 'Subestación', 'Oficinas'
] as const;
export const AREAS = [...AREAS_BIOGAS, ...AREAS_BENEFICIO] as const;
export type AreaAfectada = (typeof AREAS)[number];

export interface MotorApagon {
  id: string;
  nombre: string;
}

/** Un apagón ya guardado. */
export interface Apagon {
  id: string;
  /** Hora local de Bogotá, YYYY-MM-DDTHH:mm. */
  inicio: string;
  /** Hora local de Bogotá, o null mientras sigue en curso. */
  fin: string | null;
  origen: Origen | null;
  alcance: Alcance | null;
  areas: AreaAfectada[];
  /** IDs de registros de la tabla Motores. */
  motores: string[];
  descripcion: string;
  acciones: string;
  reporta: string;
  cierra: string;
}

export interface RespuestaApagones {
  /** Mes consultado, YYYY-MM. */
  mes: string;
  /** Ahora en Bogotá, YYYY-MM-DDTHH:mm. */
  ahora: string;
  /** Apagones que empezaron en el mes, del más reciente al más antiguo. */
  apagones: Apagon[];
  /** Apagones sin hora de fin, de cualquier mes. */
  enCurso: Apagon[];
  motores: MotorApagon[];
  turno: { id: string; operador: string } | null;
}

/** Cuerpo del POST: un apagón nuevo. */
export interface ReporteApagon {
  inicio: string;
  /** null = sigue en curso. */
  fin: string | null;
  origen: Origen;
  alcance: Alcance;
  areas: AreaAfectada[];
  motores: string[];
  descripcion: string;
  acciones: string;
  operador: string;
}

/** Cuerpo del PATCH: la energía volvió. */
export interface CierreApagon {
  fin: string;
  /** Si viene, reemplaza el origen reportado (p. ej. Desconocido → Red externa). */
  origen: Origen | null;
  acciones: string;
  operador: string;
}

const HORA_LOCAL = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d$/;

/** ¿Es un "YYYY-MM-DDTHH:mm" con fecha real? */
export function esHoraLocal(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const m = HORA_LOCAL.exec(valor);
  if (!m) return false;
  const [anio, mes, dia] = m[1].split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/** Ahora en Bogotá (UTC−5 fijo), YYYY-MM-DDTHH:mm, según el reloj de quien lo llama. */
export function ahoraEnBogota(): string {
  return new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** Minutos de `desde` a `hasta` (ambos hora local); negativo si `hasta` es anterior. */
export function minutosEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta}:00Z`) - Date.parse(`${desde}:00Z`)) / 60_000);
}

/** Minutos sin energía; un apagón en curso cuenta hasta `ahora`. */
export function duracionMinutos(apagon: Pick<Apagon, 'inicio' | 'fin'>, ahora: string): number {
  return Math.max(0, minutosEntre(apagon.inicio, apagon.fin ?? ahora));
}

/** 45 → "45 min"; 135 → "2 h 15 min"; 1500 → "1 d 1 h". */
export function formatoDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas >= 24) {
    const dias = Math.floor(horas / 24);
    const h = horas % 24;
    return h ? `${dias} d ${h} h` : `${dias} d`;
  }
  return resto ? `${horas} h ${String(resto).padStart(2, '0')} min` : `${horas} h`;
}
