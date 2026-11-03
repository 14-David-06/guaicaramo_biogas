// Validación de una hora de la planilla.
//
// La misma función corre en la página (antes de enviar) y en la API (antes de
// guardar). Rechaza lo físicamente imposible; lo que solo está fuera de umbral
// se guarda y se resalta, porque es justamente lo que el informe debe mostrar.

import { esFechaValida } from '../informe/fechas';
import {
  LIMITES_PLANILLA, MAX_M3_POR_HORA, UMBRALES_PLANILLA_BIOFILTRO, UMBRALES_PLANILLA_GAS,
  fueraDeRango, type UmbralPlanilla
} from '../informe/umbrales';
import { esHoraPlanilla } from './franjas';
import {
  ETIQUETA_GAS, ETIQUETA_PUNTO, GASES, PUNTOS_MEDICION, SOPLADORES, UNIDAD_GAS,
  type LecturaGas, type LecturaHora, type LecturaMotor, type PuntoMedicion, type Soplador
} from './tipos';

const ID_REGISTRO = /^rec[A-Za-z0-9]{14}$/;
const MAX_OBSERVACIONES = 1000;

export function esIdRegistro(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_REGISTRO.test(valor);
}

/**
 * Vacío → null; número o texto numérico (acepta coma decimal) → número;
 * cualquier otra cosa → 'invalido'. Nunca convierte un vacío en 0.
 */
export function leerNumero(valor: unknown): number | null | 'invalido' {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 'invalido';
  if (typeof valor !== 'string') return 'invalido';
  const limpio = valor.trim().replace(',', '.');
  if (limpio === '') return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : 'invalido';
}

type Resultado = { lectura: LecturaHora; errores: [] } | { lectura: null; errores: string[] };

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

export function validarLectura(cuerpo: unknown): Resultado {
  const c = objeto(cuerpo);
  const errores: string[] = [];

  /** Lee un número y lo deja dentro de [min, max]; acumula el error si no. */
  const medir = (valor: unknown, etiqueta: string, min: number, max: number, unidad: string, requerido: boolean): number | null => {
    const n = leerNumero(valor);
    if (n === 'invalido') {
      errores.push(`${etiqueta}: no es un número.`);
      return null;
    }
    if (n === null) {
      if (requerido) errores.push(`${etiqueta}: es obligatorio.`);
      return null;
    }
    if (n < min || n > max) {
      errores.push(`${etiqueta}: ${n} ${unidad} está fuera de lo posible (${min} a ${max} ${unidad}).`);
      return null;
    }
    return n;
  };

  const fecha = typeof c.fecha === 'string' && esFechaValida(c.fecha) ? c.fecha : null;
  if (!fecha) errores.push('Fecha de planilla inválida.');
  const hora = esHoraPlanilla(c.hora) ? c.hora : null;
  if (!hora) errores.push('Hora de lectura inválida.');

  const operador = typeof c.operador === 'string' ? c.operador.trim() : '';
  if (!operador) errores.push('Falta el nombre del operador.');

  const digestores = Array.isArray(c.digestores) ? [...new Set(c.digestores)] : [];
  if (digestores.length === 0) errores.push('Seleccione al menos un digestor.');
  if (!digestores.every(esIdRegistro)) errores.push('Hay un digestor no reconocido.');

  const gasCrudo = objeto(c.gas);
  const gas = {} as Record<PuntoMedicion, LecturaGas>;
  for (const punto of PUNTOS_MEDICION) {
    const crudo = objeto(gasCrudo[punto]);
    // Los cuatro gases de salida biochar alimentan los campos que ya lee el informe.
    const requerido = punto === 'salida_biochar';
    const lectura = {} as LecturaGas;
    for (const g of GASES) {
      const etiqueta = `${ETIQUETA_GAS[g]} ${ETIQUETA_PUNTO[punto].toLowerCase()}`;
      const max = g === 'h2s' ? LIMITES_PLANILLA.maxH2S : 100;
      lectura[g] = medir(crudo[g], etiqueta, 0, max, UNIDAD_GAS[g], requerido);
    }
    const suma = (lectura.ch4 ?? 0) + (lectura.o2 ?? 0) + (lectura.co2 ?? 0);
    if (suma > LIMITES_PLANILLA.maxSumaGases) {
      errores.push(
        `${ETIQUETA_PUNTO[punto]}: CH4 + O2 + CO2 suman ${Math.round(suma * 100) / 100} %; ` +
        `no pueden pasar de ${LIMITES_PLANILLA.maxSumaGases} %.`
      );
    }
    gas[punto] = lectura;
  }

  const presionEntrada = medir(c.presionEntrada, 'Presión de entrada', 0, LIMITES_PLANILLA.maxPresion, 'cm H2O', true);
  const presionSalida = medir(c.presionSalida, 'Presión de salida', 0, LIMITES_PLANILLA.maxPresion, 'cm H2O', true);
  const tempEntrada = medir(c.tempEntrada, 'Temperatura entrada biofiltro', 0, LIMITES_PLANILLA.maxTemperatura, '°C', true);
  const tempSalida = medir(c.tempSalida, 'Temperatura salida biofiltro', 0, LIMITES_PLANILLA.maxTemperatura, '°C', true);

  const motoresCrudos = Array.isArray(c.motores) ? c.motores.map(objeto) : [];
  if (motoresCrudos.length === 0) errores.push('No hay lecturas de motores.');
  const motores: LecturaMotor[] = [];
  const vistos = new Set<string>();
  for (const m of motoresCrudos) {
    const nombre = typeof m.nombre === 'string' && m.nombre ? m.nombre : 'Motor';
    if (!esIdRegistro(m.motorId) || vistos.has(m.motorId)) {
      errores.push(`${nombre}: motor no reconocido o repetido.`);
      continue;
    }
    vistos.add(m.motorId);
    motores.push({
      motorId: m.motorId,
      potenciaKw: medir(m.potenciaKw, `${nombre} — potencia`, 0, LIMITES_PLANILLA.maxPotenciaKw, 'kW', true),
      m3: medir(m.m3, `${nombre} — m³ de biogás`, 0, MAX_M3_POR_HORA, 'm³', true)
    });
  }

  const sopladores = Array.isArray(c.sopladores) ? [...new Set(c.sopladores)] : [];
  if (!sopladores.every((s) => (SOPLADORES as readonly unknown[]).includes(s))) errores.push('Soplador no reconocido.');

  const observaciones = typeof c.observaciones === 'string' ? c.observaciones.trim() : '';
  if (observaciones.length > MAX_OBSERVACIONES) errores.push(`Las observaciones pasan de ${MAX_OBSERVACIONES} caracteres.`);

  if (errores.length > 0 || !fecha || !hora) return { lectura: null, errores };

  return {
    lectura: {
      fecha,
      hora,
      operador,
      digestores: digestores as string[],
      gas,
      presionEntrada,
      presionSalida,
      tempEntrada,
      tempSalida,
      motores,
      sopladores: sopladores as Soplador[],
      observaciones
    },
    errores: []
  };
}

