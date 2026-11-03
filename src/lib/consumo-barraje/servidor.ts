import 'server-only';

// Lecturas y escrituras de la planilla de consumo kW barraje #2 en Airtable
// (tabla "Consumo KW Barraje 2").

import { TABLAS, crearRegistros, registrosDonde, type RegistroAirtable } from '../informe/airtable-server';
import { aFechaHoraBogota } from '../informe/fechas';
import { AREAS, DEFINICION_AREAS, type DiaConsumo, type LecturaConsumo, type ValoresConsumo } from './tipos';

const TABLA = 'Consumo KW Barraje 2';

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function diaDesdeRegistro(r: RegistroAirtable): DiaConsumo {
  const valores = {} as ValoresConsumo;
  for (const area of AREAS) valores[area] = numero(r.fields[DEFINICION_AREAS[area].campo]);
  return {
    id: r.id,
    fecha: texto(r.fields['Fecha']),
    valores,
    observaciones: texto(r.fields['Observaciones']),
    operador: texto(r.fields['Realiza Registro']),
    guardadoEl: aFechaHoraBogota(r.createdTime)
  };
}

/** Días registrados de un mes (YYYY-MM ya validado), en orden de fecha. */
export async function diasDelMes(mes: string): Promise<DiaConsumo[]> {
  const registros = await registrosDonde(TABLAS.consumoBarraje, TABLA, `DATETIME_FORMAT({Fecha}, 'YYYY-MM') = '${mes}'`, {
    ordenarPor: 'Fecha'
  });
  return registros.map(diaDesdeRegistro);
}

/** ¿Ya hay un registro para ese día (YYYY-MM-DD ya validado)? */
export async function existeDia(fecha: string): Promise<boolean> {
  const registros = await registrosDonde(TABLAS.consumoBarraje, TABLA, `DATETIME_FORMAT({Fecha}, 'YYYY-MM-DD') = '${fecha}'`, {
    maximo: 1
  });
  return registros.length > 0;
}

export async function guardarDia(lectura: LecturaConsumo, turnoId: string | null): Promise<string> {
  const campos: Record<string, unknown> = {
    Fecha: lectura.fecha,
    'Realiza Registro': lectura.operador
  };
  for (const area of AREAS) {
    const valor = lectura.valores[area];
    if (valor !== null) campos[DEFINICION_AREAS[area].campo] = valor;
  }
  if (lectura.observaciones) campos['Observaciones'] = lectura.observaciones;
  if (turnoId) campos['Turno'] = [turnoId];

  const [registro] = await crearRegistros(TABLAS.consumoBarraje, TABLA, [campos]);
  return registro.id;
}
