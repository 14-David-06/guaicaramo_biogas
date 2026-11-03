// Bloque "Datos de operación" de la planilla Jenbacher: horómetro, m³, kW y
// n.º de arranques, inicial y final, de cada motor. Se registra una sola vez
// por día y por motor, en dos pasos obligatorios: primero los iniciales y, ya
// guardados, los finales. Mientras un día tenga datos abiertos (iniciales sin
// finales) no se puede empezar la planilla siguiente.
//
// No importa nada del servidor: lo comparten la API y el formulario.

import { esFechaValida, sumarDias } from '../informe/fechas';
import { evaluarDeltas, UNIDAD_ENERGIA, type DeltaContador } from '../informe/contadores';
import { MAX_HORAS_POR_REGISTRO } from '../informe/umbrales';
import { nombreCortoMotor } from './campos';
import { planillaEditable } from './franjas';
import { esIdRegistro, leerNumero } from './validacion';

export const CONTADORES = ['horometro', 'm3', 'kw', 'arranques'] as const;
export type Contador = (typeof CONTADORES)[number];
export type ValoresContadores = Record<Contador, number>;

export const DEFINICION_CONTADOR: Record<Contador, { etiqueta: string; unidad: string; inicial: string; final: string }> = {
  horometro: { etiqueta: 'Horómetro', unidad: 'h', inicial: 'Horometro Inicial', final: 'Horometro Final' },
  m3: { etiqueta: 'M³ de biogás', unidad: 'm³', inicial: 'M3 Inicial', final: 'M3 Final' },
  kw: { etiqueta: 'kW (contador)', unidad: UNIDAD_ENERGIA, inicial: 'Kw Inicial', final: 'Kw Final' },
  arranques: { etiqueta: 'N.º de arranques', unidad: '', inicial: 'Arranques Inicial', final: 'Arranques Final' }
};

/** Datos de operación de un motor en un día, tal como están guardados. */
export interface OperacionMotor {
  id: string;
  motorId: string;
  inicial: ValoresContadores | null;
  final: ValoresContadores | null;
  registraInicio: string;
  registraCierre: string;
}

export interface DatosOperacionDia {
  registros: OperacionMotor[];
  /** Valores finales del día anterior por motor, para sugerir los iniciales. */
  finalAnterior: Record<string, ValoresContadores>;
  /** Motores con iniciales sin finales en la planilla anterior: bloquean esta. */
  abiertosAnterior: string[];
}

/** Texto del bloqueo cuando la planilla anterior tiene datos de operación sin cerrar. */
export function mensajeBloqueo(fechaAnterior: string, motores: string[]): string {
  const [anio, mes, dia] = fechaAnterior.split('-');
  return `Primero cierre los datos de operación de la planilla del ${dia}/${mes}/${anio} ` +
    `(${motores.join(' y ')}): faltan los valores finales.`;
}

/** Lo que llega del formulario, ya validado. */
export interface EntradaOperacion {
  fecha: string;
  motorId: string;
  operador: string;
  inicial: ValoresContadores | null;
  final: ValoresContadores | null;
}

export type CamposContadores = Record<Contador, string>;
export const CONTADORES_VACIOS: CamposContadores = { horometro: '', m3: '', kw: '', arranques: '' };

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

/**
 * Lee un grupo de cuatro contadores. Vacío del todo → null; incompleto o con
 * algo que no es un número ≥ 0 (entero, en los arranques) → errores.
 */
function leerGrupo(valor: unknown, nombre: string, errores: string[]): ValoresContadores | null {
  const v = objeto(valor);
  const leidos = CONTADORES.map((c) => [c, leerNumero(v[c])] as const);
  if (leidos.every(([, n]) => n === null)) return null;

  const resultado = {} as ValoresContadores;
  for (const [c, n] of leidos) {
    const { etiqueta } = DEFINICION_CONTADOR[c];
    if (n === null) errores.push(`${etiqueta} ${nombre}: es obligatorio.`);
    else if (n === 'invalido') errores.push(`${etiqueta} ${nombre}: no es un número.`);
    else if (n < 0) errores.push(`${etiqueta} ${nombre}: no puede ser negativo.`);
    else if (c === 'arranques' && !Number.isInteger(n)) errores.push(`${etiqueta} ${nombre}: debe ser un número entero.`);
    else resultado[c] = n;
  }
  return Object.keys(resultado).length === CONTADORES.length ? resultado : null;
}

