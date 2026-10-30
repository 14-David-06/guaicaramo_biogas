import 'server-only';

// Consolidado en Excel de un rango de días (semanal, mensual o el que se pida).
//
// Responde a lo que hoy se hace a mano: descargar los registros, transcribirlos
// y sacar de ahí los kW generados, los m³ y el H2S para entregarlos a otras
// áreas. La hoja "Resumen diario" es ese consolidado, una fila por día, armada
// con las mismas reglas del informe diario; las demás hojas traen el detalle
// para quien necesite rehacer o auditar un cálculo.

import * as XLSX from 'xlsx';
import { aFechaBogota, aHoraBogota, formatearFechaCorta } from './fechas';
import { numero, texto, type DatosPlanta } from './agregador';
import type { InformeDiario, ResumenVariable } from './tipos';

type Celda = string | number | null;

const SEVERIDAD: Record<string, string> = { critica: 'Crítica', advertencia: 'Advertencia', informativa: 'Informativa' };

function promedioDe(variables: ResumenVariable[], nombre: string): number | null {
  return variables.find((v) => v.nombre === nombre)?.promedio ?? null;
}

function maximoDe(variables: ResumenVariable[], nombre: string): number | null {
  return variables.find((v) => v.nombre === nombre)?.maximo ?? null;
}

function promedio(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
}

function suma(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10 : null;
}

function maximo(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) : null;
}

