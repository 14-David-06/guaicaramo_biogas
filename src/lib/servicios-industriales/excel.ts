import 'server-only';

// Excel del informe de Servicios Industriales — Biogás.
//
// Acumulado: la misma forma de la "Tabla de acumulados - Biogás" que hoy se
// lleva a mano (indicadores en filas, meses en columnas y el AÑO al final),
// para que reemplace esa hoja sin cambiar cómo se lee.
// Diario: una fila por día con todos los indicadores de cada motor y del total,
// y la fila "Total general".

import * as XLSX from 'xlsx';
import { formatearFechaCorta } from '../informe/fechas';
import {
  INDICADORES, TOTAL, etiquetaTotal, redondear, valoresDeFila,
  type DefinicionIndicador, type InformeServiciosIndustriales
} from './indicadores';

type Celda = string | number | null;

const PRODUCCION = INDICADORES.filter((d) => d.grupo === 'Operación' || d.grupo === 'Eficiencia');
const LECTURAS = INDICADORES.filter((d) => d.grupo !== 'Operación' && d.grupo !== 'Eficiencia');

function rotulo(d: DefinicionIndicador): string {
  return d.unidad ? `${d.nombre} (${d.unidad})` : d.nombre;
}

function hojaObservaciones(informe: InformeServiciosIndustriales): XLSX.WorkSheet {
  const filas: Celda[][] = informe.observaciones.map((o) => [formatearFechaCorta(o.fecha), o.motor, o.detalle]);
  const ws = XLSX.utils.aoa_to_sheet([['Fecha', 'Motor', 'Corrección o lectura no sumada'], ...filas]);
  ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 110 }];
  return ws;
}

function hojaAcumulado(informe: InformeServiciosIndustriales): XLSX.WorkSheet {
  const columnas = [...informe.motores, TOTAL];
  const nombreColumna = (c: string) => (c === TOTAL ? etiquetaTotal(informe.motores) : c);
  const periodos = [...informe.filas, informe.total];
  const valores = periodos.map((p) => valoresDeFila(p.acumuladores, informe.motores));

  const filas: Celda[][] = [];
  const bloque = (indicadores: DefinicionIndicador[]) => {
    for (const c of columnas) {
      for (const d of indicadores) {
        filas.push([`${rotulo(d)} — ${nombreColumna(c)}`, ...valores.map((v) => redondear(v[c][d.clave], d.decimales))]);
      }
    }
  };

  bloque(PRODUCCION);
  // Sin fuente en la base todavía: se deja la fila para no cambiar la forma del informe.
  filas.push(['Fruto procesado (t RFF) — sin fuente', ...periodos.map(() => null)]);
  bloque(LECTURAS);

  const encabezado = ['INDICADOR', ...periodos.map((p) => p.etiqueta)];
  const ws = XLSX.utils.aoa_to_sheet([[informe.titulo], [informe.subtitulo], [], encabezado, ...filas]);
  ws['!cols'] = [{ wch: 50 }, ...periodos.map(() => ({ wch: 12 }))];
  ws['!freeze'] = { xSplit: 1, ySplit: 4 };
  return ws;
}

function hojaDiario(informe: InformeServiciosIndustriales): XLSX.WorkSheet {
  const columnas = [...informe.motores, TOTAL];
  const nombreColumna = (c: string) => (c === TOTAL ? etiquetaTotal(informe.motores) : c);

  const encabezado = ['MES', 'SEMANA', 'Fecha'];
  for (const d of INDICADORES) for (const c of columnas) encabezado.push(`${rotulo(d)} ${nombreColumna(c)}`);

  const fila = (mes: string, semana: Celda, fecha: string, acumuladores: InformeServiciosIndustriales['total']['acumuladores']) => {
    const v = valoresDeFila(acumuladores, informe.motores);
    const celdas: Celda[] = [mes, semana, fecha];
    for (const d of INDICADORES) for (const c of columnas) celdas.push(redondear(v[c][d.clave], d.decimales));
    return celdas;
  };

  const filas = informe.filas.map((f) => fila(f.mes ?? '', f.semana ?? null, f.etiqueta, f.acumuladores));
  filas.push(fila('Total general', null, '', informe.total.acumuladores));

  const ws = XLSX.utils.aoa_to_sheet([encabezado, ...filas]);
  ws['!cols'] = encabezado.map((h, i) => ({ wch: i < 3 ? 12 : Math.min(Math.max(12, h.length + 1), 34) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezado.length - 1 } }) };
  return ws;
}

export function generarExcelServiciosIndustriales(informe: InformeServiciosIndustriales): Buffer {
  const libro = XLSX.utils.book_new();
  if (informe.tipo === 'acumulado') {
    XLSX.utils.book_append_sheet(libro, hojaAcumulado(informe), `Acumulados ${informe.desde.slice(0, 4)}`);
  } else {
    XLSX.utils.book_append_sheet(libro, hojaDiario(informe), 'Diario');
  }
  XLSX.utils.book_append_sheet(libro, hojaObservaciones(informe), 'Observaciones');

  const notas: Celda[][] = [
    ['Informe', informe.titulo],
    ['Período', informe.subtitulo],
    ['Generado', informe.generadoEn],
    ['Energía', 'kWh = delta del contador del motor (en MWh) × 1.000.'],
    ['Contadores', 'Por motor y día: Datos de operación de la planilla si el día está completo; si no, Monitoreo Motores.'],
    ['Correcciones', 'Un contador mal digitado se corrige con el registro vecino del mismo motor (el inicial de un registro es el final del anterior). Un registro abierto varios días se reparte entre esos días. Cada corrección y cada lectura no sumada está en la hoja Observaciones.'],
    ['Lecturas', 'Gas, potencia, flujo, presión y temperatura: promedio de todas las lecturas horarias del período (salida del filtro de biochar, gas que entra al motor).'],
    ['Combinado', 'Totales sumados; razones recalculadas sobre los totales; promedios sobre las lecturas de ambos motores.'],
    ['Registros', `${informe.conteos.monitoreos} monitoreos, ${informe.conteos.datosOperacion} datos de operación, ${informe.conteos.lecturasJenbacher} lecturas Jenbacher.`]
  ];
  const ws = XLSX.utils.aoa_to_sheet(notas);
  ws['!cols'] = [{ wch: 14 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(libro, ws, 'Notas');

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function nombreArchivoServiciosIndustriales(informe: InformeServiciosIndustriales, extension: 'xlsx' | 'pdf'): string {
  return informe.tipo === 'acumulado'
    ? `servicios-industriales-biogas-acumulado-${informe.desde.slice(0, 4)}.${extension}`
    : `servicios-industriales-biogas-${informe.desde}_a_${informe.hasta}.${extension}`;
}
