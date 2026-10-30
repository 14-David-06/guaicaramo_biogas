import 'server-only';

// Render del informe diario a PDF.
//
// Se genera en el servidor (no en el navegador como los reportes de
// monitoreo-biodigestores) para que el envío automático de las 06:00 pueda
// reutilizar exactamente esta función y adjuntar el mismo archivo al correo.
//
// Estructura: la primera página es un resumen ejecutivo que se lee en un
// minuto (estado del día, indicadores, novedades y calidad del gas); a partir
// de la segunda va el detalle (perfil del día, cobertura de turnos, motores y
// tablas). Los colores salen del logo de Guaicaramo.
//
// Solo se usa la fuente Helvetica estándar de jsPDF, que cubre WinAnsi: por eso
// se escribe "H2S" y no "H₂S", y se evita "→" (se usa "›").

import { readFileSync } from 'fs';
import path from 'path';
import jsPDF from 'jspdf';
import autoTable, { type UserOptions } from 'jspdf-autotable';
import { formatearFechaCorta, rangoDiaBogota } from './fechas';
import { MAX_HORAS_SIN_REGISTRO, UMBRALES_CALIDAD_GAS } from './umbrales';
import type { Excepcion, InformeDiario, LecturaSerie, ResumenMotor, Severidad } from './tipos';

type RGB = [number, number, number];

// ------------------------------------------------------------------ Paleta
const OLIVA: RGB = [62, 77, 40];
const HOJA: RGB = [122, 157, 75];
const HOJA_CLARA: RGB = [214, 228, 196];
const NARANJA: RGB = [232, 73, 42];
const TINTA: RGB = [31, 41, 55];
const GRIS: RGB = [107, 114, 128];
const GRIS_CLARO: RGB = [170, 176, 186];
const LINEA: RGB = [226, 230, 222];
const FONDO: RGB = [246, 248, 243];
const BLANCO: RGB = [255, 255, 255];

const SEVERIDAD: Record<Severidad, { color: RGB; fondo: RGB; etiqueta: string }> = {
  critica: { color: [190, 38, 38], fondo: [253, 238, 238], etiqueta: 'CRÍTICA' },
  advertencia: { color: [190, 105, 10], fondo: [255, 245, 225], etiqueta: 'ADVERTENCIA' },
  informativa: { color: GRIS, fondo: [241, 243, 245], etiqueta: 'INFO' }
};
const OK = { color: [86, 125, 40] as RGB, fondo: [239, 246, 231] as RGB };

// --------------------------------------------------------------- Geometría
const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const MARGEN = 16;
const ANCHO = ANCHO_PAGINA - 2 * MARGEN;
const LIMITE_INFERIOR = ALTO_PAGINA - 24;

// ------------------------------------------------------------------ Logos
function cargarImagen(archivo: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(path.join(process.cwd(), 'public', archivo)));
  } catch {
    console.warn(`[informe-pdf] No se encontró public/${archivo}; el PDF sale sin ese logo.`);
    return null;
  }
}

const LOGO_GUAICARAMO = cargarImagen('logo-guaicaramo.png'); // 1616 × 643
const LOGO_SIRIUS = cargarImagen('Logo-Sirius.png'); // 1015 × 450

// --------------------------------------------------------------- Formatos
function num(v: number | null, decimales?: number): string {
  if (v === null) return '—';
  return v.toLocaleString('es-CO', decimales === undefined ? undefined : { maximumFractionDigits: decimales });
}

function conUnidad(v: number | null, unidad: string): string {
  return v === null ? '—' : `${num(v)} ${unidad}`;
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Redondea hacia arriba a un número "de eje" (1, 1,2, 1,5 … 8 × 10^n). */
function techoRedondo(v: number): number {
  if (v <= 0) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(v));
  for (const paso of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (paso * magnitud >= v) return paso * magnitud;
  }
  return 10 * magnitud;
}

