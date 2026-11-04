import 'server-only';

// Arma las dos vistas del informe de Servicios Industriales — Biogás:
//   - acumulado: un año, una fila por mes y la columna AÑO;
//   - diario: un rango de días (una semana o un mes), una fila por día y el
//     "Total general".
// y el bloque de biogás para el informe de producción de la extractora.

import { aFechaBogota, aHoraBogota, formatearFechaCorta, hoyBogota } from '../informe/fechas';
import { construirBloque, type BloqueProduccion } from './bloque-produccion';
import { datosPorDia, type DatosPorDia } from './datos';
import { sumarAcumuladores, type Acumulador, type FilaInforme, type InformeServiciosIndustriales } from './indicadores';
import { MESES, nombreMes, semanaIso } from './periodos';

function ahora(): string {
  const instante = new Date();
  return `${aFechaBogota(instante)} ${aHoraBogota(instante)}`;
}

/** Suma, motor por motor, los acumuladores de varios días. */
function sumarDias(datos: DatosPorDia, dias: string[]): Record<string, Acumulador> {
  const resultado: Record<string, Acumulador> = {};
  for (const motor of datos.motores) {
    resultado[motor] = sumarAcumuladores(...dias.map((d) => datos.porDia.get(d)?.[motor]));
  }
  return resultado;
}

function base(
  datos: DatosPorDia,
  tipo: InformeServiciosIndustriales['tipo'],
  titulo: string,
  subtitulo: string,
  desde: string,
  hasta: string,
  filas: FilaInforme[],
  etiquetaTotal: string
): InformeServiciosIndustriales {
  return {
    tipo,
    titulo,
    subtitulo,
    desde,
    hasta,
    generadoEn: ahora(),
    motores: datos.motores,
    filas,
    total: { clave: 'total', etiqueta: etiquetaTotal, acumuladores: sumarDias(datos, [...datos.porDia.keys()]) },
    observaciones: datos.observaciones,
    conteos: datos.conteos
  };
}

/** Acumulados de enero a diciembre de un año (hasta hoy si es el año en curso). */
export async function informeAcumulado(anio: number): Promise<InformeServiciosIndustriales> {
  const desde = `${anio}-01-01`;
  const hoy = hoyBogota();
  const hasta = `${anio}-12-31` < hoy ? `${anio}-12-31` : hoy;
  const datos = await datosPorDia(desde, hasta);
  const dias = [...datos.porDia.keys()];

  const filas: FilaInforme[] = MESES.map((nombre, i) => {
    const mes = `${anio}-${String(i + 1).padStart(2, '0')}`;
    return { clave: mes, etiqueta: nombre, acumuladores: sumarDias(datos, dias.filter((d) => d.startsWith(mes))) };
  });

  return base(
    datos, 'acumulado', `Tabla de acumulados — Biogás ${anio}`,
    hasta < `${anio}-12-31` ? `Del 01/01/${anio} al ${formatearFechaCorta(hasta)}` : `Año ${anio} completo`,
    desde, hasta, filas, 'AÑO'
  );
}

/** Un día por fila, del `desde` al `hasta` (validados por quien llama). */
export async function informeDiario(desde: string, hasta: string, titulo: string): Promise<InformeServiciosIndustriales> {
  const datos = await datosPorDia(desde, hasta);
  const filas: FilaInforme[] = [...datos.porDia.keys()].map((d) => ({
    clave: d,
    etiqueta: formatearFechaCorta(d),
    semana: semanaIso(d),
    mes: nombreMes(d),
    acumuladores: sumarDias(datos, [d])
  }));
  return base(
    datos, 'diario', titulo, `Del ${formatearFechaCorta(desde)} al ${formatearFechaCorta(hasta)}`,
    desde, hasta, filas, 'Total general'
  );
}

/** Bloque de biogás del día `fecha` para el informe de producción. */
export async function bloqueDelDia(fecha: string): Promise<BloqueProduccion> {
  const datos = await datosPorDia(`${fecha.slice(0, 7)}-01`, fecha);
  return construirBloque(fecha, datos.porDia, datos.motores);
}
