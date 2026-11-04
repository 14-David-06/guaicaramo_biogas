import 'server-only';

// PDF del informe de Servicios Industriales — Biogás, en hoja horizontal.
//
// Acumulado: la tabla de acumulados (indicadores en filas, meses en columnas).
// Diario: una tabla por grupo de indicadores con un día por fila y el total.
// Misma paleta y logos que el informe diario. Solo Helvetica estándar (WinAnsi):
// por eso "H2S" y "m3" en vez de subíndices y superíndices.

import { readFileSync } from 'fs';
import path from 'path';
import jsPDF from 'jspdf';
import autoTable, { type CellDef, type RowInput } from 'jspdf-autotable';
import { formatearFechaCorta } from '../informe/fechas';
import {
  GRUPOS, INDICADORES, TOTAL, etiquetaTotal, formatear, valoresDeFila,
  type DefinicionIndicador, type InformeServiciosIndustriales
} from './indicadores';

type RGB = [number, number, number];

const OLIVA: RGB = [62, 77, 40];
const HOJA: RGB = [122, 157, 75];
const HOJA_CLARA: RGB = [232, 239, 220];
const NARANJA: RGB = [232, 73, 42];
const TINTA: RGB = [31, 41, 55];
const GRIS: RGB = [107, 114, 128];
const LINEA: RGB = [226, 230, 222];
const FONDO: RGB = [246, 248, 243];

const ANCHO_PAGINA = 297;
const ALTO_PAGINA = 210;
const MARGEN = 12;

function cargarImagen(archivo: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(path.join(process.cwd(), 'public', archivo)));
  } catch {
    return null;
  }
}

const LOGO_GUAICARAMO = cargarImagen('logo-guaicaramo.png'); // 1616 × 643
const LOGO_SIRIUS = cargarImagen('Logo-Sirius.png'); // 1015 × 450

/** Helvetica no trae "³": se escribe m3. */
function pdfTexto(s: string): string {
  return s.replace(/³/g, '3');
}

function rotulo(d: DefinicionIndicador): string {
  return pdfTexto(d.unidad ? `${d.nombre} (${d.unidad})` : d.nombre);
}

function encabezado(doc: jsPDF, informe: InformeServiciosIndustriales): number {
  if (LOGO_GUAICARAMO) {
    doc.addImage(LOGO_GUAICARAMO, 'PNG', MARGEN, 8, 30, 30 * (643 / 1616), 'guaicaramo', 'FAST');
  }
  const derecha = ANCHO_PAGINA - MARGEN;
  doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...GRIS);
  doc.text('SERVICIOS INDUSTRIALES · BIOGÁS', derecha, 11, { align: 'right' });
  doc.setFontSize(14).setTextColor(...OLIVA);
  doc.text(informe.titulo, derecha, 17.5, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...TINTA);
  doc.text(informe.subtitulo, derecha, 22.5, { align: 'right' });
  doc.setDrawColor(...NARANJA).setLineWidth(0.8);
  doc.line(MARGEN, 26, derecha, 26);
  return 31;
}

const ESTILO_TABLA = {
  theme: 'plain' as const,
  styles: { font: 'helvetica', fontSize: 6.6, cellPadding: { top: 1.1, bottom: 1.1, left: 1.2, right: 1.2 }, textColor: TINTA, halign: 'right' as const },
  headStyles: { fillColor: FONDO, textColor: OLIVA, fontStyle: 'bold' as const, halign: 'center' as const, lineWidth: { bottom: 0.4 }, lineColor: HOJA },
  bodyStyles: { lineWidth: { bottom: 0.12 }, lineColor: LINEA }
};

function tablaAcumulado(doc: jsPDF, informe: InformeServiciosIndustriales, y: number) {
  const columnas = [...informe.motores, TOTAL];
  const nombreColumna = (c: string) => (c === TOTAL ? etiquetaTotal(informe.motores) : c);
  const periodos = [...informe.filas, informe.total];
  const valores = periodos.map((p) => valoresDeFila(p.acumuladores, informe.motores));
  const produccion = INDICADORES.filter((d) => d.grupo === 'Operación' || d.grupo === 'Eficiencia');
  const lecturas = INDICADORES.filter((d) => d.grupo !== 'Operación' && d.grupo !== 'Eficiencia');

  const cuerpo: RowInput[] = [];
  const seccion = (titulo: string): CellDef[] => [
    { content: titulo, colSpan: periodos.length + 1, styles: { halign: 'left', fontStyle: 'bold', fillColor: HOJA_CLARA, textColor: OLIVA } }
  ];
  const bloque = (titulo: string, indicadores: DefinicionIndicador[]) => {
    for (const c of columnas) {
      cuerpo.push(seccion(`${titulo} — ${c === TOTAL ? `combinado ${nombreColumna(c)}` : `Jenbacher ${c.replace('J', '')}`}`));
      for (const d of indicadores) {
        cuerpo.push([rotulo(d), ...valores.map((v) => formatear(v[c][d.clave], d.decimales))]);
      }
    }
  };
  bloque('Operación y eficiencia', produccion);
  cuerpo.push(seccion('Extractora'));
  cuerpo.push(['Fruto procesado (t RFF) — sin fuente en la base', ...periodos.map(() => '—')]);
  bloque('Calidad del gas, potencia y biofiltro', lecturas);

  autoTable(doc, {
    ...ESTILO_TABLA,
    startY: y,
    margin: { left: MARGEN, right: MARGEN, top: 31, bottom: 16 },
    head: [['Indicador', ...periodos.map((p) => (p.clave === 'total' ? p.etiqueta : p.etiqueta.slice(0, 3)))]],
    body: cuerpo,
    columnStyles: { 0: { halign: 'left', cellWidth: 64 }, [periodos.length]: { fontStyle: 'bold' } },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) encabezado(doc, informe);
    }
  });
}