function hhmm(minuto: number): string {
  const m = Math.round(minuto);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Bloques del día sin lecturas Jenbacher por más de MAX_HORAS_SIN_REGISTRO. */
function vacios(serie: LecturaSerie[], corteMinuto: number): { desde: number; hasta: number }[] {
  if (serie.length === 0) return [];
  const hitos = [0, ...serie.map((s) => s.minuto).sort((a, b) => a - b), corteMinuto];
  const resultado: { desde: number; hasta: number }[] = [];
  for (let i = 1; i < hitos.length; i++) {
    if (hitos[i] - hitos[i - 1] > MAX_HORAS_SIN_REGISTRO * 60) resultado.push({ desde: hitos[i - 1], hasta: hitos[i] });
  }
  return resultado;
}

// ==========================================================================

/** Lienzo con el cursor vertical y utilidades de dibujo compartidas. */
class Lienzo {
  doc = new jsPDF({ unit: 'mm', format: 'a4' });
  y = MARGEN;

  constructor(private informe: InformeDiario) {}

  relleno(c: RGB) { this.doc.setFillColor(c[0], c[1], c[2]); }
  trazo(c: RGB) { this.doc.setDrawColor(c[0], c[1], c[2]); }
  color(c: RGB) { this.doc.setTextColor(c[0], c[1], c[2]); }

  fuente(tamano: number, estilo: 'normal' | 'bold' | 'italic' = 'normal', c: RGB = TINTA) {
    this.doc.setFont('helvetica', estilo);
    this.doc.setFontSize(tamano);
    this.color(c);
  }

  /** Salta de página si lo que sigue no cabe. */
  asegurar(alto: number) {
    if (this.y + alto <= LIMITE_INFERIOR) return;
    this.doc.addPage();
    this.encabezadoContinuacion();
  }

  encabezadoContinuacion() {
    this.fuente(7.5, 'bold', GRIS);
    this.doc.text('INFORME DIARIO DE OPERACIÓN', MARGEN, 13, { charSpace: 0.4 });
    this.fuente(7.5, 'normal', GRIS);
    this.doc.text(capitalizar(this.informe.fechaLarga), ANCHO_PAGINA - MARGEN, 13, { align: 'right' });
    this.trazo(NARANJA);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGEN, 16, ANCHO_PAGINA - MARGEN, 16);
    this.y = 24;
  }

  /** Título de sección con filete. Reserva `altoMinimo` para no dejar el título huérfano. */
  seccion(titulo: string, altoMinimo = 30, nota?: string) {
    this.asegurar(altoMinimo + 10);
    this.fuente(11, 'bold', OLIVA);
    this.doc.text(titulo, MARGEN, this.y);
    if (nota) {
      this.fuente(7.5, 'normal', GRIS);
      this.doc.text(nota, ANCHO_PAGINA - MARGEN, this.y, { align: 'right' });
    }
    this.trazo(LINEA);
    this.doc.setLineWidth(0.3);
    this.doc.line(MARGEN, this.y + 2.2, ANCHO_PAGINA - MARGEN, this.y + 2.2);
    this.y += 7;
  }

  /** Ancho real de un texto con espaciado entre letras (jsPDF no lo descuenta al alinear). */
  anchoEspaciado(texto: string, charSpace: number): number {
    return this.doc.getTextWidth(texto) + charSpace * Math.max(texto.length - 1, 0);
  }

  /** Texto en versalitas espaciadas, alineado a la derecha sin desbordar el margen. */
  rotuloDerecha(texto: string, xDerecha: number, yBase: number, charSpace = 0.5) {
    this.doc.text(texto, xDerecha - this.anchoEspaciado(texto, charSpace), yBase, { charSpace });
  }

  /** Píldora de color. Devuelve el ancho dibujado. */
  chip(x: number, yBase: number, texto: string, c: RGB, fondo: RGB, alinear: 'left' | 'right' = 'left'): number {
    this.fuente(6.5, 'bold', c);
    const ancho = this.anchoEspaciado(texto, 0.15) + 4;
    const x0 = alinear === 'right' ? x - ancho : x;
    this.relleno(fondo);
    this.doc.roundedRect(x0, yBase - 3.4, ancho, 4.6, 1.6, 1.6, 'F');
    this.doc.text(texto, x0 + 2, yBase, { charSpace: 0.15 });
    return ancho;
  }

  /** Estilo común de las tablas de detalle. */
  tabla(opciones: UserOptions) {
    autoTable(this.doc, {
      startY: this.y,
      theme: 'plain',
      margin: { left: MARGEN, right: MARGEN, top: 24, bottom: ALTO_PAGINA - LIMITE_INFERIOR },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }, textColor: TINTA, valign: 'top' },
      headStyles: { fillColor: FONDO, textColor: OLIVA, fontStyle: 'bold', fontSize: 7.2, lineWidth: { bottom: 0.4 }, lineColor: HOJA },
      bodyStyles: { lineWidth: { bottom: 0.15 }, lineColor: LINEA },
      willDrawPage: (data) => {
        if (data.pageNumber > 1) this.encabezadoContinuacion();
      },
      ...opciones
    });
    const t = (this.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    this.y = (t ? t.finalY : this.y) + 8;
  }
}

// ================================================================ Secciones

function encabezado(l: Lienzo, informe: InformeDiario) {
  const { doc } = l;
  if (LOGO_GUAICARAMO) {
    doc.addImage(LOGO_GUAICARAMO, 'PNG', MARGEN, 11, 36, 36 * (643 / 1616), 'guaicaramo', 'FAST');
  } else {
    l.fuente(14, 'bold', OLIVA);
    doc.text('GUAICARAMO', MARGEN, 20);
  }

  const derecha = ANCHO_PAGINA - MARGEN;
  l.fuente(7.5, 'bold', GRIS);
  l.rotuloDerecha('INFORME DIARIO DE OPERACIÓN', derecha, 13.5);
  l.fuente(17, 'bold', OLIVA);
  doc.text('Planta de Biogás', derecha, 21, { align: 'right' });
  l.fuente(9.5, 'normal', TINTA);
  doc.text(capitalizar(informe.fechaLarga), derecha, 27, { align: 'right' });

  // La línea naranja del logo, a todo lo ancho.
  l.trazo(NARANJA);
  doc.setLineWidth(0.9);
  doc.line(MARGEN, 32, derecha, 32);
  l.y = 39;
}