function hoja(encabezados: string[], filas: Celda[][], anchos?: number[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
  ws['!cols'] = encabezados.map((h, i) => ({ wch: anchos?.[i] ?? Math.max(10, h.length + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length, c: encabezados.length - 1 } }) };
  return ws;
}

export function generarExcelConsolidado({
  informes,
  datos
}: {
  informes: InformeDiario[];
  datos: DatosPlanta;
}): Buffer {
  const libro = XLSX.utils.book_new();
  const unidad = informes[0]?.produccion.unidadEnergia ?? 'MWh';

  // ----------------------------------------------------------- Resumen diario
  const filasResumen: Celda[][] = informes.map((inf) => {
    const remociones = inf.remocionH2S.map((m) => m.remocionTotal);
    return [
      formatearFechaCorta(inf.fecha),
      inf.fechaLarga.split(',')[0],
      inf.produccion.energiaGenerada,
      inf.produccion.m3Biogas,
      inf.produccion.horasOperacion,
      inf.produccion.arranques,
      inf.produccion.potenciaPromedio,
      inf.produccion.potenciaMaxima,
      promedioDe(inf.calidadGas, 'Metano (CH4)'),
      promedioDe(inf.calidadGas, 'Oxígeno (O2)'),
      promedioDe(inf.calidadGas, 'Dióxido de carbono (CO2)'),
      promedioDe(inf.calidadGas, 'Ácido sulfhídrico (H2S)'),
      maximoDe(inf.calidadGas, 'Ácido sulfhídrico (H2S)'),
      promedio(remociones),
      inf.conteos.registrosJenbacher,
      inf.turnos.length,
      inf.excepciones.filter((e) => e.severidad === 'critica').length,
      inf.excepciones.filter((e) => e.severidad === 'advertencia').length
    ];
  });

  const columna = (i: number) => filasResumen.map((f) => (typeof f[i] === 'number' ? (f[i] as number) : null));
  filasResumen.push([]);
  filasResumen.push([
    'TOTAL / PROMEDIO', `${informes.length} días`,
    suma(columna(2)), suma(columna(3)), suma(columna(4)), suma(columna(5)),
    promedio(columna(6)), maximo(columna(7)),
    promedio(columna(8)), promedio(columna(9)), promedio(columna(10)), promedio(columna(11)),
    maximo(columna(12)),
    promedio(columna(13)),
    suma(columna(14)), suma(columna(15)), suma(columna(16)), suma(columna(17))
  ]);

  XLSX.utils.book_append_sheet(libro, hoja(
    [
      'Fecha', 'Día', `Energía generada (${unidad})`, 'Biogás consumido (m³)', 'Horas de operación', 'Arranques',
      'Potencia promedio (kW)', 'Potencia máxima (kW)', 'CH4 prom. (%)', 'O2 prom. (%)', 'CO2 prom. (%)',
      'H2S prom. (ppm)', 'H2S máx. (ppm)', 'Remoción H2S prom. (%)', 'Registros Jenbacher', 'Turnos',
      'Excepciones críticas', 'Advertencias'
    ],
    filasResumen,
    [16, 12]
  ), 'Resumen diario');

  // -------------------------------------------------------- Motores por día
  XLSX.utils.book_append_sheet(libro, hoja(
    ['Fecha', 'Motor', 'Horas', 'Arranques', `Energía (${unidad})`, 'Biogás (m³)', 'Estado final', 'Producción parcial'],
    informes.flatMap((inf) => inf.motores.map((m) => [
      formatearFechaCorta(inf.fecha), m.nombre, m.horasOperacion, m.arranques, m.energiaGenerada,
      m.m3Consumidos, m.estadoFinal ?? 'Sin cambios', m.registroIncompleto ? 'Sí' : 'No'
    ])),
    [12, 26]
  ), 'Motores por día');

  // ------------------------------------------------------------ Excepciones
  XLSX.utils.book_append_sheet(libro, hoja(
    ['Fecha', 'Hora', 'Severidad', 'Categoría', 'Novedad', 'Detalle'],
    informes.flatMap((inf) => inf.excepciones.map((e) => [
      formatearFechaCorta(inf.fecha), e.hora ?? '', SEVERIDAD[e.severidad], e.categoria, e.titulo, e.detalle
    ])),
    [12, 8, 12, 16, 50, 90]
  ), 'Excepciones');

  // --------------------------------------------------- Registros Jenbacher
  const jenbacher = [...datos.jenbacher].sort(
    (a, b) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime()
  );
  XLSX.utils.book_append_sheet(libro, hoja(
    [
      'Fecha', 'Hora', 'Operador', 'CH4 (%)', 'O2 (%)', 'CO2 (%)', 'H2S (ppm)', 'Potencia (kW)', 'Biogás (m³)',
      'Presión entrada biofiltro', 'Presión salida biofiltro', 'Temp. entrada biofiltro', 'Temp. salida biofiltro',
      'Biodigestores'
    ],
    jenbacher.map((r) => [
      formatearFechaCorta(aFechaBogota(r.createdTime)),
      aHoraBogota(r.createdTime),
      texto(r.fields['Realiza Registro']),
      numero(r.fields['METANO(CH4)%']),
      numero(r.fields['OXIGENO(O2) %']),
      numero(r.fields['DIOXIDO DE CARBONO(CO2) %']),
      numero(r.fields['ACIDO SULFIDRICO(H2S)']),
      numero(r.fields['POTENCIA GENERADA(Kw)']),
      numero(r.fields['M3 DE BIOGAS (M3)']),
      numero(r.fields['PRESION BIOFILTRO ENTRADA (cm de h20)']),
      numero(r.fields['PRESION BIOFILTRO SALIDA (cm de h2o)']),
      numero(r.fields['TEMP. ENTRADA BIOFILTRO']),
      numero(r.fields['TEMP. SALIDA BIOFILTRO']),
      texto(r.fields['Nombre Biodigestores (from Biodigestores Usados)'])
    ]),
    [12, 8, 20]
  ), 'Registros Jenbacher');

  // ---------------------------------------------------------- Remoción H2S
  XLSX.utils.book_append_sheet(libro, hoja(
    [
      'Fecha', 'Hora', 'Operador', 'Entrada biofiltro (ppm)', 'Salida biofiltro (ppm)', 'Salida biochar (ppm)',
      '% remoción biofiltro', '% remoción biochar', '% remoción total'
    ],
    informes.flatMap((inf) => inf.remocionH2S.map((m) => [
      formatearFechaCorta(inf.fecha), m.hora, m.operador, m.entradaBiofiltro, m.salidaBiofiltro, m.salidaBiochar,
      m.remocionBiofiltro, m.remocionBiochar, m.remocionTotal
    ])),
    [12, 8, 20]
  ), 'Remoción H2S');

  // ----------------------------------------------------------------- Turnos
  XLSX.utils.book_append_sheet(libro, hoja(
    ['Fecha del informe', 'Operador', 'Inicio', 'Fin', 'Duración (h)', 'Estado'],
    informes.flatMap((inf) => inf.turnos.map((t) => [
      formatearFechaCorta(inf.fecha), t.operador, t.inicio ?? '', t.fin ?? '', t.duracionHoras,
      t.cerrado ? 'Cerrado' : 'Abierto'
    ])),
    [16, 22, 12, 12]
  ), 'Turnos');

  // --------------------------------------------------------------- Bitácora
  XLSX.utils.book_append_sheet(libro, hoja(
    ['Fecha', 'Hora', 'Operador', 'Informe ejecutivo'],
    informes.flatMap((inf) => inf.bitacora.map((b) => [
      formatearFechaCorta(inf.fecha), b.hora, b.operador, b.informeEjecutivo || b.transcripcion
    ])),
    [12, 8, 20, 120]
  ), 'Bitácora');

  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function nombreArchivoConsolidado(desde: string, hasta: string): string {
  return desde === hasta ? `consolidado-biogas-${desde}.xlsx` : `consolidado-biogas-${desde}_a_${hasta}.xlsx`;
}
