import 'server-only';

// Cliente de Airtable exclusivo del servidor.
//
// A diferencia de src/utils/airtable.ts (que corre en el navegador con
// NEXT_PUBLIC_AIRTABLE_API_TOKEN), este módulo solo se ejecuta en API routes.
// Prefiere AIRTABLE_API_TOKEN — la variable sin el prefijo NEXT_PUBLIC, que
// nunca llega al bundle del cliente. Es la base sobre la que se migrará el
// resto del acceso a datos (RNF-06).

import { rangoDiaBogota } from './fechas';

const TOKEN = process.env.AIRTABLE_API_TOKEN ?? process.env.NEXT_PUBLIC_AIRTABLE_API_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID ?? process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID;

if (process.env.AIRTABLE_API_TOKEN === undefined && TOKEN) {
  console.warn(
    '[informe] AIRTABLE_API_TOKEN no está definido; usando NEXT_PUBLIC_AIRTABLE_API_TOKEN. ' +
    'Define la variable sin prefijo NEXT_PUBLIC para que el token no viaje al navegador.'
  );
}

export const TABLAS = {
  turnos: process.env.NEXT_PUBLIC_TURNOS_TABLE_ID,
  jenbacher: process.env.NEXT_PUBLIC_REGISTRO_DIARIOS_JENBACHER_TABLE_ID,
  monitoreoMotores: process.env.NEXT_PUBLIC_MONITOREO_MOTORES_TABLE_ID,
  estadosMotores: process.env.NEXT_PUBLIC_ESTADOS_MOTORES_TABLE_ID,
  bitacora: process.env.NEXT_PUBLIC_BITACORA_BIOGAS_TABLE_ID,
  medicionBiodigestores: process.env.NEXT_PUBLIC_MEDICION_BIODIGESTORES_TABLE_ID,
  motores: process.env.NEXT_PUBLIC_MOTORES_TABLE_ID,
  biodigestores: process.env.NEXT_PUBLIC_BIODIGESTORES_TABLE_ID,
  // "Entradas y Salidas de biofiltros": H2S antes y después de cada etapa de filtrado.
  biofiltros: process.env.BIOFILTROS_TABLE_ID,
  // "Consumo KW Barraje 2": consumo del día por área de la planta de beneficio.
  consumoBarraje: process.env.CONSUMO_BARRAJE_TABLE_ID,
  // "Datos Operacion Jenbacher": horómetro, m³, kW y arranques de cada motor, una vez por día.
  operacionJenbacher: process.env.OPERACION_JENBACHER_TABLE_ID
};

export interface RegistroAirtable {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export class ErrorConfiguracion extends Error {}

export class ErrorAirtable extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function verificarConfiguracion(tabla: string | undefined, nombre: string): string {
  if (!TOKEN || !BASE_ID) {
    throw new ErrorConfiguracion('Faltan AIRTABLE_API_TOKEN o AIRTABLE_BASE_ID en las variables de entorno.');
  }
  if (!tabla) {
    throw new ErrorConfiguracion(`Falta el ID de la tabla "${nombre}" en las variables de entorno.`);
  }
  return tabla;
}

/**
 * Trae todas las páginas de una consulta, siguiendo el cursor `offset` de Airtable.
 * `campos` limita los campos devueltos: en consultas de un año entero reduce
 * bastante el tamaño de cada página.
 */
async function consultarTodo(tablaId: string, params: Record<string, string>, campos?: string[]): Promise<RegistroAirtable[]> {
  const registros: RegistroAirtable[] = [];
  let offset: string | undefined;

  do {
    const query = new URLSearchParams({ ...params, pageSize: '100' });
    for (const campo of campos ?? []) query.append('fields[]', campo);
    if (offset) query.set('offset', offset);

    const respuesta = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tablaId}?${query.toString()}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: 'no-store'
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text();
      throw new ErrorAirtable(
        `Airtable respondió ${respuesta.status} para la tabla ${tablaId}: ${cuerpo.slice(0, 300)}`,
        respuesta.status
      );
    }

    const datos = (await respuesta.json()) as { records: RegistroAirtable[]; offset?: string };
    registros.push(...datos.records);
    offset = datos.offset;
  } while (offset);

  return registros;
}

/**
 * Registros creados entre el inicio del día `desde` y el fin del día `hasta`
 * (días calendario de Bogotá, ambos incluidos).
 *
 * Se filtra por CREATED_TIME() y no por un campo de fecha propio porque todas
 * las tablas de la base ("Fecha Registro", "Fecha de creacion", "Fecha y Hora",
 * "Fecha Medicion") son campos de tipo createdTime: contienen exactamente el
 * mismo instante, pero con nombres distintos en cada tabla. Se compara contra
 * los instantes UTC del corte local para que la medianoche sea la de Bogotá.
 */
export async function registrosDelRango(
  tablaId: string | undefined,
  nombreTabla: string,
  desde: string,
  hasta: string,
  campos?: string[]
): Promise<RegistroAirtable[]> {
  const tabla = verificarConfiguracion(tablaId, nombreTabla);
  const { inicio } = rangoDiaBogota(desde);
  const { fin } = rangoDiaBogota(hasta);
  const formula =
    `AND(` +
    `NOT(IS_BEFORE(CREATED_TIME(), DATETIME_PARSE('${inicio.toISOString()}'))), ` +
    `IS_BEFORE(CREATED_TIME(), DATETIME_PARSE('${fin.toISOString()}'))` +
    `)`;
  return consultarTodo(tabla, { filterByFormula: formula }, campos);
}

