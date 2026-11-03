import type { TonoIndicador } from '@/components/ui/Indicadores';
import { UMBRALES_PLANILLA_GAS } from '@/lib/informe/umbrales';
import { estadoDeValor } from '@/lib/planilla/validacion';
import type { MedicionBiodigestores } from '@/utils/airtable';

// Ayudas de presentación para las mediciones por biodigestor. Las usan el
// monitoreo y el registro de biodigestores. Solo leen lo que la página ya
// cargó: no consultan nada.

const ZONA = 'America/Bogota';

/**
 * El gas de los biodigestores es el que entra al biofiltro, así que se compara
 * con los rangos de ese punto de la planilla horaria (preliminares, ver
 * umbrales.ts). Solo colorean: no bloquean nada.
 */
export const UMBRALES_BIODIGESTOR = UMBRALES_PLANILLA_GAS.entrada_biofiltro;
export type GasBiodigestor = keyof typeof UMBRALES_BIODIGESTOR;

export function fechaDeMedicion(m: MedicionBiodigestores): Date | null {
  const valor = m.fields['Fecha Medicion'];
  if (typeof valor !== 'string') return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** La medición con la fecha más reciente, sin depender del orden de la lista. */
export function medicionMasReciente(lista: MedicionBiodigestores[]): MedicionBiodigestores | null {
  let reciente: MedicionBiodigestores | null = null;
  let tiempo = -Infinity;
  for (const m of lista) {
    const t = fechaDeMedicion(m)?.getTime() ?? -Infinity;
    if (t > tiempo) {
      tiempo = t;
      reciente = m;
    }
  }
  return reciente;
}

const diaBogota = (fecha: Date) => fecha.toLocaleDateString('en-CA', { timeZone: ZONA });

export function esDeHoy(m: MedicionBiodigestores): boolean {
  const fecha = fechaDeMedicion(m);
  return fecha !== null && diaBogota(fecha) === diaBogota(new Date());
}

/** "14:35" si es de hoy; "2 nov, 14:35" si es de otro día. */
export function horaCorta(fecha: Date | null): string {
  if (!fecha) return '—';
  const hora = fecha.toLocaleTimeString('es-CO', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  if (diaBogota(fecha) === diaBogota(new Date())) return hora;
  const dia = fecha.toLocaleDateString('es-CO', { timeZone: ZONA, day: 'numeric', month: 'short' }).replace('.', '');
  return `${dia}, ${hora}`;
}

/** "02/11/2026 14:35" para tablas. */
export function fechaHora(fecha: Date | null): string {
  if (!fecha) return 'Sin fecha';
  return fecha.toLocaleString('es-CO', {
    timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
}

export function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function cifra(valor: number | null, decimales = 2): string {
  return valor === null ? '—' : valor.toLocaleString('es-CO', { maximumFractionDigits: decimales });
}

function estado(valor: number | null, gas: GasBiodigestor) {
  return estadoDeValor(valor, UMBRALES_BIODIGESTOR[gas]);
}

export function tonoGas(valor: number | null, gas: GasBiodigestor): TonoIndicador {
  const e = estado(valor, gas);
  return e === 'critica' || e === 'invalido' ? 'critico' : e === 'advertencia' ? 'alerta' : 'neutro';
}

/** Clase de una celda de tabla: solo cambia si el valor está fuera de rango. */
export function claseCeldaGas(valor: number | null, gas: GasBiodigestor): string {
  const e = estado(valor, gas);
  if (e === 'critica' || e === 'invalido') return 'bg-rojo-claro text-rojo font-semibold';
  if (e === 'advertencia') return 'bg-ambar-claro text-ambar font-semibold';
  return 'text-tinta';
}

/** Cuántos biodigestores distintos aparecen en la lista. */
export function biodigestoresDistintos(lista: MedicionBiodigestores[]): number {
  return new Set(lista.flatMap((m) => m.fields['Biodigestor Monitoreado'] ?? [])).size;
}
