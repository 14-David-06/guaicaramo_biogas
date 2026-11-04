import 'server-only';

// Lecturas y escrituras de la planilla horaria en Airtable.
//
// Replica en el servidor las consultas que el formulario anterior hace desde
// el navegador (último estado y último monitoreo de cada motor, turno activo),
// para que la planilla no dependa del token expuesto en el cliente.

import {
  ErrorConfiguracion, TABLAS, actualizarRegistro, crearRegistros, registrosDelRango, registrosDonde, todosLosMotores,
  type RegistroAirtable
} from '../informe/airtable-server';
import { aHoraBogota, sumarDias } from '../informe/fechas';
import { fechaPlanillaDe } from './franjas';
import { CAMPO_MEDICION, GASES_MEDICION, type MedicionDigestor, type TomaRegistrada } from './mediciones';
import { camposDeRegistro, CAMPOS, VERSION_PLANILLA } from './campos';
import {
  CONTADORES, DEFINICION_CONTADOR,
  type DatosOperacionDia, type EntradaOperacion, type OperacionMotor, type ValoresContadores
} from './operacion';
import type { HoraPlanilla, LecturaHora, MotorPlanilla } from './tipos';
import { esIdRegistro } from './validacion';

export interface MotorConEnlaces extends MotorPlanilla {
  estadoId: string | null;
  monitoreoId: string | null;
}

function texto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(String).join(', ');
  return typeof valor === 'string' ? valor : '';
}

async function ultimoDelMotor(
  tablaId: string | undefined,
  nombreTabla: string,
  motorId: string,
  campoFecha: string
): Promise<RegistroAirtable | null> {
  if (!esIdRegistro(motorId)) return null;
  // El campo vinculado "Motor" se compara por el campo primario de Motores,
  // que es RECORD_ID(); igual que en el formulario anterior.
  const [registro] = await registrosDonde(tablaId, nombreTabla, `{Motor} = '${motorId}'`, {
    ordenarPor: campoFecha,
    descendente: true,
    maximo: 1
  });
  return registro ?? null;
}

/**
 * Estado actual de cada motor. Como el formulario anterior, un motor admite
 * lecturas si su último estado es "Encendido" y tiene al menos un monitoreo.
 */