function bannerEstado(l: Lienzo, informe: InformeDiario) {
  const { doc } = l;
  const criticas = informe.excepciones.filter((e) => e.severidad === 'critica');
  const advertencias = informe.excepciones.filter((e) => e.severidad === 'advertencia');

  let estilo = OK;
  let titulo = 'Día sin novedades';
  let detalle = 'Todos los parámetros dentro de rango y registros completos.';

  if (informe.sinDatos) {
    estilo = { color: GRIS, fondo: [241, 243, 245] };
    titulo = 'Sin registros operativos';
    detalle = 'No se encontró ningún turno, registro de operación ni bitácora en el día consultado.';
  } else if (criticas.length) {
    estilo = SEVERIDAD.critica;
    titulo = `Día con ${criticas.length} ${criticas.length === 1 ? 'novedad crítica' : 'novedades críticas'}`;
    detalle = `Atender primero: ${criticas[0].titulo}.`;
  } else if (advertencias.length) {
    estilo = SEVERIDAD.advertencia;
    titulo = `Día con ${advertencias.length} ${advertencias.length === 1 ? 'advertencia' : 'advertencias'}`;
    detalle = `Revisar: ${advertencias[0].titulo}.`;
  }

  const alto = 17;
  l.relleno(estilo.fondo);
  doc.roundedRect(MARGEN, l.y, ANCHO, alto, 2, 2, 'F');
  l.relleno(estilo.color);
  doc.rect(MARGEN, l.y, 2.2, alto, 'F');

  l.fuente(12, 'bold', estilo.color);
  doc.text(titulo, MARGEN + 7, l.y + 7);
  l.fuente(8.5, 'normal', TINTA);
  doc.text(doc.splitTextToSize(detalle, ANCHO - 60)[0], MARGEN + 7, l.y + 12.5);

  if (!informe.sinDatos && informe.excepciones.length) {
    let x = ANCHO_PAGINA - MARGEN - 4;
    if (advertencias.length) {
      x -= l.chip(x, l.y + 8, `${advertencias.length} ADVERTENCIA${advertencias.length === 1 ? '' : 'S'}`, SEVERIDAD.advertencia.color, BLANCO, 'right') + 2;
    }
    if (criticas.length) {
      l.chip(x, l.y + 8, `${criticas.length} CRÍTICA${criticas.length === 1 ? '' : 'S'}`, SEVERIDAD.critica.color, BLANCO, 'right');
    }
  }
  l.y += alto + 7;
}

function indicadores(l: Lienzo, informe: InformeDiario) {
  const { doc } = l;
  const p = informe.produccion;
  const motoresActivos = informe.motores.filter((m) => (m.horasOperacion ?? 0) > 0).length;

  const tarjetas: { etiqueta: string; valor: number | null; unidad: string; nota: string; decimales?: number }[] = [
    { etiqueta: 'ENERGÍA GENERADA', valor: p.energiaGenerada, unidad: p.unidadEnergia, nota: p.energiaGenerada === null ? 'Sin cierre de contador' : 'Contador de motores *' },
    { etiqueta: 'BIOGÁS CONSUMIDO', valor: p.m3Biogas, unidad: 'm³', nota: p.m3Biogas === null ? 'Sin cierre de contador' : 'Contador de motores', decimales: 0 },
    { etiqueta: 'HORAS DE MOTOR', valor: p.horasOperacion, unidad: 'h', nota: p.horasOperacion === null ? 'Sin cierre de horómetro' : `${motoresActivos} motor(es) · ${num(p.arranques)} arranques` },
    { etiqueta: 'POTENCIA PROMEDIO', valor: p.potenciaPromedio, unidad: 'kW', nota: `Máxima ${conUnidad(p.potenciaMaxima, 'kW')}`, decimales: 0 }
  ];

  const separacion = 4;
  const ancho = (ANCHO - separacion * 3) / 4;
  const alto = 23;

  tarjetas.forEach((t, i) => {
    const x = MARGEN + i * (ancho + separacion);
    l.relleno(FONDO);
    doc.roundedRect(x, l.y, ancho, alto, 2, 2, 'F');
    l.relleno(HOJA);
    doc.rect(x, l.y + alto - 1, ancho, 1, 'F');

    l.fuente(6.5, 'bold', GRIS);
    doc.text(t.etiqueta, x + 4, l.y + 6, { charSpace: 0.3 });

    if (t.valor === null) {
      l.fuente(17, 'bold', GRIS_CLARO);
      doc.text('—', x + 4, l.y + 15);
    } else {
      const texto = num(t.valor, t.decimales ?? 1);
      l.fuente(17, 'bold', OLIVA);
      doc.text(texto, x + 4, l.y + 15);
      const anchoValor = doc.getTextWidth(texto);
      l.fuente(8.5, 'normal', GRIS);
      doc.text(t.unidad, x + 5.5 + anchoValor, l.y + 15);
    }

    l.fuente(6.8, 'normal', GRIS);
    doc.text(doc.splitTextToSize(t.nota, ancho - 6)[0], x + 4, l.y + 19.5);
  });

  l.y += alto + 3.5;
  l.fuente(6.5, 'italic', GRIS_CLARO);
  doc.text(
    '* Energía calculada con el contador acumulado ("Kw de Inicio/Fin"); su magnitud corresponde a MWh. Pendiente de confirmar con la jefatura de planta.',
    MARGEN,
    l.y
  );
  l.y += 9;
}

