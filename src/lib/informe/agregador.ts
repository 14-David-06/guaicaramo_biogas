import 'server-only';

// Construye el informe diario a partir de los registros de Airtable del día.
//
// Reglas de negocio que conviene tener presentes al leer este archivo:
//
// 1. El día es calendario local de Bogotá (00:00–23:59), no UTC y no por turno.
//    Con dos turnos de 12 h, un día calendario cubre siempre ambos.
// 2. Los kW, m³, horómetro y arranques son lecturas ACUMULADAS de contador.
//    La producción del día es la suma de los deltas (fin − inicio) de cada
//    registro de "Monitoreo Motores", no el valor del contador.
// 3. Un registro de monitoreo sin valores de cierre significa turno en curso
//    o cierre olvidado: no se descarta en silencio, se reporta como excepción.
//
// La consulta a Airtable (obtenerDatos) está separada de la construcción
// (construirInforme) para que el consolidado semanal o mensual haga UNA consulta
// por tabla y arme cada día con exactamente las mismas reglas que el diario.

import {
  registrosDelRango, turnosDelRango, todosLosMotores, TABLAS, type RegistroAirtable
} from './airtable-server';
import { aFechaBogota, aHoraBogota, diasDelRango, formatearFechaLarga, rangoDiaBogota } from './fechas';
import {
  UMBRALES_CALIDAD_GAS, UMBRALES_BIOFILTRO, UMBRAL_POTENCIA, MAX_HORAS_SIN_REGISTRO,
  MIN_REGISTROS_DIARIOS, REMOCION_H2S_MINIMA, fueraDeRango, type Umbral
} from './umbrales';
import { UNIDAD_ENERGIA, evaluarDeltas, lecturasDeMonitoreo } from './contadores';
import type {
  Excepcion, InformeDiario, MedicionRemocionH2S, ResumenMotor, ResumenTurno, ResumenVariable, Severidad
} from './tipos';

const MS_POR_HORA = 60 * 60 * 1000;

// La energía se rotula MWh (ver contadores.ts) y se deja constancia visible para
// que la Ing. Jimena lo confirme antes de automatizar el envío.
const NOTA_UNIDAD_ENERGIA =
  'Energía tomada del contador acumulado de los motores (campos "Kw de Inicio"/"Kw de Fin" ' +
  'en Airtable). La magnitud corresponde a MWh; el rótulo del campo en la base dice kW. ' +
  'Pendiente de confirmar con la jefatura de planta.';

/** Registros crudos de un rango de días, tal como vienen de Airtable. */
export interface DatosPlanta {
  jenbacher: RegistroAirtable[];
  monitoreos: RegistroAirtable[];
  estados: RegistroAirtable[];
  bitacoras: RegistroAirtable[];
  mediciones: RegistroAirtable[];
  biofiltros: RegistroAirtable[];
  turnos: RegistroAirtable[];
  motores: RegistroAirtable[];
}

export function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function texto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (Array.isArray(valor)) return valor.filter(Boolean).join(', ');
  return '';
}

function redondear(valor: number | null, decimales = 2): number | null {
  if (valor === null) return null;
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

/** % de H2S removido entre dos puntos del tren de filtrado. */
export function porcentajeRemocion(antes: number | null, despues: number | null): number | null {
  if (antes === null || despues === null || antes <= 0) return null;
  return redondear(((antes - despues) / antes) * 100, 1);
}

function resumirVariable(registros: RegistroAirtable[], umbral: Umbral): ResumenVariable {
  const valores = registros
    .map((r) => numero(r.fields[umbral.campo]))
    .filter((v): v is number => v !== null);
  const tieneRango = umbral.minimo !== undefined || umbral.maximo !== undefined;

  return {
    nombre: umbral.nombre,
    unidad: umbral.unidad,
    promedio: valores.length ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length) : null,
    minimo: valores.length ? redondear(Math.min(...valores)) : null,
    maximo: valores.length ? redondear(Math.max(...valores)) : null,
    muestras: valores.length,
    referencia: umbral.referencia,
    fueraDeRango: tieneRango ? valores.filter((v) => fueraDeRango(v, umbral) !== null).length : undefined
  };
}

