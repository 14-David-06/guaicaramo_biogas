'use client';

import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { airtableService } from '@/utils/airtable';
import * as XLSX from 'xlsx';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso, { type TonoAviso } from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';

/** Resultado de la última descarga, para el resumen de arriba. */
interface UltimaExportacion {
  archivo: string;
  registros: number;
  hojas: number;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function fechaCorta(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

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
  const { user: loggedInUser } = useAuth();
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [tipoDatos, setTipoDatos] = useState('todos');
  const [exportando, setExportando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: TonoAviso; titulo: string; texto: string } | null>(null);
  const [ultima, setUltima] = useState<UltimaExportacion | null>(null);

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-fondo px-4">
        <div className="bg-superficie border border-linea rounded-xl p-6 sm:p-8 max-w-md w-full text-center">
          <h1 className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">Inicie sesión</h1>
          <p className="mt-2 text-tinta-suave">Para ver y exportar el histórico de registros necesita ingresar con su cédula.</p>
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            className={`${claseBoton('primario', 'lg')} w-full mt-6`}
          >
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const opcionesDatos = [
    { value: 'todos', label: 'Todos los datos' },
    { value: 'turnos', label: 'Turnos de operadores' },
    { value: 'motores', label: 'Estados de motores' },
    { value: 'monitoreo', label: 'Monitoreo de motores' },
    { value: 'jenbacher', label: 'Registros diarios Jenbacher' },
    { value: 'biodigestores', label: 'Mediciones de biodigestores' },
    { value: 'bitacora', label: 'Bitácora de biogás' },
    { value: 'limpiezas', label: 'Registros de limpiezas' }
  ];

  const handleExportarExcel = async () => {
    setAviso(null);
    if (!fechaInicio || !fechaFin) {
      setAviso({ tono: 'error', titulo: 'Faltan las fechas', texto: 'Elija la fecha inicial y la final antes de descargar el archivo.' });
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

      const registros = datosExportar.filter((h) => h.hoja !== 'Dashboard').reduce((total, h) => total + h.datos.length, 0);
      const hojas = datosExportar.filter((h) => h.datos && h.datos.length > 0).length;
      setUltima({ archivo: nombreArchivo, registros, hojas });
      setAviso({
        tono: 'exito',
        titulo: 'Archivo descargado',
        texto: `${nombreArchivo}: ${registros.toLocaleString('es-CO')} registros del ${fechaCorta(fechaInicio)} al ${fechaCorta(fechaFin)}.`
      });
    } catch (error) {
      console.error('Error al exportar:', error);
      setAviso({
        tono: 'error',
        titulo: 'No se pudo exportar',
        texto: 'No se pudieron leer los datos o el rango elegido no tiene registros. Revise la conexión, pruebe con otras fechas e intente de nuevo.'
      });
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

  const etiquetaTipo = opcionesDatos.find((o) => o.value === tipoDatos)?.label ?? '';
  const dias =
    fechaInicio && fechaFin ? Math.round((new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) / DIA_MS) + 1 : null;
  const rangoInvertido = dias !== null && dias < 1;

  return (
    <Pagina>
      <EncabezadoPagina
        titulo="Histórico de registros"
        descripcion="Descargue en Excel lo que se ha registrado en la planta durante un rango de fechas."
      />

      <Indicadores
        items={[
          {
            etiqueta: 'Período elegido',
            valor: dias === null ? '—' : rangoInvertido ? 'Revisar' : dias,
            unidad: dias !== null && !rangoInvertido ? (dias === 1 ? 'día' : 'días') : undefined,
            detalle:
              dias === null
                ? 'Elija la fecha inicial y la final'
                : rangoInvertido
                  ? 'La fecha final es anterior a la inicial'
                  : `Del ${fechaCorta(fechaInicio)} al ${fechaCorta(fechaFin)}`,
            tono: rangoInvertido ? 'alerta' : 'neutro'
          },
          {
            etiqueta: 'Hojas del archivo',
            valor: tipoDatos === 'todos' ? 8 : 1,
            detalle: tipoDatos === 'todos' ? 'Resumen y hasta 7 tablas' : etiquetaTipo
          },
          {
            etiqueta: 'Última descarga',
            valor: ultima ? ultima.registros.toLocaleString('es-CO') : '—',
            unidad: ultima ? 'registros' : undefined,
            detalle: ultima ? <span className="break-all">{ultima.archivo}</span> : 'Aún no ha descargado en esta sesión'
          }
        ]}
      />

      {aviso && <Aviso tono={aviso.tono} titulo={aviso.titulo}>{aviso.texto}</Aviso>}

      <Panel
        titulo="Exportar a Excel"
        descripcion="Los registros se filtran por su fecha de creación o de registro."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="fecha-inicio" className={claseEtiqueta}>Fecha inicial</label>
            <input
              id="fecha-inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={`${claseCampo} min-h-[46px]`}
              required
            />
          </div>

          <div>
            <label htmlFor="fecha-fin" className={claseEtiqueta}>Fecha final</label>
            <input
              id="fecha-fin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={`${claseCampo} min-h-[46px]`}
              required
            />
          </div>

          <div>
            <label htmlFor="tipo-datos" className={claseEtiqueta}>Qué datos</label>
            <select
              id="tipo-datos"
              value={tipoDatos}
              onChange={(e) => setTipoDatos(e.target.value)}
              className={`${claseCampo} min-h-[46px]`}
            >
              {opcionesDatos.map((opcion) => (
                <option key={opcion.value} value={opcion.value}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleExportarExcel}
              disabled={exportando}
              className={`${claseBoton('primario')} w-full min-h-[46px]`}
            >
              {exportando ? (
                <>
                  <span className="w-5 h-5 rounded-full border-[3px] border-white/40 border-t-white animate-spin" aria-hidden="true" />
                  Preparando archivo…
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Descargar Excel
                </>
              )}
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm text-tinta-suave">
          Con «Todos los datos» el archivo trae una hoja de resumen y una hoja por tabla: turnos, estados y monitoreo de motores,
          registros Jenbacher, biodigestores, bitácora y limpiezas.
        </p>
      </Panel>
    </Pagina>
  );
}