function novedades(l: Lienzo, excepciones: Excepcion[]) {
  const { doc } = l;
  l.seccion('Novedades y excepciones', 16, excepciones.length ? `${excepciones.length} en total` : undefined);

  if (excepciones.length === 0) {
    l.relleno(OK.fondo);
    doc.roundedRect(MARGEN, l.y - 2, ANCHO, 10, 2, 2, 'F');
    l.fuente(9, 'normal', OK.color);
    doc.text('Sin novedades: todos los parámetros dentro de rango y registros completos.', MARGEN + 4, l.y + 4.2);
    l.y += 15;
    return;
  }

  for (const e of excepciones) {
    const estilo = SEVERIDAD[e.severidad];
    l.fuente(7.8, 'normal', GRIS);
    const lineas: string[] = doc.splitTextToSize(e.detalle, ANCHO - 34);
    const alto = 6 + lineas.length * 3.4 + 2.5;
    l.asegurar(alto);

    l.relleno(estilo.color);
    doc.rect(MARGEN, l.y - 1.5, 1, alto - 2, 'F');

    l.chip(MARGEN + 3.5, l.y + 2.2, estilo.etiqueta, estilo.color, estilo.fondo);
    l.fuente(9, 'bold', TINTA);
    doc.text(doc.splitTextToSize(e.titulo, ANCHO - 52)[0], MARGEN + 29, l.y + 2.2);
    l.fuente(7.5, 'normal', GRIS);
    doc.text(`${e.categoria}${e.hora ? ' · ' + e.hora : ''}`, ANCHO_PAGINA - MARGEN, l.y + 2.2, { align: 'right' });

    l.fuente(7.8, 'normal', GRIS);
    doc.text(lineas, MARGEN + 29, l.y + 6.4);

    l.y += alto;
    l.trazo(LINEA);
    doc.setLineWidth(0.15);
    doc.line(MARGEN + 3.5, l.y - 2.2, ANCHO_PAGINA - MARGEN, l.y - 2.2);
  }
  l.y += 5;
}

