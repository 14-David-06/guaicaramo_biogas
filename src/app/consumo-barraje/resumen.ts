import type { Indicador } from '@/components/ui/Indicadores';
import { AREAS_PROCESO, DEFINICION_AREAS, type DiaConsumo, type RespuestaConsumo } from '@/lib/consumo-barraje/tipos';

// Cálculos de la planilla del mes para la franja de indicadores y la tabla.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function nombreMes(mes: string): string {
  const [anio, m] = mes.split('-').map(Number);
  return `${MESES[m - 1]} de ${anio}`;
}

/** Todos los días del mes, YYYY-MM-DD. */
export function diasDelMes(mes: string): string[] {
  const [anio, m] = mes.split('-').map(Number);
  const total = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return Array.from({ length: total }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
}

/** Días del mes que ya pasaron o son hoy: los que deberían tener registro. */
export function diasExigibles(mes: string, hoy: string): string[] {
  return diasDelMes(mes).filter((d) => d <= hoy);
}

export function formatoKw(valor: number | null): string {
  return valor === null ? '—' : valor.toLocaleString('es-CO', { maximumFractionDigits: 2 });
}

export function formatoDia(fecha: string): string {
  const [, mes, dia] = fecha.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]}`;
}

/** Suma de las áreas de proceso de un día (sin Barraje #2 ni Subestación). */
export function sumaProceso(dia: DiaConsumo): number | null {
  const valores = AREAS_PROCESO.map((a) => dia.valores[a]).filter((v): v is number => v !== null);
  return valores.length ? valores.reduce((t, v) => t + v, 0) : null;
}

export function indicadoresConsumo(datos: RespuestaConsumo): Indicador[] {
  const exigibles = diasExigibles(datos.mes, datos.hoy);
  const registrados = new Set(datos.dias.map((d) => d.fecha));
  const faltantes = exigibles.filter((d) => !registrados.has(d) && d !== datos.hoy);
  const ultimo = datos.dias.at(-1);

  const conBarraje = datos.dias.filter((d) => d.valores.barraje !== null);
  const totalBarraje = conBarraje.reduce((t, d) => t + (d.valores.barraje ?? 0), 0);

  const totalesArea = AREAS_PROCESO.map((area) => ({
    area,
    total: datos.dias.reduce((t, d) => t + (d.valores[area] ?? 0), 0)
  })).sort((a, b) => b.total - a.total);
  const sumaAreas = totalesArea.reduce((t, a) => t + a.total, 0);
  const mayor = totalesArea[0];

  return [
    {
      etiqueta: 'Días registrados',
      valor: datos.dias.length,
      unidad: `de ${exigibles.length}`,
      detalle: faltantes.length
        ? `Faltan ${faltantes.length}: ${faltantes.slice(0, 4).map((d) => Number(d.slice(8))).join(', ')}${faltantes.length > 4 ? '…' : ''}`
        : exigibles.length ? 'Al día' : 'El mes todavía no empieza',
      tono: faltantes.length ? 'alerta' : datos.dias.length ? 'ok' : 'neutro'
    },
    {
      etiqueta: 'Barraje #2 en el mes',
      valor: conBarraje.length ? formatoKw(totalBarraje) : '—',
      unidad: conBarraje.length ? 'kW' : undefined,
      detalle: conBarraje.length
        ? `Promedio ${formatoKw(Math.round((totalBarraje / conBarraje.length) * 100) / 100)} kW por día`
        : 'Sin consumos registrados'
    },
    {
      etiqueta: 'Área de mayor consumo',
      valor: sumaAreas > 0 ? DEFINICION_AREAS[mayor.area].etiqueta : '—',
      detalle:
        sumaAreas > 0
          ? `${formatoKw(mayor.total)} kW, ${Math.round((mayor.total / sumaAreas) * 100)} % de las áreas de proceso`
          : 'Sin consumos registrados'
    },
    {
      etiqueta: 'Último registro',
      valor: ultimo ? formatoDia(ultimo.fecha) : '—',
      detalle: ultimo ? `${ultimo.operador.split(' ')[0] || 'Sin nombre'}, guardado el ${ultimo.guardadoEl}` : 'Aún no hay registros este mes'
    }
  ];
}
