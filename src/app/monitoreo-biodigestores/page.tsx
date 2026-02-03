'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { airtableService, MedicionBiodigestores } from '@/utils/airtable';
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

export default function MonitoreoBiodigestoresPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [mediciones, setMediciones] = useState<MedicionBiodigestores[]>([]);
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
  }, [mediciones, filtros]);

  // Cargar datos de mediciones de biodigestores
  useEffect(() => {
    if (loggedInUser) {
      cargarMedicionesBiodigestores();
    }
  }, [loggedInUser]);

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
  };

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
      head: [['Fecha', 'CH₄ (%)', 'CO₂ (%)', 'O₂ (%)', 'H₂S (ppm)', 'CO (ppm)', 'NO (ppm)', 'Operador']],
      body: tableData,
      startY: yPosition,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
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
      labels: ['CH₄ (Metano)', 'CO₂', 'O₂ (Oxígeno)'],
      datasets: [{
        data: [ch4, co2, o2],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',  // Verde para CH4
          'rgba(239, 68, 68, 0.8)',  // Rojo para CO2
          'rgba(59, 130, 246, 0.8)' // Azul para O2
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(59, 130, 246, 1)',
        ],
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
        {
          label: 'H₂S (ppm)',
          data: registros.map(r => r.fields['H2S'] || 0),
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'CO (ppm)',
          data: registros.map(r => r.fields['CO'] || 0),
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
        {
          label: 'NO (ppm)',
          data: registros.map(r => r.fields['NO'] || 0),
          borderColor: 'rgba(168, 85, 247, 1)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y',
        },
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
        {
          label: 'CH₄ (%)',
          data: registros.map(r => r.fields['CH4 (Max) %'] || 0),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'CO₂ (%)',
          data: registros.map(r => r.fields['CO2 %'] || 0),
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'O₂ (%)',
          data: registros.map(r => r.fields['O2 %'] || 0),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  };

  const opcionesGraficoComposicion = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'white',
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: 'Composición Actual del Gas',
        color: 'white',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
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
      title: {
        display: true,
        text: 'Tendencia de Contaminantes',
        color: 'white',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      legend: {
        labels: {
          color: 'white',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: 'Concentración (ppm)',
          color: 'white',
        },
      },
    },
  };

  const opcionesGraficoGases = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      title: {
        display: true,
        text: 'Composición de Gases a lo Largo del Tiempo',
        color: 'white',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      legend: {
        labels: {
          color: 'white',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      y: {
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: 'Porcentaje (%)',
          color: 'white',
        },
      },
    },
  };

  if (!loggedInUser) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 max-w-md w-full">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">Acceso Requerido</h1>
            <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder al monitoreo de biodigestores.</p>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Iniciar Sesión</span>
            </button>
          </div>
        </div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <div className="min-h-screen flex flex-col">
        <Navbar
          onLoginClick={() => {}}
          loggedInUser={loggedInUser}
          onLogout={logout}
        />

          <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
            <div className="max-w-7xl mx-auto py-12">
              <div className="text-center mb-12">
                <h1 className="text-4xl font-bold text-white mb-4">Monitoreo de Biodigestores</h1>
                <p className="text-gray-300 text-lg">Monitoreo y control en tiempo real de biodigestores</p>

                {/* Panel de Filtros y Exportación */}
                <div className="mt-8 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-600/30 p-6">
                  <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    {/* Botones de acción */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setMostrarFiltros(!mostrarFiltros)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        🔍 {mostrarFiltros ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                      </button>

                      <button
                        onClick={limpiarFiltros}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        🧹 Limpiar Filtros
                      </button>

                      <button
                        onClick={exportarPDF}
                        disabled={medicionesFiltradas.length === 0}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        📄 Exportar PDF
                      </button>

                      <button
                        onClick={exportarExcel}
                        disabled={medicionesFiltradas.length === 0}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                      >
                        📊 Exportar Excel
                      </button>
                    </div>

                    {/* Información del filtro aplicado */}
                    <div className="text-sm text-gray-300">
                      {medicionesFiltradas.length !== mediciones.length && (
                        <span>Mostrando {medicionesFiltradas.length} de {mediciones.length} registros</span>
                      )}
                      {medicionesFiltradas.length === mediciones.length && mediciones.length > 0 && (
                        <span>Total: {mediciones.length} registros</span>
                      )}
                    </div>
                  </div>

                  {/* Panel de Filtros Expandible */}
                  {mostrarFiltros && (
                    <div className="mt-6 pt-6 border-t border-slate-600/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {/* Filtros de Fecha */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Desde</label>
                          <input
                            type="date"
                            value={filtros.fechaDesde}
                            onChange={(e) => setFiltros({...filtros, fechaDesde: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fecha Hasta</label>
                          <input
                            type="date"
                            value={filtros.fechaHasta}
                            onChange={(e) => setFiltros({...filtros, fechaHasta: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        {/* Filtro de Operador */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Operador</label>
                          <select
                            value={filtros.operador}
                            onChange={(e) => setFiltros({...filtros, operador: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Todos los operadores</option>
                            {Array.from(new Set(mediciones.map(m => m.fields['Realiza Registro']).filter(Boolean))).map(op => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                        </div>

                        {/* Espacio vacío para alineación */}
                        <div></div>

                        {/* Rangos de CH4 */}
                        <div>
                          <label className="block text-sm font-medium text-green-400 mb-2">CH₄ Mín (%) </label>
                          <input
                            type="number"
                            step="0.1"
                            value={filtros.ch4Min}
                            onChange={(e) => setFiltros({...filtros, ch4Min: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="0.0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-green-400 mb-2">CH₄ Máx (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={filtros.ch4Max}
                            onChange={(e) => setFiltros({...filtros, ch4Max: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                            placeholder="100.0"
                          />
                        </div>

                        {/* Rangos de H2S */}
                        <div>
                          <label className="block text-sm font-medium text-yellow-400 mb-2">H₂S Mín (ppm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={filtros.h2sMin}
                            onChange={(e) => setFiltros({...filtros, h2sMin: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="0.0"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-yellow-400 mb-2">H₂S Máx (ppm)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={filtros.h2sMax}
                            onChange={(e) => setFiltros({...filtros, h2sMax: e.target.value})}
                            className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                            placeholder="100.0"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Indicador de estado y recarga */}
                <div className="mt-4 flex justify-center items-center space-x-4">
                  {cargandoDatos && (
                    <div className="flex items-center text-blue-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400 mr-2"></div>
                      <span className="text-sm">Actualizando datos...</span>
                    </div>
                  )}

                  {errorDatos && (
                    <div className="text-red-400 text-sm">
                      Error al cargar datos: {errorDatos}
                    </div>
                  )}

                  <button
                    onClick={cargarMedicionesBiodigestores}
                    disabled={cargandoDatos}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                  >
                    🔄 Recargar
                  </button>
                </div>
              </div>

              {/* KPIs Principales */}
              {medicionesFiltradas.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {(() => {
                    const ultimaMedicion = medicionesFiltradas[medicionesFiltradas.length - 1];
                    const promedioCH4 = medicionesFiltradas.reduce((sum, m) => sum + (m.fields['CH4 (Max) %'] || 0), 0) / medicionesFiltradas.length;
                    const promedioH2S = medicionesFiltradas.reduce((sum, m) => sum + (m.fields['H2S'] || 0), 0) / medicionesFiltradas.length;
                    const totalMediciones = medicionesFiltradas.length;
                    const ultimaFecha = typeof ultimaMedicion.fields['Fecha Medicion'] === 'string'
                      ? new Date(ultimaMedicion.fields['Fecha Medicion']).toLocaleString('es-CO')
                      : 'Fecha no disponible';

                    return (
                      <>
                        <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-xl p-6 border border-green-600/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-green-400 text-sm font-medium">CH₄ Promedio</p>
                              <p className="text-white text-2xl font-bold">{promedioCH4.toFixed(1)}%</p>
                              <p className="text-green-300 text-xs">Eficiencia del proceso</p>
                            </div>
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                              <span className="text-green-400 text-xl">🟢</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-xl p-6 border border-yellow-600/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-yellow-400 text-sm font-medium">H₂S Promedio</p>
                              <p className="text-white text-2xl font-bold">{promedioH2S.toFixed(1)} ppm</p>
                              <p className="text-yellow-300 text-xs">Control de contaminación</p>
                            </div>
                            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                              <span className="text-yellow-400 text-xl">⚠️</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-600/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-blue-400 text-sm font-medium">Total Mediciones</p>
                              <p className="text-white text-2xl font-bold">{totalMediciones}</p>
                              <p className="text-blue-300 text-xs">Registros en filtro</p>
                            </div>
                            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                              <span className="text-blue-400 text-xl">📊</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-xl p-6 border border-purple-600/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-purple-400 text-sm font-medium">Última Medición</p>
                              <p className="text-white text-sm font-bold">{ultimaFecha.split(',')[0]}</p>
                              <p className="text-purple-300 text-xs">Datos más recientes</p>
                            </div>
                            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                              <span className="text-purple-400 text-xl">🕒</span>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Gráficos de Análisis */}
              {medicionesFiltradas.length > 0 && (
                <div className="space-y-8">
                  <h2 className="text-3xl font-bold text-white mb-8 text-center">📈 Análisis de Datos de Biodigestores</h2>

                  {/* Primera fila de gráficos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Composición del Gas */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
                      <div className="h-80">
                        {prepararDatosComposicionGas() && (
                          <Doughnut
                            data={prepararDatosComposicionGas()!}
                            options={opcionesGraficoComposicion}
                          />
                        )}
                      </div>
                    </div>

                    {/* Tendencia de Contaminantes */}
                    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
                      <div className="h-80">
                        {prepararDatosTendenciaContaminantes() && (
                          <Line
                            data={prepararDatosTendenciaContaminantes()!}
                            options={opcionesGraficoContaminantes}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Segunda fila de gráficos */}
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
                    <div className="h-96">
                      {prepararDatosComposicionGases() && (
                        <Line
                          data={prepararDatosComposicionGases()!}
                          options={opcionesGraficoGases}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tabla de Mediciones Recientes */}
              {medicionesFiltradas.length > 0 && (
                <div className="mt-12">
                  <h2 className="text-2xl font-bold text-white mb-6">📋 Mediciones {medicionesFiltradas.length !== mediciones.length ? 'Filtradas' : 'Recientes'}</h2>
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl border border-slate-600/30 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-700/30">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Fecha</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CH₄ (%)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CO₂ (%)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">O₂ (%)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">H₂S (ppm)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CO (ppm)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">NO (ppm)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Operador</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-600/30">
                          {medicionesFiltradas.slice(-10).reverse().map((medicion, index) => (
                            <tr key={medicion.id || index} className="hover:bg-slate-700/20">
                              <td className="px-4 py-3 text-sm text-white">
                                {typeof medicion.fields['Fecha Medicion'] === 'string'
                                  ? new Date(medicion.fields['Fecha Medicion']).toLocaleString('es-CO')
                                  : 'N/A'}
                              </td>
                              <td className="px-4 py-3 text-sm text-green-400 font-medium">
                                {medicion.fields['CH4 (Max) %'] || 0}%
                              </td>
                              <td className="px-4 py-3 text-sm text-red-400">
                                {medicion.fields['CO2 %'] || 0}%
                              </td>
                              <td className="px-4 py-3 text-sm text-blue-400">
                                {medicion.fields['O2 %'] || 0}%
                              </td>
                              <td className="px-4 py-3 text-sm text-yellow-400">
                                {medicion.fields['H2S'] || 0}
                              </td>
                              <td className="px-4 py-3 text-sm text-orange-400">
                                {medicion.fields['CO'] || 0}
                              </td>
                              <td className="px-4 py-3 text-sm text-purple-400">
                                {medicion.fields['NO'] || 0}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-300">
                                {medicion.fields['Realiza Registro'] || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Estado vacío */}
              {!cargandoDatos && medicionesFiltradas.length === 0 && !errorDatos && (
                <div className="text-center py-12">
                  <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {mediciones.length > 0 ? 'No hay mediciones que coincidan con los filtros' : 'No hay mediciones disponibles'}
                    </h3>
                    <p className="text-gray-400">
                      {mediciones.length > 0
                        ? 'Intenta ajustar los filtros para ver más resultados.'
                        : 'No se encontraron registros de mediciones de biodigestores.'
                      }
                    </p>
                    {mediciones.length > 0 && (
                      <button
                        onClick={limpiarFiltros}
                        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Limpiar Filtros
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </main>

        <Footer />
      </div>
    </BackgroundLayout>
  );
}