function tablasDiario(doc: jsPDF, informe: InformeServiciosIndustriales, yInicial: number) {
  const columnas = [...informe.motores, TOTAL];
  const nombreColumna = (c: string) => (c === TOTAL ? etiquetaTotal(informe.motores) : c);
  const filas = [...informe.filas, informe.total];
  const valores = filas.map((f) => valoresDeFila(f.acumuladores, informe.motores));
  let y = yInicial;

  for (const grupo of GRUPOS) {
    const indicadores = INDICADORES.filter((d) => d.grupo === grupo);
    if (y > ALTO_PAGINA - 60) {
      doc.addPage();
      y = encabezado(doc, informe);
    }
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...OLIVA);
    doc.text(grupo, MARGEN, y + 3);

    autoTable(doc, {
      ...ESTILO_TABLA,
      startY: y + 5,
      margin: { left: MARGEN, right: MARGEN, top: 31, bottom: 16 },
      head: [
        [
          { content: 'Fecha', rowSpan: 2 },
          { content: 'Sem.', rowSpan: 2 },
          ...indicadores.map((d) => ({ content: rotulo(d), colSpan: columnas.length }))
        ],
        indicadores.flatMap(() => columnas.map(nombreColumna))
      ],
      body: filas.map((f, i) => [
        f.etiqueta,
        f.semana ?? '',
        ...indicadores.flatMap((d) => columnas.map((c) => formatear(valores[i][c][d.clave], d.decimales)))
      ]),
      columnStyles: { 0: { halign: 'left', cellWidth: 20 }, 1: { halign: 'center', cellWidth: 9 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === filas.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = FONDO;
        }
      },
      willDrawPage: (data) => {
        if (data.pageNumber > 1) encabezado(doc, informe);
      }
    });
    const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    y = (t ? t.finalY : y) + 8;
  }
}

export function generarPdfServiciosIndustriales(informe: InformeServiciosIndustriales): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const y = encabezado(doc, informe);

  if (informe.tipo === 'acumulado') tablaAcumulado(doc, informe, y);
  else tablasDiario(doc, informe, y);

  // En el PDF solo va lo que falta en los totales; las correcciones, que sí se
  // sumaron, quedan contadas aquí y detalladas en el Excel.
  const faltantes = informe.observaciones.filter((o) => o.detalle.includes('No se suma') || o.detalle.includes('sin valores de cierre'));
  const corregidas = informe.observaciones.length - faltantes.length;
  if (informe.observaciones.length > 0) {
    doc.addPage();
    const yObs = encabezado(doc, informe);
    doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...OLIVA);
    doc.text('Lecturas de contador que no entran en los totales', MARGEN, yObs + 3);
    doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GRIS);
    doc.text(
      `${faltantes.length} registros sin sumar o incompletos. Además, ${corregidas} registros se corrigieron por continuidad ` +
      'o se repartieron entre varios días y sí se sumaron; el detalle está en la hoja "Observaciones" del Excel.',
      MARGEN,
      yObs + 8
    );
    autoTable(doc, {
      ...ESTILO_TABLA,
      startY: yObs + 11,
      margin: { left: MARGEN, right: MARGEN, top: 31, bottom: 16 },
      head: [['Fecha', 'Motor', 'Detalle']],
      body: faltantes.map((o) => [formatearFechaCorta(o.fecha), o.motor, pdfTexto(o.detalle)]),
      columnStyles: { 0: { cellWidth: 20, halign: 'left' }, 1: { cellWidth: 14, halign: 'center' }, 2: { halign: 'left' } },
      willDrawPage: (data) => {
        if (data.pageNumber > 1) encabezado(doc, informe);
      }
    });
  }

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    const yPie = ALTO_PAGINA - 11;
    doc.setDrawColor(...LINEA).setLineWidth(0.3);
    doc.line(MARGEN, yPie, ANCHO_PAGINA - MARGEN, yPie);
    doc.setFont('helvetica', 'normal').setFontSize(6.6).setTextColor(...GRIS);
    doc.text(
      `Planta de Biogás Guaicaramo · Generado ${informe.generadoEn} · kWh = delta del contador (MWh) × 1.000 · ` +
      `Gas: promedio de lecturas horarias · ${informe.conteos.monitoreos} monitoreos, ${informe.conteos.datosOperacion} datos de operación, ` +
      `${informe.conteos.lecturasJenbacher} lecturas`,
      MARGEN,
      yPie + 4.2
    );
    doc.setFont('helvetica', 'bold').setTextColor(...OLIVA);
    doc.text(`${p} / ${paginas}`, ANCHO_PAGINA - MARGEN, yPie + 4.2, { align: 'right' });
    if (LOGO_SIRIUS) {
      const alto = 3;
      doc.addImage(LOGO_SIRIUS, 'PNG', ANCHO_PAGINA - MARGEN - 16 - alto * (1015 / 450), yPie + 1.6, alto * (1015 / 450), alto, 'sirius', 'FAST');
    }
  }

  return Buffer.from(doc.output('arraybuffer'));
}
