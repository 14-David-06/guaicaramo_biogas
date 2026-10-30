// Manejo de fechas en zona horaria de la planta (Villavicencio, Colombia).
// Colombia no aplica horario de verano, por lo que el offset es fijo en -05:00.
// Todo el informe se corta por día calendario local, no por UTC: un registro
// de las 20:00 del día anterior en Bogotá es 01:00 UTC del día siguiente.

export const ZONA_HORARIA = 'America/Bogota';
export const OFFSET_HORAS = -5;

const MS_POR_HORA = 60 * 60 * 1000;
const MS_POR_DIA = 24 * MS_POR_HORA;

/** Valida el formato YYYY-MM-DD y que sea una fecha real. */
export function esFechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return d.getUTCFullYear() === anio && d.getUTCMonth() === mes - 1 && d.getUTCDate() === dia;
}

/**
 * Convierte un día calendario de Bogotá (YYYY-MM-DD) al rango UTC que lo contiene.
 * El rango es semiabierto: [inicio, fin).
 */
export function rangoDiaBogota(fecha: string): { inicio: Date; fin: Date } {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const inicio = new Date(Date.UTC(anio, mes - 1, dia) - OFFSET_HORAS * MS_POR_HORA);
  const fin = new Date(inicio.getTime() + MS_POR_DIA);
  return { inicio, fin };
}

/** Instante UTC -> día calendario en Bogotá (YYYY-MM-DD). */
export function aFechaBogota(instante: Date | string): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  return new Date(d.getTime() + OFFSET_HORAS * MS_POR_HORA).toISOString().slice(0, 10);
}

/** Instante UTC -> hora local en Bogotá (HH:mm). */
export function aHoraBogota(instante: Date | string): string {
  const d = typeof instante === 'string' ? new Date(instante) : instante;
  return new Date(d.getTime() + OFFSET_HORAS * MS_POR_HORA).toISOString().slice(11, 16);
}

/** Instante UTC -> fecha y hora local legible (DD/MM/YYYY HH:mm). */
export function aFechaHoraBogota(instante: Date | string): string {
  const iso = aFechaBogota(instante);
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio} ${aHoraBogota(instante)}`;
}

/** Día calendario actual en Bogotá. */
export function hoyBogota(): string {
  return aFechaBogota(new Date());
}

/** Día calendario anterior al actual en Bogotá — el que cubre el informe de las 06:00. */
export function ayerBogota(): string {
  return aFechaBogota(new Date(Date.now() - MS_POR_DIA));
}

/** Suma (o resta) días a una fecha YYYY-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia) + dias * MS_POR_DIA).toISOString().slice(0, 10);
}

/** Todos los días del rango [desde, hasta], ambos incluidos. */
export function diasDelRango(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) dias.push(d);
  return dias;
}

/** Día de la semana de una fecha YYYY-MM-DD (0 = domingo). */
export function diaSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/** YYYY-MM-DD -> "lunes, 10 de agosto de 2026". */
export function formatearFechaLarga(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS[d.getUTCDay()]}, ${dia} de ${MESES[mes - 1]} de ${anio}`;
}

/** YYYY-MM-DD -> "10/08/2026". */
export function formatearFechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}/${mes}/${anio}`;
}
