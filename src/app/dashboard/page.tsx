'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
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

// Tipos para las tabs del dashboard
type TabType = 'resumen' | 'graficos' | 'detalles';

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
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
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

  // Función para obtener el último estado de cada motor único
  const obtenerUltimosEstadosPorMotor = () => {
    if (!datosTurno || datosTurno.estadosMotores.length === 0) return [];
    
    // Agrupar estados por motor ID
    const estadosPorMotor = new Map<string, EstadoMotor>();
    
    // Ordenar por fecha descendente para obtener los más recientes primero
    const estadosOrdenados = [...datosTurno.estadosMotores].sort((a, b) => {
      const fechaA = new Date(a.fields['Fecha y Hora']).getTime();
      const fechaB = new Date(b.fields['Fecha y Hora']).getTime();
      return fechaB - fechaA; // Más reciente primero
    });
    
    // Guardar solo el primer (más reciente) estado de cada motor
    estadosOrdenados.forEach(estado => {
      const motorId = Array.isArray(estado.fields['Motor']) 
        ? estado.fields['Motor'][0] 
        : estado.fields['Motor'];
      
      if (motorId && !estadosPorMotor.has(motorId)) {
        estadosPorMotor.set(motorId, estado);
      }
    });
    
    return Array.from(estadosPorMotor.values());
  };

  // Funciones para preparar datos de gráficos
  const obtenerDatosH2S = () => {
    if (!datosTurno || datosTurno.registrosJenbacher.length === 0) return null;
    const registros = datosTurno.registrosJenbacher;
    const ultimoRegistro = registros[registros.length - 1];
    const h2s = ultimoRegistro.fields['ACIDO SULFIDRICO(H2S)'] || 0;
    const maxH2S = Math.max(...registros.map(r => r.fields['ACIDO SULFIDRICO(H2S)'] || 0));
    const promedioH2S = registros.reduce((sum, r) => sum + (r.fields['ACIDO SULFIDRICO(H2S)'] || 0), 0) / registros.length;
    return { actual: h2s, maximo: maxH2S, promedio: promedioH2S };
  };

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
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 max-w-md w-full">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold mb-3">Acceso Requerido</h1>
            <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder al dashboard.</p>
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
        <div className="max-w-7xl mx-auto py-6 sm:py-8 lg:py-12">
          {/* Header del Dashboard Mejorado */}
          <div className="mb-6 sm:mb-8">
            {/* Título y estado */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 sm:w-7 sm:h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Dashboard</h1>
                  <p className="text-gray-400 text-sm sm:text-base">
                    {modoVista === 'turno' ? 'Turno actual' : 'Datos históricos'}
                  </p>
                </div>
              </div>
              
              {/* Controles del header */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                {/* Estado de carga */}
                {cargandoDatos && (
                  <div className="flex items-center text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-400 border-t-transparent mr-2"></div>
                    <span className="text-xs sm:text-sm">Cargando...</span>
                  </div>
                )}
                
                {/* Toggle de vista mejorado */}
                <div className="flex items-center bg-slate-800/50 rounded-xl p-1 border border-slate-600/30">
                  <button
                    onClick={() => setModoVista('turno')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all duration-300 ${
                      modoVista === 'turno' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="hidden sm:inline">Turno </span>Actual
                  </button>
                  <button
                    onClick={() => setModoVista('historico')}
                    className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-all duration-300 ${
                      modoVista === 'historico' 
                        ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                    }`}
                  >
                    Histórico
                  </button>
                </div>
                
                {/* Botón recargar mejorado */}
                <button
                  onClick={cargarDatosDashboard}
                  disabled={cargandoDatos}
                  className="p-2 sm:px-4 sm:py-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-xl transition-all duration-300 shadow-lg disabled:shadow-none flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${cargandoDatos ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline text-sm font-medium">Recargar</span>
                </button>
              </div>
            </div>
            
            {/* Error de carga */}
            {errorDatos && (
              <div className="mb-4 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
                <div className="w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-red-400 text-sm">{errorDatos}</p>
              </div>
            )}
            
            {/* Info del turno actual mejorada */}
            {datosTurno?.turno && (
              <div className="p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-400/20 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-white font-medium text-sm sm:text-base">Turno Activo</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-gray-300">{datosTurno.turno.fields['Realiza Registro']}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-300">
                      {typeof datosTurno.turno.fields['Fecha Inicio'] === 'string' 
                        ? new Date(datosTurno.turno.fields['Fecha Inicio']).toLocaleString('es-CO', { 
                            dateStyle: 'short', 
                            timeStyle: 'short' 
                          }) 
                        : 'Fecha no disponible'}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Tabs de navegación */}
            <div className="mt-6 flex overflow-x-auto scrollbar-hide gap-1 sm:gap-2 bg-slate-800/30 p-1.5 rounded-xl border border-slate-600/20">
              <button
                onClick={() => setActiveTab('resumen')}
                className={`flex-1 min-w-[100px] px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'resumen'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>Resumen</span>
              </button>
              <button
                onClick={() => setActiveTab('graficos')}
                className={`flex-1 min-w-[100px] px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'graficos'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                <span>Gráficos</span>
              </button>
              <button
                onClick={() => setActiveTab('detalles')}
                className={`flex-1 min-w-[100px] px-4 py-2.5 sm:py-3 text-sm sm:text-base font-medium rounded-lg transition-all duration-300 flex items-center justify-center gap-2 ${
                  activeTab === 'detalles'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Detalles</span>
              </button>
            </div>
          </div>

          {/* Contenido por Tab - Resumen */}
          {activeTab === 'resumen' && (
            <>
          {/* Panel de Estado de Motores - Nuevo */}
          {datosTurno && (() => {
            // Obtener solo el último estado de cada motor único
            const ultimosEstados = obtenerUltimosEstadosPorMotor();
            const encendidos = ultimosEstados.filter(e => e.fields['Estado Motor'] === 'Encendido').length;
            const apagados = ultimosEstados.filter(e => e.fields['Estado Motor'] === 'Apagado').length;
            const totalMotores = ultimosEstados.length;
            const operatividad = totalMotores > 0 ? Math.round((encendidos / totalMotores) * 100) : 0;
            
            return (
            <div className="mb-6 bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  Estado de Motores en Tiempo Real
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    apagados === 0
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {apagados === 0
                      ? '✓ Todos Operativos'
                      : `⚠ ${apagados} Motor(es) Apagado(s)`
                    }
                  </span>
                </div>
              </div>
              
              {/* Resumen de motores */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-4 border border-green-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-400 text-xs font-medium uppercase tracking-wider">Encendidos</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {encendidos}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-4 border border-red-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-400 text-xs font-medium uppercase tracking-wider">Apagados</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {apagados}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-4 border border-blue-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-400 text-xs font-medium uppercase tracking-wider">Total Motores</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {totalMotores}
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-400 text-xs font-medium uppercase tracking-wider">Operatividad</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {operatividad}%
                      </p>
                    </div>
                    <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Lista detallada de motores */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ultimosEstados.map((estado, index) => {
                  const motorId = estado.fields['Motor'];
                  const nombreMotor = Array.isArray(motorId) && motorId.length > 0 
                    ? obtenerNombreMotor(motorId[0])
                    : typeof motorId === 'string' 
                      ? obtenerNombreMotor(motorId)
                      : `Motor ${index + 1}`;
                  const estaEncendido = estado.fields['Estado Motor'] === 'Encendido';
                  
                  return (
                    <div 
                      key={estado.id || index}
                      className={`flex items-center p-3 rounded-xl border transition-all duration-300 hover:scale-[1.02] ${
                        estaEncendido 
                          ? 'bg-green-500/5 border-green-500/20 hover:bg-green-500/10' 
                          : 'bg-red-500/5 border-red-500/20 hover:bg-red-500/10'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                        estaEncendido ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          estaEncendido ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                        }`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${estaEncendido ? 'text-green-300' : 'text-red-300'}`}>
                          {nombreMotor}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {estaEncendido ? 'En funcionamiento' : 'Fuera de servicio'}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        estaEncendido 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {estaEncendido ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })()}
          
          {/* Panel de Valores de Biogás en Tiempo Real */}
          {datosTurno && datosTurno.registrosJenbacher.length > 0 && (
            <div className="mb-6 bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    </svg>
                  </div>
                  Valores de Biogás - Último Registro Jenbacher
                </h3>
                <span className="text-xs text-gray-400 bg-slate-700/50 px-3 py-1 rounded-full">
                  {typeof datosTurno.registrosJenbacher[0]?.fields['Fecha Registro'] === 'string'
                    ? new Date(datosTurno.registrosJenbacher[0].fields['Fecha Registro']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                    : 'Fecha no disponible'}
                </span>
              </div>
              
              {(() => {
                const ultimoRegistro = datosTurno.registrosJenbacher[0];
                const ch4 = Number(ultimoRegistro?.fields['METANO(CH4)%']) || 0;
                const o2 = Number(ultimoRegistro?.fields['OXIGENO(O2) %']) || 0;
                const co2 = Number(ultimoRegistro?.fields['DIOXIDO DE CARBONO(CO2) %']) || 0;
                const h2s = Number(ultimoRegistro?.fields['ACIDO SULFIDRICO(H2S)']) || 0;
                const potencia = Number(ultimoRegistro?.fields['POTENCIA GENERADA(Kw)']) || 0;
                const m3Biogas = Number(ultimoRegistro?.fields['M3 DE BIOGAS (M3)']) || 0;
                const presion = Number(ultimoRegistro?.fields['PRESION DE BIOGAS(mbar)']) || 0;
                const horasMotor = Number(ultimoRegistro?.fields['HORAS MOTOR']) || 0;
                
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                    <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 rounded-xl p-4 border border-emerald-500/20 text-center">
                      <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">CH₄ (Metano)</p>
                      <p className="text-2xl font-bold text-white">{ch4.toFixed(1)}<span className="text-sm text-emerald-300">%</span></p>
                      <div className="mt-2 h-1 bg-emerald-900/50 rounded-full">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(ch4, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-blue-500/15 to-blue-600/5 rounded-xl p-4 border border-blue-500/20 text-center">
                      <p className="text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">O₂ (Oxígeno)</p>
                      <p className="text-2xl font-bold text-white">{o2.toFixed(2)}<span className="text-sm text-blue-300">%</span></p>
                      <div className="mt-2 h-1 bg-blue-900/50 rounded-full">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(o2 * 5, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-red-500/15 to-red-600/5 rounded-xl p-4 border border-red-500/20 text-center">
                      <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">CO₂</p>
                      <p className="text-2xl font-bold text-white">{co2.toFixed(1)}<span className="text-sm text-red-300">%</span></p>
                      <div className="mt-2 h-1 bg-red-900/50 rounded-full">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(co2, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-amber-500/15 to-amber-600/5 rounded-xl p-4 border border-amber-500/20 text-center">
                      <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">H₂S</p>
                      <p className="text-2xl font-bold text-white">{h2s}<span className="text-sm text-amber-300">ppm</span></p>
                      <div className="mt-2 h-1 bg-amber-900/50 rounded-full">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(h2s / 20 * 100, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-500/15 to-purple-600/5 rounded-xl p-4 border border-purple-500/20 text-center">
                      <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Potencia</p>
                      <p className="text-2xl font-bold text-white">{potencia}<span className="text-sm text-purple-300">KW</span></p>
                      <div className="mt-2 h-1 bg-purple-900/50 rounded-full">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(potencia / 10, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 rounded-xl p-4 border border-cyan-500/20 text-center">
                      <p className="text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">Biogás</p>
                      <p className="text-2xl font-bold text-white">{m3Biogas.toFixed(1)}<span className="text-sm text-cyan-300">M³</span></p>
                      <div className="mt-2 h-1 bg-cyan-900/50 rounded-full">
                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${Math.min(m3Biogas / 5 * 100, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-pink-500/15 to-pink-600/5 rounded-xl p-4 border border-pink-500/20 text-center">
                      <p className="text-pink-400 text-xs font-bold uppercase tracking-wider mb-1">Presión</p>
                      <p className="text-2xl font-bold text-white">{presion}<span className="text-sm text-pink-300">mbar</span></p>
                      <div className="mt-2 h-1 bg-pink-900/50 rounded-full">
                        <div className="h-full bg-pink-500 rounded-full" style={{ width: `${Math.min(presion / 2, 100)}%` }}></div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-indigo-500/15 to-indigo-600/5 rounded-xl p-4 border border-indigo-500/20 text-center">
                      <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Hrs Motor</p>
                      <p className="text-2xl font-bold text-white">{horasMotor.toLocaleString()}<span className="text-sm text-indigo-300">h</span></p>
                      <div className="mt-2 h-1 bg-indigo-900/50 rounded-full">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Alertas recientes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  Alertas del Sistema
                </h3>
                <span className="text-xs bg-slate-700/50 text-gray-300 px-2 py-1 rounded-full">
                  {datosTurno ? obtenerUltimosEstadosPorMotor().filter(e => e.fields['Estado Motor'] === 'Apagado').length : 0} alertas activas
                </span>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {cargandoDatos ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
                    <span className="ml-3 text-gray-300 text-sm">Cargando alertas...</span>
                  </div>
                ) : datosTurno ? (
                  <>
                    {/* Alertas basadas en motores apagados - MEJORADO CON NOMBRE ESPECÍFICO */}
                    {obtenerUltimosEstadosPorMotor()
                      .filter(estado => estado.fields['Estado Motor'] === 'Apagado')
                      .map((estado, index) => {
                        const motorId = estado.fields['Motor'];
                        const nombreMotor = Array.isArray(motorId) && motorId.length > 0 
                          ? obtenerNombreMotor(motorId[0])
                          : typeof motorId === 'string' 
                            ? obtenerNombreMotor(motorId)
                            : `Motor ${index + 1}`;
                        
                        return (
                          <div key={estado.id || index} className="flex items-center p-3 bg-red-500/10 rounded-xl border border-red-500/20 hover:bg-red-500/15 transition-colors">
                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-red-300 text-sm font-bold truncate">
                                🔴 {nombreMotor} - APAGADO
                              </p>
                              <p className="text-gray-400 text-xs">
                                Motor fuera de operación desde {typeof estado.fields['Fecha y Hora'] === 'string' 
                                  ? new Date(estado.fields['Fecha y Hora']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                  : 'fecha no disponible'}
                              </p>
                            </div>
                            <span className="px-2 py-1 bg-red-500/30 text-red-300 text-xs font-bold rounded-lg">CRÍTICO</span>
                          </div>
                        );
                      })}
                    
                    {/* Alertas de temperatura elevada - MEJORADO */}
                    {datosTurno.monitoreoMotores
                      .filter(monitoreo => {
                        const temp = monitoreo.fields['Temperatura'];
                        return typeof temp === 'number' && temp > 40;
                      })
                      .slice(0, 2)
                      .map((monitoreo, index) => {
                        const motorId = monitoreo.fields['Motor'];
                        const nombreMotor = Array.isArray(motorId) && motorId.length > 0 
                          ? obtenerNombreMotor(motorId[0])
                          : typeof motorId === 'string' 
                            ? obtenerNombreMotor(motorId)
                            : `Motor ${index + 1}`;
                        const temp = monitoreo.fields['Temperatura'];
                        
                        return (
                          <div key={monitoreo.id || index} className="flex items-center p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 hover:bg-yellow-500/15 transition-colors">
                            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-yellow-300 text-sm font-bold truncate">
                                ⚠️ {nombreMotor} - Temperatura: {temp}°C
                              </p>
                              <p className="text-gray-400 text-xs">
                                Temperatura por encima del umbral normal (40°C) - {typeof monitoreo.fields['Fecha Monitoreo'] === 'string'
                                  ? new Date(monitoreo.fields['Fecha Monitoreo']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                  : 'Fecha no disponible'}
                              </p>
                            </div>
                            <span className="px-2 py-1 bg-yellow-500/30 text-yellow-300 text-xs font-bold rounded-lg">ALERTA</span>
                          </div>
                        );
                      })}
                    
                    {/* Si no hay alertas específicas, mostrar mensaje positivo */}
                    {obtenerUltimosEstadosPorMotor().filter(estado => estado.fields['Estado Motor'] === 'Apagado').length === 0 && 
                     datosTurno.monitoreoMotores.filter(monitoreo => {
                       const temp = monitoreo.fields['Temperatura'];
                       return typeof temp === 'number' && temp > 40;
                     }).length === 0 && (
                      <div className="flex items-center p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                        <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-green-300 text-sm font-bold">✓ Sistema Operativo al 100%</p>
                          <p className="text-gray-400 text-xs">Todos los motores funcionando correctamente - Sin alertas activas</p>
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

            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  Últimos Registros
                </h3>
                <span className="text-xs bg-slate-700/50 text-gray-300 px-2 py-1 rounded-full">
                  {datosTurno 
                    ? datosTurno.registrosJenbacher.length + datosTurno.medicionBiodigestores.length + datosTurno.bitacoraBiogas.length
                    : 0} registros
                </span>
              </div>
              <div className="space-y-2 sm:space-y-3">
                {cargandoDatos ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-400 border-t-transparent"></div>
                    <span className="ml-3 text-gray-300 text-sm">Cargando actividad...</span>
                  </div>
                ) : datosTurno ? (
                  <>
                    {/* Registros Jenbacher recientes - MEJORADO */}
                    {datosTurno.registrosJenbacher.slice(0, 2).map((registro, index) => {
                      const m3 = registro.fields['M3 DE BIOGAS (M3)'] || 0;
                      const potencia = registro.fields['POTENCIA GENERADA(Kw)'] || 0;
                      const ch4 = registro.fields['METANO(CH4)%'] || 0;
                      
                      return (
                        <div key={registro.id || index} className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 hover:bg-blue-500/15 transition-colors">
                          <div className="flex items-center mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-3 shadow-lg flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-blue-300 text-sm font-bold truncate">
                                Registro Jenbacher #{datosTurno.registrosJenbacher.length - index}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {typeof registro.fields['Fecha Registro'] === 'string'
                                  ? new Date(registro.fields['Fecha Registro']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                  : 'Fecha no disponible'}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="text-center bg-blue-500/10 rounded-lg py-1">
                              <p className="text-xs text-blue-300 font-bold">{typeof m3 === 'number' ? m3.toFixed(1) : m3} M³</p>
                              <p className="text-[10px] text-gray-500">Biogás</p>
                            </div>
                            <div className="text-center bg-purple-500/10 rounded-lg py-1">
                              <p className="text-xs text-purple-300 font-bold">{potencia} KW</p>
                              <p className="text-[10px] text-gray-500">Potencia</p>
                            </div>
                            <div className="text-center bg-emerald-500/10 rounded-lg py-1">
                              <p className="text-xs text-emerald-300 font-bold">{typeof ch4 === 'number' ? ch4.toFixed(1) : ch4}%</p>
                              <p className="text-[10px] text-gray-500">CH₄</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Mediciones de biodigestores recientes - MEJORADO */}
                    {datosTurno.medicionBiodigestores.slice(0, 1).map((medicion, index) => {
                      const ch4Max = medicion.fields['CH4 (Max) %'] || 0;
                      const co2Max = medicion.fields['CO2 (Max) %'] || 0;
                      const h2sMax = medicion.fields['H2S (Max) ppm'] || 0;
                      
                      return (
                        <div key={medicion.id || index} className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 hover:bg-purple-500/15 transition-colors">
                          <div className="flex items-center mb-2">
                            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg flex-shrink-0">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-purple-300 text-sm font-bold truncate">
                                Medición Biodigestor
                              </p>
                              <p className="text-gray-400 text-xs">
                                {typeof medicion.fields['Fecha Medicion'] === 'string'
                                  ? new Date(medicion.fields['Fecha Medicion']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                                  : 'Fecha no disponible'}
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="text-center bg-emerald-500/10 rounded-lg py-1">
                              <p className="text-xs text-emerald-300 font-bold">{ch4Max}%</p>
                              <p className="text-[10px] text-gray-500">CH₄ Max</p>
                            </div>
                            <div className="text-center bg-red-500/10 rounded-lg py-1">
                              <p className="text-xs text-red-300 font-bold">{co2Max}%</p>
                              <p className="text-[10px] text-gray-500">CO₂ Max</p>
                            </div>
                            <div className="text-center bg-amber-500/10 rounded-lg py-1">
                              <p className="text-xs text-amber-300 font-bold">{h2sMax} ppm</p>
                              <p className="text-[10px] text-gray-500">H₂S Max</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Bitácora reciente - MEJORADO */}
                    {datosTurno.bitacoraBiogas.slice(0, 1).map((bitacora, index) => (
                      <div key={bitacora.id || index} className="flex items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors">
                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center mr-3 shadow-lg flex-shrink-0">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-emerald-300 text-sm font-bold truncate">📝 Nueva entrada en Bitácora</p>
                          <p className="text-gray-400 text-xs">
                            Registrado: {typeof bitacora.fields['Fecha de creacion'] === 'string'
                              ? new Date(bitacora.fields['Fecha de creacion']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                              : 'Fecha no disponible'}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-lg">NUEVO</span>
                      </div>
                    ))}
                    
                    {/* Si no hay actividad reciente */}
                    {datosTurno.registrosJenbacher.length === 0 && 
                     datosTurno.medicionBiodigestores.length === 0 && 
                     datosTurno.bitacoraBiogas.length === 0 && (
                      <div className="flex items-center p-4 bg-slate-500/10 rounded-xl border border-slate-500/20">
                        <div className="w-10 h-10 bg-slate-600 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-white text-sm font-bold">Sin registros en este período</p>
                          <p className="text-gray-400 text-xs">Aún no hay actividad registrada en el turno actual</p>
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
                  <div className="h-64">
                    {prepararDatosComposicionGas() && (
                      <Doughnut
                        data={prepararDatosComposicionGas()!}
                        options={opcionesGraficoComposicion}
                      />
                    )}
                  </div>
                  {/* Indicador de H2S */}
                  {obtenerDatosH2S() && (
                    <div className="mt-4 p-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-xl border border-amber-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-amber-400 font-semibold text-sm flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                          H₂S (Ácido Sulfhídrico)
                        </span>
                        <span className={`text-lg font-bold ${obtenerDatosH2S()!.actual > 300 ? 'text-red-400' : obtenerDatosH2S()!.actual > 200 ? 'text-amber-400' : 'text-green-400'}`}>
                          {obtenerDatosH2S()!.actual.toFixed(0)} ppm
                        </span>
                      </div>
                      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${obtenerDatosH2S()!.actual > 300 ? 'bg-gradient-to-r from-red-500 to-red-400' : obtenerDatosH2S()!.actual > 200 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-green-500 to-emerald-400'}`}
                          style={{ width: `${Math.min((obtenerDatosH2S()!.actual / 500) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>0 ppm</span>
                        <span className="text-amber-400">Límite: 300 ppm</span>
                        <span>500 ppm</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                          <p className="text-slate-400 text-xs">Promedio</p>
                          <p className="text-amber-300 font-semibold">{obtenerDatosH2S()!.promedio.toFixed(1)} ppm</p>
                        </div>
                        <div className="text-center p-2 bg-slate-800/50 rounded-lg">
                          <p className="text-slate-400 text-xs">Máximo</p>
                          <p className="text-amber-300 font-semibold">{obtenerDatosH2S()!.maximo.toFixed(0)} ppm</p>
                        </div>
                      </div>
                    </div>
                  )}
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

              {/* KPIs Estratégicos Mejorados */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {(() => {
                  const registros = datosTurno.registrosJenbacher;
                  const promedioCH4 = registros.reduce((sum, r) => sum + (r.fields['METANO(CH4)%'] || 0), 0) / registros.length;
                  const promedioPotencia = registros.reduce((sum, r) => sum + (r.fields['POTENCIA GENERADA(Kw)'] || 0), 0) / registros.length;
                  const totalBiogas = registros.reduce((sum, r) => sum + (r.fields['M3 DE BIOGAS (M3)'] || 0), 0);
                  const maxH2S = Math.max(...registros.map(r => r.fields['ACIDO SULFIDRICO(H2S)'] || 0));

                  return (
                    <>
                      <div className="group bg-gradient-to-br from-emerald-900/30 to-emerald-800/20 rounded-2xl p-4 sm:p-6 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-emerald-400 text-xs sm:text-sm font-medium mb-1">CH₄ Promedio</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{promedioCH4.toFixed(1)}<span className="text-lg">%</span></p>
                            <p className="text-emerald-300/70 text-[10px] sm:text-xs mt-1">Meta: &gt;50%</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-emerald-900/50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(promedioCH4 * 2, 100)}%` }}></div>
                        </div>
                      </div>

                      <div className="group bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-2xl p-4 sm:p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-blue-400 text-xs sm:text-sm font-medium mb-1">Potencia Prom.</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{promedioPotencia.toFixed(0)}<span className="text-lg ml-1">KW</span></p>
                            <p className="text-blue-300/70 text-[10px] sm:text-xs mt-1">Eficiencia energética</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(promedioPotencia / 10, 100)}%` }}></div>
                        </div>
                      </div>

                      <div className="group bg-gradient-to-br from-purple-900/30 to-purple-800/20 rounded-2xl p-4 sm:p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-purple-400 text-xs sm:text-sm font-medium mb-1">Biogás Total</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{totalBiogas.toFixed(1)}<span className="text-lg ml-1">M³</span></p>
                            <p className="text-purple-300/70 text-[10px] sm:text-xs mt-1">Consumo turno</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-purple-900/50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-violet-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(totalBiogas / 5, 100)}%` }}></div>
                        </div>
                      </div>

                      <div className="group bg-gradient-to-br from-amber-900/30 to-amber-800/20 rounded-2xl p-4 sm:p-6 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-amber-400 text-xs sm:text-sm font-medium mb-1">H₂S Máximo</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{maxH2S}<span className="text-lg ml-1">ppm</span></p>
                            <p className="text-amber-300/70 text-[10px] sm:text-xs mt-1">Control contaminación</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-amber-900/50 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(maxH2S / 20, 100)}%` }}></div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          </>
          )}

          {/* Tab Gráficos */}
          {activeTab === 'graficos' && (
            <>
          {/* Gráficos Estratégicos de Componentes Químicos */}
          {datosTurno && datosTurno.registrosJenbacher.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-6 sm:mb-8 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                Análisis Químico {modoVista === 'historico' ? 'Histórico' : 'del Turno'}
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
                {/* Composición del Gas */}
                <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
                  <div className="h-52 sm:h-64">
                    {prepararDatosComposicionGas() && (
                      <Doughnut
                        data={prepararDatosComposicionGas()!}
                        options={opcionesGraficoComposicion}
                      />
                    )}
                  </div>
                  {/* Indicador de H2S */}
                  {obtenerDatosH2S() && (
                    <div className="mt-4 p-3 sm:p-4 bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-xl border border-amber-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-amber-400 font-semibold text-xs sm:text-sm flex items-center gap-2">
                          <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500"></span>
                          H₂S (Ácido Sulfhídrico)
                        </span>
                        <span className={`text-base sm:text-lg font-bold ${obtenerDatosH2S()!.actual > 300 ? 'text-red-400' : obtenerDatosH2S()!.actual > 200 ? 'text-amber-400' : 'text-green-400'}`}>
                          {obtenerDatosH2S()!.actual.toFixed(0)} ppm
                        </span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${obtenerDatosH2S()!.actual > 300 ? 'bg-gradient-to-r from-red-500 to-red-400' : obtenerDatosH2S()!.actual > 200 ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-gradient-to-r from-green-500 to-emerald-400'}`}
                          style={{ width: `${Math.min((obtenerDatosH2S()!.actual / 500) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-[10px] sm:text-xs text-slate-400 mt-1">
                        <span>0 ppm</span>
                        <span className="text-amber-400">Límite: 300 ppm</span>
                        <span>500 ppm</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 sm:mt-3">
                        <div className="text-center p-1.5 sm:p-2 bg-slate-800/50 rounded-lg">
                          <p className="text-slate-400 text-[10px] sm:text-xs">Promedio</p>
                          <p className="text-amber-300 font-semibold text-sm sm:text-base">{obtenerDatosH2S()!.promedio.toFixed(1)} ppm</p>
                        </div>
                        <div className="text-center p-1.5 sm:p-2 bg-slate-800/50 rounded-lg">
                          <p className="text-slate-400 text-[10px] sm:text-xs">Máximo</p>
                          <p className="text-amber-300 font-semibold text-sm sm:text-base">{obtenerDatosH2S()!.maximo.toFixed(0)} ppm</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Potencia vs Consumo de Biogás */}
                <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
                  <div className="h-64 sm:h-80">
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
              <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl mb-6 sm:mb-8">
                <div className="h-72 sm:h-96">
                  {prepararDatosTendenciaQuimicos() && (
                    <Line
                      data={prepararDatosTendenciaQuimicos()!}
                      options={opcionesGraficoTendencia}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Gráficos Avanzados del Sistema */}
          {datosTurno && (datosTurno.registrosJenbacher.length > 0 || datosTurno.estadosMotores.length > 0) && (
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-6 sm:mb-8 flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                Análisis del Sistema {modoVista === 'historico' ? 'Histórico' : 'del Turno'}
              </h2>

              {/* Primera fila de gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
                {/* Temperaturas del Biofiltro */}
                {datosTurno.registrosJenbacher.length > 0 && (
                  <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-red-500/20 shadow-xl">
                    <div className="h-64 sm:h-80">
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
                  <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-blue-500/20 shadow-xl">
                    <div className="h-64 sm:h-80">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
                {/* Estados de Motores */}
                {datosTurno.estadosMotores.length > 0 && (
                  <div className="bg-gradient-to-br from-emerald-900/20 to-emerald-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-emerald-500/20 shadow-xl">
                    <div className="h-64 sm:h-80">
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
                  <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-purple-500/20 shadow-xl">
                    <div className="h-64 sm:h-80">
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

              {/* KPIs Avanzados Mejorados */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {(() => {
                  const registros = datosTurno.registrosJenbacher;
                  const estados = datosTurno.estadosMotores;

                  if (registros.length === 0 && estados.length === 0) return null;

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
                  const tiempoEncendido = estados.filter(e => e.fields['Estado Motor'] === 'Encendido').length;
                  const disponibilidad = estados.length > 0 ? (tiempoEncendido / estados.length) * 100 : 0;

                  return (
                    <>
                      <div className="group bg-gradient-to-br from-rose-900/30 to-rose-800/20 rounded-2xl p-4 sm:p-6 border border-rose-500/20 hover:border-rose-500/40 transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-rose-400 text-xs sm:text-sm font-medium mb-1">ΔT Biofiltro</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">
                              {(tempEntradaPromedio - tempSalidaPromedio).toFixed(1)}<span className="text-lg">°C</span>
                            </p>
                            <p className="text-rose-300/70 text-[10px] sm:text-xs mt-1">Diferencial temp.</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-rose-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="group bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 rounded-2xl p-4 sm:p-6 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-cyan-400 text-xs sm:text-sm font-medium mb-1">Eficiencia</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{eficienciaPromedio.toFixed(2)}</p>
                            <p className="text-cyan-300/70 text-[10px] sm:text-xs mt-1">KW por M³</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="group bg-gradient-to-br from-lime-900/30 to-lime-800/20 rounded-2xl p-4 sm:p-6 border border-lime-500/20 hover:border-lime-500/40 transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-lime-400 text-xs sm:text-sm font-medium mb-1">Disponibilidad</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{disponibilidad.toFixed(1)}<span className="text-lg">%</span></p>
                            <p className="text-lime-300/70 text-[10px] sm:text-xs mt-1">Tiempo operativo</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-lime-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="group bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-2xl p-4 sm:p-6 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-orange-400 text-xs sm:text-sm font-medium mb-1">Ciclos</p>
                            <p className="text-white text-xl sm:text-2xl lg:text-3xl font-bold">{tiempoEncendido}</p>
                            <p className="text-orange-300/70 text-[10px] sm:text-xs mt-1">Encendidos</p>
                          </div>
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
          </>
          )}

          {/* Tab Detalles */}
          {activeTab === 'detalles' && datosTurno && (
            <>
          {/* Detalles Completos del Turno Actual */}
          <div className="space-y-6 sm:space-y-8">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
              Detalles {modoVista === 'historico' ? 'Históricos' : 'del Turno Actual'}
            </h2>

            {/* Información del Turno */}
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-slate-600/30 shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                Información del Turno
              </h3>
              {datosTurno.turno ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                  <div className="bg-slate-700/30 rounded-xl p-3 sm:p-4">
                    <p className="text-gray-400 text-xs sm:text-sm">Estado</p>
                    <p className="text-white font-medium text-sm sm:text-base flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      Activo
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3 sm:p-4">
                    <p className="text-gray-400 text-xs sm:text-sm">Operador</p>
                    <p className="text-white font-medium text-sm sm:text-base truncate">{datosTurno.turno.fields['Realiza Registro'] || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
                    <p className="text-gray-400 text-xs sm:text-sm">Fecha Inicio</p>
                    <p className="text-white font-medium text-sm sm:text-base">
                      {typeof datosTurno.turno.fields['Fecha Inicio'] === 'string'
                        ? new Date(datosTurno.turno.fields['Fecha Inicio']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3 sm:p-4 col-span-2 sm:col-span-1">
                    <p className="text-gray-400 text-xs sm:text-sm">Fecha Fin</p>
                    <p className="text-white font-medium text-sm sm:text-base">
                      {datosTurno.turno.fields['Fecha Fin']
                        ? (typeof datosTurno.turno.fields['Fecha Fin'] === 'string'
                          ? new Date(datosTurno.turno.fields['Fecha Fin']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                          : 'N/A')
                        : 'En curso'}
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3 sm:p-4">
                    <p className="text-gray-400 text-xs sm:text-sm">ID</p>
                    <p className="text-white font-mono text-xs sm:text-sm truncate">
                      {Array.isArray(datosTurno.turno.fields['ID_Operador'])
                        ? String(datosTurno.turno.fields['ID_Operador'][0] || '').slice(0, 8)
                        : String(datosTurno.turno.fields['ID_Operador'] || 'N/A').slice(0, 8)}...
                    </p>
                  </div>
                  <div className="bg-slate-700/30 rounded-xl p-3 sm:p-4">
                    <p className="text-gray-400 text-xs sm:text-sm">Nombre</p>
                    <p className="text-white font-medium text-sm sm:text-base truncate">
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

            {/* Registros Jenbacher - Tabla Responsive */}
            <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-blue-500/20 shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  Registros Jenbacher
                </div>
                <span className="text-sm bg-blue-500/20 px-3 py-1 rounded-full text-blue-400">{datosTurno.registrosJenbacher.length}</span>
              </h3>
              {datosTurno.registrosJenbacher.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b border-blue-500/20">
                        <th className="text-left text-gray-400 font-medium py-3 px-2">#</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">Fecha</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">Biogás (m³)</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">Potencia</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">CH₄</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">O₂</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">CO₂</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">H₂S</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosTurno.registrosJenbacher.map((registro, index) => (
                        <tr key={registro.id || index} className="border-b border-blue-500/10 hover:bg-blue-500/5 transition-colors">
                          <td className="py-3 px-2 text-white font-mono">{index + 1}</td>
                          <td className="py-3 px-2 text-gray-300">
                            {typeof registro.fields['Fecha Registro'] === 'string'
                              ? new Date(registro.fields['Fecha Registro']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                              : 'N/A'}
                          </td>
                          <td className="py-3 px-2 text-blue-400 font-semibold">{registro.fields['M3 DE BIOGAS (M3)'] || 0}</td>
                          <td className="py-3 px-2 text-white">{registro.fields['POTENCIA GENERADA(Kw)'] || 'N/A'} KW</td>
                          <td className="py-3 px-2 text-emerald-400">{registro.fields['METANO(CH4)%'] || 'N/A'}%</td>
                          <td className="py-3 px-2 text-gray-300">{registro.fields['OXIGENO(O2) %'] || 'N/A'}%</td>
                          <td className="py-3 px-2 text-gray-300">{registro.fields['DIOXIDO DE CARBONO(CO2) %'] || 'N/A'}%</td>
                          <td className="py-3 px-2 text-amber-400">{registro.fields['ACIDO SULFIDRICO(H2S)'] || 'N/A'} ppm</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No hay registros Jenbacher en este turno</p>
              )}
            </div>

            {/* Estados de Motores - Cards Compactas */}
            <div className="bg-gradient-to-br from-red-900/20 to-rose-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-red-500/20 shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  Estados de Motores (Actual)
                </div>
                <span className="text-sm bg-red-500/20 px-3 py-1 rounded-full text-red-400">{obtenerUltimosEstadosPorMotor().length}</span>
              </h3>
              {obtenerUltimosEstadosPorMotor().length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {obtenerUltimosEstadosPorMotor().map((estado, index) => {
                    const motorId = estado.fields['Motor'];
                    const nombreMotor = Array.isArray(motorId) && motorId.length > 0 
                      ? obtenerNombreMotor(motorId[0])
                      : typeof motorId === 'string' 
                        ? obtenerNombreMotor(motorId)
                        : `Motor ${index + 1}`;
                    
                    return (
                    <div key={estado.id || index} className="bg-red-500/10 rounded-xl p-3 sm:p-4 border border-red-500/10 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${estado.fields['Estado Motor'] === 'Encendido' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                        <div className={`w-3 h-3 rounded-full ${estado.fields['Estado Motor'] === 'Encendido' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${estado.fields['Estado Motor'] === 'Encendido' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {nombreMotor}
                        </p>
                        <p className="text-gray-400 text-xs truncate">
                          {estado.fields['Estado Motor']} - {typeof estado.fields['Fecha y Hora'] === 'string'
                            ? new Date(estado.fields['Fecha y Hora']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                            : 'N/A'}
                        </p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No hay estados de motores registrados</p>
              )}
            </div>

            {/* Monitoreo de Motores - Tabla Responsive */}
            <div className="bg-gradient-to-br from-amber-900/20 to-yellow-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-amber-500/20 shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  Monitoreo de Motores
                </div>
                <span className="text-sm bg-amber-500/20 px-3 py-1 rounded-full text-amber-400">{datosTurno.monitoreoMotores.length}</span>
              </h3>
              {datosTurno.monitoreoMotores.length > 0 ? (
                <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-amber-500/20">
                        <th className="text-left text-gray-400 font-medium py-3 px-2">#</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">Fecha</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">Motor</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">Horómetro</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">M³</th>
                        <th className="text-left text-gray-400 font-medium py-3 px-2">KW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datosTurno.monitoreoMotores.map((monitoreo, index) => (
                        <tr key={monitoreo.id || index} className="border-b border-amber-500/10 hover:bg-amber-500/5 transition-colors">
                          <td className="py-3 px-2 text-white font-mono">{index + 1}</td>
                          <td className="py-3 px-2 text-gray-300">
                            {typeof monitoreo.fields['Fecha de creacion'] === 'string'
                              ? new Date(monitoreo.fields['Fecha de creacion']).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
                              : 'N/A'}
                          </td>
                          <td className="py-3 px-2 text-amber-400 font-medium">{obtenerNombreMotor(monitoreo.fields['Nombre Motor'])}</td>
                          <td className="py-3 px-2 text-white">{monitoreo.fields['Horometro Inicial'] || 0} → {monitoreo.fields['Horometro Final'] || 0}</td>
                          <td className="py-3 px-2 text-white">{monitoreo.fields['M3 de Inicio'] || 0} → {monitoreo.fields['M3 de Fin'] || 0}</td>
                          <td className="py-3 px-2 text-white">{monitoreo.fields['Kw de Inicio'] || 0} → {monitoreo.fields['Kw de Fin'] || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No hay monitoreo de motores registrado</p>
              )}
            </div>

            {/* Bitácora de Biogás */}
            <div className="bg-gradient-to-br from-emerald-900/20 to-green-800/20 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-emerald-500/20 shadow-xl">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  Bitácora de Biogás
                </div>
                <span className="text-sm bg-emerald-500/20 px-3 py-1 rounded-full text-emerald-400">{datosTurno.bitacoraBiogas.length}</span>
              </h3>
              {datosTurno.bitacoraBiogas.length > 0 ? (
                <div className="space-y-3">
                  {datosTurno.bitacoraBiogas.map((bitacora, index) => (
                    <div key={bitacora.id || index} className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/10">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                        <span className="text-emerald-400 font-mono text-sm">#{index + 1}</span>
                        <span className="text-gray-400 text-sm">
                          {typeof bitacora.fields['Fecha de creacion'] === 'string'
                            ? new Date(bitacora.fields['Fecha de creacion']).toLocaleString('es-CO')
                            : 'N/A'}
                        </span>
                        <span className="text-white text-sm">{bitacora.fields['Realiza Registro'] || 'N/A'}</span>
                      </div>
                      {bitacora.fields['Transcripción Operador'] && (
                        <div className="mb-2">
                          <p className="text-gray-400 text-xs mb-1">Transcripción:</p>
                          <p className="text-gray-300 text-sm bg-slate-800/50 p-2 rounded-lg">{bitacora.fields['Transcripción Operador']}</p>
                        </div>
                      )}
                      {bitacora.fields['Informe ejecutivo'] && (
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Informe:</p>
                          <p className="text-white text-sm bg-slate-800/50 p-2 rounded-lg">{bitacora.fields['Informe ejecutivo']}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center py-4">No hay entradas en la bitácora</p>
              )}
            </div>
          </div>
          </>
          )}
        </div>
      </main>

        <Footer />
      </div>
    </BackgroundLayout>
  );
}