function calidadGas(l: Lienzo, informe: InformeDiario) {
  const { doc } = l;
  l.seccion('Calidad del biogás', 56, `${informe.conteos.registrosJenbacher} lecturas del día`);

  // Leyenda
  l.fuente(6.5, 'normal', GRIS);
  const yLeyenda = l.y - 1;
  l.relleno(HOJA_CLARA);
  doc.rect(MARGEN + 46, yLeyenda - 2, 4, 2.4, 'F');
  doc.text('Rango esperado', MARGEN + 51.5, yLeyenda);
  l.relleno(OLIVA);
  doc.roundedRect(MARGEN + 72, yLeyenda - 1.9, 8, 2.2, 1.1, 1.1, 'F');
  doc.text('Mínimo – máximo del día', MARGEN + 81.5, yLeyenda);
  l.trazo(OLIVA);
  l.relleno(BLANCO);
  doc.setLineWidth(0.5);
  doc.circle(MARGEN + 114, yLeyenda - 0.8, 1.1, 'FD');
  doc.text('Promedio', MARGEN + 116.5, yLeyenda);
  l.y += 5;

  const xBarra = MARGEN + 46;
  const anchoBarra = 78;
  const altoFila = 12.5;

  informe.calidadGas.forEach((v, i) => {
    const umbral = UMBRALES_CALIDAD_GAS[i];
    const yFila = l.y;
    const yBarra = yFila + 3.2;

    // Nombre y rango esperado
    l.fuente(9, 'bold', TINTA);
    doc.text(v.nombre, MARGEN, yFila + 2.5);
    l.fuente(7, 'normal', GRIS);
    doc.text(`Esperado ${v.referencia ?? '—'}`, MARGEN, yFila + 6.5);

    // Dominio del eje: incluye siempre el umbral y los extremos del día.
    let lo = 0;
    let hi: number;
    if (umbral.minimo !== undefined) {
      lo = Math.max(0, Math.floor(Math.min(v.minimo ?? umbral.minimo, umbral.minimo) - 5));
      hi = Math.ceil(Math.max(v.maximo ?? umbral.minimo, umbral.minimo) + 8);
    } else {
      hi = techoRedondo(Math.max((umbral.maximo ?? 1) * 1.6, v.maximo ?? 0));
    }
    const xEn = (valor: number) => xBarra + ((Math.min(Math.max(valor, lo), hi) - lo) / (hi - lo)) * anchoBarra;

    // Pista y zona aceptable
    l.relleno(LINEA);
    doc.roundedRect(xBarra, yBarra - 1.3, anchoBarra, 2.6, 1.3, 1.3, 'F');
    l.relleno(HOJA_CLARA);
    if (umbral.minimo !== undefined) doc.rect(xEn(umbral.minimo), yBarra - 1.3, xBarra + anchoBarra - xEn(umbral.minimo), 2.6, 'F');
    if (umbral.maximo !== undefined) doc.rect(xBarra, yBarra - 1.3, xEn(umbral.maximo) - xBarra, 2.6, 'F');

    // Umbral
    const valorUmbral = umbral.minimo ?? umbral.maximo!;
    l.trazo(GRIS);
    doc.setLineWidth(0.3);
    doc.line(xEn(valorUmbral), yBarra - 2.6, xEn(valorUmbral), yBarra + 2.6);
    l.fuente(6, 'normal', GRIS);
    doc.text(num(valorUmbral), xEn(valorUmbral), yBarra + 5.4, { align: 'center' });
    doc.text(num(lo), xBarra, yBarra + 5.4);
    doc.text(num(hi), xBarra + anchoBarra, yBarra + 5.4, { align: 'right' });

    const fuera = v.fueraDeRango ?? 0;
    const colorEstado = v.muestras === 0 ? GRIS_CLARO : fuera > 0 ? SEVERIDAD[umbral.severidad].color : OK.color;

    // Mínimo–máximo y promedio
    if (v.minimo !== null && v.maximo !== null) {
      const x1 = xEn(v.minimo);
      const x2 = Math.max(xEn(v.maximo), x1 + 1.4);
      l.relleno(colorEstado);
      doc.roundedRect(x1, yBarra - 1.1, x2 - x1, 2.2, 1.1, 1.1, 'F');
    }
    if (v.promedio !== null) {
      l.trazo(colorEstado);
      l.relleno(BLANCO);
      doc.setLineWidth(0.6);
      doc.circle(xEn(v.promedio), yBarra, 1.5, 'FD');
    }

    // Promedio y estado
    const xValor = xBarra + anchoBarra + 6;
    l.fuente(12, 'bold', v.muestras === 0 ? GRIS_CLARO : TINTA);
    const textoProm = num(v.promedio, Math.abs(v.promedio ?? 0) >= 100 ? 0 : 2);
    doc.text(textoProm, xValor, yFila + 4.5);
    const anchoProm = doc.getTextWidth(textoProm);
    l.fuente(7, 'normal', GRIS);
    doc.text(v.unidad, xValor + anchoProm + 1.2, yFila + 4.5);
    doc.text('promedio', xValor, yFila + 8.2);

    const etiquetaEstado = v.muestras === 0 ? 'SIN LECTURAS' : fuera > 0 ? `${fuera} DE ${v.muestras} FUERA` : 'EN RANGO';
    const fondoEstado = v.muestras === 0 ? FONDO : fuera > 0 ? SEVERIDAD[umbral.severidad].fondo : OK.fondo;
    l.chip(ANCHO_PAGINA - MARGEN, yFila + 4, etiquetaEstado, colorEstado, fondoEstado, 'right');

    l.y += altoFila;
    if (i < informe.calidadGas.length - 1) {
      l.trazo(LINEA);
      doc.setLineWidth(0.15);
      doc.line(MARGEN, l.y - 2.6, ANCHO_PAGINA - MARGEN, l.y - 2.6);
    }
  });
  l.y += 5;
}

function grafico(
  l: Lienzo,
  x: number,
  y: number,
  ancho: number,
  alto: number,
  titulo: string,
  puntos: { minuto: number; valor: number }[],
  huecos: { desde: number; hasta: number }[],
  umbral?: { valor: number; etiqueta: string }
) {
  const { doc } = l;
  l.fuente(8.5, 'bold', TINTA);
  doc.text(titulo, x, y);

  const xPlot = x + 9;
  const yPlot = y + 4;
  const anchoPlot = ancho - 9;
  const altoPlot = alto - 12;

  const maxValor = Math.max(...puntos.map((p) => p.valor), umbral ? umbral.valor * 1.15 : 0, 1);
  const hi = techoRedondo(maxValor);
  const xEn = (min: number) => xPlot + (min / 1440) * anchoPlot;
  const yEn = (v: number) => yPlot + altoPlot - (Math.min(v, hi) / hi) * altoPlot;

  l.relleno(FONDO);
  doc.rect(xPlot, yPlot, anchoPlot, altoPlot, 'F');

  for (const h of huecos) {
    l.relleno(SEVERIDAD.advertencia.fondo);
    doc.rect(xEn(h.desde), yPlot, xEn(h.hasta) - xEn(h.desde), altoPlot, 'F');
  }

  // Rejilla y eje Y
  l.trazo(LINEA);
  doc.setLineWidth(0.15);
  l.fuente(5.8, 'normal', GRIS);
  for (const fraccion of [0, 0.5, 1]) {
    const yy = yPlot + altoPlot - fraccion * altoPlot;
    doc.line(xPlot, yy, xPlot + anchoPlot, yy);
    doc.text(num(hi * fraccion), xPlot - 1.2, yy + 1, { align: 'right' });
  }
  for (const hora of [0, 6, 12, 18, 24]) {
    doc.text(`${String(hora).padStart(2, '0')}h`, xEn(hora * 60), yPlot + altoPlot + 3.6, { align: 'center' });
  }

  if (umbral && umbral.valor <= hi) {
    l.trazo(SEVERIDAD.critica.color);
    doc.setLineWidth(0.3);
    doc.setLineDashPattern([1.2, 0.8], 0);
    doc.line(xPlot, yEn(umbral.valor), xPlot + anchoPlot, yEn(umbral.valor));
    doc.setLineDashPattern([], 0);
    l.fuente(5.8, 'bold', SEVERIDAD.critica.color);
    doc.text(umbral.etiqueta, xPlot + anchoPlot - 1, yEn(umbral.valor) - 1, { align: 'right' });
  }

  if (puntos.length === 0) {
    l.fuente(7.5, 'italic', GRIS);
    doc.text('Sin lecturas', xPlot + anchoPlot / 2, yPlot + altoPlot / 2, { align: 'center' });
    return;
  }

  const ordenados = [...puntos].sort((a, b) => a.minuto - b.minuto);
  l.trazo(OLIVA);
  doc.setLineWidth(0.5);
  for (let i = 1; i < ordenados.length; i++) {
    // No se une a través de un hueco: la línea sugeriría datos que no existen.
    if (ordenados[i].minuto - ordenados[i - 1].minuto > MAX_HORAS_SIN_REGISTRO * 60) continue;
    doc.line(xEn(ordenados[i - 1].minuto), yEn(ordenados[i - 1].valor), xEn(ordenados[i].minuto), yEn(ordenados[i].valor));
  }
  l.relleno(HOJA);
  for (const p of ordenados) doc.circle(xEn(p.minuto), yEn(p.valor), 0.55, 'F');
}