/** Detecta bloques de tiempo del día sin ningún registro de monitoreo. */
function detectarVacios(registros: RegistroAirtable[], fecha: string, ahora: Date): Excepcion[] {
  if (registros.length === 0) return [];

  const { inicio, fin } = rangoDiaBogota(fecha);
  // Para el día en curso el corte es "ahora", no la medianoche que aún no llega.
  const corte = ahora < fin ? ahora : fin;
  const instantes = registros.map((r) => new Date(r.createdTime).getTime()).sort((a, b) => a - b);
  const hitos = [inicio.getTime(), ...instantes, corte.getTime()];

  const excepciones: Excepcion[] = [];
  for (let i = 1; i < hitos.length; i++) {
    const horas = (hitos[i] - hitos[i - 1]) / MS_POR_HORA;
    if (horas > MAX_HORAS_SIN_REGISTRO) {
      excepciones.push({
        severidad: 'advertencia',
        categoria: 'Datos faltantes',
        titulo: `${horas.toFixed(1)} h sin registro de monitoreo`,
        detalle:
          `Sin registros Jenbacher entre las ${aHoraBogota(new Date(hitos[i - 1]))} ` +
          `y las ${aHoraBogota(new Date(hitos[i]))}.`,
        hora: aHoraBogota(new Date(hitos[i - 1]))
      });
    }
  }
  return excepciones;
}

/** Consulta todas las tablas del informe para el rango de días [desde, hasta]. */
export async function obtenerDatos(desde: string, hasta: string): Promise<DatosPlanta> {
  const [jenbacher, monitoreos, estados, bitacoras, mediciones, biofiltros, turnos, motores] = await Promise.all([
    registrosDelRango(TABLAS.jenbacher, 'Registros Diarios Jenbacher', desde, hasta),
    registrosDelRango(TABLAS.monitoreoMotores, 'Monitoreo Motores', desde, hasta),
    registrosDelRango(TABLAS.estadosMotores, 'Estados Motores', desde, hasta),
    registrosDelRango(TABLAS.bitacora, 'Bitacora Biogas', desde, hasta),
    registrosDelRango(TABLAS.medicionBiodigestores, 'Medicion Biodigestores', desde, hasta),
    // La remoción de H2S es opcional: sin la tabla configurada el informe sale igual.
    TABLAS.biofiltros
      ? registrosDelRango(TABLAS.biofiltros, 'Entradas y Salidas de biofiltros', desde, hasta)
      : Promise.resolve([]),
    turnosDelRango(desde, hasta),
    todosLosMotores()
  ]);
  return { jenbacher, monitoreos, estados, bitacoras, mediciones, biofiltros, turnos, motores };
}