export async function motoresConEstado(): Promise<MotorConEnlaces[]> {
  const motores = await todosLosMotores();
  const resultado: MotorConEnlaces[] = [];
  // Un motor a la vez: Airtable admite 5 solicitudes por segundo por base.
  for (const motor of motores) {
    const [estado, monitoreo] = await Promise.all([
      ultimoDelMotor(TABLAS.estadosMotores, 'Estados Motores', motor.id, 'Fecha y Hora'),
      ultimoDelMotor(TABLAS.monitoreoMotores, 'Monitoreo Motores', motor.id, 'Fecha de creacion')
    ]);
    resultado.push({
      id: motor.id,
      nombre: texto(motor.fields['Nombre Motor']).trim() || motor.id,
      encendido: estado?.fields['Estado Motor'] === 'Encendido',
      tieneMonitoreo: monitoreo !== null,
      estadoId: estado?.id ?? null,
      monitoreoId: monitoreo?.id ?? null
    });
  }
  return resultado.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Turno abierto más reciente ("Fecha Fin" vacía), o null si no hay. */
export async function turnoActivo(): Promise<{ id: string; operador: string } | null> {
  const [turno] = await registrosDonde(TABLAS.turnos, 'Turnos Operadores', `AND({Fecha Inicio} != BLANK(), {Fecha Fin} = BLANK())`, {
    ordenarPor: 'Fecha Inicio',
    descendente: true,
    maximo: 1
  });
  if (!turno) return null;
  return {
    id: turno.id,
    operador: texto(turno.fields['Realiza Registro']) || texto(turno.fields['Nombre del Operador'])
  };
}

export async function biodigestores(): Promise<{ id: string; nombre: string }[]> {
  const registros = await registrosDonde(TABLAS.biodigestores, 'Biodigestores', 'TRUE()');
  return registros
    .map((r) => ({ id: r.id, nombre: texto(r.fields['Nombre Biodigestores']).trim() || r.id }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}

/**
 * Registros de la planilla de un día (solo los creados desde la planilla).
 * `fecha` y `hora` deben llegar validados: se interpolan en la fórmula.
 */
export async function registrosDePlanilla(fecha: string, hora?: HoraPlanilla): Promise<RegistroAirtable[]> {
  const condiciones = [
    `{${CAMPOS.version}} = '${VERSION_PLANILLA}'`,
    `DATETIME_FORMAT({${CAMPOS.fechaPlanilla}}, 'YYYY-MM-DD') = '${fecha}'`
  ];
  if (hora) condiciones.push(`{${CAMPOS.hora}} = '${hora}'`);
  return registrosDonde(TABLAS.jenbacher, 'Registros Diarios Jenbacher', `AND(${condiciones.join(', ')})`);
}

/** Guarda una hora: un registro por motor, en un solo lote (todo o nada). */
export async function guardarHora(
  lectura: LecturaHora,
  motores: MotorConEnlaces[],
  turnoId: string | null
): Promise<RegistroAirtable[]> {
  const porId = new Map(motores.map((m) => [m.id, m]));
  const campos = lectura.motores.map((lecturaMotor) => {
    const motor = porId.get(lecturaMotor.motorId);
    if (!motor?.estadoId || !motor.monitoreoId) {
      throw new Error(`El motor ${lecturaMotor.motorId} no tiene estado o monitoreo para enlazar.`);
    }
    return camposDeRegistro(lectura, lecturaMotor, { estadoId: motor.estadoId, monitoreoId: motor.monitoreoId, turnoId });
  });
  return crearRegistros(TABLAS.jenbacher, 'Registros Diarios Jenbacher', campos);
}

// --- Datos de operación (una vez por día y por motor) ---

const TABLA_OPERACION = 'Datos Operacion Jenbacher';

function contadores(fields: Record<string, unknown>, extremo: 'inicial' | 'final'): ValoresContadores | null {
  const valores = {} as ValoresContadores;
  for (const c of CONTADORES) {
    const v = fields[DEFINICION_CONTADOR[c][extremo]];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    valores[c] = v;
  }
  return valores;
}

function operacionDesdeRegistro(r: RegistroAirtable): OperacionMotor {
  const motor = r.fields['Motor'];
  return {
    id: r.id,
    motorId: Array.isArray(motor) ? String(motor[0] ?? '') : '',
    inicial: contadores(r.fields, 'inicial'),
    final: contadores(r.fields, 'final'),
    registraInicio: texto(r.fields['Registra Inicio']),
    registraCierre: texto(r.fields['Registra Cierre'])
  };
}

/** Datos de operación de la planilla y los finales de la planilla anterior (`fecha` ya validada). */
export async function operacionDelDia(fecha: string): Promise<DatosOperacionDia> {
  const anterior = sumarDias(fecha, -1);
  const registros = await registrosDonde(
    TABLAS.operacionJenbacher,
    TABLA_OPERACION,
    `OR(DATETIME_FORMAT({Fecha planilla}, 'YYYY-MM-DD') = '${fecha}', DATETIME_FORMAT({Fecha planilla}, 'YYYY-MM-DD') = '${anterior}')`
  );
  const delDia: OperacionMotor[] = [];
  const finalAnterior: Record<string, ValoresContadores> = {};
  const abiertosAnterior: string[] = [];
  for (const r of registros) {
    const operacion = operacionDesdeRegistro(r);
    if (texto(r.fields['Fecha planilla']) === fecha) delDia.push(operacion);
    else if (operacion.final) finalAnterior[operacion.motorId] = operacion.final;
    else abiertosAnterior.push(operacion.motorId);
  }
  return { registros: delDia, finalAnterior, abiertosAnterior };
}

/** Igual que operacionDelDia, pero null si la tabla no está configurada: la planilla horaria sigue funcionando. */
export function operacionOpcional(fecha: string): Promise<DatosOperacionDia | null> {
  return operacionDelDia(fecha).catch((error) => {
    if (error instanceof ErrorConfiguracion) return null;
    throw error;
  });
}

/**
 * Crea el registro del día (iniciales, y finales si vinieron) o completa el
 * existente con los finales. Nunca reescribe iniciales ya guardados.
 */
export async function guardarOperacion(
  entrada: EntradaOperacion,
  existente: OperacionMotor | null,
  nombreMotor: string,
  turnoId: string | null
): Promise<string> {
  const campos: Record<string, unknown> = {};
  if (entrada.inicial) {
    for (const c of CONTADORES) campos[DEFINICION_CONTADOR[c].inicial] = entrada.inicial[c];
    campos['Registra Inicio'] = entrada.operador;
  }
  if (entrada.final) {
    for (const c of CONTADORES) campos[DEFINICION_CONTADOR[c].final] = entrada.final[c];
    campos['Registra Cierre'] = entrada.operador;
  }

  if (existente) {
    const registro = await actualizarRegistro(TABLAS.operacionJenbacher, TABLA_OPERACION, existente.id, campos);
    return registro.id;
  }

  campos['Clave'] = `${entrada.fecha} ${nombreMotor}`;
  campos['Fecha planilla'] = entrada.fecha;
  campos['Motor'] = [entrada.motorId];
  if (turnoId) campos['Turno'] = [turnoId];
  const [registro] = await crearRegistros(TABLAS.operacionJenbacher, TABLA_OPERACION, [campos]);
  return registro.id;
}

// --- Mediciones antes del biofiltro (por digestor) ---

const TABLA_MEDICIONES = 'Medicion Biodigestores';

/** Tomas de cada digestor dentro de la planilla `fecha` (de 06:00 a 06:00). */
export async function medicionesDePlanilla(fecha: string): Promise<TomaRegistrada[]> {
  const registros = await registrosDelRango(TABLAS.medicionBiodigestores, TABLA_MEDICIONES, fecha, sumarDias(fecha, 1));
  return registros
    .filter((r) => fechaPlanillaDe(new Date(r.createdTime)) === fecha)
    .sort((a, b) => a.createdTime.localeCompare(b.createdTime))
    .map((r) => {
      const digestor = r.fields['Biodigestor Monitoreado'];
      return {
        digestorId: Array.isArray(digestor) ? String(digestor[0] ?? '') : '',
        hora: aHoraBogota(r.createdTime),
        operador: texto(r.fields['Realiza Registro']),
        valores: Object.fromEntries(
          GASES_MEDICION.map((g) => {
            const v = r.fields[CAMPO_MEDICION[g]];
            return [g, typeof v === 'number' && Number.isFinite(v) ? v : null];
          })
        ) as TomaRegistrada['valores']
      };
    });
}

/** Una toma por digestor, en un solo lote (todo o nada). */
export async function guardarMediciones(
  mediciones: MedicionDigestor[],
  operador: string,
  turnoId: string | null
): Promise<RegistroAirtable[]> {
  return crearRegistros(
    TABLAS.medicionBiodigestores,
    TABLA_MEDICIONES,
    mediciones.map((m) => {
      const campos: Record<string, unknown> = {
        'Biodigestor Monitoreado': [m.digestorId],
        'Realiza Registro': operador
      };
      for (const g of GASES_MEDICION) campos[CAMPO_MEDICION[g]] = m.valores[g];
      // El enlace de turno de esta tabla apunta a "Turnos Operadores", como en el registro de biodigestores.
      if (turnoId) campos['Turno Biogas'] = [turnoId];
      return campos;
    })
  );
}
