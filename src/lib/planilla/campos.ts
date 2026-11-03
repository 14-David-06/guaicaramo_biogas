// Traducción entre una hora de la planilla y los registros de
// "Registros Diarios Jenbacher".
//
// Una hora se ve como una fila, pero se guarda como el formulario anterior: un
// registro por motor encendido, con la composición del gas repetida. Así el
// informe diario, el dashboard y el histórico siguen leyendo los mismos campos.

import {
  GASES, PUNTOS_MEDICION, SOPLADORES,
  type Gas, type HoraRegistrada, type LecturaGas, type LecturaHora, type LecturaMotor,
  type PuntoMedicion, type Soplador
} from './tipos';

/** Valor de "Version formato" de los registros creados desde la planilla. */
export const VERSION_PLANILLA = 'v2-planilla';

export const CAMPOS = {
  fechaPlanilla: 'Fecha planilla',
  hora: 'Hora de lectura',
  version: 'Version formato',
  sopladores: 'Sopladores encendidos',
  observaciones: 'Observaciones',
  operador: 'Realiza Registro',
  turno: 'Turno',
  biodigestores: 'Biodigestores Usados',
  nombresBiodigestores: 'Nombre Biodigestores (from Biodigestores Usados)',
  estadoMotor: 'Estados Motores',
  monitoreo: 'Monitoreo Motores',
  nombreMotor: 'Nombre Motor (from Monitoreo Motores)',
  potencia: 'POTENCIA GENERADA(Kw)',
  m3: 'M3 DE BIOGAS (M3)',
  presionEntrada: 'PRESION BIOFILTRO ENTRADA (cm de h20)',
  presionSalida: 'PRESION BIOFILTRO SALIDA (cm de h2o)',
  tempEntrada: 'TEMP. ENTRADA BIOFILTRO',
  tempSalida: 'TEMP. SALIDA BIOFILTRO'
} as const;

/**
 * Campo de Airtable de cada gas en cada punto de medición.
 *
 * ⚠️ PENDIENTE de confirmar con la Ing. Jimena: se asume que los campos del
 * formulario anterior ("METANO(CH4)%", etc.) guardan el gas que entra al
 * motor, es decir, la salida del filtro de biochar. Su umbral de H2S (< 300)
 * coincide con el de ese punto en el formato nuevo. Si la respuesta es otra,
 * solo cambia este mapeo.
 */
export const CAMPOS_GAS: Record<PuntoMedicion, Record<Gas, string>> = {
  entrada_biofiltro: {
    ch4: 'CH4 Entrada Biofiltro %',
    o2: 'O2 Entrada Biofiltro %',
    co2: 'CO2 Entrada Biofiltro %',
    h2s: 'H2S Entrada Biofiltro ppm'
  },
  salida_biofiltro: {
    ch4: 'CH4 Salida Biofiltro %',
    o2: 'O2 Salida Biofiltro %',
    co2: 'CO2 Salida Biofiltro %',
    h2s: 'H2S Salida Biofiltro ppm'
  },
  salida_biochar: {
    ch4: 'METANO(CH4)%',
    o2: 'OXIGENO(O2) %',
    co2: 'DIOXIDO DE CARBONO(CO2) %',
    h2s: 'ACIDO SULFIDRICO(H2S)'
  }
};

export interface EnlacesRegistro {
  estadoId: string;
  monitoreoId: string;
  turnoId: string | null;
}

/** Campos del registro de un motor para una hora. Los valores vacíos no se envían. */
export function camposDeRegistro(lectura: LecturaHora, motor: LecturaMotor, enlaces: EnlacesRegistro): Record<string, unknown> {
  const campos: Record<string, unknown> = {
    [CAMPOS.fechaPlanilla]: lectura.fecha,
    [CAMPOS.hora]: lectura.hora,
    [CAMPOS.version]: VERSION_PLANILLA,
    [CAMPOS.operador]: lectura.operador,
    [CAMPOS.biodigestores]: lectura.digestores,
    [CAMPOS.estadoMotor]: [enlaces.estadoId],
    [CAMPOS.monitoreo]: [enlaces.monitoreoId]
  };
  if (enlaces.turnoId) campos[CAMPOS.turno] = [enlaces.turnoId];
  if (lectura.sopladores.length) campos[CAMPOS.sopladores] = lectura.sopladores;
  if (lectura.observaciones) campos[CAMPOS.observaciones] = lectura.observaciones;

  const valores: [string, number | null][] = [
    [CAMPOS.potencia, motor.potenciaKw],
    [CAMPOS.m3, motor.m3],
    [CAMPOS.presionEntrada, lectura.presionEntrada],
    [CAMPOS.presionSalida, lectura.presionSalida],
    [CAMPOS.tempEntrada, lectura.tempEntrada],
    [CAMPOS.tempSalida, lectura.tempSalida]
  ];
  for (const punto of PUNTOS_MEDICION) {
    for (const gas of GASES) valores.push([CAMPOS_GAS[punto][gas], lectura.gas[punto][gas]]);
  }
  for (const [campo, valor] of valores) {
    if (valor !== null) campos[campo] = valor;
  }
  return campos;
}

/** Lo mínimo de un registro de Airtable; evita importar el cliente del servidor. */
interface RegistroLeido {
  createdTime: string;
  fields: Record<string, unknown>;
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function texto(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map(String).join(', ');
  return typeof valor === 'string' ? valor : '';
}

function lista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.map(String) : [];
}

/** "Jenbacher 1 J320 S599" → "J1". */
export function nombreCortoMotor(nombre: string): string {
  const coincidencia = /jenbacher\s*(\d+)/i.exec(nombre);
  return coincidencia ? `J${coincidencia[1]}` : nombre.trim();
}

/**
 * Reconstruye una hora desde sus registros (uno por motor). La parte común se
 * toma del primero: se guardó repetida en todos.
 */
export function horaDesdeRegistros(registros: RegistroLeido[], aHoraLocal: (iso: string) => string): HoraRegistrada {
  const [primero] = registros;
  const f = primero.fields;
  const gas = Object.fromEntries(
    PUNTOS_MEDICION.map((punto) => [
      punto,
      Object.fromEntries(GASES.map((g) => [g, numero(f[CAMPOS_GAS[punto][g]])])) as LecturaGas
    ])
  ) as Record<PuntoMedicion, LecturaGas>;

  return {
    operador: texto(f[CAMPOS.operador]),
    guardadaA: aHoraLocal(primero.createdTime),
    digestorIds: lista(f[CAMPOS.biodigestores]),
    digestores: lista(f[CAMPOS.nombresBiodigestores]),
    gas,
    presionEntrada: numero(f[CAMPOS.presionEntrada]),
    presionSalida: numero(f[CAMPOS.presionSalida]),
    tempEntrada: numero(f[CAMPOS.tempEntrada]),
    tempSalida: numero(f[CAMPOS.tempSalida]),
    motores: registros
      .map((r) => ({
        nombre: texto(r.fields[CAMPOS.nombreMotor]).trim() || 'Motor sin nombre',
        potenciaKw: numero(r.fields[CAMPOS.potencia]),
        m3: numero(r.fields[CAMPOS.m3])
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    sopladores: lista(f[CAMPOS.sopladores]).filter((s): s is Soplador => (SOPLADORES as readonly string[]).includes(s)),
    observaciones: texto(f[CAMPOS.observaciones])
  };
}
