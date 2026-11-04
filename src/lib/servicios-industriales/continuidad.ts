// Deltas de los contadores de un motor, corregidos por continuidad.
//
// Los contadores de "Monitoreo Motores" son acumulados: el inicial de un
// registro debería ser el final del anterior del mismo motor. En la base, el
// error más frecuente es escribir en un extremo la lectura instantánea del
// tablero en vez del contador (p. ej. "Kw de Fin" = 400 y, en el registro
// siguiente, "Kw de Inicio" = 400, cuando el contador iba en 27.190). Ese
// registro queda con un delta imposible y se perdería del total del mes.
//
// Para cada contador, en orden:
//   1. Delta directo (final − inicial) si es físicamente posible.
//   2. Si no, se cambia el extremo malo por el del registro vecino, siempre
//      que el delta del vecino sea válido: inicial ← final del anterior, o
//      final ← inicial del siguiente.
//   3. Si el registro siguiente tiene el mismo error (el valor intermedio mal
//      escrito en los dos), se toma el total de ambos —inicial del primero a
//      final del segundo— y se reparte entre los dos por horas de horómetro.
//   4. Si nada de eso da un delta posible, el registro no se suma.
// Toda corrección queda escrita en las notas del registro.
//
// No importa nada del servidor.

import { evaluarDeltas, type DeltaContador, type LecturaContadores } from '../informe/contadores';
import { MAX_HORAS_POR_REGISTRO } from '../informe/umbrales';

export type Contador = keyof LecturaContadores;

/** El horómetro primero: los topes de energía y m³, y los repartos, usan sus horas. */
const ORDEN: Contador[] = ['horometro', 'energia', 'm3', 'arranques'];

const ETIQUETA: Record<Contador, DeltaContador['etiqueta']> = {
  horometro: 'horómetro', energia: 'energía', m3: 'm³', arranques: 'arranques'
};

export interface LecturaRegistro {
  inicio: LecturaContadores;
  fin: LecturaContadores;
  /**
   * Horas que pudo cubrir el registro: hasta que se abrió el siguiente del
   * mismo motor (un cierre olvidado un fin de semana cubre 48 h o más). Por
   * defecto, MAX_HORAS_POR_REGISTRO.
   */
  maxHoras?: number;
}

export interface DeltasRegistro {
  /** Delta usado por contador (energía en MWh); null si no se pudo establecer. */
  valores: Record<Contador, number | null>;
  /** Correcciones aplicadas, en lenguaje de planta. */
  notas: string[];
  /** Deltas imposibles que no se pudieron corregir y no se suman. */
  problemas: DeltaContador[];
  /** Algún contador sin valor de cierre y sin registro siguiente para completarlo. */
  sinCierre: boolean;
}

function formato(v: number): string {
  return v.toLocaleString('es-CO', { maximumFractionDigits: 1 });
}

function deltaDe(inicio: LecturaContadores, fin: LecturaContadores, contador: Contador, maxHoras = MAX_HORAS_POR_REGISTRO): DeltaContador {
  return evaluarDeltas(inicio, fin, maxHoras).find((d) => d.etiqueta === ETIQUETA[contador])!;
}

function valido(d: DeltaContador): boolean {
  return d.valor !== null && d.problema === null;
}

export function deltasPorContinuidad(lecturas: LecturaRegistro[]): DeltasRegistro[] {
  // Nota: el tope de arranques (MAX_ARRANQUES_POR_REGISTRO) no se escala con
  // maxHoras; es el mismo del formulario.
  const n = lecturas.length;
  const resultado: DeltasRegistro[] = lecturas.map(() => ({
    valores: { horometro: null, energia: null, m3: null, arranques: null },
    notas: [],
    problemas: [],
    sinCierre: false
  }));

  for (const c of ORDEN) {
    const nombre = ETIQUETA[c];
    const repartido = new Set<number>();

    for (let i = 0; i < n; i++) {
      if (repartido.has(i)) continue;
      const { inicio, fin } = lecturas[i];
      const max = lecturas[i].maxHoras ?? MAX_HORAS_POR_REGISTRO;
      const directo = deltaDe(inicio, fin, c, max);
      if (valido(directo)) {
        resultado[i].valores[c] = directo.valor;
        continue;
      }

      // 2a. Inicial ← final del registro anterior (si ese registro cuadró).
      const anterior = i > 0 ? lecturas[i - 1].fin[c] : null;
      if (anterior !== null && resultado[i - 1].valores[c] !== null) {
        const d = deltaDe({ ...inicio, [c]: anterior }, fin, c, max);
        if (valido(d)) {
          resultado[i].valores[c] = d.valor;
          resultado[i].notas.push(
            `${nombre}: inicial ${inicio[c] === null ? 'vacío' : formato(inicio[c]!)} cambiado por el final del registro anterior (${formato(anterior)})`
          );
          continue;
        }
      }

      // 2b. Final ← inicial del registro siguiente (si ese registro cuadra).
      const siguiente = i < n - 1 ? lecturas[i + 1] : null;
      const maxSiguiente = siguiente?.maxHoras ?? MAX_HORAS_POR_REGISTRO;
      if (siguiente && siguiente.inicio[c] !== null && valido(deltaDe(siguiente.inicio, siguiente.fin, c, maxSiguiente))) {
        const d = deltaDe(inicio, { ...fin, [c]: siguiente.inicio[c] }, c, max);
        if (valido(d)) {
          resultado[i].valores[c] = d.valor;
          resultado[i].notas.push(
            `${nombre}: final ${fin[c] === null ? 'vacío' : formato(fin[c]!)} cambiado por el inicial del registro siguiente (${formato(siguiente.inicio[c]!)})`
          );
          continue;
        }
      }

      // 3. El mismo valor intermedio mal escrito en este registro y el siguiente.
      if (siguiente && c !== 'horometro' && !valido(deltaDe(siguiente.inicio, siguiente.fin, c, maxSiguiente))) {
        const total = deltaDe(inicio, siguiente.fin, c, max + maxSiguiente);
        if (valido(total)) {
          const hi = resultado[i].valores.horometro;
          const hj = resultado[i + 1].valores.horometro;
          const parte = hi !== null && hj !== null && hi + hj > 0 ? hi / (hi + hj) : 0.5;
          let propio = total.valor! * parte;
          if (c === 'arranques') propio = Math.round(propio);
          resultado[i].valores[c] = propio;
          resultado[i + 1].valores[c] = total.valor! - propio;
          const intermedio = fin[c] === null ? 'vacío' : formato(fin[c]!);
          const nota =
            `${nombre}: valor intermedio mal digitado (${intermedio}) en dos registros seguidos; ` +
            `se tomó el total de ambos (${formato(total.valor!)} ${total.unidad}) y se repartió por horas de horómetro`;
          resultado[i].notas.push(nota);
          resultado[i + 1].notas.push(nota);
          repartido.add(i + 1);
          continue;
        }
      }

      // 4. Sin corrección posible.
      if (directo.valor === null) resultado[i].sinCierre = true;
      else resultado[i].problemas.push(directo);
    }
  }

  return resultado;
}