function perfilDelDia(l: Lienzo, informe: InformeDiario, huecos: { desde: number; hasta: number }[]) {
  l.seccion('Perfil del día', 52, huecos.length ? 'Sombreado: periodos sin registro' : undefined);
  const serie = (campo: 'potencia' | 'h2s') =>
    informe.serie.filter((s) => s[campo] !== null).map((s) => ({ minuto: s.minuto, valor: s[campo] as number }));

  const ancho = (ANCHO - 8) / 2;
  const alto = 46;
  // Sin línea de límite: los 1.000 kW obligarían a una escala que aplana la curva real (~500 kW).
  grafico(l, MARGEN, l.y, ancho, alto, 'Potencia generada (kW)', serie('potencia'), huecos);
  const umbralH2S = UMBRALES_CALIDAD_GAS.find((u) => u.campo === 'ACIDO SULFIDRICO(H2S)')?.maximo;
  grafico(l, MARGEN + ancho + 8, l.y, ancho, alto, 'Ácido sulfhídrico H2S (ppm)', serie('h2s'), huecos,
    umbralH2S !== undefined ? { valor: umbralH2S, etiqueta: `Máximo ${num(umbralH2S)} ppm` } : undefined);
  l.y += alto + 4;
}

function cobertura(l: Lienzo, informe: InformeDiario, huecos: { desde: number; hasta: number }[]) {
  const { doc } = l;
  l.seccion('Cobertura del día', 30, `${informe.turnos.length} turno(s) · ${informe.serie.length} registros Jenbacher`);

  const xEn = (min: number) => MARGEN + (min / 1440) * ANCHO;
  const yTurnos = l.y;
  const altoTurno = 7;

  l.relleno(FONDO);
  doc.roundedRect(MARGEN, yTurnos, ANCHO, altoTurno, 1.2, 1.2, 'F');

  const tonos: RGB[] = [HOJA, OLIVA, [150, 180, 110], [95, 120, 60]];
  informe.turnos.forEach((t, i) => {
    const x1 = xEn(t.inicioMinuto);
    const x2 = xEn(t.finMinuto);
    if (x2 - x1 <= 0.2) return;
    l.relleno(tonos[i % tonos.length]);
    doc.rect(x1, yTurnos, x2 - x1, altoTurno, 'F');
    l.fuente(6.3, 'bold', BLANCO);
    const nombre = t.operador.split(' ').slice(0, 2).join(' ') || 'Sin nombre';
    if (doc.getTextWidth(nombre) < x2 - x1 - 3) doc.text(nombre, x1 + 1.5, yTurnos + 4.6);
  });

  // Registros y huecos
  const yRegistros = yTurnos + altoTurno + 3;
  for (const h of huecos) {
    l.relleno(SEVERIDAD.advertencia.fondo);
    doc.rect(xEn(h.desde), yRegistros - 0.5, xEn(h.hasta) - xEn(h.desde), 4.5, 'F');
    l.fuente(6, 'bold', SEVERIDAD.advertencia.color);
    const etiqueta = `${num((h.hasta - h.desde) / 60, 1)} h sin registro`;
    if (doc.getTextWidth(etiqueta) < xEn(h.hasta) - xEn(h.desde) - 2) {
      doc.text(etiqueta, (xEn(h.desde) + xEn(h.hasta)) / 2, yRegistros + 2.6, { align: 'center' });
    }
  }
  l.trazo(OLIVA);
  doc.setLineWidth(0.35);
  for (const s of informe.serie) doc.line(xEn(s.minuto), yRegistros, xEn(s.minuto), yRegistros + 3.5);

  // Eje horario
  l.fuente(5.8, 'normal', GRIS);
  for (let hora = 0; hora <= 24; hora += 3) {
    doc.text(hhmm(hora * 60), xEn(hora * 60), yRegistros + 7.5, {
      align: hora === 0 ? 'left' : hora === 24 ? 'right' : 'center'
    });
  }
  l.fuente(6.3, 'normal', GRIS);
  doc.text('Barra superior: turnos abiertos. Marcas inferiores: cada registro Jenbacher.', MARGEN, yRegistros + 11.5);
  l.y = yRegistros + 18;
}

