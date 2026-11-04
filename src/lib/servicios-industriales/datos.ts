import 'server-only';

// Lectura de Airtable para el informe de Servicios Industriales — Biogás.
//
// Arma un acumulador por motor y por día con dos fuentes:
//
// 1. Energía, m³, horas y arranques: deltas de los contadores. Para cada motor
//    y día se usa "Datos Operacion Jenbacher" (inicial/final de la planilla) si
//    el registro del día está completo; si no, la suma de los registros de
//    "Monitoreo Motores" creados ese día, corregidos por continuidad entre
//    registros vecinos (ver continuidad.ts). Nunca las dos a la vez, para no
//    contar doble.
// 2. Gas, potencia, flujo, presión y temperatura: lecturas horarias de
//    "Registros Diarios Jenbacher". El día es el de la planilla ("Fecha
//    planilla", de 06:00 a 05:00) cuando el registro lo trae, o el día
//    calendario en que se creó.
//
// El contador de energía está en MWh y el informe de Servicios Industriales
// reporta kWh: el delta se multiplica por 1.000.

import { registrosDelRango, todosLosMotores, TABLAS, type RegistroAirtable } from '../informe/airtable-server';
import { lecturasDeMonitoreo, type DeltaContador } from '../informe/contadores';
import { aFechaBogota, diasDelRango, sumarDias } from '../informe/fechas';
import { MAX_HORAS_POR_REGISTRO } from '../informe/umbrales';
import { nombreCortoMotor } from '../planilla/campos';
import { deltasPorContinuidad, type Contador } from './continuidad';
import { CONTADORES, DEFINICION_CONTADOR, deltasDelDia, type ValoresContadores } from '../planilla/operacion';
import {
  acumuladorVacio, CAMPO_VARIABLE, VARIABLES_GAS, type Acumulador, type Observacion
} from './indicadores';

const KWH_POR_MWH = 1000;

const CAMPO_MOTOR_JENBACHER = 'Nombre Motor (from Monitoreo Motores)';
const CAMPO_FECHA_PLANILLA = 'Fecha planilla';
const CAMPOS_JENBACHER = [...Object.values(CAMPO_VARIABLE), CAMPO_MOTOR_JENBACHER, CAMPO_FECHA_PLANILLA];

/** Consultas simultáneas a Airtable (límite de 5 solicitudes por segundo por base). */
const CONCURRENCIA = 3;
const DIAS_POR_TRAMO = 31;
/** Días antes y después del rango que se consultan para encontrar el registro vecino de cada motor. */
const MARGEN_CONTINUIDAD = 5;
const MS_POR_HORA = 3_600_000;
/** Margen entre la hora en que se abre un registro y la lectura real del horómetro. */
const HOLGURA_HORAS = 2;
/** Un registro que cubre más de esto se reparte entre los días que abarcó. */
const UMBRAL_REPARTO_HORAS = 36;

export interface DatosPorDia {
  /** fecha → motor → acumulador. Incluye todos los días del rango, aunque estén vacíos. */
  porDia: Map<string, Record<string, Acumulador>>;
  motores: string[];
  observaciones: Observacion[];
  conteos: { monitoreos: number; datosOperacion: number; lecturasJenbacher: number };
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function texto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(String).join(', ');
  return typeof valor === 'string' ? valor : '';
}

function primerEnlace(valor: unknown): string {
  return Array.isArray(valor) && valor.length > 0 ? String(valor[0]) : '';
}

/** Ejecuta tareas con un máximo de `limite` a la vez, conservando el orden. */
async function enParalelo<T>(tareas: (() => Promise<T>)[], limite: number): Promise<T[]> {
  const resultados: T[] = new Array(tareas.length);
  let siguiente = 0;
  async function trabajador() {
    while (siguiente < tareas.length) {
      const i = siguiente++;
      resultados[i] = await tareas[i]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, tareas.length) }, trabajador));
  return resultados;
}

/** Registros Jenbacher del rango, consultados por tramos en paralelo (un año son ~70 páginas). */
async function lecturasJenbacher(desde: string, hasta: string): Promise<RegistroAirtable[]> {
  const tramos: [string, string][] = [];
  for (let inicio = desde; inicio <= hasta; inicio = sumarDias(inicio, DIAS_POR_TRAMO)) {
    const fin = sumarDias(inicio, DIAS_POR_TRAMO - 1);
    tramos.push([inicio, fin < hasta ? fin : hasta]);
  }
  const paginas = await enParalelo(
    tramos.map(([a, b]) => () => registrosDelRango(TABLAS.jenbacher, 'Registros Diarios Jenbacher', a, b, CAMPOS_JENBACHER)),
    CONCURRENCIA
  );
  return paginas.flat();
}