/** Arma el informe de un día a partir de datos ya consultados (que pueden cubrir más días). */
export function construirInforme(
  datos: DatosPlanta,
  fecha: string,
  generadoPor = 'Generación bajo demanda',
  ahora = new Date()
): InformeDiario {
  const { inicio: inicioDia, fin: finDia } = rangoDiaBogota(fecha);
  const porFecha = (a: RegistroAirtable, b: RegistroAirtable) =>
    new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime();
  const delDia = (registros: RegistroAirtable[]) =>
    registros.filter((r) => aFechaBogota(r.createdTime) === fecha).sort(porFecha);

  const jenbacher = delDia(datos.jenbacher);
  const monitoreos = delDia(datos.monitoreos);
  const estados = delDia(datos.estados);
  const bitacoras = delDia(datos.bitacoras);
  const mediciones = delDia(datos.mediciones);
  const biofiltros = delDia(datos.biofiltros);
  const turnos = datos.turnos.filter((t) => {
    const inicio = texto(t.fields['Fecha Inicio']);
    const fin = texto(t.fields['Fecha Fin']);
    if (!inicio || new Date(inicio) >= finDia) return false;
    return !fin || new Date(fin) > inicioDia;
  });
  const motores = datos.motores;

  const excepciones: Excepcion[] = [];

  // Un turno abierto o un monitoreo sin cerrar son el estado normal mientras el
  // día transcurre; solo son anomalía una vez pasada la medianoche local.
  const diaTerminado = ahora >= finDia;

  // ---------------------------------------------------------------- Producción
  // En Airtable algunos nombres traen espacios dobles ("Jenbacher 2  J320 AK32").
  const nombresMotor = new Map(motores.map((m) => [m.id, texto(m.fields['Nombre Motor']).replace(/\s+/g, ' ').trim() || m.id]));
  const motoresResumen: ResumenMotor[] = [];
  let kwTotal: number | null = null;
  let m3Total: number | null = null;
  let horasTotal: number | null = null;
  let arranquesTotal: number | null = null;

  const acumular = (actual: number | null, sumando: number | null) =>
    sumando === null ? actual : (actual ?? 0) + sumando;

  for (const motor of motores) {
    const nombre = nombresMotor.get(motor.id) ?? motor.id;
    const enlazaMotor = (r: RegistroAirtable) => (r.fields['Motor'] as string[] | undefined)?.includes(motor.id);
    const monitoreosMotor = monitoreos.filter(enlazaMotor);
    const cambios = estados.filter(enlazaMotor).map((e) => ({
      hora: aHoraBogota(e.createdTime),
      estado: texto(e.fields['Estado Motor']),
      operador: texto(e.fields['Realiza Registro'])
    }));

    if (monitoreosMotor.length === 0 && cambios.length === 0) continue;

    let kw: number | null = null;
    let m3: number | null = null;
    let horas: number | null = null;
    let arranques: number | null = null;
    let incompleto = false;

    for (const m of monitoreosMotor) {
      // Un delta negativo es imposible en un contador acumulado, y uno por encima del
      // límite físico del motor también: ambos indican error de digitación o cambio de
      // equipo. Se reportan y no se suman para no falsear el total.
      const { inicio, fin } = lecturasDeMonitoreo(m.fields);
      const lecturas = evaluarDeltas(inicio, fin);
      const [dKw, dM3, dHoras] = lecturas.map((l) => l.valor);

      if (dKw === null || dM3 === null || dHoras === null) {
        incompleto = true;
      }

      const validos = new Map<string, number | null>();

      for (const { etiqueta, valor, maximo, unidad, problema } of lecturas) {
        validos.set(etiqueta, problema ? null : valor);
        if (!problema) continue;
        const negativo = problema === 'negativo';

        excepciones.push({
          severidad: 'advertencia',
          categoria: 'Datos faltantes',
          titulo: `Lectura inconsistente de ${etiqueta} en ${nombre}`,
          detalle:
            (negativo
              ? `El valor de cierre es menor que el de apertura (${valor!.toFixed(1)} ${unidad}). `
              : `El delta del registro (${valor!.toLocaleString('es-CO')} ${unidad}) supera el máximo físico ` +
                `posible (${Math.round(maximo * 10) / 10} ${unidad}); revisar los valores de inicio y cierre. `) +
            `Registro de ${texto(m.fields['Realiza Registro']) || 'operador no identificado'} ` +
            `a las ${aHoraBogota(m.createdTime)}. No se incluye en el total del día.`,
          hora: aHoraBogota(m.createdTime)
        });
      }

      kw = acumular(kw, validos.get('energía') ?? null);
      m3 = acumular(m3, validos.get('m³') ?? null);
      horas = acumular(horas, validos.get('horómetro') ?? null);
      arranques = acumular(arranques, validos.get('arranques') ?? null);
    }

    if (incompleto && diaTerminado) {
      excepciones.push({
        severidad: 'advertencia',
        categoria: 'Datos faltantes',
        titulo: `Monitoreo sin cerrar en ${nombre}`,
        detalle:
          'Al menos un registro de monitoreo del día quedó sin valores de cierre ' +
          '(kW, m³ u horómetro final). La producción reportada para este motor es parcial.'
      });
    }

    motoresResumen.push({
      nombre,
      horasOperacion: redondear(horas, 1),
      arranques,
      energiaGenerada: redondear(kw, 1),
      m3Consumidos: redondear(m3, 1),
      estadoFinal: cambios.length ? cambios[cambios.length - 1].estado : null,
      cambiosEstado: cambios,
      registroIncompleto: incompleto
    });

    kwTotal = acumular(kwTotal, kw);
    m3Total = acumular(m3Total, m3);
    horasTotal = acumular(horasTotal, horas);
    arranquesTotal = acumular(arranquesTotal, arranques);
  }

  motoresResumen.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const potencias = jenbacher
    .map((r) => numero(r.fields[UMBRAL_POTENCIA.campo]))
    .filter((v): v is number => v !== null);

  // ------------------------------------------------------------ Calidad de gas
  const calidadGas = UMBRALES_CALIDAD_GAS.map((u) => resumirVariable(jenbacher, u));
  const biofiltro = UMBRALES_BIOFILTRO.map((u) => resumirVariable(jenbacher, u));

  for (const umbral of [...UMBRALES_CALIDAD_GAS, UMBRAL_POTENCIA]) {
    const desviaciones = jenbacher
      .map((r) => ({ registro: r, valor: numero(r.fields[umbral.campo]) }))
      .filter((x): x is { registro: RegistroAirtable; valor: number } => x.valor !== null)
      .map((x) => ({ ...x, motivo: fueraDeRango(x.valor, umbral) }))
      .filter((x) => x.motivo !== null);

    if (desviaciones.length === 0) continue;

    const peor = desviaciones.reduce((a, b) =>
      umbral.minimo !== undefined ? (b.valor < a.valor ? b : a) : (b.valor > a.valor ? b : a)
    );

    excepciones.push({
      severidad: umbral.severidad,
      categoria: 'Calidad de gas',
      titulo: `${umbral.nombre} fuera de rango (${desviaciones.length} de ${jenbacher.length} lecturas)`,
      detalle:
        `Rango esperado ${umbral.referencia}. Lectura más crítica: ${peor.motivo}, ` +
        `registrada por ${texto(peor.registro.fields['Realiza Registro']) || 'operador no identificado'}.`,
      hora: aHoraBogota(peor.registro.createdTime)
    });
  }

  // ------------------------------------------------------------ Remoción H2S
  // Tren de filtrado: entrada → biofiltro → filtro de biochar → motores.
  const remocionH2S: MedicionRemocionH2S[] = biofiltros.map((b) => {
    const entrada = numero(b.fields['Entrada Biofiltro']);
    const salidaBiofiltro = numero(b.fields['Salida Biofiltro']);
    const salidaBiochar = numero(b.fields['Salida Filtro Biochar']);
    return {
      hora: aHoraBogota(b.createdTime),
      operador: texto(b.fields['Nombre Operador']),
      entradaBiofiltro: entrada,
      salidaBiofiltro,
      salidaBiochar,
      remocionBiofiltro: porcentajeRemocion(entrada, salidaBiofiltro),
      remocionBiochar: porcentajeRemocion(salidaBiofiltro, salidaBiochar),
      remocionTotal: porcentajeRemocion(entrada, salidaBiochar ?? salidaBiofiltro)
    };
  });

  for (const m of remocionH2S) {
    if (m.remocionTotal !== null && m.remocionTotal < REMOCION_H2S_MINIMA) {
      excepciones.push({
        severidad: 'advertencia',
        categoria: 'Remoción H2S',
        titulo: `Remoción de H2S baja: ${m.remocionTotal} %`,
        detalle:
          `Se esperaba al menos ${REMOCION_H2S_MINIMA} %. Entrada ${m.entradaBiofiltro} ppm, ` +
          `salida ${m.salidaBiochar ?? m.salidaBiofiltro} ppm. Revisar saturación del medio filtrante.`,
        hora: m.hora
      });
    }
  }

  // ------------------------------------------------------------------- Turnos
  // Un turno de noche abre un día y cierra al siguiente, así que la hora sola
  // resulta engañosa ("13:41 → 05:24" parece un fin anterior al inicio).
  // Cuando el instante cae fuera del día del informe se antepone la fecha.
  const marcaTemporal = (instante: string) => {
    const hora = aHoraBogota(instante);
    const dia = aFechaBogota(instante);
    if (dia === fecha) return hora;
    const [, mes, numeroDia] = dia.split('-');
    return `${numeroDia}/${mes} ${hora}`;
  };

  const minutoDelDia = (instante: Date) =>
    Math.min(Math.max((instante.getTime() - inicioDia.getTime()) / 60000, 0), 1440);

  const turnosResumen: ResumenTurno[] = turnos.map((t) => {
    const inicio = texto(t.fields['Fecha Inicio']);
    const fin = texto(t.fields['Fecha Fin']);
    return {
      inicioMinuto: inicio ? minutoDelDia(new Date(inicio)) : 0,
      // Un turno abierto se dibuja hasta "ahora" en el día en curso, o hasta medianoche.
      finMinuto: minutoDelDia(fin ? new Date(fin) : ahora),
      operador: texto(t.fields['Realiza Registro']) || texto(t.fields['Nombre del Operador']),
      inicio: inicio ? marcaTemporal(inicio) : null,
      fin: fin ? marcaTemporal(fin) : null,
      cerrado: Boolean(fin),
      duracionHoras:
        inicio && fin ? redondear((new Date(fin).getTime() - new Date(inicio).getTime()) / MS_POR_HORA, 1) : null
    };
  });

  for (const turno of turnosResumen) {
    if (turno.cerrado || !diaTerminado) continue;
    excepciones.push({
      severidad: 'advertencia',
      categoria: 'Turnos',
      titulo: `Turno sin cerrar — ${turno.operador || 'operador no identificado'}`,
      detalle: `El turno iniciado a las ${turno.inicio ?? '—'} nunca registró cierre.`,
      hora: turno.inicio ?? undefined
    });
  }

  // ------------------------------------------------------------------ Bitácora
  const bitacora = bitacoras.map((b) => ({
    hora: aHoraBogota(b.createdTime),
    operador: texto(b.fields['Realiza Registro']),
    informeEjecutivo: texto(b.fields['Informe ejecutivo']),
    transcripcion: texto(b.fields['Transcripción Operador'])
  }));

  // --------------------------------------------------- Mediciones biodigestores
  // Ojo: el campo de oxígeno en esta tabla es "02 %" (cero-dos), no "O2 %".
  const medicionesResumen = mediciones.map((m) => ({
    hora: aHoraBogota(m.createdTime),
    biodigestor: texto(m.fields['Nombre Biodigestores (from Biodigestor Monitoreado)']),
    operador: texto(m.fields['Realiza Registro']),
    ch4: numero(m.fields['CH4 (Max) %']),
    co2: numero(m.fields['CO2 %']),
    o2: numero(m.fields['02 %']) ?? numero(m.fields['O2 %']),
    h2s: numero(m.fields['H2S']),
    co: numero(m.fields['CO']),
    no: numero(m.fields['NO'])
  }));

  // -------------------------------------------------- Excepciones de cobertura
  if (jenbacher.length === 0) {
    excepciones.push({
      severidad: 'critica',
      categoria: 'Datos faltantes',
      titulo: 'Sin registros Jenbacher en todo el día',
      detalle:
        'No se encontró ningún registro de parámetros de operación. Verificar si hubo ' +
        'parada de planta o si los operadores no realizaron el registro.'
    });
  } else if (diaTerminado && jenbacher.length < MIN_REGISTROS_DIARIOS) {
    excepciones.push({
      severidad: 'advertencia',
      categoria: 'Datos faltantes',
      titulo: `Solo ${jenbacher.length} registros Jenbacher en el día`,
      detalle: `Se esperan al menos ${MIN_REGISTROS_DIARIOS} en una operación de 24 horas.`
    });
  }

  excepciones.push(...detectarVacios(jenbacher, fecha, ahora));

  if (diaTerminado && turnos.length === 0) {
    excepciones.push({
      severidad: 'critica',
      categoria: 'Turnos',
      titulo: 'Sin turnos registrados',
      detalle: 'Ningún operador abrió turno durante el día.'
    });
  }

  const orden: Record<Severidad, number> = { critica: 0, advertencia: 1, informativa: 2 };
  excepciones.sort((a, b) => orden[a.severidad] - orden[b.severidad]);

  // -------------------------------------------------------------------- Salida
  const sinDatos =
    jenbacher.length === 0 && monitoreos.length === 0 && estados.length === 0 &&
    bitacoras.length === 0 && mediciones.length === 0 && biofiltros.length === 0 && turnos.length === 0;

  return {
    fecha,
    fechaLarga: formatearFechaLarga(fecha),
    generadoEn: aFechaBogota(ahora) + ' ' + aHoraBogota(ahora),
    generadoPor,
    produccion: {
      energiaGenerada: redondear(kwTotal, 1),
      unidadEnergia: UNIDAD_ENERGIA,
      notaUnidades: NOTA_UNIDAD_ENERGIA,
      m3Biogas: redondear(m3Total, 1),
      horasOperacion: redondear(horasTotal, 1),
      arranques: arranquesTotal,
      potenciaPromedio: potencias.length
        ? redondear(potencias.reduce((a, b) => a + b, 0) / potencias.length, 1)
        : null,
      potenciaMaxima: potencias.length ? redondear(Math.max(...potencias), 1) : null
    },
    calidadGas,
    biofiltro,
    serie: jenbacher.map((r) => ({
      minuto: minutoDelDia(new Date(r.createdTime)),
      ch4: numero(r.fields['METANO(CH4)%']),
      o2: numero(r.fields['OXIGENO(O2) %']),
      h2s: numero(r.fields['ACIDO SULFIDRICO(H2S)']),
      potencia: numero(r.fields[UMBRAL_POTENCIA.campo])
    })),
    remocionH2S,
    motores: motoresResumen,
    turnos: turnosResumen,
    bitacora,
    medicionesBiodigestores: medicionesResumen,
    excepciones,
    conteos: {
      registrosJenbacher: jenbacher.length,
      monitoreosMotor: monitoreos.length,
      cambiosEstado: estados.length,
      entradasBitacora: bitacoras.length,
      medicionesBiodigestores: mediciones.length,
      medicionesRemocion: biofiltros.length
    },
    sinDatos
  };
}

export async function construirInformeDiario({
  fecha,
  generadoPor = 'Generación bajo demanda'
}: {
  fecha: string;
  generadoPor?: string;
}): Promise<InformeDiario> {
  const datos = await obtenerDatos(fecha, fecha);
  return construirInforme(datos, fecha, generadoPor);
}

/**
 * Un informe por cada día del rango, con una sola consulta por tabla.
 * Devuelve también los datos crudos para que el Excel incluya las hojas de detalle.
 */
export async function construirInformesDelRango(
  desde: string,
  hasta: string,
  generadoPor = 'Generación bajo demanda'
): Promise<{ informes: InformeDiario[]; datos: DatosPlanta }> {
  const datos = await obtenerDatos(desde, hasta);
  const ahora = new Date();
  const informes = diasDelRango(desde, hasta).map((dia) => construirInforme(datos, dia, generadoPor, ahora));
  return { informes, datos };
}