export interface AlertaUmbral {
  etiqueta: string;
  valor: number;
  unidad: string;
  referencia: string;
  severidad: UmbralPlanilla['severidad'];
}

/** Valores de una hora que están dentro de lo posible pero fuera de umbral. */
export function alertasDeUmbral(lectura: LecturaHora): AlertaUmbral[] {
  const alertas: AlertaUmbral[] = [];
  const revisar = (valor: number | null, umbral: UmbralPlanilla, etiqueta: string) => {
    if (valor !== null && fueraDeRango(valor, umbral)) {
      alertas.push({ etiqueta, valor, unidad: umbral.unidad, referencia: umbral.referencia, severidad: umbral.severidad });
    }
  };
  for (const punto of PUNTOS_MEDICION) {
    for (const g of GASES) {
      revisar(lectura.gas[punto][g], UMBRALES_PLANILLA_GAS[punto][g], `${ETIQUETA_GAS[g]} ${ETIQUETA_PUNTO[punto].toLowerCase()}`);
    }
  }
  const b = UMBRALES_PLANILLA_BIOFILTRO;
  revisar(lectura.presionEntrada, b.presionEntrada, b.presionEntrada.nombre);
  revisar(lectura.presionSalida, b.presionSalida, b.presionSalida.nombre);
  revisar(lectura.tempEntrada, b.tempEntrada, b.tempEntrada.nombre);
  revisar(lectura.tempSalida, b.tempSalida, b.tempSalida.nombre);
  return alertas;
}

/** Estado de un valor frente a su umbral, para colorear la celda o el campo. */
export function estadoDeValor(valor: number | null | 'invalido', umbral?: UmbralPlanilla): 'vacio' | 'invalido' | 'ok' | 'advertencia' | 'critica' {
  if (valor === null) return 'vacio';
  if (valor === 'invalido') return 'invalido';
  if (!umbral || !fueraDeRango(valor, umbral)) return 'ok';
  return umbral.severidad === 'critica' ? 'critica' : 'advertencia';
}
