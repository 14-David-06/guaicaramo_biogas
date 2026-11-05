import 'server-only';

// Lecturas y escrituras del reporte de apagones en Airtable (tabla "Apagones").

import { TABLAS, actualizarRegistro, crearRegistros, registrosDonde, todosLosMotores, type RegistroAirtable } from '../informe/airtable-server';
import { aFechaBogota, aHoraBogota } from '../informe/fechas';
import {
  ALCANCES, AREAS, ORIGENES,
  type Alcance, type Apagon, type AreaAfectada, type CierreApagon, type MotorApagon, type Origen, type ReporteApagon
} from './tipos';

const TABLA = 'Apagones';
const ID_REGISTRO = /^rec[A-Za-z0-9]{14}$/;

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

/** Instante UTC → hora local de Bogotá, YYYY-MM-DDTHH:mm. */
function aHoraLocal(instante: Date | string): string {
  return `${aFechaBogota(instante)}T${aHoraBogota(instante)}`;
}

/** Hora local de Bogotá (YYYY-MM-DDTHH:mm) → instante ISO en UTC. Bogotá no tiene horario de verano. */
function aInstante(horaLocal: string): string {
  return new Date(`${horaLocal}:00-05:00`).toISOString();
}

/** Ahora en Bogotá, YYYY-MM-DDTHH:mm. */
export function ahoraBogota(): string {
  return aHoraLocal(new Date());
}

function apagonDesdeRegistro(r: RegistroAirtable): Apagon {
  const f = r.fields;
  const origen = texto(f['Origen']);
  const alcance = texto(f['Alcance']);
  const areas = Array.isArray(f['Áreas afectadas']) ? (f['Áreas afectadas'] as unknown[]) : [];
  const motores = Array.isArray(f['Motores afectados']) ? (f['Motores afectados'] as unknown[]) : [];
  return {
    id: r.id,
    inicio: f['Inicio'] ? aHoraLocal(texto(f['Inicio'])) : aHoraLocal(r.createdTime),
    fin: f['Fin'] ? aHoraLocal(texto(f['Fin'])) : null,
    origen: ORIGENES.includes(origen as Origen) ? (origen as Origen) : null,
    alcance: ALCANCES.includes(alcance as Alcance) ? (alcance as Alcance) : null,
    areas: AREAS.filter((a) => areas.includes(a)) as AreaAfectada[],
    motores: motores.filter((m): m is string => typeof m === 'string'),
    descripcion: texto(f['Descripción']),
    acciones: texto(f['Acciones tomadas']),
    reporta: texto(f['Reporta']),
    cierra: texto(f['Cierra'])
  };
}

/**
 * Apagones que empezaron en el mes (YYYY-MM ya validado) más los que siguen
 * en curso, de cualquier mes. Del más reciente al más antiguo.
 */
export async function apagonesDelMes(mes: string): Promise<{ apagones: Apagon[]; enCurso: Apagon[] }> {
  const delMes = `DATETIME_FORMAT(SET_TIMEZONE({Inicio}, 'America/Bogota'), 'YYYY-MM') = '${mes}'`;
  const registros = await registrosDonde(TABLAS.apagones, TABLA, `OR(${delMes}, {Fin} = BLANK())`, {
    ordenarPor: 'Inicio',
    descendente: true
  });
  const todos = registros.map(apagonDesdeRegistro);
  return {
    apagones: todos.filter((a) => a.inicio.startsWith(mes)),
    enCurso: todos.filter((a) => a.fin === null)
  };
}

/** Apagones todavía sin hora de fin. */
export async function apagonesEnCurso(): Promise<Apagon[]> {
  const registros = await registrosDonde(TABLAS.apagones, TABLA, `{Fin} = BLANK()`, { ordenarPor: 'Inicio', descendente: true });
  return registros.map(apagonDesdeRegistro);
}

export async function apagonPorId(id: string): Promise<Apagon | null> {
  if (!ID_REGISTRO.test(id)) return null;
  const [registro] = await registrosDonde(TABLAS.apagones, TABLA, `RECORD_ID() = '${id}'`, { maximo: 1 });
  return registro ? apagonDesdeRegistro(registro) : null;
}

/** Catálogo de motores para marcar cuáles se apagaron. */
export async function motoresParaApagon(): Promise<MotorApagon[]> {
  const motores = await todosLosMotores();
  return motores
    .map((m) => ({ id: m.id, nombre: texto(m.fields['Nombre Motor']).replace(/\s+/g, ' ').trim() || m.id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export async function guardarApagon(reporte: ReporteApagon, turnoId: string | null): Promise<string> {
  const campos: Record<string, unknown> = {
    Inicio: aInstante(reporte.inicio),
    Origen: reporte.origen,
    Alcance: reporte.alcance,
    Reporta: reporte.operador
  };
  if (reporte.fin) {
    campos['Fin'] = aInstante(reporte.fin);
    campos['Cierra'] = reporte.operador;
  }
  if (reporte.areas.length) campos['Áreas afectadas'] = reporte.areas;
  if (reporte.motores.length) campos['Motores afectados'] = reporte.motores;
  if (reporte.descripcion) campos['Descripción'] = reporte.descripcion;
  if (reporte.acciones) campos['Acciones tomadas'] = reporte.acciones;
  if (turnoId) campos['Turno'] = [turnoId];

  const [registro] = await crearRegistros(TABLAS.apagones, TABLA, [campos]);
  return registro.id;
}

/** Registra el restablecimiento. Las acciones se agregan a las que ya hubiera. */
export async function cerrarApagon(apagon: Apagon, cierre: CierreApagon): Promise<void> {
  const campos: Record<string, unknown> = {
    Fin: aInstante(cierre.fin),
    Cierra: cierre.operador
  };
  if (cierre.origen) campos['Origen'] = cierre.origen;
  if (cierre.acciones) {
    campos['Acciones tomadas'] = [apagon.acciones.trim(), cierre.acciones].filter(Boolean).join('\n');
  }
  await actualizarRegistro(TABLAS.apagones, TABLA, apagon.id, campos);
}