function contadoresOperacion(fields: Record<string, unknown>, extremo: 'inicial' | 'final'): ValoresContadores | null {
  const valores = {} as ValoresContadores;
  for (const c of CONTADORES) {
    const v = numero(fields[DEFINICION_CONTADOR[c][extremo]]);
    if (v === null) return null;
    valores[c] = v;
  }
  return valores;
}

const NOMBRE_DELTA: Record<DeltaContador['etiqueta'], string> = {
  'energía': 'energía', 'm³': 'm³', 'horómetro': 'horómetro', arranques: 'arranques'
};

function describirProblema(d: DeltaContador): string {
  const valor = d.valor!.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return d.problema === 'negativo'
    ? `${NOMBRE_DELTA[d.etiqueta]}: el final es menor que el inicial (${valor} ${d.unidad})`
    : `${NOMBRE_DELTA[d.etiqueta]}: ${valor} ${d.unidad}, más del máximo posible (${Math.round(d.maximo * 10) / 10})`;
}

/** Suma al acumulador los deltas de un registro (energía en MWh) y alimenta las razones. */
function sumarValores(acumulador: Acumulador, valores: Record<Contador, number | null>) {
  const sumar = (actual: number | null, delta: number | null) => (delta === null ? actual : (actual ?? 0) + delta);
  const kwh = valores.energia === null ? null : valores.energia * KWH_POR_MWH;
  const { m3, horometro: horas } = valores;
  acumulador.kwh = sumar(acumulador.kwh, kwh);
  acumulador.m3 = sumar(acumulador.m3, m3);
  acumulador.horas = sumar(acumulador.horas, horas);
  acumulador.arranques = sumar(acumulador.arranques, valores.arranques);

  const par = (p: keyof Acumulador['pares'], x: number | null, y: number | null) => {
    if (x === null || y === null) return;
    acumulador.pares[p].a += x;
    acumulador.pares[p].b += y;
  };
  par('kwhHoras', kwh, horas);
  par('m3Horas', m3, horas);
  par('kwhM3', kwh, m3);
}

function valoresDeDeltas(deltas: DeltaContador[]): Record<Contador, number | null> {
  const de = (etiqueta: DeltaContador['etiqueta']) => {
    const d = deltas.find((x) => x.etiqueta === etiqueta);
    return d && d.problema === null ? d.valor : null;
  };
  return { horometro: de('horómetro'), energia: de('energía'), m3: de('m³'), arranques: de('arranques') };
}

