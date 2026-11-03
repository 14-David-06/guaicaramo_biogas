import type { BitacoraBiogas, EstadoMotor, MedicionBiodigestores, MonitoreoMotor, RegistroDiariosJenbacher, TurnoOperador } from '@/utils/airtable';
import type { TonoIndicador } from '@/components/ui/Indicadores';
import { UMBRALES_CALIDAD_GAS, fueraDeRango } from '@/lib/informe/umbrales';

// Tipos y utilidades de presentación compartidos por las pestañas del tablero.

export interface DatosTablero {
  turno: TurnoOperador | null;
  estadosMotores: EstadoMotor[];
  monitoreoMotores: MonitoreoMotor[];
  registrosJenbacher: RegistroDiariosJenbacher[];
  bitacoraBiogas: BitacoraBiogas[];
  medicionBiodigestores: MedicionBiodigestores[];
}

export type ModoVista = 'turno' | 'historico';

/** Fecha y hora corta, como la mostraba el tablero: 2/11/26, 2:30 p. m. */
export function fechaCorta(valor: unknown, siFalta = 'Sin fecha'): string {
  return typeof valor === 'string'
    ? new Date(valor).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
    : siFalta;
}

/** Nombre del motor de un estado o un monitoreo (el campo es un vínculo). */
export function nombreDeMotor(
  motorId: unknown,
  obtenerNombreMotor: (id: string | string[]) => string,
  index: number
): string {
  return Array.isArray(motorId) && motorId.length > 0
    ? obtenerNombreMotor(motorId[0])
    : typeof motorId === 'string'
      ? obtenerNombreMotor(motorId)
      : `Motor ${index + 1}`;
}

/** Tono de un gas del registro Jenbacher según UMBRALES_CALIDAD_GAS. */
export function tonoGas(campo: string, valor: unknown): TonoIndicador {
  const umbral = UMBRALES_CALIDAD_GAS.find((u) => u.campo === campo);
  if (!umbral || typeof valor !== 'number' || !valor) return 'neutro';
  if (!fueraDeRango(valor, umbral)) return 'neutro';
  return umbral.severidad === 'critica' ? 'critico' : 'alerta';
}

/** Tono del H2S como lo pintaba el tablero: sobre 300 ppm crítico, sobre 200 atención. */
export function tonoH2S(ppm: number): TonoIndicador {
  return ppm > 300 ? 'critico' : ppm > 200 ? 'alerta' : 'ok';
}

export const CLASE_TONO_CELDA: Record<TonoIndicador, string> = {
  neutro: '',
  ok: '',
  alerta: 'bg-ambar-claro text-ambar font-semibold',
  critico: 'bg-rojo-claro text-rojo font-semibold'
};

export const CLASE_TONO_TEXTO: Record<TonoIndicador, string> = {
  neutro: 'text-tinta',
  ok: 'text-bosque',
  alerta: 'text-ambar',
  critico: 'text-rojo'
};

/** Clases de una tabla del sistema claro. */
export const TABLA = {
  contenedor: 'bg-superficie border border-linea rounded-xl overflow-auto max-h-[36rem]',
  thead: 'bg-superficie-2 sticky top-0 z-10',
  th: 'text-left font-condensada font-semibold text-tinta-suave py-2.5 px-3 whitespace-nowrap',
  fila: 'border-t border-linea',
  td: 'py-2.5 px-3 whitespace-nowrap tabular-nums'
};

/** Cifra con coma decimal y punto de miles, como en Colombia. */
export function dec(valor: number, decimales = 0): string {
  return valor.toLocaleString('es-CO', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}