/** Diferencias final − inicial, marcadas si son imposibles para un día de 24 h. */
export function deltasDelDia(inicial: ValoresContadores, final: ValoresContadores): DeltaContador[] {
  const lectura = (v: ValoresContadores) => ({ horometro: v.horometro, m3: v.m3, energia: v.kw, arranques: v.arranques });
  return evaluarDeltas(lectura(inicial), lectura(final), MAX_HORAS_POR_REGISTRO);
}

function mensajeDelta(d: DeltaContador): string {
  const valor = d.valor!.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  const nombre = { 'horómetro': 'Horómetro', 'm³': 'M³', 'energía': 'kW', arranques: 'Arranques' }[d.etiqueta];
  const maximo = (Math.round(d.maximo * 10) / 10).toLocaleString('es-CO');
  if (d.problema === 'negativo') {
    return `${nombre}: el valor final es menor que el inicial (${valor} ${d.unidad}). Un contador acumulado no retrocede.`;
  }
  return d.etiqueta === 'arranques'
    ? `Arranques: el día suma ${valor}, más del máximo de ${maximo} por día.`
    : `${nombre}: el día suma ${valor} ${d.unidad}, más de lo posible en 24 horas (máximo ${maximo} ${d.unidad}).`;
}

/**
 * Valida un envío del bloque. `inicialGuardado` son los iniciales que ya
 * están en la base para ese motor y día (null si todavía no hay registro):
 * - sin registro: solo se aceptan los iniciales; los finales llegan después;
 * - con iniciales guardados: se envían los finales (los iniciales no cambian).
 */
export function validarOperacion(
  cuerpo: unknown,
  inicialGuardado: ValoresContadores | null
): { entrada: EntradaOperacion; errores: [] } | { entrada: null; errores: string[] } {
  const c = objeto(cuerpo);
  const errores: string[] = [];

  const fecha = typeof c.fecha === 'string' && esFechaValida(c.fecha) ? c.fecha : null;
  if (!fecha) errores.push('Fecha de la planilla inválida.');
  const motorId = esIdRegistro(c.motorId) ? c.motorId : null;
  if (!motorId) errores.push('Motor inválido.');
  const operador = typeof c.operador === 'string' ? c.operador.trim() : '';
  if (!operador) errores.push('Falta el nombre de quien registra.');

  let inicial: ValoresContadores | null = null;
  let final: ValoresContadores | null = null;

  if (!inicialGuardado) {
    inicial = leerGrupo(c.inicial, 'inicial', errores);
    if (!inicial && !errores.some((e) => e.includes('inicial'))) {
      errores.push('Digite el horómetro, los m³, los kW y los arranques iniciales.');
    }
    if (leerGrupo(c.final, 'final', []) !== null) {
      errores.push('Primero guarde los valores iniciales; los finales se habilitan después.');
    }
  } else {
    final = leerGrupo(c.final, 'final', errores);
    if (!final && !errores.some((e) => e.includes('final'))) {
      errores.push('Digite el horómetro, los m³, los kW y los arranques finales.');
    }

    if (final) {
      for (const d of deltasDelDia(inicialGuardado, final)) if (d.problema) errores.push(mensajeDelta(d));
    }
  }

  if (errores.length > 0 || !fecha || !motorId) return { entrada: null, errores };
  return { entrada: { fecha, motorId, operador, inicial, final }, errores: [] };
}

/**
 * Motores con datos de operación abiertos en la planilla anterior. Solo bloquean
 * si esa planilla todavía se puede cerrar: una más vieja ya no admite registros.
 */
export function bloqueoDe(
  fecha: string,
  operacion: DatosOperacionDia | null,
  motores: { id: string; nombre: string }[],
  ahora: Date
): { fechaAnterior: string; motores: string[] } | null {
  const fechaAnterior = sumarDias(fecha, -1);
  if (!operacion || operacion.abiertosAnterior.length === 0 || !planillaEditable(fechaAnterior, ahora)) return null;
  const nombres = operacion.abiertosAnterior.map((id) => nombreCortoMotor(motores.find((m) => m.id === id)?.nombre ?? id));
  return { fechaAnterior, motores: nombres };
}
