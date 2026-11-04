// "Mediciones antes del biofiltro" del formato Jenbacher: el gas de cada
// digestor (CH4, H2S, O2, CO2), normalmente dos tomas al día. Se guardan en la
// tabla de siempre, "Medicion Biodigestores", la misma que usa el registro de
// biodigestores.
//
// No importa nada del servidor: lo comparten la API y el formulario.

import { LIMITES_PLANILLA } from '../informe/umbrales';
import { esIdRegistro, leerNumero } from './validacion';

export const GASES_MEDICION = ['ch4', 'h2s', 'o2', 'co2'] as const;
export type GasMedicion = (typeof GASES_MEDICION)[number];

export const ETIQUETA_MEDICION: Record<GasMedicion, string> = { ch4: 'CH4 %', h2s: 'H2S ppm', o2: 'O2 %', co2: 'CO2 %' };

/** Campo de "Medicion Biodigestores". Ojo: el oxígeno es "02 %" (cero-dos). */
export const CAMPO_MEDICION: Record<GasMedicion, string> = { ch4: 'CH4 (Max) %', h2s: 'H2S', o2: '02 %', co2: 'CO2 %' };

/** Lo máximo que un digestor admite en una planilla (el formato trae dos tomas). */
export const TOMAS_POR_DIA = 2;

export interface MedicionDigestor {
  digestorId: string;
  valores: Record<GasMedicion, number>;
}

/** Una toma ya guardada, para mostrarla en el formulario. */
export interface TomaRegistrada {
  digestorId: string;
  hora: string;
  operador: string;
  valores: Record<GasMedicion, number | null>;
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

/**
 * Valida las filas del formulario. Una fila vacía se ignora; una fila
 * empezada debe traer los cuatro gases dentro de lo posible.
 */
export function validarMediciones(
  cuerpo: unknown,
  nombreDigestor: (id: string) => string
): { operador: string; mediciones: MedicionDigestor[]; errores: string[] } {
  const c = objeto(cuerpo);
  const errores: string[] = [];
  const operador = typeof c.operador === 'string' ? c.operador.trim() : '';
  if (!operador) errores.push('Falta el nombre de quien registra.');

  const filas = Array.isArray(c.mediciones) ? c.mediciones.map(objeto) : [];
  const mediciones: MedicionDigestor[] = [];
  const vistos = new Set<string>();

  for (const fila of filas) {
    const crudos = objeto(fila.valores);
    const leidos = GASES_MEDICION.map((g) => [g, leerNumero(crudos[g])] as const);
    if (leidos.every(([, n]) => n === null)) continue;

    if (!esIdRegistro(fila.digestorId) || vistos.has(fila.digestorId)) {
      errores.push('Hay un digestor no reconocido o repetido.');
      continue;
    }
    vistos.add(fila.digestorId);
    const nombre = nombreDigestor(fila.digestorId);

    const valores = {} as Record<GasMedicion, number>;
    for (const [g, n] of leidos) {
      const max = g === 'h2s' ? LIMITES_PLANILLA.maxH2S : 100;
      if (n === null) errores.push(`${nombre} — ${ETIQUETA_MEDICION[g]}: es obligatorio.`);
      else if (n === 'invalido') errores.push(`${nombre} — ${ETIQUETA_MEDICION[g]}: no es un número.`);
      else if (n < 0 || n > max) errores.push(`${nombre} — ${ETIQUETA_MEDICION[g]}: ${n} está fuera de lo posible (0 a ${max}).`);
      else valores[g] = n;
    }
    if (Object.keys(valores).length === GASES_MEDICION.length) {
      const suma = valores.ch4 + valores.o2 + valores.co2;
      if (suma > LIMITES_PLANILLA.maxSumaGases) {
        errores.push(`${nombre}: CH4 + O2 + CO2 suman ${Math.round(suma * 100) / 100} %; no pueden pasar de ${LIMITES_PLANILLA.maxSumaGases} %.`);
      } else {
        mediciones.push({ digestorId: fila.digestorId, valores });
      }
    }
  }

  if (mediciones.length === 0 && errores.length === 0) {
    errores.push('Digite al menos la medición de un digestor.');
  }
  return { operador, mediciones, errores };
}