function tarjetaMotor(l: Lienzo, m: ResumenMotor, unidadEnergia: string, x: number, y: number, ancho: number, alto: number) {
  const { doc } = l;
  l.trazo(LINEA);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, ancho, alto, 2, 2, 'S');

  l.fuente(9.5, 'bold', TINTA);
  doc.text(m.nombre, x + 4, y + 6);

  const estado = m.estadoFinal ?? 'Sin cambios';
  const esEncendido = /encend/i.test(estado);
  const esMantenimiento = /mant/i.test(estado);
  l.chip(x + ancho - 4, y + 6, estado.toUpperCase(),
    esEncendido ? OK.color : esMantenimiento ? SEVERIDAD.advertencia.color : GRIS,
    esEncendido ? OK.fondo : esMantenimiento ? SEVERIDAD.advertencia.fondo : FONDO, 'right');

  const datos: [string, string][] = [
    ['Horas', num(m.horasOperacion)],
    ['Arranques', num(m.arranques)],
    [unidadEnergia, num(m.energiaGenerada)],
    ['m³', num(m.m3Consumidos, 0)]
  ];
  const anchoDato = (ancho - 8) / 4;
  datos.forEach(([etiqueta, valor], i) => {
    const xd = x + 4 + i * anchoDato;
    l.fuente(11, 'bold', valor === '—' ? GRIS_CLARO : OLIVA);
    doc.text(valor, xd, y + 14);
    l.fuente(6.5, 'normal', GRIS);
    doc.text(etiqueta, xd, y + 17.5);
  });

  const cambios = m.cambiosEstado.map((c) => `${c.hora} ${c.estado}`).join(' › ');
  l.fuente(6.8, m.registroIncompleto ? 'bold' : 'normal', m.registroIncompleto ? SEVERIDAD.advertencia.color : GRIS);
  const pie = m.registroIncompleto ? 'Producción parcial: monitoreo sin valores de cierre' : cambios ? `Cambios: ${cambios}` : 'Sin cambios de estado en el día';
  doc.text(doc.splitTextToSize(pie, ancho - 8)[0], x + 4, y + alto - 3);
}

function motores(l: Lienzo, informe: InformeDiario) {
  if (informe.motores.length === 0) return;
  const alto = 25;
  l.seccion('Motores', alto + 2);
  const ancho = (ANCHO - 6) / 2;
  informe.motores.forEach((m, i) => {
    if (i % 2 === 0 && i > 0) l.y += alto + 5;
    if (i % 2 === 0) l.asegurar(alto);
    tarjetaMotor(l, m, informe.produccion.unidadEnergia, MARGEN + (i % 2) * (ancho + 6), l.y, ancho, alto);
  });
  l.y += alto + 10;
}

/** Presión y temperatura del biofiltro: cuatro tarjetas compactas en lugar de una tabla. */
function biofiltro(l: Lienzo, informe: InformeDiario) {
  const { doc } = l;
  const alto = 17;
  l.seccion('Biofiltro', alto, 'Promedio del día · mínimo y máximo');
  const separacion = 4;
  const ancho = (ANCHO - separacion * 3) / 4;

  informe.biofiltro.forEach((v, i) => {
    const x = MARGEN + i * (ancho + separacion);
    l.relleno(FONDO);
    doc.roundedRect(x, l.y - 1, ancho, alto, 2, 2, 'F');

    l.fuente(6.5, 'bold', GRIS);
    doc.text(v.nombre.replace(' biofiltro', '').toUpperCase(), x + 3.5, l.y + 3.5, { charSpace: 0.2 });

    const texto = num(v.promedio, 1);
    l.fuente(12, 'bold', v.promedio === null ? GRIS_CLARO : OLIVA);
    doc.text(texto, x + 3.5, l.y + 9.5);
    const anchoValor = doc.getTextWidth(texto);
    l.fuente(7, 'normal', GRIS);
    doc.text(v.unidad, x + 4.8 + anchoValor, l.y + 9.5);
    doc.text(`mín ${num(v.minimo)} · máx ${num(v.maximo)} · ${v.muestras} lecturas`, x + 3.5, l.y + 13.6);
  });
  l.y += alto + 7;
}

// ============================================================= Exportación

