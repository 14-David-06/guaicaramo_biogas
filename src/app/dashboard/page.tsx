'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { airtableService, EstadoMotor, MonitoreoMotor, RegistroDiariosJenbacher, BitacoraBiogas, MedicionBiodigestores, TurnoOperador, Motor } from '@/utils/airtable';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function DashboardPage() {
  const { user: loggedInUser, logout } = useAuth();

  // Estado para datos del dashboard
  const [datosTurno, setDatosTurno] = useState<{
    turno: TurnoOperador | null;
    estadosMotores: EstadoMotor[];
    monitoreoMotores: MonitoreoMotor[];
    registrosJenbacher: RegistroDiariosJenbacher[];
    bitacoraBiogas: BitacoraBiogas[];
    medicionBiodigestores: MedicionBiodigestores[];
  } | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [motores, setMotores] = useState<Motor[]>([]);
  const [modoVista, setModoVista] = useState<'turno' | 'historico'>('historico'); // Cambiado a 'historico' por defecto

  // Función helper para obtener nombre del motor
  const obtenerNombreMotor = (motorId: string | string[]): string => {
    if (Array.isArray(motorId)) {
      return motorId.map(id => {
        const motor = motores.find(m => m.id === id);
        return motor ? `${motor.fields['Nombre Motor']} ${motor.fields['Modelo Motor']} ${motor.fields['Número Serie']}` : id;
      }).join(', ');
    }
    const motor = motores.find(m => m.id === motorId);
    return motor ? `${motor.fields['Nombre Motor']} ${motor.fields['Modelo Motor']} ${motor.fields['Número Serie']}` : motorId;
  };

  // Funciones para preparar datos de gráficos
  const prepararDatosComposicionGas = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;

    const registros = datosTurno.registrosJenbacher;
    const ultimoRegistro = registros[registros.length - 1];

    const ch4 = ultimoRegistro.fields['METANO(CH4)%'] || 0;
    const o2 = ultimoRegistro.fields['OXIGENO(O2) %'] || 0;
    const co2 = ultimoRegistro.fields['DIOXIDO DE CARBONO(CO2) %'] || 0;
    const otros = 100 - (ch4 + o2 + co2);

    return {
      labels: ['CH₄ (Metano)', 'O₂ (Oxígeno)', 'CO₂', 'Otros'],
      datasets: [{
        data: [ch4, o2, co2, Math.max(0, otros)],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',  // Verde para CH4
          'rgba(59, 130, 246, 0.8)', // Azul para O2
          'rgba(239, 68, 68, 0.8)',  // Rojo para CO2
          'rgba(156, 163, 175, 0.8)' // Gris para otros
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(156, 163, 175, 1)'
        ],
        borderWidth: 2,
      }],
    };
  };

  const prepararDatosTendenciaQuimicos = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;

    const registros = datosTurno.registrosJenbacher.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Registro'] === 'string' ? new Date(a.fields['Fecha Registro']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Registro'] === 'string' ? new Date(b.fields['Fecha Registro']).getTime() : 0;
      return fechaA - fechaB;
    });

    // Limitar a los últimos 100 registros para evitar sobrecargar las gráficas
    const registrosLimitados = registros.slice(-100);

    const labels = registrosLimitados.map((registro) => {
      const fecha = typeof registro.fields['Fecha Registro'] === 'string' ? new Date(registro.fields['Fecha Registro']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'CH₄ (%)',
          data: registrosLimitados.map(r => r.fields['METANO(CH4)%'] || 0),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'O₂ (%)',
          data: registrosLimitados.map(r => r.fields['OXIGENO(O2) %'] || 0),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'CO₂ (%)',
          data: registrosLimitados.map(r => r.fields['DIOXIDO DE CARBONO(CO2) %'] || 0),
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'H₂S (ppm)',
          data: registrosLimitados.map(r => r.fields['ACIDO SULFIDRICO(H2S)'] || 0),
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true,
          yAxisID: 'y1',
        },
      ],
    };
  };

  const prepararDatosPotenciaVsBiogas = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;

    const registros = datosTurno.registrosJenbacher.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Registro'] === 'string' ? new Date(a.fields['Fecha Registro']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Registro'] === 'string' ? new Date(b.fields['Fecha Registro']).getTime() : 0;
      return fechaA - fechaB;
    });

    // Limitar a los últimos 100 registros
    const registrosLimitados = registros.slice(-100);

    const labels = registrosLimitados.map((registro) => {
      const fecha = typeof registro.fields['Fecha Registro'] === 'string' ? new Date(registro.fields['Fecha Registro']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Potencia Generada (KW)',
          data: registrosLimitados.map(r => r.fields['POTENCIA GENERADA(Kw)'] || 0),
          backgroundColor: 'rgba(34, 197, 94, 0.8)',
          borderColor: 'rgba(34, 197, 94, 1)',
          borderWidth: 1,
          yAxisID: 'y',
        },
        {
          label: 'Biogás Consumido (M³)',
          data: registrosLimitados.map(r => r.fields['M3 DE BIOGAS (M3)'] || 0),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1,
          yAxisID: 'y1',
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

  const opcionesGraficoTendencia = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    stacked: false,
    plugins: {
      title: {
        display: true,
        text: 'Tendencia de Componentes Químicos',
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
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
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
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        ticks: {
          color: 'white',
        },
        grid: {
          drawOnChartArea: false,
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: 'H₂S (ppm)',
          color: 'white',
        },
      },
    },
  };

  const opcionesGraficoPotencia = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Potencia vs Consumo de Biogás',
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
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        ticks: {
          color: 'white',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: 'Potencia (KW)',
          color: 'white',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        ticks: {
          color: 'white',
        },
        grid: {
          drawOnChartArea: false,
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: 'Biogás (M³)',
          color: 'white',
        },
      },
    },
  };

  const prepararDatosTemperaturasBiofiltro = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;

    const registros = datosTurno.registrosJenbacher.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Registro'] === 'string' ? new Date(a.fields['Fecha Registro']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Registro'] === 'string' ? new Date(b.fields['Fecha Registro']).getTime() : 0;
      return fechaA - fechaB;
    });

    // Limitar a los últimos 100 registros
    const registrosLimitados = registros.slice(-100);

    const labels = registrosLimitados.map((registro) => {
      const fecha = typeof registro.fields['Fecha Registro'] === 'string' ? new Date(registro.fields['Fecha Registro']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Temp. Entrada Biofiltro (°C)',
          data: registrosLimitados.map(r => r.fields['TEMP. ENTRADA BIOFILTRO'] || 0),
          borderColor: 'rgba(239, 68, 68, 1)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Temp. Salida Biofiltro (°C)',
          data: registrosLimitados.map(r => r.fields['TEMP. SALIDA BIOFILTRO'] || 0),
          borderColor: 'rgba(34, 197, 94, 1)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  };

  const prepararDatosPresionesBiofiltro = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;

    const registros = datosTurno.registrosJenbacher.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Registro'] === 'string' ? new Date(a.fields['Fecha Registro']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Registro'] === 'string' ? new Date(b.fields['Fecha Registro']).getTime() : 0;
      return fechaA - fechaB;
    });

    const labels = registros.map((registro) => {
      const fecha = typeof registro.fields['Fecha Registro'] === 'string' ? new Date(registro.fields['Fecha Registro']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Presión Entrada (cm H₂O)',
          data: registros.map(r => r.fields['PRESION BIOFILTRO ENTRADA (cm de h20)'] || 0),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
        },
        {
          label: 'Presión Salida (cm H₂O)',
          data: registros.map(r => r.fields['PRESION BIOFILTRO SALIDA (cm de h2o)'] || 0),
          borderColor: 'rgba(245, 158, 11, 1)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          tension: 0.4,
          fill: true,
        },
      ],
    };
  };

  const prepararDatosEstadosMotores = () => {
    if (!datosTurno || datosTurno.estadosMotores.length === 0) return null;

    const estados = datosTurno.estadosMotores.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha y Hora'] === 'string' ? new Date(a.fields['Fecha y Hora']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha y Hora'] === 'string' ? new Date(b.fields['Fecha y Hora']).getTime() : 0;
      return fechaA - fechaB;
    });

    const labels = estados.map((estado) => {
      const fecha = typeof estado.fields['Fecha y Hora'] === 'string' ? new Date(estado.fields['Fecha y Hora']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [{
        label: 'Estado del Motor',
        data: estados.map(estado => estado.fields['Estado Motor'] === 'Encendido' ? 1 : 0),
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        stepped: true,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    };
  };

  const prepararDatosEficienciaMotor = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;

    const registros = datosTurno.registrosJenbacher.sort((a, b) => {
      const fechaA = typeof a.fields['Fecha Registro'] === 'string' ? new Date(a.fields['Fecha Registro']).getTime() : 0;
      const fechaB = typeof b.fields['Fecha Registro'] === 'string' ? new Date(b.fields['Fecha Registro']).getTime() : 0;
      return fechaA - fechaB;
    });

    const labels = registros.map((registro) => {
      const fecha = typeof registro.fields['Fecha Registro'] === 'string' ? new Date(registro.fields['Fecha Registro']) : new Date();
      return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    });

    return {
      labels,
      datasets: [{
        label: 'Eficiencia (KW/M³)',
        data: registros.map(r => {
          const potencia = r.fields['POTENCIA GENERADA(Kw)'] || 0;
          const biogas = r.fields['M3 DE BIOGAS (M3)'] || 1; // Evitar división por cero
          return biogas > 0 ? potencia / biogas : 0;
        }),
        borderColor: 'rgba(168, 85, 247, 1)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      }],
    };
  };

  const opcionesGraficoTemperaturas = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Temperaturas del Biofiltro',
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
          text: 'Temperatura (°C)',
          color: 'white',
        },
      },
    },
  };

  const opcionesGraficoPresiones = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Presiones del Biofiltro',
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
          text: 'Presión (cm H₂O)',
          color: 'white',
        },
      },
    },
  };

  const opcionesGraficoEstados = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Estados de Motores',
        color: 'white',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      legend: {
        display: false,
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
          callback: (tickValue: string | number) => typeof tickValue === 'number' && tickValue === 1 ? 'Encendido' : 'Apagado',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
        title: {
          display: true,
          text: 'Estado',
          color: 'white',
        },
      },
    },
  };

  const opcionesGraficoEficiencia = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Eficiencia del Motor',
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
          text: 'Eficiencia (KW/M³)',
          color: 'white',
        },
      },
    },
  };

  // Cargar datos del turno actual
  useEffect(() => {
    if (loggedInUser) {
      cargarDatosDashboard();
    }
  }, [loggedInUser, modoVista]);

  const cargarDatosDashboard = async () => {
    try {
      setCargandoDatos(true);
      setErrorDatos(null);

      if (modoVista === 'turno') {
        // Cargar datos del turno actual
        const datos = await airtableService.obtenerDatosTurnoActual();
        const motoresData = await airtableService.obtenerMotores();
        setDatosTurno(datos);
        setMotores(motoresData);
      } else {
        // Cargar todos los datos históricos
        const [
          turno,
          estadosMotores,
          monitoreoMotores,
          registrosJenbacher,
          bitacoraBiogas,
          medicionBiodigestores,
          motoresData
        ] = await Promise.all([
          airtableService.obtenerTurnoActivo(),
          airtableService.obtenerEstadosMotores(),
          airtableService.obtenerMonitoreoMotores(),
          airtableService.obtenerRegistrosDiariosJenbacher(),
          airtableService.obtenerBitacoraBiogas(),
          airtableService.obtenerMedicionesBiodigestores(),
          airtableService.obtenerMotores()
        ]);

        setDatosTurno({
          turno,
          estadosMotores,
          monitoreoMotores,
          registrosJenbacher,
          bitacoraBiogas,
          medicionBiodigestores
        });
        setMotores(motoresData);
      }
    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);
      setErrorDatos('Error al cargar los datos del dashboard');
    } finally {
      setCargandoDatos(false);
    }
  };

  if (!loggedInUser) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-xl p-8 border border-white/20">
            <h1 className="text-2xl mb-4">Acceso Requerido</h1>
            <p>Debes iniciar sesión para acceder al dashboard.</p>
          </div>
        </div>
      </BackgroundLayout>
    );
  }

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
            <h1 className="text-4xl font-bold text-white mb-4">Dashboard Principal</h1>
            <p className="text-gray-300 text-lg">
              {modoVista === 'turno' ? 'Vista general del turno actual' : 'Vista general de datos históricos'}
            </p>
            
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

              {/* Toggle para modo de vista */}
              <div className="flex items-center space-x-2">
                <span className="text-gray-300 text-sm">Vista:</span>
                <button
                  onClick={() => setModoVista('turno')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    modoVista === 'turno' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                  }`}
                >
                  Turno Actual
                </button>
                <button
                  onClick={() => setModoVista('historico')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    modoVista === 'historico' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                  }`}
                >
                  Datos Históricos
                </button>
              </div>
              
              <button
                onClick={cargarDatosDashboard}
                disabled={cargandoDatos}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors"
              >
                🔄 Recargar
              </button>
            </div>
            
            {datosTurno?.turno && (
              <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-400/30">
                <p className="text-blue-400 text-sm">
                  Turno actual: <span className="font-semibold">{datosTurno.turno.fields['Realiza Registro']}</span>
                  <span className="ml-4">
                    Inicio: {typeof datosTurno.turno.fields['Fecha Inicio'] === 'string' 
                      ? new Date(datosTurno.turno.fields['Fecha Inicio']).toLocaleString('es-CO') 
                      : 'Fecha no disponible'}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Alertas recientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-lg font-bold text-white mb-4">Alertas Recientes</h3>
              <div className="space-y-3">
                {cargandoDatos ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <span className="ml-3 text-gray-300">Cargando alertas...</span>
                  </div>
                ) : datosTurno ? (
                  <>
                    {/* Alertas basadas en motores apagados */}
                    {datosTurno.estadosMotores
                      .filter(estado => estado.fields['Estado Motor'] === 'Apagado')
                      .slice(0, 2)
                      .map((estado, index) => (
                        <div key={estado.id || index} className="flex items-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                          <div className="w-2 h-2 bg-red-400 rounded-full mr-3"></div>
                          <div>
                            <p className="text-white text-sm">Motor apagado detectado</p>
                            <p className="text-gray-400 text-xs">
                              {typeof estado.fields['Fecha y Hora'] === 'string' 
                                ? new Date(estado.fields['Fecha y Hora']).toLocaleString('es-CO')
                                : 'Fecha no disponible'}
                            </p>
                          </div>
                        </div>
                      ))}
                    
                    {/* Alertas de temperatura elevada */}
                    {datosTurno.monitoreoMotores
                      .filter(monitoreo => {
                        const temp = monitoreo.fields['Temperatura'];
                        return typeof temp === 'number' && temp > 40;
                      })
                      .slice(0, 1)
                      .map((monitoreo, index) => (
                        <div key={monitoreo.id || index} className="flex items-center p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></div>
                          <div>
                            <p className="text-white text-sm">Temperatura elevada: {monitoreo.fields['Temperatura']}°C</p>
                            <p className="text-gray-400 text-xs">
                              {typeof monitoreo.fields['Fecha Monitoreo'] === 'string'
                                ? new Date(monitoreo.fields['Fecha Monitoreo']).toLocaleString('es-CO')
                                : 'Fecha no disponible'}
                            </p>
                          </div>
                        </div>
                      ))}
                    
                    {/* Si no hay alertas específicas, mostrar mensaje positivo */}
                    {datosTurno.estadosMotores.filter(estado => estado.fields['Estado Motor'] === 'Apagado').length === 0 && 
                     datosTurno.monitoreoMotores.filter(monitoreo => {
                       const temp = monitoreo.fields['Temperatura'];
                       return typeof temp === 'number' && temp > 40;
                     }).length === 0 && (
                      <div className="flex items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                        <div>
                          <p className="text-white text-sm">Sistema funcionando normalmente</p>
                          <p className="text-gray-400 text-xs">Sin alertas activas</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                    <div className="w-2 h-2 bg-gray-400 rounded-full mr-3"></div>
                    <div>
                      <p className="text-white text-sm">No hay datos disponibles</p>
                      <p className="text-gray-400 text-xs">Verifica la conexión con Airtable</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
              <h3 className="text-lg font-bold text-white mb-4">Actividad Reciente</h3>
              <div className="space-y-3">
                {cargandoDatos ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                    <span className="ml-3 text-gray-300">Cargando actividad...</span>
                  </div>
                ) : datosTurno ? (
                  <>
                    {/* Registros Jenbacher recientes */}
                    {datosTurno.registrosJenbacher.slice(0, 2).map((registro, index) => (
                      <div key={registro.id || index} className="flex items-center p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                        <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-blue-400 text-xs font-bold">JH</span>
                        </div>
                        <div>
                          <p className="text-white text-sm">
                            Registro Jenbacher: {registro.fields['M3 DE BIOGAS (M3)'] || 0} m³
                          </p>
                          <p className="text-gray-400 text-xs">
                            {typeof registro.fields['Fecha Registro'] === 'string'
                              ? new Date(registro.fields['Fecha Registro']).toLocaleString('es-CO')
                              : 'Fecha no disponible'}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Mediciones de biodigestores recientes */}
                    {datosTurno.medicionBiodigestores.slice(0, 2).map((medicion, index) => (
                      <div key={medicion.id || index} className="flex items-center p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
                        <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-purple-400 text-xs font-bold">BD</span>
                        </div>
                        <div>
                          <p className="text-white text-sm">
                            Medición biodigestor: CH4 {medicion.fields['CH4 (Max) %'] || 0}%
                          </p>
                          <p className="text-gray-400 text-xs">
                            {typeof medicion.fields['Fecha Medicion'] === 'string'
                              ? new Date(medicion.fields['Fecha Medicion']).toLocaleString('es-CO')
                              : 'Fecha no disponible'}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Bitácora reciente */}
                    {datosTurno.bitacoraBiogas.slice(0, 1).map((bitacora, index) => (
                      <div key={bitacora.id || index} className="flex items-center p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                        <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-green-400 text-xs font-bold">BT</span>
                        </div>
                        <div>
                          <p className="text-white text-sm">Entrada en bitácora registrada</p>
                          <p className="text-gray-400 text-xs">
                            {typeof bitacora.fields['Fecha de creacion'] === 'string'
                              ? new Date(bitacora.fields['Fecha de creacion']).toLocaleString('es-CO')
                              : 'Fecha no disponible'}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Si no hay actividad reciente */}
                    {datosTurno.registrosJenbacher.length === 0 && 
                     datosTurno.medicionBiodigestores.length === 0 && 
                     datosTurno.bitacoraBiogas.length === 0 && (
                      <div className="flex items-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                        <div className="w-8 h-8 bg-gray-500/20 rounded-full flex items-center justify-center mr-3">
                          <span className="text-gray-400 text-xs font-bold">?</span>
                        </div>
                        <div>
                          <p className="text-white text-sm">Sin actividad reciente</p>
                          <p className="text-gray-400 text-xs">No hay registros en el turno actual</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center p-3 bg-gray-500/10 rounded-lg border border-gray-500/20">
                    <div className="w-8 h-8 bg-gray-500/20 rounded-full flex items-center justify-center mr-3">
                      <span className="text-gray-400 text-xs font-bold">?</span>
                    </div>
                    <div>
                      <p className="text-white text-sm">No hay datos disponibles</p>
                      <p className="text-gray-400 text-xs">Verifica la conexión con Airtable</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Gráficos Estratégicos de Componentes Químicos */}
          {datosTurno && datosTurno.registrosJenbacher.length > 0 && (
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">📈 Análisis Estratégico - Componentes Químicos {modoVista === 'historico' ? 'Históricos' : 'del Turno'}</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
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

                {/* Potencia vs Consumo de Biogás */}
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
                  <div className="h-80">
                    {prepararDatosPotenciaVsBiogas() && (
                      <Bar
                        data={prepararDatosPotenciaVsBiogas()!}
                        options={opcionesGraficoPotencia}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Tendencia de Componentes Químicos */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30 mb-8">
                <div className="h-96">
                  {prepararDatosTendenciaQuimicos() && (
                    <Line
                      data={prepararDatosTendenciaQuimicos()!}
                      options={opcionesGraficoTendencia}
                    />
                  )}
                </div>
              </div>

              {/* KPIs Estratégicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(() => {
                  const registros = datosTurno.registrosJenbacher;
                  const promedioCH4 = registros.reduce((sum, r) => sum + (r.fields['METANO(CH4)%'] || 0), 0) / registros.length;
                  const promedioPotencia = registros.reduce((sum, r) => sum + (r.fields['POTENCIA GENERADA(Kw)'] || 0), 0) / registros.length;
                  const totalBiogas = registros.reduce((sum, r) => sum + (r.fields['M3 DE BIOGAS (M3)'] || 0), 0);
                  const maxH2S = Math.max(...registros.map(r => r.fields['ACIDO SULFIDRICO(H2S)'] || 0));

                  return (
                    <>
                      <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-xl p-6 border border-green-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-green-400 text-sm font-medium">CH₄ Promedio</p>
                            <p className="text-white text-2xl font-bold">{promedioCH4.toFixed(1)}%</p>
                            <p className="text-green-300 text-xs">Meta: &gt;50%</p>
                          </div>
                          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                            <span className="text-green-400 text-xl">🟢</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-blue-400 text-sm font-medium">Potencia Promedio</p>
                            <p className="text-white text-2xl font-bold">{promedioPotencia.toFixed(0)} KW</p>
                            <p className="text-blue-300 text-xs">Eficiencia energética</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-400 text-xl">⚡</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-xl p-6 border border-purple-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-purple-400 text-sm font-medium">Biogás Total</p>
                            <p className="text-white text-2xl font-bold">{totalBiogas.toFixed(1)} M³</p>
                            <p className="text-purple-300 text-xs">Consumo turno actual</p>
                          </div>
                          <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                            <span className="text-purple-400 text-xl">⛽</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-xl p-6 border border-yellow-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-yellow-400 text-sm font-medium">H₂S Máximo</p>
                            <p className="text-white text-2xl font-bold">{maxH2S} ppm</p>
                            <p className="text-yellow-300 text-xs">Control de contaminación</p>
                          </div>
                          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                            <span className="text-yellow-400 text-xl">⚠️</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Gráficos Avanzados del Sistema */}
          {datosTurno && (datosTurno.registrosJenbacher.length > 0 || datosTurno.estadosMotores.length > 0) && (
            <div className="mt-12">
              <h2 className="text-3xl font-bold text-white mb-8 text-center">🔬 Análisis Avanzado del Sistema {modoVista === 'historico' ? 'Histórico' : 'del Turno'}</h2>

              {/* Primera fila de gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Temperaturas del Biofiltro */}
                {datosTurno.registrosJenbacher.length > 0 && (
                  <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 rounded-xl p-6 border border-red-600/30">
                    <div className="h-80">
                      {prepararDatosTemperaturasBiofiltro() && (
                        <Line
                          data={prepararDatosTemperaturasBiofiltro()!}
                          options={opcionesGraficoTemperaturas}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Presiones del Biofiltro */}
                {datosTurno.registrosJenbacher.length > 0 && (
                  <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-600/30">
                    <div className="h-80">
                      {prepararDatosPresionesBiofiltro() && (
                        <Line
                          data={prepararDatosPresionesBiofiltro()!}
                          options={opcionesGraficoPresiones}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Segunda fila de gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Estados de Motores */}
                {datosTurno.estadosMotores.length > 0 && (
                  <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-xl p-6 border border-green-600/30">
                    <div className="h-80">
                      {prepararDatosEstadosMotores() && (
                        <Line
                          data={prepararDatosEstadosMotores()!}
                          options={opcionesGraficoEstados}
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Eficiencia del Motor */}
                {datosTurno.registrosJenbacher.length > 0 && (
                  <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-xl p-6 border border-purple-600/30">
                    <div className="h-80">
                      {prepararDatosEficienciaMotor() && (
                        <Line
                          data={prepararDatosEficienciaMotor()!}
                          options={opcionesGraficoEficiencia}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* KPIs Avanzados */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(() => {
                  const registros = datosTurno.registrosJenbacher;
                  const estados = datosTurno.estadosMotores;

                  if (registros.length === 0 && estados.length === 0) return null;

                  // Cálculos para registros Jenbacher
                  const tempEntradaPromedio = registros.length > 0
                    ? registros.reduce((sum, r) => sum + (r.fields['TEMP. ENTRADA BIOFILTRO'] || 0), 0) / registros.length
                    : 0;
                  const tempSalidaPromedio = registros.length > 0
                    ? registros.reduce((sum, r) => sum + (r.fields['TEMP. SALIDA BIOFILTRO'] || 0), 0) / registros.length
                    : 0;
                  const eficienciaPromedio = registros.length > 0
                    ? registros.reduce((sum, r) => {
                        const potencia = r.fields['POTENCIA GENERADA(Kw)'] || 0;
                        const biogas = r.fields['M3 DE BIOGAS (M3)'] || 1;
                        return sum + (biogas > 0 ? potencia / biogas : 0);
                      }, 0) / registros.length
                    : 0;

                  // Cálculos para estados de motores
                  const tiempoEncendido = estados.filter(e => e.fields['Estado Motor'] === 'Encendido').length;
                  const disponibilidad = estados.length > 0 ? (tiempoEncendido / estados.length) * 100 : 0;

                  return (
                    <>
                      <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 rounded-xl p-6 border border-red-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-red-400 text-sm font-medium">ΔT Biofiltro</p>
                            <p className="text-white text-2xl font-bold">
                              {tempEntradaPromedio && tempSalidaPromedio
                                ? (tempEntradaPromedio - tempSalidaPromedio).toFixed(1)
                                : '0.0'}°C
                            </p>
                            <p className="text-red-300 text-xs">Diferencial de temperatura</p>
                          </div>
                          <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                            <span className="text-red-400 text-xl">🌡️</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-blue-400 text-sm font-medium">Eficiencia Motor</p>
                            <p className="text-white text-2xl font-bold">{eficienciaPromedio.toFixed(2)}</p>
                            <p className="text-blue-300 text-xs">KW por M³ de biogás</p>
                          </div>
                          <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                            <span className="text-blue-400 text-xl">⚙️</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-xl p-6 border border-green-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-green-400 text-sm font-medium">Disponibilidad Motor</p>
                            <p className="text-white text-2xl font-bold">{disponibilidad.toFixed(1)}%</p>
                            <p className="text-green-300 text-xs">Tiempo operativo</p>
                          </div>
                          <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                            <span className="text-green-400 text-xl">🟢</span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-xl p-6 border border-yellow-600/30">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-yellow-400 text-sm font-medium">Ciclos de Encendido</p>
                            <p className="text-white text-2xl font-bold">{tiempoEncendido}</p>
                            <p className="text-yellow-300 text-xs">Cambios de estado</p>
                          </div>
                          <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center">
                            <span className="text-yellow-400 text-xl">🔄</span>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Detalles Completos del Turno Actual */}
          {datosTurno && (
            <div className="mt-12 space-y-8">
              <h2 className="text-2xl font-bold text-white mb-6">📊 Detalles Completos {modoVista === 'historico' ? 'Históricos' : 'del Turno Actual'}</h2>

              {/* Información del Turno */}
              <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-6 border border-slate-600/30">
                <h3 className="text-xl font-bold text-white mb-4">ℹ️ Información del Turno</h3>
                {datosTurno.turno ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Turno #</p>
                      <p className="text-white font-mono text-sm">{datosTurno.turno.id ? 'Activo' : 'N/A'}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Operador</p>
                      <p className="text-white">{datosTurno.turno.fields['Realiza Registro'] || 'N/A'}</p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Fecha Inicio</p>
                      <p className="text-white">
                        {typeof datosTurno.turno.fields['Fecha Inicio'] === 'string'
                          ? new Date(datosTurno.turno.fields['Fecha Inicio']).toLocaleString('es-CO')
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Fecha Fin</p>
                      <p className="text-white">
                        {datosTurno.turno.fields['Fecha Fin']
                          ? (typeof datosTurno.turno.fields['Fecha Fin'] === 'string'
                            ? new Date(datosTurno.turno.fields['Fecha Fin']).toLocaleString('es-CO')
                            : 'N/A')
                          : 'Turno activo'}
                      </p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">ID Operador</p>
                      <p className="text-white font-mono text-sm">
                        {Array.isArray(datosTurno.turno.fields['ID_Operador'])
                          ? datosTurno.turno.fields['ID_Operador'].join(', ')
                          : datosTurno.turno.fields['ID_Operador'] || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-slate-700/30 rounded-lg p-4">
                      <p className="text-gray-400 text-sm">Nombre Operador</p>
                      <p className="text-white">
                        {Array.isArray(datosTurno.turno.fields['Nombre del Operador'])
                          ? datosTurno.turno.fields['Nombre del Operador'].join(', ')
                          : datosTurno.turno.fields['Nombre del Operador'] || 'N/A'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400">No hay información del turno disponible</p>
                )}
              </div>

              {/* Registros Jenbacher */}
              <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 rounded-xl p-6 border border-blue-600/30">
                <h3 className="text-xl font-bold text-white mb-4">🔥 Registros Jenbacher ({datosTurno.registrosJenbacher.length})</h3>
                {datosTurno.registrosJenbacher.length > 0 ? (
                  <div className="space-y-4">
                    {datosTurno.registrosJenbacher.map((registro, index) => (
                      <div key={registro.id || index} className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          <div>
                            <p className="text-gray-400 text-sm">Registro #</p>
                            <p className="text-white font-mono text-sm">{index + 1}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Fecha Registro</p>
                            <p className="text-white">
                              {typeof registro.fields['Fecha Registro'] === 'string'
                                ? new Date(registro.fields['Fecha Registro']).toLocaleString('es-CO')
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">M³ de Biogás</p>
                            <p className="text-blue-400 font-bold">{registro.fields['M3 DE BIOGAS (M3)'] || 0} m³</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Potencia Generada</p>
                            <p className="text-white">{registro.fields['POTENCIA GENERADA(Kw)'] || 'N/A'} KW</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Metano (CH4)</p>
                            <p className="text-white">{registro.fields['METANO(CH4)%'] || 'N/A'}%</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Oxígeno (O2)</p>
                            <p className="text-white">{registro.fields['OXIGENO(O2) %'] || 'N/A'}%</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">CO2</p>
                            <p className="text-white">{registro.fields['DIOXIDO DE CARBONO(CO2) %'] || 'N/A'}%</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">H2S</p>
                            <p className="text-white">{registro.fields['ACIDO SULFIDRICO(H2S)'] || 'N/A'} ppm</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Presión Entrada Biofiltro</p>
                            <p className="text-white">{registro.fields['PRESION BIOFILTRO ENTRADA (cm de h20)'] || 'N/A'} cm</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Presión Salida Biofiltro</p>
                            <p className="text-white">{registro.fields['PRESION BIOFILTRO SALIDA (cm de h2o)'] || 'N/A'} cm</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Temp. Entrada Biofiltro</p>
                            <p className="text-white">{registro.fields['TEMP. ENTRADA BIOFILTRO'] || 'N/A'}°C</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Temp. Salida Biofiltro</p>
                            <p className="text-white">{registro.fields['TEMP. SALIDA BIOFILTRO'] || 'N/A'}°C</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Realiza Registro</p>
                            <p className="text-white">{registro.fields['Realiza Registro'] || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No hay registros Jenbacher en este turno</p>
                )}
              </div>

              {/* Estados de Motores */}
              <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 rounded-xl p-6 border border-red-600/30">
                <h3 className="text-xl font-bold text-white mb-4">⚙️ Estados de Motores ({datosTurno.estadosMotores.length})</h3>
                {datosTurno.estadosMotores.length > 0 ? (
                  <div className="space-y-4">
                    {datosTurno.estadosMotores.map((estado, index) => (
                      <div key={estado.id || index} className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-gray-400 text-sm">Estado #</p>
                            <p className="text-white font-mono text-sm">{index + 1}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Fecha y Hora</p>
                            <p className="text-white">
                              {typeof estado.fields['Fecha y Hora'] === 'string'
                                ? new Date(estado.fields['Fecha y Hora']).toLocaleString('es-CO')
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Estado Motor</p>
                            <p className={`font-bold ${estado.fields['Estado Motor'] === 'Encendido' ? 'text-green-400' : 'text-red-400'}`}>
                              {estado.fields['Estado Motor'] || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Motor</p>
                            <p className="text-white">{obtenerNombreMotor(estado.fields['Motor'])}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Realiza Registro</p>
                            <p className="text-white">{estado.fields['Realiza Registro'] || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No hay estados de motores registrados en este turno</p>
                )}
              </div>

              {/* Monitoreo de Motores */}
              <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-xl p-6 border border-yellow-600/30">
                <h3 className="text-xl font-bold text-white mb-4">📊 Monitoreo de Motores ({datosTurno.monitoreoMotores.length})</h3>
                {datosTurno.monitoreoMotores.length > 0 ? (
                  <div className="space-y-4">
                    {datosTurno.monitoreoMotores.map((monitoreo, index) => (
                      <div key={monitoreo.id || index} className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                          <div>
                            <p className="text-gray-400 text-sm">Monitoreo #</p>
                            <p className="text-white font-mono text-sm">{index + 1}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Fecha Creación</p>
                            <p className="text-white">
                              {typeof monitoreo.fields['Fecha de creacion'] === 'string'
                                ? new Date(monitoreo.fields['Fecha de creacion']).toLocaleString('es-CO')
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Motor</p>
                            <p className="text-yellow-400 font-bold">
                              {obtenerNombreMotor(monitoreo.fields['Nombre Motor'])}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Horómetro Inicial</p>
                            <p className="text-white">{monitoreo.fields['Horometro Inicial'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Horómetro Final</p>
                            <p className="text-white">{monitoreo.fields['Horometro Final'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Arranques Inicial</p>
                            <p className="text-white">{monitoreo.fields['Arranques Inicio'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Arranques Final</p>
                            <p className="text-white">{monitoreo.fields['Arranques Final'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">M³ Inicial</p>
                            <p className="text-white">{monitoreo.fields['M3 de Inicio'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">M³ Final</p>
                            <p className="text-white">{monitoreo.fields['M3 de Fin'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">KW Inicial</p>
                            <p className="text-white">{monitoreo.fields['Kw de Inicio'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">KW Final</p>
                            <p className="text-white">{monitoreo.fields['Kw de Fin'] || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Realiza Registro</p>
                            <p className="text-white">{monitoreo.fields['Realiza Registro'] || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No hay monitoreo de motores registrado en este turno</p>
                )}
              </div>

              {/* Bitácora de Biogás */}
              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-xl p-6 border border-green-600/30">
                <h3 className="text-xl font-bold text-white mb-4">📝 Bitácora de Biogás ({datosTurno.bitacoraBiogas.length})</h3>
                {datosTurno.bitacoraBiogas.length > 0 ? (
                  <div className="space-y-4">
                    {datosTurno.bitacoraBiogas.map((bitacora, index) => (
                      <div key={bitacora.id || index} className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div>
                            <p className="text-gray-400 text-sm">Bitácora #</p>
                            <p className="text-white font-mono text-sm">{index + 1}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Fecha Creación</p>
                            <p className="text-white">
                              {typeof bitacora.fields['Fecha de creacion'] === 'string'
                                ? new Date(bitacora.fields['Fecha de creacion']).toLocaleString('es-CO')
                                : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-sm">Realiza Registro</p>
                            <p className="text-white">{bitacora.fields['Realiza Registro'] || 'N/A'}</p>
                          </div>
                          <div className="md:col-span-4">
                            <p className="text-gray-400 text-sm">Transcripción del Operador</p>
                            <p className="text-white bg-gray-800/50 p-2 rounded text-sm">{bitacora.fields['Transcripción Operador'] || 'Sin transcripción'}</p>
                          </div>
                          <div className="md:col-span-4">
                            <p className="text-gray-400 text-sm">Informe Ejecutivo</p>
                            <p className="text-white bg-gray-800/50 p-2 rounded text-sm">{bitacora.fields['Informe ejecutivo'] || 'Sin informe'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No hay entradas en la bitácora de biogás en este turno</p>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}