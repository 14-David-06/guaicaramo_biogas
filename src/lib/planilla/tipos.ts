// Contrato de la planilla horaria Jenbacher.
//
// Lleva a la app el formato en papel "Control diario a composición del biogás
// y potencia de Jenbacher": 24 franjas de 06:00 a 05:00 con el gas medido en
// tres puntos del tren de filtrado y J1/J2 en la misma fila. No importa nada
// del servidor: lo comparten la API y la página.

import type { DatosOperacionDia } from './operacion';

export const HORAS_PLANILLA = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00',
  '22:00', '23:00', '00:00', '01:00', '02:00', '03:00', '04:00', '05:00'
] as const;
export type HoraPlanilla = (typeof HORAS_PLANILLA)[number];

/** Orden del tren de filtrado: entrada → biofiltro → filtro de biochar → motores. */
export const PUNTOS_MEDICION = ['entrada_biofiltro', 'salida_biofiltro', 'salida_biochar'] as const;
export type PuntoMedicion = (typeof PUNTOS_MEDICION)[number];

export const GASES = ['ch4', 'o2', 'co2', 'h2s'] as const;
export type Gas = (typeof GASES)[number];

export const SOPLADORES = ['1', '2', '3'] as const;
export type Soplador = (typeof SOPLADORES)[number];

export const ETIQUETA_PUNTO: Record<PuntoMedicion, string> = {
  entrada_biofiltro: 'Entrada biofiltro',
  salida_biofiltro: 'Salida biofiltro',
  salida_biochar: 'Salida biochar'
};

export const ETIQUETA_GAS: Record<Gas, string> = { ch4: 'CH4', o2: 'O2', co2: 'CO2', h2s: 'H2S' };
export const UNIDAD_GAS: Record<Gas, string> = { ch4: '%', o2: '%', co2: '%', h2s: 'ppm' };

export type LecturaGas = Record<Gas, number | null>;

export interface LecturaMotor {
  motorId: string;
  potenciaKw: number | null;
  m3: number | null;
}

/** Una hora de la planilla, ya validada. */
export interface LecturaHora {
  fecha: string;
  hora: HoraPlanilla;
  operador: string;
  /** IDs de registro de la tabla "Biodigestores". */
  digestores: string[];
  gas: Record<PuntoMedicion, LecturaGas>;
  presionEntrada: number | null;
  presionSalida: number | null;
  tempEntrada: number | null;
  tempSalida: number | null;
  motores: LecturaMotor[];
  sopladores: Soplador[];
  observaciones: string;
}

/** Una hora ya guardada, reconstruida desde sus registros (uno por motor). */
export interface HoraRegistrada {
  operador: string;
  /** Hora local (HH:mm) en que se guardó; puede ser posterior a la franja. */
  guardadaA: string;
  digestorIds: string[];
  digestores: string[];
  gas: Record<PuntoMedicion, LecturaGas>;
  presionEntrada: number | null;
  presionSalida: number | null;
  tempEntrada: number | null;
  tempSalida: number | null;
  motores: { nombre: string; potenciaKw: number | null; m3: number | null }[];
  sopladores: Soplador[];
  observaciones: string;
}

export type EstadoFranja = 'registrada' | 'pendiente' | 'futura';

export interface FranjaPlanilla {
  hora: HoraPlanilla;
  estado: EstadoFranja;
  /** Pendiente, ya empezó y la planilla admite registros. */
  registrable: boolean;
  lectura: HoraRegistrada | null;
}

export interface MotorPlanilla {
  id: string;
  nombre: string;
  encendido: boolean;
  tieneMonitoreo: boolean;
}

export interface RespuestaPlanilla {
  fecha: string;
  /** Planilla y franja en curso al momento de la consulta. */
  fechaActual: string;
  horaActual: HoraPlanilla;
  /** Solo la planilla actual y la anterior admiten registros nuevos. */
  editable: boolean;
  franjas: FranjaPlanilla[];
  motores: MotorPlanilla[];
  biodigestores: { id: string; nombre: string }[];
  turno: { id: string; operador: string } | null;
  /** Bloque "Datos de operación" del día; null si la tabla no está configurada. */
  operacion: DatosOperacionDia | null;
  /**
   * La planilla anterior tiene datos de operación sin cerrar: mientras tanto no
   * se registran horas ni datos de operación en esta.
   */
  bloqueo: { fechaAnterior: string; motores: string[] } | null;
}
