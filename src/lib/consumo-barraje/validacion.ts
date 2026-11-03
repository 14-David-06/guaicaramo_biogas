// Validación de un día de la planilla de consumo. Corre en la página (antes
// de enviar) y en la API (antes de guardar).

import { esFechaValida } from '../informe/fechas';
import { AREAS, DEFINICION_AREAS, type LecturaConsumo, type ValoresConsumo } from './tipos';

const MAX_OBSERVACIONES = 1000;
/** Tope de cordura para atajar dígitos de más; ningún área consume esto en un día. */
export const MAX_CONSUMO_DIA = 1_000_000;

/** Vacío → null; número o texto numérico (acepta coma decimal) → número; lo demás → 'invalido'. */
export function leerConsumo(valor: unknown): number | null | 'invalido' {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 'invalido';
  if (typeof valor !== 'string') return 'invalido';
  const limpio = valor.trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 'invalido';
}

/** ¿`mes` es un YYYY-MM real? */
export function esMesValido(mes: string): boolean {
  return /^\d{4}-\d{2}$/.test(mes) && esFechaValida(`${mes}-01`);
}

type Resultado = { lectura: LecturaConsumo; errores: [] } | { lectura: null; errores: string[] };

export function validarConsumo(cuerpo: unknown, hoy: string): Resultado {
  const c = cuerpo !== null && typeof cuerpo === 'object' ? (cuerpo as Record<string, unknown>) : {};
  const crudos = c.valores !== null && typeof c.valores === 'object' ? (c.valores as Record<string, unknown>) : {};
  const errores: string[] = [];

  const fecha = typeof c.fecha === 'string' ? c.fecha : '';
  if (!esFechaValida(fecha)) errores.push('Fecha: no es válida.');
  else if (fecha > hoy) errores.push('Fecha: no se puede registrar un día que todavía no llega.');

  const operador = typeof c.operador === 'string' ? c.operador.trim() : '';
  if (!operador) errores.push('Falta el nombre de quien registra. Inicie sesión de nuevo.');

  const valores = {} as ValoresConsumo;
  for (const area of AREAS) {
    const { etiqueta } = DEFINICION_AREAS[area];
    const n = leerConsumo(crudos[area]);
    if (n === 'invalido') {
      errores.push(`${etiqueta}: no es un número.`);
      valores[area] = null;
    } else if (n !== null && (n < 0 || n > MAX_CONSUMO_DIA)) {
      errores.push(`${etiqueta}: debe estar entre 0 y ${MAX_CONSUMO_DIA.toLocaleString('es-CO')}.`);
      valores[area] = null;
    } else {
      valores[area] = n;
    }
  }
  if (errores.length === 0 && AREAS.every((a) => valores[a] === null)) {
    errores.push('Escriba el consumo de al menos un área.');
  }

  const observaciones = typeof c.observaciones === 'string' ? c.observaciones.trim() : '';
  if (observaciones.length > MAX_OBSERVACIONES) errores.push(`Observaciones: máximo ${MAX_OBSERVACIONES} caracteres.`);

  if (errores.length > 0) return { lectura: null, errores };
  return { lectura: { fecha, operador, valores, observaciones }, errores: [] };
}
