// Validación del reporte y del cierre de un apagón. Corre en la página (antes
// de enviar) y en la API (antes de guardar), con la misma hora "ahora" que
// entrega el servidor.

import { esFechaValida } from '../informe/fechas';
import {
  ALCANCES, AREAS, ORIGENES, esHoraLocal, minutosEntre,
  type Alcance, type AreaAfectada, type CierreApagon, type Origen, type ReporteApagon
} from './tipos';

export const MAX_TEXTO = 1000;
/** Holgura para relojes de celular adelantados unos minutos. */
const TOLERANCIA_FUTURO_MIN = 5;
/** Lo más atrás que se puede reportar un apagón desde la app. */
export const MAX_DIAS_ATRAS = 45;
/** Un apagón más largo que esto casi seguro es un error de fecha. */
const MAX_DURACION_MIN = 7 * 24 * 60;
const ID_REGISTRO = /^rec[A-Za-z0-9]{14}$/;

/** ¿`mes` es un YYYY-MM real? */
export function esMesValido(mes: string): boolean {
  return /^\d{4}-\d{2}$/.test(mes) && esFechaValida(`${mes}-01`);
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' ? (valor as Record<string, unknown>) : {};
}

function textoLibre(valor: unknown, etiqueta: string, errores: string[]): string {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto.length > MAX_TEXTO) errores.push(`${etiqueta}: máximo ${MAX_TEXTO} caracteres.`);
  return texto;
}

function validarFin(fin: unknown, inicio: string | null, ahora: string, errores: string[]): string | null {
  if (!esHoraLocal(fin)) {
    errores.push('Hora en que volvió la energía: no es válida.');
    return null;
  }
  if (minutosEntre(ahora, fin) > TOLERANCIA_FUTURO_MIN) {
    errores.push('Hora en que volvió la energía: todavía no llega.');
  }
  if (inicio) {
    const duracion = minutosEntre(inicio, fin);
    if (duracion <= 0) errores.push('La energía tuvo que volver después de irse. Revise las dos horas.');
    else if (duracion > MAX_DURACION_MIN) errores.push('El apagón dura más de 7 días. Revise las fechas.');
  }
  return fin;
}

type Resultado<T> = { valor: T; errores: [] } | { valor: null; errores: string[] };

export function validarReporte(cuerpo: unknown, ahora: string): Resultado<ReporteApagon> {
  const c = objeto(cuerpo);
  const errores: string[] = [];

  const inicio = esHoraLocal(c.inicio) ? c.inicio : null;
  if (!inicio) {
    errores.push('Hora en que se fue la energía: no es válida.');
  } else if (minutosEntre(ahora, inicio) > TOLERANCIA_FUTURO_MIN) {
    errores.push('Hora en que se fue la energía: todavía no llega.');
  } else if (minutosEntre(inicio, ahora) > MAX_DIAS_ATRAS * 24 * 60) {
    errores.push(`Solo se pueden reportar apagones de los últimos ${MAX_DIAS_ATRAS} días. Para uno más antiguo, avise a la jefatura de planta.`);
  }

  const fin = c.fin === null || c.fin === undefined || c.fin === '' ? null : validarFin(c.fin, inicio, ahora, errores);

  const origen = ORIGENES.includes(c.origen as Origen) ? (c.origen as Origen) : null;
  if (!origen) errores.push('Elija el origen del apagón. Si no se sabe, marque «Desconocido».');

  const alcance = ALCANCES.includes(c.alcance as Alcance) ? (c.alcance as Alcance) : null;
  if (!alcance) errores.push('Elija qué se quedó sin energía.');

  const areasCrudas = Array.isArray(c.areas) ? c.areas : [];
  const areas = AREAS.filter((a) => areasCrudas.includes(a)) as AreaAfectada[];
  if (areasCrudas.length !== areas.length) errores.push('Áreas afectadas: hay un área que no existe.');
  if (alcance === 'Áreas puntuales' && areas.length === 0) errores.push('Marque al menos un área afectada.');

  const motoresCrudos = Array.isArray(c.motores) ? c.motores : [];
  const motores = [...new Set(motoresCrudos.filter((m): m is string => typeof m === 'string' && ID_REGISTRO.test(m)))];
  if (motores.length !== motoresCrudos.length) errores.push('Motores afectados: hay un motor que no existe.');

  const descripcion = textoLibre(c.descripcion, 'Descripción', errores);
  const acciones = textoLibre(c.acciones, 'Acciones tomadas', errores);

  const operador = typeof c.operador === 'string' ? c.operador.trim() : '';
  if (!operador) errores.push('Falta el nombre de quien reporta. Inicie sesión de nuevo.');

  if (errores.length > 0 || !inicio || !origen || !alcance) return { valor: null, errores };
  return { valor: { inicio, fin, origen, alcance, areas, motores, descripcion, acciones, operador }, errores: [] };
}

/** `inicio` es el del apagón guardado; el servidor lo vuelve a leer de Airtable. */
export function validarCierre(cuerpo: unknown, inicio: string, ahora: string): Resultado<CierreApagon> {
  const c = objeto(cuerpo);
  const errores: string[] = [];

  const fin = validarFin(c.fin, inicio, ahora, errores);

  let origen: Origen | null = null;
  if (c.origen !== null && c.origen !== undefined && c.origen !== '') {
    if (ORIGENES.includes(c.origen as Origen)) origen = c.origen as Origen;
    else errores.push('Origen: no es una opción válida.');
  }

  const acciones = textoLibre(c.acciones, 'Acciones tomadas', errores);

  const operador = typeof c.operador === 'string' ? c.operador.trim() : '';
  if (!operador) errores.push('Falta el nombre de quien registra. Inicie sesión de nuevo.');

  if (errores.length > 0 || !fin) return { valor: null, errores };
  return { valor: { fin, origen, acciones, operador }, errores: [] };
}
