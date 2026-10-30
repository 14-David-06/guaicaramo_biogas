// Reglas físicas de los contadores acumulados de "Monitoreo Motores".
//
// Las comparten el agregador del informe (para no sumar una lectura imposible)
// y el formulario de monitoreo (para no dejarla entrar). No importa nada del
// servidor: se puede usar desde un componente cliente.

import {
  MAX_ENERGIA_POR_HORA, MAX_M3_POR_HORA, MAX_HORAS_POR_REGISTRO, MAX_ARRANQUES_POR_REGISTRO
} from './umbrales';

// Los campos "Kw de Inicio"/"Kw de Fin" están rotulados en kW, pero son un
// contador de energía acumulada cuyo delta diario está entre 8 y 15 — coherente
// con MWh (potencia promedio × horas de operación), no con kW.
export const UNIDAD_ENERGIA = 'MWh';

/** Lectura de los cuatro contadores de un motor en un instante. */
export interface LecturaContadores {
  horometro: number | null;
  arranques: number | null;
  m3: number | null;
  energia: number | null;
}

export interface DeltaContador {
  etiqueta: 'energía' | 'm³' | 'horómetro' | 'arranques';
  unidad: string;
  /** Fin − inicio. null si falta alguno de los dos extremos. */
  valor: number | null;
  /** Máximo físicamente posible para el intervalo. */
  maximo: number;
  problema: 'negativo' | 'excesivo' | null;
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function delta(inicio: number | null, fin: number | null): number | null {
  return inicio === null || fin === null ? null : fin - inicio;
}

/** Lecturas de apertura y cierre de un registro de "Monitoreo Motores". */
export function lecturasDeMonitoreo(fields: Record<string, unknown>): {
  inicio: LecturaContadores;
  fin: LecturaContadores;
} {
  return {
    inicio: {
      horometro: numero(fields['Horometro Inicial']),
      arranques: numero(fields['Arranques Inicio']),
      m3: numero(fields['M3 de Inicio']),
      energia: numero(fields['Kw de Inicio'])
    },
    fin: {
      horometro: numero(fields['Horometro Final']),
      arranques: numero(fields['Arranques Final']),
      m3: numero(fields['M3 de Fin']),
      energia: numero(fields['Kw de Fin'])
    }
  };
}

/**
 * Deltas de los cuatro contadores entre dos lecturas, cada uno marcado si es
 * imposible: negativo (un contador acumulado no retrocede) o por encima del
 * límite físico del motor. Los topes de energía y m³ se calculan sobre las horas
 * de horómetro del intervalo; si el horómetro también es inválido, sobre
 * `maxHoras`.
 *
 * `maxHoras` es el horómetro máximo admisible: por defecto el tope por registro
 * del informe; el formulario pasa las horas reales transcurridas desde la
 * lectura anterior.
 */
export function evaluarDeltas(
  inicio: LecturaContadores,
  fin: LecturaContadores,
  maxHoras: number = MAX_HORAS_POR_REGISTRO
): DeltaContador[] {
  const dHoras = delta(inicio.horometro, fin.horometro);
  const horasValidas = dHoras !== null && dHoras >= 0 && dHoras <= maxHoras ? dHoras : null;
  const horasTope = horasValidas ?? maxHoras;

  const lecturas: Omit<DeltaContador, 'problema'>[] = [
    { etiqueta: 'energía', valor: delta(inicio.energia, fin.energia), maximo: horasTope * MAX_ENERGIA_POR_HORA, unidad: UNIDAD_ENERGIA },
    { etiqueta: 'm³', valor: delta(inicio.m3, fin.m3), maximo: horasTope * MAX_M3_POR_HORA, unidad: 'm³' },
    { etiqueta: 'horómetro', valor: dHoras, maximo: maxHoras, unidad: 'h' },
    { etiqueta: 'arranques', valor: delta(inicio.arranques, fin.arranques), maximo: MAX_ARRANQUES_POR_REGISTRO, unidad: 'arranques' }
  ];

  return lecturas.map((l) => ({
    ...l,
    problema: l.valor === null ? null : l.valor < 0 ? 'negativo' : l.valor > l.maximo ? 'excesivo' : null
  }));
}