/** Registros creados dentro de un día calendario de Bogotá. */
export async function registrosDelDia(
  tablaId: string | undefined,
  nombreTabla: string,
  fecha: string
): Promise<RegistroAirtable[]> {
  return registrosDelRango(tablaId, nombreTabla, fecha, fecha);
}

/**
 * Turnos que estuvieron activos en algún momento del rango de días.
 *
 * No se filtra por fecha de creación: un turno de noche abre a las 18:00 de un
 * día y cierra a las 06:00 del siguiente, así que aparece en ambos informes.
 * Un turno todavía abierto ("Fecha Fin" vacía) cuenta como activo.
 */
export async function turnosDelRango(desde: string, hasta: string): Promise<RegistroAirtable[]> {
  const tabla = verificarConfiguracion(TABLAS.turnos, 'Turnos Operadores');
  const { inicio } = rangoDiaBogota(desde);
  const { fin } = rangoDiaBogota(hasta);
  const formula =
    `AND(` +
    `IS_BEFORE({Fecha Inicio}, DATETIME_PARSE('${fin.toISOString()}')), ` +
    `OR({Fecha Fin} = BLANK(), IS_AFTER({Fecha Fin}, DATETIME_PARSE('${inicio.toISOString()}')))` +
    `)`;
  return consultarTodo(tabla, {
    filterByFormula: formula,
    'sort[0][field]': 'Fecha Inicio',
    'sort[0][direction]': 'asc'
  });
}

/**
 * Registros que cumplen una fórmula de Airtable. Quien llama es responsable de
 * que los valores interpolados en la fórmula estén validados.
 */
export async function registrosDonde(
  tablaId: string | undefined,
  nombreTabla: string,
  formula: string,
  opciones: { ordenarPor?: string; descendente?: boolean; maximo?: number } = {}
): Promise<RegistroAirtable[]> {
  const tabla = verificarConfiguracion(tablaId, nombreTabla);
  const params: Record<string, string> = { filterByFormula: formula };
  if (opciones.ordenarPor) {
    params['sort[0][field]'] = opciones.ordenarPor;
    params['sort[0][direction]'] = opciones.descendente ? 'desc' : 'asc';
  }
  if (opciones.maximo) params.maxRecords = String(opciones.maximo);
  return consultarTodo(tabla, params);
}

/**
 * Crea hasta 10 registros en un solo request. Airtable valida el lote completo
 * antes de escribir: si un registro falla, no se crea ninguno.
 */
export async function crearRegistros(
  tablaId: string | undefined,
  nombreTabla: string,
  campos: Record<string, unknown>[]
): Promise<RegistroAirtable[]> {
  const tabla = verificarConfiguracion(tablaId, nombreTabla);
  if (campos.length === 0 || campos.length > 10) {
    throw new Error(`crearRegistros admite de 1 a 10 registros por llamada; llegaron ${campos.length}.`);
  }

  const respuesta = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tabla}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: campos.map((fields) => ({ fields })), typecast: true }),
    cache: 'no-store'
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new ErrorAirtable(`Airtable respondió ${respuesta.status} al crear registros en ${nombreTabla}: ${cuerpo.slice(0, 300)}`, respuesta.status);
  }

  return ((await respuesta.json()) as { records: RegistroAirtable[] }).records;
}

/** Actualiza campos de un registro existente; los campos que no se envían no cambian. */
export async function actualizarRegistro(
  tablaId: string | undefined,
  nombreTabla: string,
  id: string,
  campos: Record<string, unknown>
): Promise<RegistroAirtable> {
  const tabla = verificarConfiguracion(tablaId, nombreTabla);
  const respuesta = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tabla}/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: campos, typecast: true }),
    cache: 'no-store'
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new ErrorAirtable(`Airtable respondió ${respuesta.status} al actualizar ${nombreTabla}: ${cuerpo.slice(0, 300)}`, respuesta.status);
  }

  return (await respuesta.json()) as RegistroAirtable;
}

/** Catálogo completo de motores (4 registros). */
export async function todosLosMotores(): Promise<RegistroAirtable[]> {
  const tabla = verificarConfiguracion(TABLAS.motores, 'Motores');
  return consultarTodo(tabla, {});
}

/**
 * Registra una medición de H2S en "Entradas y Salidas de biofiltros".
 *
 * El campo "Turno" de esa tabla apunta a la tabla legacy "Turnos Biogas", que ya
 * no recibe turnos; por eso la medición se guarda sin enlace a turno y se
 * asocia al día por su fecha de creación, igual que el resto del informe.
 */
export async function crearMedicionRemocion(campos: {
  operador: string;
  entradaBiofiltro: number;
  salidaBiofiltro: number | null;
  salidaBiochar: number | null;
}): Promise<RegistroAirtable> {
  const tabla = verificarConfiguracion(TABLAS.biofiltros, 'Entradas y Salidas de biofiltros');
  const fields: Record<string, unknown> = {
    'Nombre Operador': campos.operador,
    'Entrada Biofiltro': campos.entradaBiofiltro
  };
  if (campos.salidaBiofiltro !== null) fields['Salida Biofiltro'] = campos.salidaBiofiltro;
  if (campos.salidaBiochar !== null) fields['Salida Filtro Biochar'] = campos.salidaBiochar;

  const respuesta = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${tabla}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields, typecast: true }),
    cache: 'no-store'
  });

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new ErrorAirtable(`Airtable respondió ${respuesta.status} al registrar la medición: ${cuerpo.slice(0, 300)}`, respuesta.status);
  }

  return (await respuesta.json()) as RegistroAirtable;
}
