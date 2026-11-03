'use client';

import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Aviso from '@/components/ui/Aviso';
import { claseBoton } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { airtableService, EstadoMotor, Motor } from '@/utils/airtable';
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
  Filler,
} from 'chart.js';
import { type DatosTablero, type ModoVista, fechaCorta } from './formato';
import { indicadoresTablero, registroMasReciente } from './indicadores';
import PestanaResumen from './PestanaResumen';
import PestanaGraficas from './PestanaGraficas';
import PestanaDetalle from './PestanaDetalle';

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
  ArcElement,
  Filler
);

// Tipos para las tabs del dashboard
type TabType = 'resumen' | 'graficos' | 'detalles';

const PESTANAS: [TabType, string][] = [
  ['resumen', 'Resumen'],
  ['graficos', 'Gráficas'],
  ['detalles', 'Detalle']
];

const MODOS: [ModoVista, string][] = [
  ['turno', 'Turno actual'],
  ['historico', 'Histórico']
];

function claseSegmento(activo: boolean): string {
  return `min-h-11 px-4 py-2 rounded-md font-semibold transition-colors ${
    activo ? 'bg-bosque text-white' : 'text-tinta-suave hover:text-tinta hover:bg-superficie-2'
  }`;
}

export default function DashboardPage() {
  const { user: loggedInUser } = useAuth();

  // Estado para datos del dashboard
  const [datosTurno, setDatosTurno] = useState<DatosTablero | null>(null);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [errorDatos, setErrorDatos] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('resumen');
  const [motores, setMotores] = useState<Motor[]>([]);
  const [modoVista, setModoVista] = useState<ModoVista>('historico'); // Cambiado a 'historico' por defecto

  // Función helper para obtener nombre del motor
  const obtenerNombreMotor = (motorId: string | string[]): string => {
    if (Array.isArray(motorId)) {
      return motorId.map(id => {
        const motor = motores.find(m => m.id === id);
        return motor ? [motor.fields['Nombre Motor'], motor.fields['Modelo Motor'], motor.fields['Número Serie']].filter(Boolean).join(' ') : id;
      }).join(', ');
    }
    const motor = motores.find(m => m.id === motorId);
    return motor ? [motor.fields['Nombre Motor'], motor.fields['Modelo Motor'], motor.fields['Número Serie']].filter(Boolean).join(' ') : motorId;
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
      setErrorDatos('No se pudieron traer los datos de Airtable. Revise la conexión a internet y toque «Actualizar».');
    } finally {
      setCargandoDatos(false);
    }
  };

  if (!loggedInUser) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center px-4">
        <div className="bg-superficie border border-linea rounded-xl p-6 sm:p-8 max-w-md w-full text-center">
          <h1 className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">Inicie sesión para ver el tablero</h1>
          <p className="mt-2 text-tinta-suave">El tablero general solo está disponible para el personal de la planta.</p>
          <button onClick={() => window.location.href = '/'} className={`${claseBoton('primario', 'lg')} w-full mt-6`}>
            Ir a iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const ultimosEstados = obtenerUltimosEstadosPorMotor();
  const ultimoJenbacher = datosTurno ? registroMasReciente(datosTurno.registrosJenbacher) : null;

  return (
    <Pagina ancho="amplio">
      <EncabezadoPagina
        titulo="Tablero general"
        descripcion={
          modoVista === 'turno'
            ? 'Motores, calidad del biogás y registros del turno abierto.'
            : 'Motores, calidad del biogás y los registros más recientes de la planta.'
        }
        acciones={
          <>
            <div className="inline-flex p-1 bg-superficie border border-linea rounded-lg" role="group" aria-label="Período">
              {MODOS.map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={modoVista === valor}
                  onClick={() => setModoVista(valor)}
                  className={claseSegmento(modoVista === valor)}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <button type="button" onClick={cargarDatosDashboard} disabled={cargandoDatos} className={`${claseBoton('secundario')} min-h-11`}>
              <svg className={`w-5 h-5 ${cargandoDatos ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {cargandoDatos ? 'Actualizando…' : 'Actualizar'}
            </button>
          </>
        }
      >
        {datosTurno && (
          <>
            <span className="inline-flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${datosTurno.turno ? 'bg-hoja' : 'bg-ambar-borde'}`} aria-hidden="true" />
              {datosTurno.turno ? (
                <span>
                  En turno: <span className="font-semibold text-tinta">{datosTurno.turno.fields['Realiza Registro']}</span>
                  {' '}desde {fechaCorta(datosTurno.turno.fields['Fecha Inicio'], 'hora desconocida')}
                </span>
              ) : (
                'Sin turno abierto'
              )}
            </span>
            {ultimoJenbacher && (
              <span>
                Último registro Jenbacher:{' '}
                <span className="font-semibold text-tinta">{fechaCorta(ultimoJenbacher.fields['Fecha Registro'])}</span>
              </span>
            )}
          </>
        )}
      </EncabezadoPagina>

      {datosTurno && <Indicadores items={indicadoresTablero(datosTurno, ultimosEstados, motores)} />}

      {errorDatos && <Aviso tono="error" titulo="No se pudo cargar el tablero">{errorDatos}</Aviso>}

      <div className="inline-flex max-w-full overflow-x-auto p-1 bg-superficie border border-linea rounded-lg" role="tablist" aria-label="Vista">
        {PESTANAS.map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={activeTab === valor}
            onClick={() => setActiveTab(valor)}
            className={claseSegmento(activeTab === valor)}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {cargandoDatos && !datosTurno ? (
        <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
          <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
          Cargando los datos de la planta…
        </div>
      ) : (
        <>
          {activeTab === 'resumen' && (
            <PestanaResumen
              datosTurno={datosTurno}
              cargandoDatos={cargandoDatos}
              ultimosEstados={ultimosEstados}
              obtenerNombreMotor={obtenerNombreMotor}
            />
          )}
          {activeTab === 'graficos' && <PestanaGraficas datosTurno={datosTurno} />}
          {activeTab === 'detalles' && datosTurno && (
            <PestanaDetalle datosTurno={datosTurno} ultimosEstados={ultimosEstados} obtenerNombreMotor={obtenerNombreMotor} />
          )}
        </>
      )}
    </Pagina>
  );
}
