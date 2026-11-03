// Calendario de la planilla horaria.
//
// La planilla en papel arranca a las 06:00 y termina a las 05:00 del día
// siguiente: la lectura de las 02:00 del 31/10 pertenece a la planilla del
// 30/10. El informe diario, en cambio, corta por día calendario; por eso cada
// registro guarda su "Fecha planilla" además de la fecha de creación.

import { aFechaBogota, aHoraBogota, rangoDiaBogota, sumarDias } from '../informe/fechas';
import { HORAS_PLANILLA, type HoraPlanilla } from './tipos';

export const HORA_INICIO_PLANILLA = 6;

/**
 * Minutos antes de una franja en que ya se puede registrar. El operario suele
 * tomar la lectura de las 11:00 un poco antes de la hora en punto.
 */
export const ADELANTO_PERMITIDO_MIN = 15;

const MS_POR_MINUTO = 60 * 1000;
const MS_POR_HORA = 60 * MS_POR_MINUTO;

export function esHoraPlanilla(valor: unknown): valor is HoraPlanilla {
  return typeof valor === 'string' && (HORAS_PLANILLA as readonly string[]).includes(valor);
}

/** Planilla (YYYY-MM-DD) a la que pertenece un instante. */
export function fechaPlanillaDe(instante: Date): string {
  return aFechaBogota(new Date(instante.getTime() - HORA_INICIO_PLANILLA * MS_POR_HORA));
}

/** Instante en que empieza una franja. Las de 00:00 a 05:00 caen el día calendario siguiente. */
export function inicioDeFranja(fecha: string, hora: HoraPlanilla): Date {
  const h = Number(hora.slice(0, 2));
  const dia = h >= HORA_INICIO_PLANILLA ? fecha : sumarDias(fecha, 1);
  return new Date(rangoDiaBogota(dia).inicio.getTime() + h * MS_POR_HORA);
}

/** Planilla y franja en curso. */
export function franjaActual(ahora: Date): { fecha: string; hora: HoraPlanilla } {
  return {
    fecha: fechaPlanillaDe(ahora),
    hora: `${aHoraBogota(ahora).slice(0, 2)}:00` as HoraPlanilla
  };
}

export function franjaYaEmpezo(fecha: string, hora: HoraPlanilla, ahora: Date): boolean {
  return inicioDeFranja(fecha, hora).getTime() - ADELANTO_PERMITIDO_MIN * MS_POR_MINUTO <= ahora.getTime();
}

/**
 * Solo se registra en la planilla actual y en la anterior: a las 06:10 el
 * operario que entrega turno todavía puede cargar la lectura de las 05:00.
 */
export function planillaEditable(fecha: string, ahora: Date): boolean {
  const actual = fechaPlanillaDe(ahora);
  return fecha === actual || fecha === sumarDias(actual, -1);
}
