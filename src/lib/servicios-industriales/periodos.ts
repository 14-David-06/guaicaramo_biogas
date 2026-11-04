// Meses y semanas del informe de Servicios Industriales.
//
// La semana es la ISO (lunes a domingo), la misma numeración que usa el
// informe en Excel de Servicios Industriales: la semana 44 de 2026 va del
// 26/10 al 01/11 y cruza de octubre a noviembre. No importa nada del servidor.

import { diaSemana, sumarDias } from '../informe/fechas';

export const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

/** "2026-10-28" → "OCTUBRE". */
export function nombreMes(fecha: string): string {
  return MESES[Number(fecha.slice(5, 7)) - 1];
}

/** Lunes de la semana de una fecha. */
export function lunesDe(fecha: string): string {
  const dia = diaSemana(fecha); // 0 = domingo
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}

/** Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves del año). */
export function semanaIso(fecha: string): number {
  const jueves = sumarDias(lunesDe(fecha), 3);
  const anio = jueves.slice(0, 4);
  const [a, m, d] = jueves.split('-').map(Number);
  const diaDelAnio = (Date.UTC(a, m - 1, d) - Date.UTC(Number(anio), 0, 1)) / 86_400_000;
  return Math.floor(diaDelAnio / 7) + 1;
}

/** Último día de un mes "YYYY-MM". */
export function finDeMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

export interface SemanaDelMes {
  numero: number;
  /** Lunes. */
  desde: string;
  /** Domingo. */
  hasta: string;
}

/** Semanas ISO que tocan un mes "YYYY-MM" (las de los bordes pueden cruzar de mes). */
export function semanasDelMes(mes: string): SemanaDelMes[] {
  const semanas: SemanaDelMes[] = [];
  const fin = finDeMes(mes);
  for (let lunes = lunesDe(`${mes}-01`); lunes <= fin; lunes = sumarDias(lunes, 7)) {
    semanas.push({ numero: semanaIso(lunes), desde: lunes, hasta: sumarDias(lunes, 6) });
  }
  return semanas;
}
