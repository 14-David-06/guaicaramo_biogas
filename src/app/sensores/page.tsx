'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurnoGuard from '@/components/TurnoGuard';
import BackgroundLayout from '@/components/BackgroundLayout';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { airtableService } from '@/utils/airtable';
import * as XLSX from 'xlsx';

interface AirtableRecord {
  id?: string;
  fields: Record<string, unknown>;
}

interface DashboardData {
  turnos?: AirtableRecord[];
  estadosMotores?: AirtableRecord[];
  monitoreo?: AirtableRecord[];
  jenbachers?: AirtableRecord[];
  mediciones?: AirtableRecord[];
  bitacora?: AirtableRecord[];
  limpiezas?: AirtableRecord[];
}

interface DashboardRow {
  'Métrica': string;
  'Valor': unknown;
  'Unidad': string;
  'Fecha': string;
}

export default function SensoresPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoDatos, setTipoDatos] = useState('todos');
  const [exportando, setExportando] = useState(false);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para ver los sensores.</p>
        </div>
      </div>
    );
  }

  const opcionesDatos = [
    { value: 'todos', label: 'Todos los datos' },
    { value: 'turnos', label: 'Turnos de Operadores' },
    { value: 'motores', label: 'Estados de Motores' },
    { value: 'monitoreo', label: 'Monitoreo de Motores' },
    { value: 'jenbacher', label: 'Registros Diarios Jenbacher' },
    { value: 'biodigestores', label: 'Mediciones de Biodigestores' },
    { value: 'bitacora', label: 'Bitácora de Biogas' },
    { value: 'limpiezas', label: 'Registros de Limpiezas' }
  ];

  const handleExportarExcel = async () => {
    if (!fechaInicio || !fechaFin) {
      alert('Por favor selecciona las fechas de inicio y fin');
      return;
    }

    setExportando(true);
    try {
      // Crear fechas en formato ISO para comparación
      const fechaInicioISO = new Date(fechaInicio).toISOString().split('T')[0];
      const fechaFinISO = new Date(fechaFin).toISOString().split('T')[0];
      
      console.log('Exportando datos desde:', fechaInicioISO, 'hasta:', fechaFinISO);
      console.log('Tipo de datos seleccionado:', tipoDatos);

      // Obtener datos según el tipo seleccionado
      let datosExportar: { hoja: string; datos: AirtableRecord[] | DashboardRow[] }[] = [];
      const nombreArchivo = `reporte_biogas_${fechaInicioISO}_${fechaFinISO}.xlsx`;

      switch (tipoDatos) {
        case 'todos':
          // Exportar todos los datos disponibles
          const [turnos, estadosMotores, monitoreo, jenbachers, mediciones, bitacora, limpiezas] = await Promise.all([
            airtableService.obtenerHistorialTurnos(1000),
            airtableService.obtenerEstadosMotores(),
            airtableService.obtenerMonitoreoMotores(),
            airtableService.obtenerRegistrosDiariosJenbacher(),
            airtableService.obtenerMedicionesBiodigestores(),
            airtableService.obtenerBitacoraBiogas(),
            airtableService.obtenerRegistrosLimpiezas()
          ]);
          
          // Filtrar datos por fecha usando los campos correctos
          const turnosFiltrados = filtrarPorFecha(turnos, 'Creacion', fechaInicioISO, fechaFinISO);
          const estadosFiltrados = filtrarPorFecha(estadosMotores, 'Fecha y Hora', fechaInicioISO, fechaFinISO);
          const monitoreoFiltrado = filtrarPorFecha(monitoreo, 'Fecha de creacion', fechaInicioISO, fechaFinISO);
          const jenbachersFiltrados = filtrarPorFecha(jenbachers, 'Fecha Registro', fechaInicioISO, fechaFinISO);
          const medicionesFiltradas = filtrarPorFecha(mediciones, 'Fecha Medicion', fechaInicioISO, fechaFinISO);
          const bitacoraFiltrada = filtrarPorFecha(bitacora, 'Fecha de creacion', fechaInicioISO, fechaFinISO);
          const limpiezasFiltradas = filtrarPorFecha(limpiezas, 'Fecha de creacion', fechaInicioISO, fechaFinISO);

          // Crear dashboard resumen
          const dashboardData = crearDashboardResumen({
            turnos: turnosFiltrados,
            estadosMotores: estadosFiltrados,
            monitoreo: monitoreoFiltrado,
            jenbachers: jenbachersFiltrados,
            mediciones: medicionesFiltradas,
            bitacora: bitacoraFiltrada,
            limpiezas: limpiezasFiltradas
          });

          datosExportar = [
            { hoja: 'Dashboard', datos: dashboardData },
            { hoja: 'Turnos Operadores', datos: turnosFiltrados },
            { hoja: 'Estados Motores', datos: estadosFiltrados },
            { hoja: 'Monitoreo Motores', datos: monitoreoFiltrado },
            { hoja: 'Registros Jenbacher', datos: jenbachersFiltrados },
            { hoja: 'Mediciones Biodigestores', datos: medicionesFiltradas },
            { hoja: 'Bitácora Biogas', datos: bitacoraFiltrada },
            { hoja: 'Registros Limpieza', datos: limpiezasFiltradas }
          ];
          break;

        case 'turnos':
          const turnosData = await airtableService.obtenerHistorialTurnos(1000);
          datosExportar = [{ hoja: 'Turnos', datos: filtrarPorFecha(turnosData, 'Creacion', fechaInicioISO, fechaFinISO) }];
          break;

        case 'motores':
          const motoresData = await airtableService.obtenerEstadosMotores();
          datosExportar = [{ hoja: 'Estados Motores', datos: filtrarPorFecha(motoresData, 'Fecha y Hora', fechaInicioISO, fechaFinISO) }];
          break;

        case 'monitoreo':
          const monitoreoData = await airtableService.obtenerMonitoreoMotores();
          datosExportar = [{ hoja: 'Monitoreo Motores', datos: filtrarPorFecha(monitoreoData, 'Fecha de creacion', fechaInicioISO, fechaFinISO) }];
          break;

        case 'jenbacher':
          const jenbachersData = await airtableService.obtenerRegistrosDiariosJenbacher();
          datosExportar = [{ hoja: 'Registros Jenbacher', datos: jenbachersData }];
          break;

        case 'biodigestores':
          const biodigestoresData = await airtableService.obtenerMedicionesBiodigestores();
          datosExportar = [{ hoja: 'Mediciones Biodigestores', datos: filtrarPorFecha(biodigestoresData, 'Fecha Medicion', fechaInicioISO, fechaFinISO) }];
          break;

        case 'bitacora':
          const bitacoraData = await airtableService.obtenerBitacoraBiogas();
          datosExportar = [{ hoja: 'Bitácora Biogas', datos: filtrarPorFecha(bitacoraData, 'Fecha de creacion', fechaInicioISO, fechaFinISO) }];
          break;

        case 'limpiezas':
          const limpiezasData = await airtableService.obtenerRegistrosLimpiezas();
          datosExportar = [{ hoja: 'Registros Limpieza', datos: filtrarPorFecha(limpiezasData, 'Fecha de creacion', fechaInicioISO, fechaFinISO) }];
          break;
      }

      // Generar archivo Excel profesional
      generarExcelProfesional(datosExportar, nombreArchivo, fechaInicioISO, fechaFinISO);
      
      alert(`✅ Exportación completada exitosamente!\nArchivo: ${nombreArchivo}\n\nDatos exportados desde ${fechaInicio} hasta ${fechaFin}`);
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('❌ Error al exportar los datos. Revisa la consola para más detalles.');
    } finally {
      setExportando(false);
    }
  };

  // Función para crear dashboard resumen
  const crearDashboardResumen = (datos: DashboardData) => {
    const dashboard = [
      { 'Métrica': 'REPORTE EJECUTIVO - BIOGAS SYSTEM', 'Valor': '', 'Unidad': '', 'Fecha': new Date().toLocaleDateString('es-CO') },
      { 'Métrica': '', 'Valor': '', 'Unidad': '', 'Fecha': '' },
      { 'Métrica': '📊 RESUMEN GENERAL', 'Valor': '', 'Unidad': '', 'Fecha': '' },
      { 'Métrica': 'Total Turnos Registrados', 'Valor': datos.turnos?.length || 0, 'Unidad': 'turnos', 'Fecha': '' },
      { 'Métrica': 'Estados de Motor Registrados', 'Valor': datos.estadosMotores?.length || 0, 'Unidad': 'registros', 'Fecha': '' },
      { 'Métrica': 'Registros de Monitoreo', 'Valor': datos.monitoreo?.length || 0, 'Unidad': 'registros', 'Fecha': '' },
      { 'Métrica': 'Registros Jenbacher', 'Valor': datos.jenbachers?.length || 0, 'Unidad': 'registros', 'Fecha': '' },
      { 'Métrica': 'Mediciones Biodigestores', 'Valor': datos.mediciones?.length || 0, 'Unidad': 'registros', 'Fecha': '' },
      { 'Métrica': 'Registros Bitácora', 'Valor': datos.bitacora?.length || 0, 'Unidad': 'registros', 'Fecha': '' },
      { 'Métrica': 'Registros de Limpieza', 'Valor': datos.limpiezas?.length || 0, 'Unidad': 'registros', 'Fecha': '' },
      { 'Métrica': '', 'Valor': '', 'Unidad': '', 'Fecha': '' },
      { 'Métrica': '⚡ ESTADOS DE MOTORES', 'Valor': '', 'Unidad': '', 'Fecha': '' },
    ];

    // Agregar estadísticas de motores
    const motoresEncendidos = datos.estadosMotores?.filter((m: AirtableRecord) => m.fields['Estado Motor'] === 'Encendido').length || 0;
    const motoresApagados = datos.estadosMotores?.filter((m: AirtableRecord) => m.fields['Estado Motor'] === 'Apagado').length || 0;
    
    dashboard.push(
      { 'Métrica': 'Motores Encendidos', 'Valor': motoresEncendidos, 'Unidad': 'motores', 'Fecha': '' },
      { 'Métrica': 'Motores Apagados', 'Valor': motoresApagados, 'Unidad': 'motores', 'Fecha': '' },
      { 'Métrica': '', 'Valor': '', 'Unidad': '', 'Fecha': '' },
      { 'Métrica': '🏭 PARÁMETROS DE CALIDAD', 'Valor': '', 'Unidad': '', 'Fecha': '' }
    );

    // Estadísticas de calidad del biogas
    if (datos.mediciones && datos.mediciones.length > 0) {
      const ultimaMedicion = datos.mediciones[datos.mediciones.length - 1];
      const ch4Value = ultimaMedicion?.fields['CH4 (Max) %'] ? String(ultimaMedicion.fields['CH4 (Max) %']) : 'N/A';
      const co2Value = ultimaMedicion?.fields['CO2 %'] ? String(ultimaMedicion.fields['CO2 %']) : 'N/A';
      const o2Value = ultimaMedicion?.fields['O2 %'] ? String(ultimaMedicion.fields['O2 %']) : 'N/A';
      const h2sValue = ultimaMedicion?.fields['H2S'] ? String(ultimaMedicion.fields['H2S']) : 'N/A';
      const fechaMedicion = ultimaMedicion?.fields['Fecha Medicion'] ? new Date(ultimaMedicion.fields['Fecha Medicion'] as string).toLocaleDateString('es-CO') : '';
      
      dashboard.push(
        { 'Métrica': 'Última Medición CH4', 'Valor': ch4Value, 'Unidad': '%', 'Fecha': fechaMedicion },
        { 'Métrica': 'Última Medición CO2', 'Valor': co2Value, 'Unidad': '%', 'Fecha': fechaMedicion },
        { 'Métrica': 'Última Medición O2', 'Valor': o2Value, 'Unidad': '%', 'Fecha': fechaMedicion },
        { 'Métrica': 'Última Medición H2S', 'Valor': h2sValue, 'Unidad': 'ppm', 'Fecha': fechaMedicion }
      );
    } else {
      // Agregar filas vacías cuando no hay mediciones
      dashboard.push(
        { 'Métrica': 'Última Medición CH4', 'Valor': 'Sin datos', 'Unidad': '%', 'Fecha': '' },
        { 'Métrica': 'Última Medición CO2', 'Valor': 'Sin datos', 'Unidad': '%', 'Fecha': '' },
        { 'Métrica': 'Última Medición O2', 'Valor': 'Sin datos', 'Unidad': '%', 'Fecha': '' },
        { 'Métrica': 'Última Medición H2S', 'Valor': 'Sin datos', 'Unidad': 'ppm', 'Fecha': '' }
      );
    }

    dashboard.push(
      { 'Métrica': '', 'Valor': '', 'Unidad': '', 'Fecha': '' },
      { 'Métrica': '📈 PRODUCCIÓN Y CONSUMO', 'Valor': '', 'Unidad': '', 'Fecha': '' }
    );

    // Estadísticas de producción
    if (datos.jenbachers && datos.jenbachers.length > 0) {
      const ultimaProduccion = datos.jenbachers[datos.jenbachers.length - 1];
      const potenciaValue = ultimaProduccion?.fields['POTENCIA GENERADA(Kw)'] ? String(ultimaProduccion.fields['POTENCIA GENERADA(Kw)']) : 'N/A';
      const consumoValue = ultimaProduccion?.fields['M3 DE BIOGAS (M3)'] ? String(ultimaProduccion.fields['M3 DE BIOGAS (M3)']) : 'N/A';
      const fechaRegistro = ultimaProduccion?.fields['Fecha Registro'] ? new Date(ultimaProduccion.fields['Fecha Registro'] as string).toLocaleDateString('es-CO') : '';

      dashboard.push(
        { 'Métrica': 'Última Potencia Generada', 'Valor': potenciaValue, 'Unidad': 'kW', 'Fecha': fechaRegistro },
        { 'Métrica': 'Último Consumo Biogas', 'Valor': consumoValue, 'Unidad': 'm³', 'Fecha': fechaRegistro }
      );
    }

    return dashboard;
  };

  // Función para filtrar datos por fecha
  const filtrarPorFecha = (datos: AirtableRecord[], campoFecha: string, fechaInicio: string, fechaFin: string) => {
    return datos.filter(item => {
      const fechaItem = item.fields[campoFecha];
      if (!fechaItem || typeof fechaItem !== 'string') return false;

      // Convertir fecha del item a formato YYYY-MM-DD
      const fechaItemFormateada = new Date(fechaItem).toISOString().split('T')[0];

      return fechaItemFormateada >= fechaInicio && fechaItemFormateada <= fechaFin;
    });
  };

  // Función para generar archivo Excel profesional
  const generarExcelProfesional = (datosExportar: { hoja: string; datos: AirtableRecord[] | DashboardRow[] }[], nombreArchivo: string, fechaInicio: string, fechaFin: string) => {
    const workbook = XLSX.utils.book_new();
    
    // Agregar metadatos al workbook
    workbook.Props = {
      Title: 'Reporte Sistema Biogas',
      Subject: 'Datos históricos del sistema de biogas',
      Author: 'Sistema BioGas',
      CreatedDate: new Date(),
      Company: 'Empresa BioGas'
    };

    datosExportar.forEach(({ hoja, datos }) => {
      if (datos && datos.length > 0) {
        // Convertir datos a formato de hoja de cálculo
        let worksheetData: unknown[];
        
        if (hoja === 'Dashboard') {
          // Los datos del dashboard ya están en el formato correcto
          worksheetData = datos as DashboardRow[];
        } else {
          // Los datos de Airtable necesitan conversión
          worksheetData = (datos as AirtableRecord[]).map((item, index) => {
            const processedFields: Record<string, unknown> = {};
            
            // Procesar cada campo para asegurar que no queden undefined
            Object.entries(item.fields).forEach(([key, value]) => {
              processedFields[key] = value ?? '';
            });
            
            return {
              ID: item.id || `REG-${index + 1}`,
              ...processedFields
            };
          });
        }
        
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        
        // Configurar ancho de columnas
        const columnWidths = [
          { wch: 15 }, // ID
          ...Object.keys(worksheetData[0] || {}).slice(1).map(() => ({ wch: 20 }))
        ];
        worksheet['!cols'] = columnWidths;
        
        // Agregar fila de encabezado con información del reporte
        if (hoja === 'Dashboard') {
          XLSX.utils.sheet_add_aoa(worksheet, [
            ['SISTEMA DE BIOGAS - REPORTE EJECUTIVO'],
            [`Período: ${new Date(fechaInicio).toLocaleDateString('es-CO')} - ${new Date(fechaFin).toLocaleDateString('es-CO')}`],
            [`Generado: ${new Date().toLocaleString('es-CO')}`],
            ['']
          ], { origin: 'A1' });
        } else {
          XLSX.utils.sheet_add_aoa(worksheet, [
            [`${hoja.toUpperCase()} - PERÍODO ${new Date(fechaInicio).toLocaleDateString('es-CO')} AL ${new Date(fechaFin).toLocaleDateString('es-CO')}`],
            [`Total registros: ${datos.length}`],
            ['Nota: Las celdas vacías indican que ese campo no tiene datos para ese registro específico.'],
            ['']
          ], { origin: 'A1' });
        }
        
        XLSX.utils.book_append_sheet(workbook, worksheet, hoja);
      }
    });
    
    // Descargar archivo
    XLSX.writeFile(workbook, nombreArchivo);
  };

  return (
    <TurnoGuard>
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
            <h1 className="text-4xl font-bold text-white mb-4">Histórico de Registros</h1>
            <p className="text-gray-300 text-lg">Histórico de datos registrados del sistema</p>
          </div>

          {/* Panel de Exportación */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-8 border border-slate-600/30 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">Exportar Datos a Excel</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              
              {/* Fecha Inicio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha Inicio *
                </label>
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Fecha Fin */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Fecha Fin *
                </label>
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {/* Tipo de Datos */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tipo de Datos
                </label>
                <select
                  value={tipoDatos}
                  onChange={(e) => setTipoDatos(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {opcionesDatos.map((opcion) => (
                    <option key={opcion.value} value={opcion.value} className="bg-gray-700">
                      {opcion.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botón Exportar */}
              <div className="flex items-end">
                <button
                  onClick={handleExportarExcel}
                  disabled={exportando}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center justify-center"
                >
                  {exportando ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exportando...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Exportar Excel
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-sm text-gray-400">
              <p>Selecciona el rango de fechas y el tipo de datos que deseas exportar. Los datos se filtrarán por fecha de creación/registro.</p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}