export function generarPdfInforme(informe: InformeDiario): Buffer {
  const l = new Lienzo(informe);
  const { doc } = l;

  encabezado(l, informe);
  bannerEstado(l, informe);

  if (!informe.sinDatos) {
    const { inicio, fin } = rangoDiaBogota(informe.fecha);
    const corte = Math.min(Date.now(), fin.getTime());
    const huecos = vacios(informe.serie, (corte - inicio.getTime()) / 60000);

    indicadores(l, informe);
    novedades(l, informe.excepciones);
    calidadGas(l, informe);

    // El detalle empieza en página nueva: la primera queda como resumen ejecutivo.
    doc.addPage();
    l.encabezadoContinuacion();

    perfilDelDia(l, informe, huecos);
    cobertura(l, informe, huecos);
    motores(l, informe);

    if (informe.turnos.length > 0) {
      l.seccion('Turnos', 20);
      l.tabla({
        head: [['Operador', 'Inicio', 'Fin', 'Duración', 'Estado']],
        body: informe.turnos.map((t) => [
          t.operador || '—', t.inicio ?? '—', t.fin ?? '—',
          t.duracionHoras === null ? '—' : `${num(t.duracionHoras)} h`,
          t.cerrado ? 'Cerrado' : 'Abierto'
        ]),
        columnStyles: { 0: { cellWidth: 60 } },
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 4 && d.cell.raw === 'Abierto') {
            d.cell.styles.textColor = SEVERIDAD.advertencia.color;
            d.cell.styles.fontStyle = 'bold';
          }
        }
      });
    }

    biofiltro(l, informe);

    l.seccion('Remoción de H2S', 4, 'Entrada › biofiltro › filtro de biochar');
    if (informe.remocionH2S.length === 0) {
      // Se muestra vacía a propósito: que falte la medición también es información.
      l.fuente(8, 'italic', GRIS);
      doc.text('Sin mediciones de H2S a la entrada y salida del filtro en este día.', MARGEN, l.y + 1);
      l.y += 10;
    } else {
      l.tabla({
        head: [['Hora', 'Entrada', 'Salida biofiltro', 'Salida biochar', '% biofiltro', '% biochar', '% total', 'Operador']],
        body: informe.remocionH2S.map((m) => [
          m.hora, num(m.entradaBiofiltro), num(m.salidaBiofiltro), num(m.salidaBiochar),
          conUnidad(m.remocionBiofiltro, '%'), conUnidad(m.remocionBiochar, '%'), conUnidad(m.remocionTotal, '%'), m.operador || '—'
        ]),
        columnStyles: { 6: { fontStyle: 'bold' } }
      });
    }

    if (informe.medicionesBiodigestores.length > 0) {
      l.seccion('Mediciones de biodigestores', 20);
      l.tabla({
        head: [['Hora', 'Biodigestor', 'CH4 %', 'CO2 %', 'O2 %', 'H2S ppm', 'CO', 'NO', 'Operador']],
        body: informe.medicionesBiodigestores.map((m) => [
          m.hora, m.biodigestor || '—', num(m.ch4), num(m.co2), num(m.o2), num(m.h2s), num(m.co), num(m.no), m.operador || '—'
        ])
      });
    }

    if (informe.bitacora.length > 0) {
      l.seccion('Bitácora de operadores', 20);
      l.tabla({
        head: [['Hora', 'Operador', 'Informe ejecutivo']],
        body: informe.bitacora.map((b) => [b.hora, b.operador || '—', b.informeEjecutivo || b.transcripcion]),
        columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 34 } }
      });
    }
  }

  // ----------------------------------------------------------- Pie de página
  const [fechaGenerado, horaGenerado] = informe.generadoEn.split(' ');
  const generado = `${formatearFechaCorta(fechaGenerado)} ${horaGenerado}`;
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    const yPie = ALTO_PAGINA - 14;
    l.trazo(LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, yPie, ANCHO_PAGINA - MARGEN, yPie);

    l.fuente(6.8, 'normal', GRIS);
    doc.text(
      `Planta de Biogás Guaicaramo · Informe del ${formatearFechaCorta(informe.fecha)} · ` +
      `Generado ${generado} · ${informe.generadoPor}`,
      MARGEN,
      yPie + 4.5
    );
    doc.text(
      `${informe.conteos.registrosJenbacher} registros Jenbacher · ${informe.conteos.monitoreosMotor} monitoreos · ` +
      `${informe.conteos.cambiosEstado} cambios de estado · ${informe.conteos.entradasBitacora} entradas de bitácora`,
      MARGEN,
      yPie + 8
    );

    l.fuente(7, 'bold', OLIVA);
    doc.text(`${p} / ${paginas}`, ANCHO_PAGINA - MARGEN, yPie + 4.5, { align: 'right' });
    if (LOGO_SIRIUS) {
      const altoLogo = 3.2;
      const anchoLogo = altoLogo * (1015 / 450);
      doc.addImage(LOGO_SIRIUS, 'PNG', ANCHO_PAGINA - MARGEN - anchoLogo, yPie + 5.8, anchoLogo, altoLogo, 'sirius', 'FAST');
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}

export function nombreArchivoInforme(fecha: string): string {
  return `informe-biogas-${fecha}.pdf`;
}
