// Contrato del informe diario.
//
// Lo comparten la vista previa en pantalla, el PDF, el consolidado en Excel y
// el correo de las 06:00. Cambiar un campo aquí obliga a revisar los cuatro.

export type Severidad = 'critica' | 'advertencia' | 'informativa';

export type CategoriaExcepcion = 'Calidad de gas' | 'Datos faltantes' | 'Turnos' | 'Remoción H2S';

export interface Excepcion {
  severidad: Severidad;
  categoria: CategoriaExcepcion;
  titulo: string;
  detalle: string;
  /** Hora local (HH:mm) del evento, cuando aplica. */
  hora?: string;
}

export interface ResumenVariable {
  nombre: string;
  unidad: string;
  promedio: number | null;
  minimo: number | null;
  maximo: number | null;
  muestras: number;
  referencia?: string;
  /** Lecturas fuera de rango; undefined si la variable no tiene rango definido. */
  fueraDeRango?: number;
}

export interface CambioEstado {
  hora: string;
  estado: string;
  operador: string;
}

export interface ResumenMotor {
  nombre: string;
  horasOperacion: number | null;
  arranques: number | null;
  energiaGenerada: number | null;
  m3Consumidos: number | null;
  estadoFinal: string | null;
  cambiosEstado: CambioEstado[];
  registroIncompleto: boolean;
}

export interface ResumenTurno {
  operador: string;
  inicio: string | null;
  fin: string | null;
  cerrado: boolean;
  duracionHoras: number | null;
  /** Minutos desde la medianoche local, recortados al día del informe (0–1440). Para la línea de tiempo. */
  inicioMinuto: number;
  finMinuto: number;
}

/** Una lectura de "Registros Diarios Jenbacher", para graficar el perfil del día. */
export interface LecturaSerie {
  /** Minutos desde la medianoche local (0–1440). */
  minuto: number;
  ch4: number | null;
  o2: number | null;
  h2s: number | null;
  potencia: number | null;
}

export interface EntradaBitacora {
  hora: string;
  operador: string;
  informeEjecutivo: string;
  transcripcion: string;
}

export interface MedicionBiodigestor {
  hora: string;
  biodigestor: string;
  operador: string;
  ch4: number | null;
  co2: number | null;
  o2: number | null;
  h2s: number | null;
  co: number | null;
  no: number | null;
}

export interface MedicionRemocionH2S {
  hora: string;
  operador: string;
  entradaBiofiltro: number | null;
  salidaBiofiltro: number | null;
  salidaBiochar: number | null;
  /** % removido por el biofiltro (entrada → salida biofiltro). */
  remocionBiofiltro: number | null;
  /** % removido por el filtro de biochar (salida biofiltro → salida biochar). */
  remocionBiochar: number | null;
  /** % removido por todo el tren (entrada → salida final). */
  remocionTotal: number | null;
}

export interface Produccion {
  energiaGenerada: number | null;
  unidadEnergia: string;
  notaUnidades: string;
  m3Biogas: number | null;
  horasOperacion: number | null;
  arranques: number | null;
  potenciaPromedio: number | null;
  potenciaMaxima: number | null;
}

export interface InformeDiario {
  fecha: string;
  fechaLarga: string;
  generadoEn: string;
  generadoPor: string;
  produccion: Produccion;
  calidadGas: ResumenVariable[];
  biofiltro: ResumenVariable[];
  serie: LecturaSerie[];
  remocionH2S: MedicionRemocionH2S[];
  motores: ResumenMotor[];
  turnos: ResumenTurno[];
  bitacora: EntradaBitacora[];
  medicionesBiodigestores: MedicionBiodigestor[];
  excepciones: Excepcion[];
  conteos: {
    registrosJenbacher: number;
    monitoreosMotor: number;
    cambiosEstado: number;
    entradasBitacora: number;
    medicionesBiodigestores: number;
    medicionesRemocion: number;
  };
  sinDatos: boolean;
}
