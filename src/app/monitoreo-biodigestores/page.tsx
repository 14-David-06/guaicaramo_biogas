'use client';

import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { airtableService, MedicionBiodigestores, Biodigestor } from '@/utils/airtable';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  UMBRALES_BIODIGESTOR, biodigestoresDistintos, cifra, claseCeldaGas, esDeHoy, fechaDeMedicion, fechaHora,
  horaCorta, medicionMasReciente, numero, tonoGas
} from './resumen';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

// Colores de las series: los tokens del sistema en hex (el canvas no lee clases).
const COLOR = {
  bosque: '#4b5a32',
  hoja: '#7a9c4b',
  ambar: '#d9a33f',
  gris: '#6b7564',
  rejilla: '#d8dcd0',
  ejes: '#525c4b'
};

/** La familia real de Barlow que cargó next/font; el canvas la necesita por nombre. */
function fuenteGraficas(): string {
  return typeof window === 'undefined' ? 'Barlow, system-ui, sans-serif' : getComputedStyle(document.body).fontFamily;
}

function serie(label: string, data: number[], color: string, punteada = false) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    borderDash: punteada ? [6, 4] : undefined,
    pointRadius: 2,
    pointHoverRadius: 5,
    tension: 0.3,
    fill: false,
  };
}

export default function MonitoreoBiodigestoresPage() {
  const { user: loggedInUser } = useAuth();
  const [mediciones, setMediciones] = useState<MedicionBiodigestores[]>([]);
  const [biodigestores, setBiodigestores] = useState<Biodigestor[]>([]);
  const [biodigestorSeleccionado, setBiodigestorSeleccionado] = useState<string>('todos');
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    fechaDesde: '',
    fechaHasta: '',
    operador: '',
    ch4Min: '',
    ch4Max: '',
    co2Min: '',
    co2Max: '',
    o2Min: '',
    o2Max: '',
    h2sMin: '',
    h2sMax: '',
    coMin: '',
    coMax: '',
    noMin: '',
    noMax: '',
  });

  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Filtrar mediciones basado en los filtros aplicados
  const medicionesFiltradas = useMemo(() => {
    return mediciones.filter((medicion) => {
      // Filtro por biodigestor
      if (biodigestorSeleccionado !== 'todos') {
        const biodigestorIds = medicion.fields['Biodigestor Monitoreado'] || [];
        if (!biodigestorIds.includes(biodigestorSeleccionado)) return false;
      }
      // Filtro por fecha
      if (filtros.fechaDesde || filtros.fechaHasta) {
        const fechaMedicion = typeof medicion.fields['Fecha Medicion'] === 'string'
          ? new Date(medicion.fields['Fecha Medicion'])
          : null;

        if (!fechaMedicion) return false;

        const fechaDesde = filtros.fechaDesde ? startOfDay(new Date(filtros.fechaDesde)) : null;
        const fechaHasta = filtros.fechaHasta ? endOfDay(new Date(filtros.fechaHasta)) : null;

        if (fechaDesde && fechaHasta) {
          if (!isWithinInterval(fechaMedicion, { start: fechaDesde, end: fechaHasta })) return false;
        } else if (fechaDesde) {
          if (fechaMedicion < fechaDesde) return false;
        } else if (fechaHasta) {
          if (fechaMedicion > fechaHasta) return false;
        }
      }

      // Filtro por operador
      if (filtros.operador && medicion.fields['Realiza Registro'] !== filtros.operador) {
        return false;
      }

      // Filtros por rangos de valores
      const ch4 = medicion.fields['CH4 (Max) %'] || 0;
      const co2 = medicion.fields['CO2 %'] || 0;
      const o2 = medicion.fields['O2 %'] || 0;
      const h2s = medicion.fields['H2S'] || 0;
      const co = medicion.fields['CO'] || 0;
      const no = medicion.fields['NO'] || 0;

      if (filtros.ch4Min && ch4 < parseFloat(filtros.ch4Min)) return false;
      if (filtros.ch4Max && ch4 > parseFloat(filtros.ch4Max)) return false;
      if (filtros.co2Min && co2 < parseFloat(filtros.co2Min)) return false;
      if (filtros.co2Max && co2 > parseFloat(filtros.co2Max)) return false;
      if (filtros.o2Min && o2 < parseFloat(filtros.o2Min)) return false;
      if (filtros.o2Max && o2 > parseFloat(filtros.o2Max)) return false;
      if (filtros.h2sMin && h2s < parseFloat(filtros.h2sMin)) return false;
      if (filtros.h2sMax && h2s > parseFloat(filtros.h2sMax)) return false;
      if (filtros.coMin && co < parseFloat(filtros.coMin)) return false;
      if (filtros.coMax && co > parseFloat(filtros.coMax)) return false;
      if (filtros.noMin && no < parseFloat(filtros.noMin)) return false;
      if (filtros.noMax && no > parseFloat(filtros.noMax)) return false;

      return true;
    });
  }, [mediciones, filtros, biodigestorSeleccionado]);

  // Cargar datos de mediciones de biodigestores
  useEffect(() => {
    if (loggedInUser) {
      cargarMedicionesBiodigestores();
      cargarBiodigestores();
    }
  }, [loggedInUser]);

  const cargarBiodigestores = async () => {
    try {
      const datos = await airtableService.obtenerBiodigestores();
      setBiodigestores(datos);
    } catch (error) {
      console.error('Error cargando biodigestores:', error);
    }
  };

  const cargarMedicionesBiodigestores = async () => {
    try {
      setCargandoDatos(true);
      setErrorDatos(null);
      const datos = await airtableService.obtenerMedicionesBiodigestores();
      setMediciones(datos);
    } catch (error) {
      console.error('Error cargando mediciones de biodigestores:', error);
      setErrorDatos('Error al cargar los datos de mediciones');
    } finally {
      setCargandoDatos(false);
    }
  };

  // Función para limpiar filtros
  const limpiarFiltros = () => {
    setFiltros({
      fechaDesde: '',
      fechaHasta: '',
      operador: '',
      ch4Min: '',
      ch4Max: '',
      co2Min: '',
      co2Max: '',
      o2Min: '',
      o2Max: '',
      h2sMin: '',
      h2sMax: '',
      coMin: '',
      coMax: '',
      noMin: '',
      noMax: '',
    });
    setBiodigestorSeleccionado('todos');
  };

  // Función para obtener el nombre del biodigestor a partir de su ID
  const obtenerNombreBiodigestor = (medicion: MedicionBiodigestores): string => {
    const biodigestorId = medicion.fields['Biodigestor Monitoreado']?.[0];
    if (!biodigestorId) return 'No especificado';
    const biodigestor = biodigestores.find(b => b.id === biodigestorId);
    return biodigestor?.fields['Nombre Biodigestores'] || 'Biodigestor desconocido';
  };

  // Obtener nombre del biodigestor seleccionado para reportes
  const nombreBiodigestorSeleccionado = useMemo(() => {
    if (biodigestorSeleccionado === 'todos') return 'Todos los biodigestores';
    const bio = biodigestores.find(b => b.id === biodigestorSeleccionado);
    return bio?.fields['Nombre Biodigestores'] || 'Biodigestor';
  }, [biodigestorSeleccionado, biodigestores]);

  // Función para exportar a PDF
  const exportarPDF = () => {
    const doc = new jsPDF();

    // Título
    doc.setFontSize(20);
    doc.text('Reporte de Monitoreo de Biodigestores', 20, 20);

    // Información del filtro aplicado
    doc.setFontSize(12);
    let yPosition = 35;

    if (filtros.fechaDesde || filtros.fechaHasta) {
      const fechaTexto = `Período: ${filtros.fechaDesde || 'Inicio'} - ${filtros.fechaHasta || 'Fin'}`;
      doc.text(fechaTexto, 20, yPosition);
      yPosition += 10;
    }

    if (biodigestorSeleccionado !== 'todos') {
      doc.text(`Biodigestor: ${nombreBiodigestorSeleccionado}`, 20, yPosition);
      yPosition += 10;
    }

    if (filtros.operador) {
      doc.text(`Operador: ${filtros.operador}`, 20, yPosition);
      yPosition += 10;
    }

    doc.text(`Total de registros: ${medicionesFiltradas.length}`, 20, yPosition);
    yPosition += 15;

    // Preparar datos para la tabla
    const tableData = medicionesFiltradas.map(medicion => [
      typeof medicion.fields['Fecha Medicion'] === 'string'
        ? format(new Date(medicion.fields['Fecha Medicion']), 'dd/MM/yyyy HH:mm', { locale: es })
        : 'N/A',
      obtenerNombreBiodigestor(medicion),
      (medicion.fields['CH4 (Max) %'] || 0).toString(),
      (medicion.fields['CO2 %'] || 0).toString(),
      (medicion.fields['O2 %'] || 0).toString(),
      (medicion.fields['H2S'] || 0).toString(),
      (medicion.fields['CO'] || 0).toString(),
      (medicion.fields['NO'] || 0).toString(),
      medicion.fields['Realiza Registro'] || 'N/A'
    ]);

    // Agregar tabla
    autoTable(doc, {
      head: [['Fecha', 'Biodigestor', 'CH₄ (%)', 'CO₂ (%)', 'O₂ (%)', 'H₂S (ppm)', 'CO (ppm)', 'NO (ppm)', 'Operador']],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [75, 90, 50] },
    });

    // Agregar estadísticas
    // @ts-expect-error - lastAutoTable is added by jspdf-autotable
    const finalY = doc.lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Estadísticas del Período', 20, finalY);

    if (medicionesFiltradas.length > 0) {
      const promedioCH4 = medicionesFiltradas.reduce((sum, m) => sum + (m.fields['CH4 (Max) %'] || 0), 0) / medicionesFiltradas.length;
      const promedioH2S = medicionesFiltradas.reduce((sum, m) => sum + (m.fields['H2S'] || 0), 0) / medicionesFiltradas.length;
      const maxCH4 = Math.max(...medicionesFiltradas.map(m => m.fields['CH4 (Max) %'] || 0));
      const minCH4 = Math.min(...medicionesFiltradas.map(m => m.fields['CH4 (Max) %'] || 0));

      doc.setFontSize(10);
      doc.text(`CH₄ Promedio: ${promedioCH4.toFixed(2)}%`, 20, finalY + 15);
      doc.text(`CH₄ Máximo: ${maxCH4.toFixed(2)}%`, 20, finalY + 25);
      doc.text(`CH₄ Mínimo: ${minCH4.toFixed(2)}%`, 20, finalY + 35);
      doc.text(`H₂S Promedio: ${promedioH2S.toFixed(2)} ppm`, 110, finalY + 15);
    }

    // Guardar el PDF
    const fechaActual = format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: es });
    doc.save(`reporte_biodigestores_${fechaActual}.pdf`);
  };

  // Función para exportar a Excel
  const exportarExcel = () => {
    const datosParaExcel = medicionesFiltradas.map(medicion => ({
      'Fecha': typeof medicion.fields['Fecha Medicion'] === 'string'
        ? format(new Date(medicion.fields['Fecha Medicion']), 'dd/MM/yyyy HH:mm', { locale: es })
        : 'N/A',
      'Biodigestor': obtenerNombreBiodigestor(medicion),
      'CH4 (%)': medicion.fields['CH4 (Max) %'] || 0,
      'CO2 (%)': medicion.fields['CO2 %'] || 0,
      'O2 (%)': medicion.fields['O2 %'] || 0,
      'H2S (ppm)': medicion.fields['H2S'] || 0,
      'CO (ppm)': medicion.fields['CO'] || 0,
      'NO (ppm)': medicion.fields['NO'] || 0,
      'Operador': medicion.fields['Realiza Registro'] || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(datosParaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mediciones Biodigestores');

    // Agregar hoja de estadísticas
    if (medicionesFiltradas.length > 0) {
      const estadisticas = [
        { 'Métrica': 'Total de Registros', 'Valor': medicionesFiltradas.length },
        { 'Métrica': 'CH4 Promedio (%)', 'Valor': (medicionesFiltradas.reduce((sum, m) => sum + (m.fields['CH4 (Max) %'] || 0), 0) / medicionesFiltradas.length).toFixed(2) },
        { 'Métrica': 'CH4 Máximo (%)', 'Valor': Math.max(...medicionesFiltradas.map(m => m.fields['CH4 (Max) %'] || 0)).toFixed(2) },
        { 'Métrica': 'CH4 Mínimo (%)', 'Valor': Math.min(...medicionesFiltradas.map(m => m.fields['CH4 (Max) %'] || 0)).toFixed(2) },
        { 'Métrica': 'H2S Promedio (ppm)', 'Valor': (medicionesFiltradas.reduce((sum, m) => sum + (m.fields['H2S'] || 0), 0) / medicionesFiltradas.length).toFixed(2) },
      ];

      const wsStats = XLSX.utils.json_to_sheet(estadisticas);
      XLSX.utils.book_append_sheet(wb, wsStats, 'Estadísticas');
    }

    const fechaActual = format(new Date(), 'yyyy-MM-dd_HH-mm', { locale: es });
    XLSX.writeFile(wb, `reporte_biodigestores_${fechaActual}.xlsx`);
  };


  // Funciones para preparar datos de gráficos
  const prepararDatosComposicionGas = () => {
    if (medicionesFiltradas.length === 0) return null;

    const ultimaMedicion = medicionesFiltradas[medicionesFiltradas.length - 1];
    const ch4 = ultimaMedicion.fields['CH4 (Max) %'] || 0;
    const co2 = ultimaMedicion.fields['CO2 %'] || 0;
    const o2 = ultimaMedicion.fields['O2 %'] || 0;

    return {
      labels: ['CH4 (metano)', 'CO2', 'O2 (oxígeno)'],
      datasets: [{
        data: [ch4, co2, o2],
        backgroundColor: [COLOR.bosque, COLOR.gris, COLOR.hoja],
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    };
  };

  const prepararDatosTendenciaContaminantes = () => {
    if (medicionesFiltradas.length === 0) return null;

    const registros = medicionesFiltradas.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Medicion'] === 'string' ? new Date(a.fields['Fecha Medicion']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Medicion'] === 'string' ? new Date(b.fields['Fecha Medicion']).getTime() : 0;
      return fechaA - fechaB;
    });

    const labels = registros.map((registro) => {
      const fecha = typeof registro.fields['Fecha Medicion'] === 'string' ? new Date(registro.fields['Fecha Medicion']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [
        serie('H2S (ppm)', registros.map(r => r.fields['H2S'] || 0), COLOR.ambar),
        serie('CO (ppm)', registros.map(r => r.fields['CO'] || 0), COLOR.gris),
        serie('NO (ppm)', registros.map(r => r.fields['NO'] || 0), COLOR.bosque, true),
      ],
    };
  };

  const prepararDatosComposicionGases = () => {
    if (medicionesFiltradas.length === 0) return null;

    const registros = medicionesFiltradas.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Medicion'] === 'string' ? new Date(a.fields['Fecha Medicion']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Medicion'] === 'string' ? new Date(b.fields['Fecha Medicion']).getTime() : 0;
      return fechaA - fechaB;
    });

    const labels = registros.map((registro) => {
      const fecha = typeof registro.fields['Fecha Medicion'] === 'string' ? new Date(registro.fields['Fecha Medicion']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [
        serie('CH4 (%)', registros.map(r => r.fields['CH4 (Max) %'] || 0), COLOR.bosque),
        serie('CO2 (%)', registros.map(r => r.fields['CO2 %'] || 0), COLOR.gris),
        serie('O2 (%)', registros.map(r => r.fields['O2 %'] || 0), COLOR.hoja, true),
      ],
    };
  };

  const fuente = fuenteGraficas();
  const leyenda = {
    labels: {
      color: COLOR.ejes,
      font: { family: fuente, size: 13 },
      usePointStyle: true,
      pointStyle: 'line' as const,
    },
  };
  const ejes = (tituloY: string) => ({
    x: {
      ticks: { color: COLOR.ejes, font: { family: fuente }, maxRotation: 0, autoSkipPadding: 12 },
      grid: { color: COLOR.rejilla },
    },
    y: {
      ticks: { color: COLOR.ejes, font: { family: fuente } },
      grid: { color: COLOR.rejilla },
      title: { display: true, text: tituloY, color: COLOR.ejes, font: { family: fuente } },
    },
  });

  const opcionesGraficoComposicion = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { ...leyenda.labels, pointStyle: 'rect' as const },
      },
      title: { display: false },
    },
  };

  const opcionesGraficoContaminantes = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: { display: false },
      legend: leyenda,
    },
    scales: ejes('Concentración (ppm)'),
  };

  const opcionesGraficoGases = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: { display: false },
      legend: leyenda,
    },
    scales: ejes('Porcentaje (%)'),
  };

  // Resumen de arriba: sale de las mediciones que ya pasaron los filtros.
  const resumen: Indicador[] = (() => {
    const ultima = medicionMasReciente(medicionesFiltradas);
    const deHoy = medicionesFiltradas.filter(esDeHoy);
    const total = medicionesFiltradas.length;
    const promedio = (campo: string) =>
      total ? medicionesFiltradas.reduce((s, m) => s + (numero(m.fields[campo]) ?? 0), 0) / total : null;
    const ch4 = ultima ? numero(ultima.fields['CH4 (Max) %']) : null;
    const h2s = ultima ? numero(ultima.fields['H2S']) : null;
    return [
      {
        etiqueta: 'Última medición',
        valor: horaCorta(ultima ? fechaDeMedicion(ultima) : null),
        detalle: ultima
          ? `${obtenerNombreBiodigestor(ultima)}, ${ultima.fields['Realiza Registro'] || 'sin operador'}`
          : 'No hay mediciones en la vista'
      },
      {
        etiqueta: 'CH4 en la última',
        valor: cifra(ch4, 1),
        unidad: ch4 === null ? undefined : '%',
        detalle: total ? `Promedio ${cifra(promedio('CH4 (Max) %'), 1)} %, rango ${UMBRALES_BIODIGESTOR.ch4.referencia}` : undefined,
        tono: tonoGas(ch4, 'ch4')
      },
      {
        etiqueta: 'H2S en la última',
        valor: cifra(h2s, 0),
        unidad: h2s === null ? undefined : 'ppm',
        detalle: total ? `Promedio ${cifra(promedio('H2S'), 0)} ppm, rango ${UMBRALES_BIODIGESTOR.h2s.referencia}` : undefined,
        tono: tonoGas(h2s, 'h2s')
      },
      {
        etiqueta: 'Mediciones de hoy',
        valor: deHoy.length,
        detalle: biodigestorSeleccionado === 'todos'
          ? `${biodigestoresDistintos(deHoy)} de ${biodigestores.length} biodigestores medidos`
          : `${total} en la vista`
      }
    ];
  })();

  const hayFiltros =
    biodigestorSeleccionado !== 'todos' || Object.values(filtros).some((v) => v !== '');

  const chip = (activo: boolean) =>
    `min-h-11 px-4 py-2 rounded-lg border-2 font-semibold transition-colors ${
      activo ? 'bg-bosque border-bosque text-white' : 'bg-superficie border-linea-fuerte text-tinta hover:border-bosque'
    }`;

  if (!loggedInUser) {
    return (
      <Pagina>
        <Panel className="max-w-md mx-auto text-center">
          <h1 className="font-condensada font-bold text-2xl text-tinta">Inicie sesión para continuar</h1>
          <p className="mt-2 text-tinta-suave">El monitoreo de biodigestores solo está disponible con una sesión abierta.</p>
          <Link href="/" className={`${claseBoton('primario', 'lg')} w-full mt-5`}>
            Ir a iniciar sesión
          </Link>
        </Panel>
      </Pagina>
    );
  }

  return (
    <Pagina ancho="amplio">
      <EncabezadoPagina
        titulo="Monitoreo de biodigestores"
        descripcion="Composición del gas medida en cada biodigestor: última lectura, tendencia y exportación."
        acciones={
          <>
            <button
              type="button"
              onClick={cargarMedicionesBiodigestores}
              disabled={cargandoDatos}
              className={claseBoton('secundario')}
            >
              {cargandoDatos ? 'Actualizando…' : 'Actualizar'}
            </button>
            <button
              type="button"
              onClick={exportarExcel}
              disabled={medicionesFiltradas.length === 0}
              className={claseBoton('secundario')}
            >
              Descargar Excel
            </button>
            <button
              type="button"
              onClick={exportarPDF}
              disabled={medicionesFiltradas.length === 0}
              className={claseBoton('secundario')}
            >
              Descargar PDF
            </button>
          </>
        }
      >
        <span>
          Mostrando <span className="font-semibold text-tinta">{nombreBiodigestorSeleccionado.toLowerCase()}</span>
        </span>
        {mediciones.length > 0 && (
          <span className="tabular-nums">
            {medicionesFiltradas.length !== mediciones.length
              ? `${medicionesFiltradas.length} de ${mediciones.length} mediciones`
              : `${mediciones.length} mediciones`}
          </span>
        )}
      </EncabezadoPagina>

      {mediciones.length > 0 && <Indicadores items={resumen} />}

      {errorDatos && (
        <Aviso tono="error" titulo="No se pudieron cargar las mediciones">
          Revise la conexión y toque Actualizar.
        </Aviso>
      )}

      {/* Biodigestor y filtros */}
      <Panel>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Biodigestor">
          <button
            type="button"
            aria-pressed={biodigestorSeleccionado === 'todos'}
            onClick={() => setBiodigestorSeleccionado('todos')}
            className={chip(biodigestorSeleccionado === 'todos')}
          >
            Todos
          </button>
          {biodigestores.map((bio) => (
            <button
              key={bio.id}
              type="button"
              aria-pressed={biodigestorSeleccionado === bio.id}
              onClick={() => setBiodigestorSeleccionado(bio.id)}
              className={chip(biodigestorSeleccionado === bio.id)}
            >
              {bio.fields['Nombre Biodigestores']}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-expanded={mostrarFiltros}
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className={claseBoton('secundario')}
          >
            {mostrarFiltros ? 'Ocultar filtros' : 'Filtrar por fecha, operador o valores'}
          </button>
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className={claseBoton('sutil')}>
              Quitar filtros
            </button>
          )}
        </div>

        {mostrarFiltros && (
          <div className="mt-4 pt-4 border-t border-linea grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="filtro-desde" className={claseEtiqueta}>Desde</label>
              <input
                id="filtro-desde"
                type="date"
                value={filtros.fechaDesde}
                onChange={(e) => setFiltros({...filtros, fechaDesde: e.target.value})}
                className={claseCampo}
              />
            </div>

            <div>
              <label htmlFor="filtro-hasta" className={claseEtiqueta}>Hasta</label>
              <input
                id="filtro-hasta"
                type="date"
                value={filtros.fechaHasta}
                onChange={(e) => setFiltros({...filtros, fechaHasta: e.target.value})}
                className={claseCampo}
              />
            </div>

            <div>
              <label htmlFor="filtro-operador" className={claseEtiqueta}>Operador</label>
              <select
                id="filtro-operador"
                value={filtros.operador}
                onChange={(e) => setFiltros({...filtros, operador: e.target.value})}
                className={claseCampo}
              >
                <option value="">Todos los operadores</option>
                {Array.from(new Set(mediciones.map(m => m.fields['Realiza Registro']).filter(Boolean))).map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filtro-biodigestor" className={claseEtiqueta}>Biodigestor</label>
              <select
                id="filtro-biodigestor"
                value={biodigestorSeleccionado}
                onChange={(e) => setBiodigestorSeleccionado(e.target.value)}
                className={claseCampo}
              >
                <option value="todos">Todos los biodigestores</option>
                {biodigestores.map(bio => (
                  <option key={bio.id} value={bio.id}>{bio.fields['Nombre Biodigestores']}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filtro-ch4-min" className={claseEtiqueta}>CH4 mínimo (%)</label>
              <input
                id="filtro-ch4-min"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={filtros.ch4Min}
                onChange={(e) => setFiltros({...filtros, ch4Min: e.target.value})}
                className={claseCampo}
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="filtro-ch4-max" className={claseEtiqueta}>CH4 máximo (%)</label>
              <input
                id="filtro-ch4-max"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={filtros.ch4Max}
                onChange={(e) => setFiltros({...filtros, ch4Max: e.target.value})}
                className={claseCampo}
                placeholder="100"
              />
            </div>

            <div>
              <label htmlFor="filtro-h2s-min" className={claseEtiqueta}>H2S mínimo (ppm)</label>
              <input
                id="filtro-h2s-min"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={filtros.h2sMin}
                onChange={(e) => setFiltros({...filtros, h2sMin: e.target.value})}
                className={claseCampo}
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="filtro-h2s-max" className={claseEtiqueta}>H2S máximo (ppm)</label>
              <input
                id="filtro-h2s-max"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={filtros.h2sMax}
                onChange={(e) => setFiltros({...filtros, h2sMax: e.target.value})}
                className={claseCampo}
                placeholder="Sin límite"
              />
            </div>
          </div>
        )}
      </Panel>

      {cargandoDatos && mediciones.length === 0 && (
        <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
          <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
          Cargando las mediciones…
        </div>
      )}

      {/* Gráficos de análisis. Van antes de la tabla: ordenan la lista por fecha. */}
      {medicionesFiltradas.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Panel
              className="lg:col-span-2"
              titulo="Composición actual del gas"
              descripcion={nombreBiodigestorSeleccionado}
            >
              <div className="h-72">
                {prepararDatosComposicionGas() && (
                  <Doughnut
                    data={prepararDatosComposicionGas()!}
                    options={opcionesGraficoComposicion}
                  />
                )}
              </div>
            </Panel>

            <Panel
              className="lg:col-span-3"
              titulo="H2S, CO y NO en el tiempo"
              descripcion={nombreBiodigestorSeleccionado}
            >
              <div className="h-72">
                {prepararDatosTendenciaContaminantes() && (
                  <Line
                    data={prepararDatosTendenciaContaminantes()!}
                    options={opcionesGraficoContaminantes}
                  />
                )}
              </div>
            </Panel>
          </div>

          <Panel titulo="CH4, CO2 y O2 en el tiempo" descripcion={nombreBiodigestorSeleccionado}>
            <div className="h-80 sm:h-96">
              {prepararDatosComposicionGases() && (
                <Line
                  data={prepararDatosComposicionGases()!}
                  options={opcionesGraficoGases}
                />
              )}
            </div>
          </Panel>
        </>
      )}

      {/* Tabla de mediciones recientes */}
      {medicionesFiltradas.length > 0 && (
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-3">
            <h2 className="font-condensada font-bold text-xl sm:text-2xl text-tinta">
              Últimas mediciones{medicionesFiltradas.length !== mediciones.length ? ' del filtro' : ''}
            </h2>
            <p className="text-sm text-tinta-suave">
              Ámbar o rojo: fuera del rango de entrada al biofiltro.
            </p>
          </div>
          <div className="bg-superficie border border-linea rounded-xl overflow-x-auto">
            <table className="w-full text-left tabular-nums">
              <thead className="bg-superficie-2">
                <tr className="font-condensada font-semibold text-tinta-suave whitespace-nowrap">
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Biodigestor</th>
                  <th scope="col" className="px-4 py-3 text-right">CH4 (%)</th>
                  <th scope="col" className="px-4 py-3 text-right">CO2 (%)</th>
                  <th scope="col" className="px-4 py-3 text-right">O2 (%)</th>
                  <th scope="col" className="px-4 py-3 text-right">H2S (ppm)</th>
                  <th scope="col" className="px-4 py-3 text-right">CO (ppm)</th>
                  <th scope="col" className="px-4 py-3 text-right">NO (ppm)</th>
                  <th scope="col" className="px-4 py-3">Operador</th>
                </tr>
              </thead>
              <tbody>
                {medicionesFiltradas.slice(-10).reverse().map((medicion, index) => (
                  <tr key={medicion.id || index} className="border-t border-linea">
                    <td className="px-4 py-3 whitespace-nowrap text-tinta">
                      {fechaHora(fechaDeMedicion(medicion))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-tinta">
                      {obtenerNombreBiodigestor(medicion)}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(medicion.fields['CH4 (Max) %'] || 0, 'ch4')}`}>
                      {medicion.fields['CH4 (Max) %'] || 0}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(medicion.fields['CO2 %'] || 0, 'co2')}`}>
                      {medicion.fields['CO2 %'] || 0}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(medicion.fields['O2 %'] || 0, 'o2')}`}>
                      {medicion.fields['O2 %'] || 0}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(medicion.fields['H2S'] || 0, 'h2s')}`}>
                      {medicion.fields['H2S'] || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-tinta">
                      {medicion.fields['CO'] || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-tinta">
                      {medicion.fields['NO'] || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-tinta-suave">
                      {medicion.fields['Realiza Registro'] || 'Sin operador'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Estado vacío */}
      {!cargandoDatos && medicionesFiltradas.length === 0 && !errorDatos && (
        <Panel className="text-center py-10">
          <h2 className="font-condensada font-bold text-xl text-tinta">
            {mediciones.length > 0 ? 'Ninguna medición coincide con los filtros' : 'Todavía no hay mediciones registradas'}
          </h2>
          <p className="mt-1 text-tinta-suave">
            {mediciones.length > 0
              ? 'Amplíe el rango de fechas o quite los filtros para ver más mediciones.'
              : 'Las mediciones se registran en Registro de biodigestores.'}
          </p>
          {mediciones.length > 0 ? (
            <button type="button" onClick={limpiarFiltros} className={`${claseBoton('secundario')} mt-4`}>
              Quitar filtros
            </button>
          ) : (
            <Link href="/registro-biodigestores" className={`${claseBoton('secundario')} mt-4`}>
              Ir a registro de biodigestores
            </Link>
          )}
        </Panel>
      )}
    </Pagina>
  );
}
