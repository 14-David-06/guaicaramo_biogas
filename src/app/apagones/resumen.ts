import type { Indicador } from '@/components/ui/Indicadores';
import { ORIGEN_CORTO, duracionMinutos, formatoDuracion, type Apagon, type RespuestaApagones } from '@/lib/apagones/tipos';

// Cálculos del mes para la franja de indicadores y formatos de hora.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function nombreMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${anio}`;
}

/** "2026-11-04T14:30" → "4 nov, 14:30". */
export function formatoMomento(horaLocal: string): string {
  const [, mes, dia] = horaLocal.slice(0, 10).split('-').map(Number);
  return `${dia} ${MESES_CORTOS[mes - 1]}, ${horaLocal.slice(11, 16)}`;
}

/** Hora de fin; si es el mismo día del inicio, solo HH:mm. */
export function formatoFin(apagon: Apagon): string {
  if (!apagon.fin) return 'En curso';
  return apagon.fin.slice(0, 10) === apagon.inicio.slice(0, 10) ? apagon.fin.slice(11, 16) : formatoMomento(apagon.fin);
}

export function indicadoresApagones(datos: RespuestaApagones, ahora: string): Indicador[] {
  const { apagones } = datos;
  const enCurso = datos.enCurso.length;
  const duraciones = apagones.map((a) => duracionMinutos(a, ahora));
  const total = duraciones.reduce((t, d) => t + d, 0);

  const largo = apagones.reduce<{ a: Apagon; d: number } | null>((max, a, i) => (!max || duraciones[i] > max.d ? { a, d: duraciones[i] } : max), null);

  const porOrigen = new Map<string, number>();
  for (const a of apagones) {
    if (a.origen && a.origen !== 'Desconocido') porOrigen.set(ORIGEN_CORTO[a.origen], (porOrigen.get(ORIGEN_CORTO[a.origen]) ?? 0) + 1);
  }
  const [causa] = [...porOrigen.entries()].sort((x, y) => y[1] - x[1]);
  const sinCausa = apagones.filter((a) => !a.origen || a.origen === 'Desconocido').length;

  return [
    {
      etiqueta: 'Apagones en el mes',
      valor: apagones.length,
      detalle: enCurso ? `${enCurso} en curso ahora` : apagones.length ? 'Ninguno en curso' : 'Sin apagones reportados',
      tono: enCurso ? 'critico' : apagones.length ? 'alerta' : 'ok'
    },
    {
      etiqueta: 'Tiempo sin energía',
      valor: apagones.length ? formatoDuracion(total) : '—',
      detalle: apagones.length ? `Promedio ${formatoDuracion(Math.round(total / apagones.length))} por apagón` : 'Sin apagones reportados'
    },
    {
      etiqueta: 'El más largo',
      valor: largo ? formatoDuracion(largo.d) : '—',
      detalle: largo ? `${formatoMomento(largo.a.inicio)}${largo.a.fin ? '' : ' · sigue en curso'}` : 'Sin apagones reportados'
    },
    {
      etiqueta: 'Origen más frecuente',
      valor: causa ? causa[0] : '—',
      detalle: causa
        ? `${causa[1]} de ${apagones.length}${sinCausa ? ` · ${sinCausa} sin origen conocido` : ''}`
        : sinCausa ? `${sinCausa} sin origen conocido` : 'Sin apagones reportados'
    }
  ];
}