/** Acumuladores por motor y por día del rango [desde, hasta]. */
export async function datosPorDia(desde: string, hasta: string): Promise<DatosPorDia> {
  // Un día de planilla termina a las 06:00 del siguiente: se consulta un día más
  // y se descarta lo que no pertenezca al rango.
  const hastaConsulta = sumarDias(hasta, 1);
  const [motoresAirtable, monitoreos, operaciones] = await Promise.all([
    todosLosMotores(),
    // Con márgenes: el registro anterior y el siguiente sirven para corregir por continuidad.
    registrosDelRango(TABLAS.monitoreoMotores, 'Monitoreo Motores', sumarDias(desde, -MARGEN_CONTINUIDAD), sumarDias(hasta, MARGEN_CONTINUIDAD)),
    TABLAS.operacionJenbacher
      ? registrosDelRango(TABLAS.operacionJenbacher, 'Datos Operacion Jenbacher', desde, hastaConsulta)
      : Promise.resolve([] as RegistroAirtable[])
  ]);
  const jenbacher = await lecturasJenbacher(desde, hastaConsulta);

  const nombrePorId = new Map(motoresAirtable.map((m) => [m.id, nombreCortoMotor(texto(m.fields['Nombre Motor']))]));
  const dias = diasDelRango(desde, hasta);
  const porDia = new Map<string, Record<string, Acumulador>>(dias.map((d) => [d, {}]));
  const observaciones: Observacion[] = [];

  const acumuladorDe = (fecha: string, motor: string): Acumulador | null => {
    const delDia = porDia.get(fecha);
    if (!delDia) return null;
    delDia[motor] ??= acumuladorVacio();
    return delDia[motor];
  };

  // ------------------------------------------------ Contadores: planilla primero
  const conOperacion = new Set<string>();
  let datosOperacion = 0;
  for (const r of operaciones) {
    const fecha = texto(r.fields['Fecha planilla']).slice(0, 10);
    const motor = nombrePorId.get(primerEnlace(r.fields['Motor']));
    if (!motor || !porDia.has(fecha)) continue;
    const inicial = contadoresOperacion(r.fields, 'inicial');
    const final = contadoresOperacion(r.fields, 'final');
    if (!inicial || !final) continue; // día abierto: se usa Monitoreo Motores
    datosOperacion++;
    conOperacion.add(`${fecha}|${motor}`);
    const deltas = deltasDelDia(inicial, final);
    const problemas = deltas.filter((d) => d.problema);
    if (problemas.length > 0) {
      observaciones.push({ fecha, motor, detalle: `Datos de operación — ${problemas.map(describirProblema).join('; ')}. No se suma.` });
    }
    sumarValores(acumuladorDe(fecha, motor)!, valoresDeDeltas(deltas));
  }

  // Registros de cada motor en orden, para tener a mano el anterior y el siguiente.
  const porMotor = new Map<string, RegistroAirtable[]>();
  for (const r of monitoreos) {
    const motor = nombrePorId.get(primerEnlace(r.fields['Motor']));
    if (motor) porMotor.set(motor, [...(porMotor.get(motor) ?? []), r]);
  }

  let monitoreosUsados = 0;
  for (const [motor, registros] of porMotor) {
    registros.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
    // Horas entre la apertura de un registro y la del siguiente: lo que pudo cubrir.
    const horasHastaSiguiente = registros.map((r, i) =>
      i < registros.length - 1 ? (Date.parse(registros[i + 1].createdTime) - Date.parse(r.createdTime)) / MS_POR_HORA : 0
    );
    const deltas = deltasPorContinuidad(
      registros.map((r, i) => ({
        ...lecturasDeMonitoreo(r.fields),
        maxHoras: Math.max(MAX_HORAS_POR_REGISTRO, Math.ceil(horasHastaSiguiente[i]) + HOLGURA_HORAS)
      }))
    );

    registros.forEach((r, i) => {
      const fecha = aFechaBogota(r.createdTime);
      const { valores, notas, problemas, sinCierre } = deltas[i];

      // Un registro que quedó abierto varios días se reparte en partes iguales
      // entre los días de planilla que cubrió, para no cargar 48 h a un solo día.
      const diasCubiertos = horasHastaSiguiente[i] > UMBRAL_REPARTO_HORAS ? Math.round(horasHastaSiguiente[i] / 24) : 1;
      const fechas = Array.from({ length: diasCubiertos }, (_, k) => sumarDias(fecha, k));
      const parte = (v: number | null) => (v === null ? null : v / diasCubiertos);
      let usado = false;

      fechas.forEach((dia, k) => {
        if (conOperacion.has(`${dia}|${motor}`)) return;
        const acumulador = acumuladorDe(dia, motor);
        if (!acumulador) return; // día del margen, fuera del rango
        usado = true;
        sumarValores(acumulador, {
          horometro: parte(valores.horometro),
          energia: parte(valores.energia),
          m3: parte(valores.m3),
          // Los arranques no se reparten: van al primer día.
          arranques: k === 0 ? valores.arranques : null
        });
      });
      if (!usado) return;
      monitoreosUsados++;

      const observar = (detalle: string) => observaciones.push({ fecha, motor, detalle });
      if (diasCubiertos > 1) {
        observar(`Monitoreo de motor abierto ${Math.round(horasHastaSiguiente[i])} h: sus contadores se repartieron en ${diasCubiertos} días.`);
      }
      if (notas.length > 0) observar(`Monitoreo de motor corregido — ${notas.join('; ')}.`);
      if (problemas.length > 0) observar(`Monitoreo de motor — ${problemas.map(describirProblema).join('; ')}. No se suma.`);
      if (sinCierre) observar('Monitoreo de motor sin valores de cierre: el día queda parcial.');
    });
  }

  // ------------------------------------------------------ Lecturas horarias
  let lecturas = 0;
  for (const r of jenbacher) {
    const fecha = texto(r.fields[CAMPO_FECHA_PLANILLA]).slice(0, 10) || aFechaBogota(r.createdTime);
    const motor = nombreCortoMotor(texto(r.fields[CAMPO_MOTOR_JENBACHER]));
    if (!motor) continue;
    const acumulador = acumuladorDe(fecha, motor);
    if (!acumulador) continue;
    lecturas++;
    for (const v of VARIABLES_GAS) {
      const valor = numero(r.fields[CAMPO_VARIABLE[v]]);
      if (valor === null) continue;
      acumulador.gas[v].suma += valor;
      acumulador.gas[v].n += 1;
    }
  }

  const conDatos = new Set<string>();
  for (const delDia of porDia.values()) Object.keys(delDia).forEach((m) => conDatos.add(m));
  const motores = [...conDatos].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  observaciones.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.motor.localeCompare(b.motor));

  return {
    porDia,
    motores,
    observaciones,
    conteos: { monitoreos: monitoreosUsados, datosOperacion, lecturasJenbacher: lecturas }
  };
}
