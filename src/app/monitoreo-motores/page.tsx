'use client';

import TurnoGuard, { PRIVILEGED_ROLES } from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { airtableService, Motor, EstadoMotor, MonitoreoMotor } from '@/utils/airtable';
import { evaluarDeltas, lecturasDeMonitoreo, type DeltaContador } from '@/lib/informe/contadores';
import { useState, useEffect } from 'react';

// Margen sobre el tiempo real transcurrido para el horómetro: la lectura anterior
// puede haberse digitado unos minutos después de tomarla.
const TOLERANCIA_HORAS = 0.5;

// Jenbacher 3 y 4 se ocultan temporalmente: no tienen registros de estado en
// Airtable. Para mostrarlos de nuevo, quítelos de esta lista.
const MOTORES_OCULTOS = ['Jenbacher 3', 'Jenbacher 4'];

interface MotorConEstado {
  motor: Motor;
  ultimoEstado: EstadoMotor | null;
}

interface ConfirmacionModal {
  isOpen: boolean;
  motorId: string;
  nombreMotor: string;
  nuevoEstado: 'Encendido' | 'Apagado';
  onConfirm: () => void;
  onCancel: () => void;
}

interface ProtocoloModal {
  isOpen: boolean;
  motorId: string;
  nombreMotor: string;
  onSubmit: (protocoloData: Record<string, string>) => void;
  onCancel: () => void;
}

interface MonitoreoModal {
  isOpen: boolean;
  motorId: string;
  nombreMotor: string;
  onSubmit: (datosMonitoreo: Record<string, number>) => void;
  onCancel: () => void;
  /** Lectura anterior del motor: undefined mientras carga, null si no hay. */
  ultimoRegistro?: MonitoreoMotor | null;
  /** Lectura digitada y sus deltas, pendiente de confirmar por el operador. */
  revision?: RevisionLectura | null;
}

interface RevisionLectura {
  datos: Record<string, number>;
  deltas: DeltaContador[];
  horasTranscurridas: number | null;
}

interface ResumenInicioTurno {
  fechaTurno: string;
  operador: string;
  motoresEncendidos: { nombre: string; modelo: string; serie: string }[];
  motoresApagados: { nombre: string; modelo: string; serie: string }[];
}

/** Estado del motor de un vistazo: punto hoja y "Encendido", gris y "Apagado". */
function EstadoEtiqueta({ estado }: { estado: string | undefined }) {
  if (estado === 'Encendido') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-hoja-claro border border-hoja px-3 py-1 font-semibold text-bosque-oscuro">
        <span className="w-3 h-3 rounded-full bg-hoja" aria-hidden="true" />
        Encendido
      </span>
    );
  }
  if (estado === 'Apagado') {
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-superficie-2 border border-linea-fuerte px-3 py-1 font-semibold text-tinta-suave">
        <span className="w-3 h-3 rounded-full bg-tinta-tenue" aria-hidden="true" />
        Apagado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ambar-claro border border-ambar-borde px-3 py-1 font-semibold text-ambar">
      <span className="w-3 h-3 rounded-full bg-ambar-borde" aria-hidden="true" />
      Sin estado
    </span>
  );
}

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
      <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

function Girando() {
  return <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" />;
}

/** Marco de los modales: fondo oscurecido y caja blanca con título. */
function Modal({ titulo, subtitulo, onCerrar, ancho = 'max-w-md', children }: {
  titulo: string;
  subtitulo?: React.ReactNode;
  onCerrar: () => void;
  ancho?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-tinta/40" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative bg-superficie rounded-xl border border-linea shadow-xl w-full ${ancho} max-h-[92vh] flex flex-col`}
      >
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-linea">
          <h2 className="font-condensada font-bold text-2xl text-tinta">{titulo}</h2>
          {subtitulo && <p className="text-tinta-suave mt-0.5">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MonitoreoMotoresPage() {
  const { user: loggedInUser } = useAuth();
  const [motoresConEstado, setMotoresConEstado] = useState<MotorConEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoMotor, setProcesandoMotor] = useState<string | null>(null);
  const [resumenInicioTurno, setResumenInicioTurno] = useState<ResumenInicioTurno | null>(null);
  const [mostrarBannerTurno, setMostrarBannerTurno] = useState(false);
  const [modalConfirmacion, setModalConfirmacion] = useState<ConfirmacionModal>({
    isOpen: false,
    motorId: '',
    nombreMotor: '',
    nuevoEstado: 'Apagado',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const [modalProtocolo, setModalProtocolo] = useState<ProtocoloModal>({
    isOpen: false,
    motorId: '',
    nombreMotor: '',
    onSubmit: () => {},
    onCancel: () => {}
  });

  const [modalMonitoreo, setModalMonitoreo] = useState<MonitoreoModal>({
    isOpen: false,
    motorId: '',
    nombreMotor: '',
    onSubmit: () => {},
    onCancel: () => {}
  });

  // Verificar si viene de inicio de turno
  useEffect(() => {
    const resumenGuardado = sessionStorage.getItem('resumenInicioTurno');
    if (resumenGuardado) {
      try {
        const resumen = JSON.parse(resumenGuardado);
        setResumenInicioTurno(resumen);
        setMostrarBannerTurno(true);
        // Limpiar después de mostrar
        sessionStorage.removeItem('resumenInicioTurno');
      } catch (e) {
        console.error('Error al parsear resumen de turno:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (loggedInUser) {
      cargarDatosMotores();
      // Debug: Verificar estructura de Estados Motores
      airtableService.debugEstadosMotores();
    }
  }, [loggedInUser]);

  const cargarDatosMotores = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener todos los motores
      const motores = await airtableService.obtenerMotores();
      console.log('Motores obtenidos:', motores);

      // Para cada motor, obtener su último estado
      const motoresConEstadoData: MotorConEstado[] = [];

      for (const motor of motores) {
        try {
          const ultimoEstado = await airtableService.obtenerUltimoEstadoMotor(motor.id);
          motoresConEstadoData.push({
            motor,
            ultimoEstado
          });
        } catch (error) {
          console.error(`Error al obtener estado del motor ${motor.id}:`, error);
          motoresConEstadoData.push({
            motor,
            ultimoEstado: null
          });
        }
      }

      setMotoresConEstado(motoresConEstadoData);
    } catch (error) {
      console.error('Error al cargar datos de motores:', error);
      setError('No se pudo cargar la información de los motores. Revise la conexión e intente de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const cambiarEstadoMotor = async (motorId: string, nuevoEstado: 'Encendido' | 'Apagado', nombreMotor: string) => {
    if (!loggedInUser) return;

    // Mostrar modal de confirmación
    setModalConfirmacion({
      isOpen: true,
      motorId,
      nombreMotor,
      nuevoEstado,
      onConfirm: () => ejecutarCambioEstado(motorId, nuevoEstado, nombreMotor),
      onCancel: () => setModalConfirmacion(prev => ({ ...prev, isOpen: false }))
    });
  };

  const ejecutarCambioEstado = async (motorId: string, nuevoEstado: 'Encendido' | 'Apagado', nombreMotor: string) => {
    // Cerrar modal de confirmación
    setModalConfirmacion(prev => ({ ...prev, isOpen: false }));

    // Si es encendido, mostrar formulario de protocolo primero
    if (nuevoEstado === 'Encendido') {
      setModalProtocolo({
        isOpen: true,
        motorId,
        nombreMotor,
        onSubmit: (protocoloData) => procederConEncendido(motorId, nombreMotor, protocoloData),
        onCancel: () => {
          setModalProtocolo(prev => ({ ...prev, isOpen: false }));
          setProcesandoMotor(null);
        }
      });
      return;
    }

    // Si es apagado, proceder directamente
    await cambiarEstadoDirecto(motorId, nuevoEstado, nombreMotor);
  };

  const procederConEncendido = async (motorId: string, nombreMotor: string, protocoloData: Record<string, string>) => {
    // Cerrar modal de protocolo
    setModalProtocolo(prev => ({ ...prev, isOpen: false }));

    try {
      setProcesandoMotor(motorId);

      // Crear el estado del motor junto con el protocolo de encendido
      await airtableService.crearEncendidoConProtocolo(
        motorId,
        loggedInUser!.nombre,
        protocoloData
      );

      // Mostrar mensaje de éxito con información sobre el siguiente paso
      alert(`${nombreMotor} quedó encendido.\n\nAhora registre la lectura inicial del motor: horómetro, arranques, m³ y kW.`);

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();

      // NUEVO: Abrir automáticamente el modal de registro de datos del motor
      setTimeout(() => {
        abrirModalMonitoreo(motorId, nombreMotor);
      }, 1000); // Dar tiempo para que el usuario lea el mensaje

    } catch (error) {
      console.error('Error en el proceso de encendido:', error);
      alert(`No se pudo registrar el encendido de ${nombreMotor}. Revise la conexión e intente de nuevo.`);
    } finally {
      setProcesandoMotor(null);
    }
  };

  const abrirModalMonitoreo = (motorId: string, nombreMotor: string) => {
    setModalMonitoreo({
      isOpen: true,
      motorId,
      nombreMotor,
      onSubmit: (datosMonitoreo) => registrarDatosMotor(motorId, nombreMotor, datosMonitoreo),
      onCancel: () => setModalMonitoreo(prev => ({ ...prev, isOpen: false })),
      ultimoRegistro: undefined,
      revision: null
    });

    // La lectura anterior es la apertura contra la que se valida la nueva
    airtableService.obtenerUltimoMonitoreoMotor(motorId).then((ultimoRegistro) => {
      setModalMonitoreo(prev => prev.motorId === motorId ? { ...prev, ultimoRegistro } : prev);
    });
  };

  const registrarDatosMotor = async (motorId: string, nombreMotor: string, datosMonitoreo: Record<string, number>) => {
    // Cerrar modal de monitoreo
    setModalMonitoreo(prev => ({ ...prev, isOpen: false }));

    try {
      setProcesandoMotor(motorId);

      // Usar la nueva función que actualiza el registro anterior y crea uno nuevo
      const resultado = await airtableService.registrarNuevoMonitoreo(
        motorId,
        loggedInUser!.nombre,
        datosMonitoreo as {
          'Horometro Inicial': number;
          'Arranques Inicio': number;
          'M3 de Inicio': number;
          'Kw de Inicio': number;
        }
      );

      // Mostrar mensaje de éxito detallado
      if (resultado.registroActualizado) {
        alert(`Lectura de ${nombreMotor} guardada.\n\nSe cerró la lectura anterior con estos valores y se abrió una nueva.`);
      } else {
        alert(`Primera lectura de ${nombreMotor} guardada.`);
      }

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();

    } catch (error) {
      console.error('Error al registrar datos del motor:', error);
      alert(`No se pudo guardar la lectura de ${nombreMotor}. Revise la conexión e intente de nuevo.`);
    } finally {
      setProcesandoMotor(null);
    }
  };

  const cambiarEstadoDirecto = async (motorId: string, nuevoEstado: 'Encendido' | 'Apagado', nombreMotor: string) => {
    try {
      setProcesandoMotor(motorId);

      // Crear nuevo estado en Airtable
      await airtableService.crearEstadoMotor(
        motorId,
        nuevoEstado,
        loggedInUser!.nombre
      );

      alert(`${nombreMotor} quedó ${nuevoEstado.toLowerCase()}.`);

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();

    } catch (error) {
      console.error('Error al cambiar estado del motor:', error);
      alert(`No se pudo cambiar el estado de ${nombreMotor}. Revise la conexión e intente de nuevo.`);
    } finally {
      setProcesandoMotor(null);
    }
  };

  const formatearFecha = (fechaString: string | undefined) => {
    if (!fechaString) return 'Sin fecha';
    try {
      return new Date(fechaString).toLocaleString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  // Componente Modal de Confirmación Personalizado
  const ModalConfirmacion = () => {
    if (!modalConfirmacion.isOpen) return null;

    const encender = modalConfirmacion.nuevoEstado === 'Encendido';

    return (
      <Modal
        titulo={encender ? '¿Encender el motor?' : '¿Apagar el motor?'}
        subtitulo={encender ? 'Después de confirmar se abre el protocolo de encendido.' : 'Quedará registrado el apagado a su nombre.'}
        onCerrar={modalConfirmacion.onCancel}
      >
        <div className="px-5 sm:px-6 py-5">
          <dl className="bg-superficie-2 border border-linea rounded-lg divide-y divide-linea">
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-tinta-suave">Motor</dt>
              <dd className="font-semibold text-tinta text-right">{modalConfirmacion.nombreMotor}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-tinta-suave">Acción</dt>
              <dd className="font-semibold text-tinta">{encender ? 'Encender' : 'Apagar'}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-2.5">
              <dt className="text-tinta-suave">Operador</dt>
              <dd className="font-semibold text-tinta text-right">{loggedInUser?.nombre}</dd>
            </div>
          </dl>
        </div>
        <div className="px-5 sm:px-6 py-4 border-t border-linea flex flex-col-reverse sm:flex-row gap-3">
          <button type="button" onClick={modalConfirmacion.onCancel} className={`${claseBoton('secundario', 'lg')} flex-1`}>
            Cancelar
          </button>
          <button type="button" onClick={modalConfirmacion.onConfirm} className={`${claseBoton('primario', 'lg')} flex-1`}>
            {encender ? 'Sí, encender' : 'Sí, apagar'}
          </button>
        </div>
      </Modal>
    );
  };

  // Componente Modal de Protocolo de Encendido
  const ModalProtocolo = () => {
    const {
      isRecording,
      isTranscribing,
      startRecording,
      stopRecording,
      error: recordingError
    } = useVoiceRecording();

    const initialFormData = {
      'Elementos de Protección Personal disponibles': '',
      'Elementos de Protección Personal en buen estado': '',
      'Aceite al 50% (mirilla)': '',
      'Presión refrigerante 1.5 bar': '',
      'CH4 > 50%': '',
      'O2 < 3%': '',
      'H2S < 300ppm': '',
      'Mangueras en buen estado': '',
      'Válvulas de gas abiertas': '',
      'Ventiladores encendidos': '',
      'Equipos Biofiltro funcionando': '',
      'Encendido correcto': '',
      'Planilla actualizada': '',
      'Temperatura refrigerante 80-90°C': '',
      'Presión aceite 3.5 bar': '',
      'Carga trabajo < 1000kW': '',
      'Horómetro inicial registrado': '',
      'Composición de biogás controlada': '',
      'Lavado de radiador (si aplica)': '',
      'Observaciones generales': ''
    };

    const [formData, setFormData, clearFormData] = useFormPersistence(
      `protocolo-${modalProtocolo.motorId}`,
      initialFormData
    );

    if (!modalProtocolo.isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      modalProtocolo.onSubmit(formData);
      clearFormData(); // Limpiar datos guardados después del envío exitoso
    };

    const handleChange = (field: string, value: string) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleVoiceRecording = async () => {
      if (isRecording) {
        try {
          const transcription = await stopRecording();
          const currentObservations = formData['Observaciones generales'];
          const newObservations = currentObservations
            ? `${currentObservations}\n${transcription}`
            : transcription;
          handleChange('Observaciones generales', newObservations);
        } catch (error) {
          console.error('Error al procesar grabación:', error);
        }
      } else {
        await startRecording();
      }
    };

    const protocoloGroups = [
      {
        title: 'Seguridad',
        fields: [
          { key: 'Elementos de Protección Personal disponibles', label: 'EPP disponibles' },
          { key: 'Elementos de Protección Personal en buen estado', label: 'EPP en buen estado' }
        ]
      },
      {
        title: 'Niveles',
        fields: [
          { key: 'Aceite al 50% (mirilla)', label: 'Aceite al 50 % (mirilla)' },
          { key: 'Presión refrigerante 1.5 bar', label: 'Presión del refrigerante 1,5 bar' }
        ]
      },
      {
        title: 'Gases',
        fields: [
          { key: 'CH4 > 50%', label: 'CH4 mayor a 50 %' },
          { key: 'O2 < 3%', label: 'O2 menor a 3 %' },
          { key: 'H2S < 300ppm', label: 'H2S menor a 300 ppm' }
        ]
      },
      {
        title: 'Mecánica',
        fields: [
          { key: 'Mangueras en buen estado', label: 'Mangueras en buen estado' },
          { key: 'Válvulas de gas abiertas', label: 'Válvulas de gas abiertas' },
          { key: 'Ventiladores encendidos', label: 'Ventiladores encendidos' }
        ]
      },
      {
        title: 'Equipos',
        fields: [
          { key: 'Equipos Biofiltro funcionando', label: 'Equipos del biofiltro funcionando' },
          { key: 'Encendido correcto', label: 'Secuencia de encendido correcta' },
          { key: 'Planilla actualizada', label: 'Planilla actualizada' }
        ]
      },
      {
        title: 'Operación',
        fields: [
          { key: 'Temperatura refrigerante 80-90°C', label: 'Temperatura del refrigerante 80–90 °C' },
          { key: 'Presión aceite 3.5 bar', label: 'Presión del aceite 3,5 bar' },
          { key: 'Carga trabajo < 1000kW', label: 'Carga de trabajo menor a 1000 kW' },
          { key: 'Horómetro inicial registrado', label: 'Horómetro inicial registrado' },
          { key: 'Composición de biogás controlada', label: 'Composición del biogás controlada' },
          { key: 'Lavado de radiador (si aplica)', label: 'Lavado del radiador (si aplica)' }
        ]
      }
    ];

    const totalPuntos = protocoloGroups.reduce((n, g) => n + g.fields.length, 0);
    const respondidos = protocoloGroups.reduce(
      (n, g) => n + g.fields.filter((f) => formData[f.key as keyof typeof formData] !== '').length,
      0
    );

    const opcion = (activo: boolean, tipo: 'si' | 'no') =>
      `flex-1 min-h-11 px-3 rounded-lg border-2 font-semibold transition-colors ${
        activo
          ? tipo === 'si'
            ? 'bg-bosque border-bosque text-white'
            : 'bg-rojo-claro border-rojo text-rojo'
          : 'bg-superficie border-linea-fuerte text-tinta hover:border-bosque'
      }`;

    return (
      <Modal
        titulo="Protocolo de encendido"
        subtitulo={<>Motor <span className="font-semibold text-tinta">{modalProtocolo.nombreMotor}</span>. Marque cada punto antes de encender.</>}
        onCerrar={modalProtocolo.onCancel}
        ancho="max-w-4xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            {protocoloGroups.map((group) => (
              <fieldset key={group.title} className="border-t border-linea pt-4 first:border-t-0 first:pt-0">
                <legend className="font-condensada font-bold text-lg text-tinta float-left w-full mb-3">{group.title}</legend>
                <div className="clear-both grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {group.fields.map((field) => {
                    const valorCampo = formData[field.key as keyof typeof formData];
                    return (
                      <div key={field.key}>
                        <p className="text-sm font-semibold text-tinta-suave mb-1.5">{field.label}</p>
                        <div className="flex gap-2" role="group" aria-label={field.label}>
                          <button
                            type="button"
                            aria-pressed={valorCampo === 'Sí'}
                            onClick={() => handleChange(field.key, 'Sí')}
                            className={opcion(valorCampo === 'Sí', 'si')}
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            aria-pressed={valorCampo === 'No'}
                            onClick={() => handleChange(field.key, 'No')}
                            className={opcion(valorCampo === 'No', 'no')}
                          >
                            No
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {/* Observaciones */}
            <div className="border-t border-linea pt-4">
              <label htmlFor="protocolo-observaciones" className="font-condensada font-bold text-lg text-tinta">
                Observaciones generales
              </label>
              <p className="text-sm text-tinta-suave mb-2">Escriba o toque el micrófono para dictar; lo dictado se agrega al final.</p>
              <div className="flex items-start gap-3">
                <textarea
                  id="protocolo-observaciones"
                  value={formData['Observaciones generales']}
                  onChange={(e) => handleChange('Observaciones generales', e.target.value)}
                  className={`${claseCampo} resize-none`}
                  rows={3}
                  placeholder="Novedades del encendido, si las hay"
                  disabled={isRecording || isTranscribing}
                />
                <button
                  type="button"
                  onClick={handleVoiceRecording}
                  disabled={isTranscribing}
                  aria-label={isRecording ? 'Detener y transcribir' : 'Dictar por voz'}
                  title={isRecording ? 'Detener y transcribir' : 'Dictar por voz'}
                  className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque ${
                    isRecording
                      ? 'bg-rojo hover:bg-[#912018] ring-4 ring-rojo/25 animate-pulse'
                      : isTranscribing
                        ? 'bg-ambar-borde cursor-wait'
                        : 'bg-bosque hover:bg-bosque-oscuro'
                  }`}
                >
                  {isTranscribing ? (
                    <Girando />
                  ) : isRecording ? (
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>

              {(isRecording || isTranscribing) && (
                <p role="status" className={`mt-2 text-sm font-semibold flex items-center gap-2 ${isRecording ? 'text-rojo' : 'text-ambar'}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${isRecording ? 'bg-rojo' : 'bg-ambar-borde'}`} aria-hidden="true" />
                  {isRecording ? 'Grabando. Toque el micrófono otra vez para detener.' : 'Transcribiendo el audio…'}
                </p>
              )}

              {recordingError && (
                <Aviso tono="error" className="mt-2 text-sm">{recordingError}</Aviso>
              )}
            </div>
          </div>

          <div className="px-5 sm:px-6 py-4 border-t border-linea flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-tinta-suave sm:mr-auto tabular-nums">
              Respondidos <span className="font-semibold text-tinta">{respondidos} de {totalPuntos}</span>
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={modalProtocolo.onCancel} className={claseBoton('secundario', 'lg')}>
                Cancelar
              </button>
              <button type="submit" className={claseBoton('primario', 'lg')}>
                Encender motor
              </button>
            </div>
          </div>
        </form>
      </Modal>
    );
  };

  // Componente Modal de Monitoreo de Motor
  const ModalMonitoreo = () => {
    const initialData = {
      'Horometro Inicial': '',
      'Arranques Inicio': '',
      'M3 de Inicio': '',
      'Kw de Inicio': ''
    };

    const [datosMonitoreo, setDatosMonitoreo, clearDatos] = useFormPersistence(
      `monitoreo-${modalMonitoreo.motorId}`,
      initialData
    );

    if (!modalMonitoreo.isOpen) return null;

    const { ultimoRegistro, revision } = modalMonitoreo;
    const puedeForzar = !!loggedInUser && PRIVILEGED_ROLES.includes(loggedInUser.cargo);

    const guardar = (datos: Record<string, number>) => {
      modalMonitoreo.onSubmit(datos);
      clearDatos();
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Convertir strings a números antes de enviar
      const datosNumericos = Object.entries(datosMonitoreo).reduce((acc, [key, value]) => {
        acc[key] = parseFloat(value as string) || 0;
        return acc;
      }, {} as Record<string, number>);

      // Primer registro del motor: no hay apertura contra la cual comparar
      if (!ultimoRegistro) {
        guardar(datosNumericos);
        return;
      }

      // La lectura nueva cierra el registro anterior: el delta debe ser físicamente posible
      const desde = Date.parse(ultimoRegistro.fields['Fecha de creacion']);
      const horasTranscurridas = Number.isFinite(desde) ? (Date.now() - desde) / (60 * 60 * 1000) : null;
      const deltas = evaluarDeltas(
        lecturasDeMonitoreo(ultimoRegistro.fields).inicio,
        {
          horometro: datosNumericos['Horometro Inicial'],
          arranques: datosNumericos['Arranques Inicio'],
          m3: datosNumericos['M3 de Inicio'],
          energia: datosNumericos['Kw de Inicio']
        },
        horasTranscurridas === null ? undefined : horasTranscurridas + TOLERANCIA_HORAS
      );
      setModalMonitoreo(prev => ({ ...prev, revision: { datos: datosNumericos, deltas, horasTranscurridas } }));
    };

    const handleChange = (field: string, value: string) => {
      setDatosMonitoreo(prev => ({ ...prev, [field]: value }));
    };

    // Valor anterior de cada contador, para que el operador compare al digitar.
    const anterior = ultimoRegistro ? lecturasDeMonitoreo(ultimoRegistro.fields).inicio : null;
    const campos = [
      { key: 'Horometro Inicial', label: 'Horómetro', unit: 'h', previo: anterior?.horometro },
      { key: 'Arranques Inicio', label: 'Arranques', unit: '', previo: anterior?.arranques },
      { key: 'M3 de Inicio', label: 'Gas consumido', unit: 'm³', previo: anterior?.m3 },
      { key: 'Kw de Inicio', label: 'Energía', unit: 'kW', previo: anterior?.energia }
    ];

    return (
      <Modal
        titulo="Lectura de contadores"
        subtitulo={<>Motor <span className="font-semibold text-tinta">{modalMonitoreo.nombreMotor}</span>. Digite lo que marcan ahora los contadores.</>}
        onCerrar={modalMonitoreo.onCancel}
        ancho="max-w-2xl"
      >
        {revision && ultimoRegistro ? (
          <div className="overflow-y-auto px-5 sm:px-6 py-5">
            <RevisionMonitoreo
              revision={revision}
              ultimoRegistro={ultimoRegistro}
              puedeForzar={puedeForzar}
              onCorregir={() => setModalMonitoreo(prev => ({ ...prev, revision: null }))}
              onGuardar={() => guardar(revision.datos)}
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-4">
              {ultimoRegistro !== null && (
                <p className="text-sm text-tinta-suave">Antes de guardar, la lectura se compara con la anterior para descartar errores de digitación.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {campos.map((campo) => (
                  <div key={campo.key}>
                    <label htmlFor={`lectura-${campo.key}`} className={claseEtiqueta}>
                      {campo.label}{campo.unit && ` (${campo.unit})`}
                    </label>
                    <input
                      id={`lectura-${campo.key}`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={datosMonitoreo[campo.key as keyof typeof datosMonitoreo]}
                      onChange={(e) => handleChange(campo.key, e.target.value)}
                      className={`${claseCampo} text-lg font-semibold tabular-nums`}
                      required
                    />
                    <p className="mt-1 text-sm text-tinta-suave tabular-nums">
                      {ultimoRegistro === undefined
                        ? 'Buscando lectura anterior…'
                        : campo.previo !== null && campo.previo !== undefined
                          ? `Anterior: ${campo.previo.toLocaleString('es-CO', { maximumFractionDigits: 2 })}${campo.unit ? ` ${campo.unit}` : ''}`
                          : 'Sin lectura anterior'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-linea flex flex-col-reverse sm:flex-row gap-3">
              <button type="button" onClick={modalMonitoreo.onCancel} className={`${claseBoton('secundario', 'lg')} flex-1`}>
                Cancelar
              </button>
              <button
                type="submit"
                disabled={ultimoRegistro === undefined}
                className={`${claseBoton('primario', 'lg')} flex-1 disabled:cursor-wait`}
              >
                {ultimoRegistro === undefined ? 'Cargando lectura anterior…' : ultimoRegistro ? 'Revisar lectura' : 'Guardar lectura'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    );
  };

  // Paso de confirmación del modal de monitoreo: muestra lo que se va a registrar
  // desde la lectura anterior y bloquea los deltas físicamente imposibles.
  const RevisionMonitoreo = ({ revision, ultimoRegistro, puedeForzar, onCorregir, onGuardar }: {
    revision: RevisionLectura;
    ultimoRegistro: MonitoreoMotor;
    puedeForzar: boolean;
    onCorregir: () => void;
    onGuardar: () => void;
  }) => {
    const anterior = lecturasDeMonitoreo(ultimoRegistro.fields).inicio;
    const valorAnterior: Record<DeltaContador['etiqueta'], number | null> = {
      'energía': anterior.energia,
      'm³': anterior.m3,
      'horómetro': anterior.horometro,
      'arranques': anterior.arranques
    };
    const conProblema = revision.deltas.filter(d => d.problema);
    const bloqueado = conProblema.length > 0;
    const fmt = (n: number | null, decimales = 1) =>
      n === null ? '—' : n.toLocaleString('es-CO', { maximumFractionDigits: decimales });
    const fechaAnterior = new Date(ultimoRegistro.fields['Fecha de creacion']).toLocaleString('es-CO', {
      timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short'
    });

    return (
      <div className="space-y-5">
        <Aviso
          tono={bloqueado ? 'error' : 'info'}
          titulo={bloqueado ? 'Revise la lectura antes de guardar' : 'Confirme lo que va a registrar'}
        >
          Diferencia desde la lectura anterior ({fechaAnterior}
          {ultimoRegistro.fields['Realiza Registro'] ? `, ${ultimoRegistro.fields['Realiza Registro']}` : ''}
          {revision.horasTranscurridas !== null ? `, hace ${fmt(revision.horasTranscurridas)} h` : ''}):
        </Aviso>

        <ul className="border border-linea rounded-lg divide-y divide-linea overflow-hidden">
          {revision.deltas.map(d => (
            <li key={d.etiqueta} className={`px-4 py-3 ${d.problema ? 'bg-rojo-claro' : 'bg-superficie'}`}>
              <div className="flex justify-between items-baseline gap-4">
                <span className={`first-letter:uppercase ${d.problema ? 'text-rojo font-semibold' : 'text-tinta-suave'}`}>{d.etiqueta}</span>
                <span className={`font-condensada font-bold text-xl tabular-nums ${d.problema ? 'text-rojo' : 'text-tinta'}`}>
                  {fmt(d.valor, d.etiqueta === 'arranques' ? 0 : 2)} {d.unidad}
                </span>
              </div>
              {d.problema === 'negativo' && (
                <p className="text-sm text-rojo mt-1">
                  El contador no puede retroceder: la lectura anterior fue {fmt(valorAnterior[d.etiqueta], 2)}.
                </p>
              )}
              {d.problema === 'excesivo' && (
                <p className="text-sm text-rojo mt-1">
                  Supera el máximo posible ({fmt(d.maximo)} {d.unidad}) para el tiempo transcurrido.
                  La lectura anterior fue {fmt(valorAnterior[d.etiqueta], 2)}.
                </p>
              )}
            </li>
          ))}
        </ul>

        {bloqueado && (
          <p className="text-sm text-tinta-suave">
            Si el contador se cambió o la lectura anterior quedó mal digitada, avise a la jefatura de planta.
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <button type="button" onClick={onCorregir} className={`${claseBoton('secundario', 'lg')} flex-1`}>
            Corregir
          </button>
          {!bloqueado && (
            <button type="button" onClick={onGuardar} className={`${claseBoton('primario', 'lg')} flex-1`}>
              Confirmar y guardar
            </button>
          )}
          {bloqueado && puedeForzar && (
            <button
              type="button"
              onClick={onGuardar}
              className={`${claseBoton('secundario', 'lg')} flex-1 text-rojo border-rojo-borde hover:bg-rojo-claro`}
            >
              Guardar de todas formas
            </button>
          )}
        </div>
      </div>
    );
  };

  if (!loggedInUser) {
    return (
      <TurnoGuard>
        <Pagina>
          <Panel titulo="Inicie sesión" descripcion="Para ver y operar los motores necesita iniciar sesión." className="max-w-md mx-auto">
            <button type="button" onClick={() => window.location.href = '/'} className={`${claseBoton('primario', 'lg')} w-full`}>
              Ir a iniciar sesión
            </button>
          </Panel>
        </Pagina>
      </TurnoGuard>
    );
  }

  const encabezado = (
    <EncabezadoPagina
      titulo="Monitoreo de motores"
      descripcion="Estado de cada motor Jenbacher, encendido y apagado con su protocolo, y lectura de contadores."
    >
      <span>
        Operador: <span className="font-semibold text-tinta">{loggedInUser.nombre}</span>
      </span>
    </EncabezadoPagina>
  );

  if (loading) {
    return (
      <TurnoGuard>
        <Pagina>
          {encabezado}
          <Cargando texto="Cargando el estado de los motores…" />
        </Pagina>
      </TurnoGuard>
    );
  }

  const motoresVisibles = motoresConEstado.filter(
    (m) => !MOTORES_OCULTOS.includes(m.motor.fields['Nombre Motor'])
  );
  const encendidos = motoresVisibles.filter((m) => m.ultimoEstado?.fields['Estado Motor'] === 'Encendido');
  const apagados = motoresVisibles.filter((m) => m.ultimoEstado?.fields['Estado Motor'] === 'Apagado');
  const sinEstado = motoresVisibles.filter((m) => !m.ultimoEstado);
  const ultimoCambio = motoresVisibles
    .filter((m) => m.ultimoEstado?.fields['Fecha y Hora'])
    .sort(
      (a, b) =>
        new Date(b.ultimoEstado!.fields['Fecha y Hora']).getTime() - new Date(a.ultimoEstado!.fields['Fecha y Hora']).getTime()
    )[0];

  const indicadores: Indicador[] = [
    {
      etiqueta: 'Encendidos',
      valor: encendidos.length,
      unidad: `de ${motoresVisibles.length}`,
      detalle: encendidos.length > 0 ? encendidos.map((m) => m.motor.fields['Nombre Motor']).join(', ') : 'Ningún motor en marcha',
      tono: motoresVisibles.length > 0 && encendidos.length === 0 ? 'alerta' : 'neutro'
    },
    {
      etiqueta: 'Apagados',
      valor: apagados.length,
      detalle: apagados.length > 0 ? apagados.map((m) => m.motor.fields['Nombre Motor']).join(', ') : 'Ninguno'
    },
    {
      etiqueta: 'Último cambio de estado',
      valor: ultimoCambio
        ? new Date(ultimoCambio.ultimoEstado!.fields['Fecha y Hora']).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
        : '—',
      detalle: ultimoCambio
        ? `${ultimoCambio.motor.fields['Nombre Motor']} ${ultimoCambio.ultimoEstado!.fields['Estado Motor'].toLowerCase()}, ${new Date(
            ultimoCambio.ultimoEstado!.fields['Fecha y Hora']
          ).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}${
            ultimoCambio.ultimoEstado!.fields['Realiza Registro'] ? ` · ${ultimoCambio.ultimoEstado!.fields['Realiza Registro']}` : ''
          }`
        : 'Sin registros de estado'
    }
  ];
  if (sinEstado.length > 0) {
    indicadores.push({
      etiqueta: 'Sin estado registrado',
      valor: sinEstado.length,
      detalle: sinEstado.map((m) => m.motor.fields['Nombre Motor']).join(', '),
      tono: 'alerta'
    });
  }

  return (
    <TurnoGuard>
      <Pagina>
        {encabezado}

        {/* Resumen al recibir el turno */}
        {mostrarBannerTurno && resumenInicioTurno && (
          <Panel
            titulo="Turno recibido"
            descripcion={`Estado de los motores al recibir el turno, ${new Date(resumenInicioTurno.fechaTurno).toLocaleString('es-CO', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}.`}
            acciones={
              <button type="button" onClick={() => setMostrarBannerTurno(false)} className={claseBoton('sutil', 'sm')}>
                Ocultar
              </button>
            }
            className="border-l-4 border-l-hoja"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                ['Encendidos', resumenInicioTurno.motoresEncendidos, 'bg-hoja'],
                ['Apagados', resumenInicioTurno.motoresApagados, 'bg-tinta-tenue']
              ] as const).map(([titulo, lista, punto]) => (
                <div key={titulo} className="bg-superficie-2 border border-linea rounded-lg p-4">
                  <p className="flex items-center gap-2 font-semibold text-tinta">
                    <span className={`w-2.5 h-2.5 rounded-full ${punto}`} aria-hidden="true" />
                    {titulo} ({lista.length})
                  </p>
                  {lista.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-tinta">
                      {lista.map((m, i) => (
                        <li key={i}>
                          {m.nombre} <span className="text-tinta-suave">· {m.modelo}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-tinta-suave">Ninguno</p>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        )}

        {error ? (
          <Aviso tono="error" titulo="No se pudieron cargar los motores">
            <p>{error}</p>
            <button type="button" onClick={cargarDatosMotores} className={`${claseBoton('secundario', 'sm')} mt-3`}>
              Reintentar
            </button>
          </Aviso>
        ) : (
          motoresVisibles.length > 0 && <Indicadores items={indicadores} />
        )}

        {/* Estado detallado de cada motor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {motoresVisibles.map((motorData, index) => {
            const { motor, ultimoEstado } = motorData;
            const estado = ultimoEstado?.fields['Estado Motor'];
            const nombre = motor.fields['Nombre Motor'] || `Motor ${index + 1}`;
            const procesando = procesandoMotor === motor.id;
            const franja =
              estado === 'Encendido' ? 'border-l-hoja' : estado === 'Apagado' ? 'border-l-linea-fuerte' : 'border-l-ambar-borde';

            return (
              <section
                key={motor.id}
                aria-label={`${nombre}: ${estado ?? 'sin estado'}`}
                className={`bg-superficie border border-linea border-l-4 ${franja} rounded-xl p-4 sm:p-6 flex flex-col`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-condensada font-bold text-2xl text-tinta leading-tight">{nombre}</h2>
                  <EstadoEtiqueta estado={estado} />
                </div>

                {ultimoEstado ? (
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <dt className="text-sm text-tinta-suave">{estado === 'Encendido' ? 'Encendido desde' : estado === 'Apagado' ? 'Apagado desde' : 'Último cambio'}</dt>
                      <dd className="font-semibold text-tinta tabular-nums">{formatearFecha(ultimoEstado.fields['Fecha y Hora'])}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-tinta-suave">Registró</dt>
                      <dd className="font-semibold text-tinta">{ultimoEstado.fields['Realiza Registro'] || 'No especificado'}</dd>
                    </div>
                    {ultimoEstado.fields['Observaciones'] && (
                      <div className="col-span-2">
                        <dt className="text-sm text-tinta-suave">Observaciones</dt>
                        <dd className="text-tinta">{String(ultimoEstado.fields['Observaciones'])}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <Aviso tono="alerta" className="mt-4">
                    Este motor no tiene estados registrados. Encienda o apague el motor para dejar el primero.
                  </Aviso>
                )}

                <div className="mt-auto pt-5">
                  <div className="border-t border-linea pt-4 flex flex-col sm:flex-row gap-3">
                    {estado === 'Encendido' && (
                      <button
                        type="button"
                        onClick={() => abrirModalMonitoreo(motor.id, nombre)}
                        disabled={procesando}
                        className={`${claseBoton('primario', 'lg')} flex-1`}
                      >
                        {procesando ? <><Girando /> Procesando…</> : 'Registrar lectura'}
                      </button>
                    )}
                    {estado !== 'Encendido' && (
                      <button
                        type="button"
                        onClick={() => cambiarEstadoMotor(motor.id, 'Encendido', nombre)}
                        disabled={procesando}
                        className={`${claseBoton(estado === 'Apagado' ? 'primario' : 'secundario', 'lg')} flex-1`}
                      >
                        {procesando ? <><Girando /> Procesando…</> : 'Encender motor'}
                      </button>
                    )}
                    {estado !== 'Apagado' && (
                      <button
                        type="button"
                        onClick={() => cambiarEstadoMotor(motor.id, 'Apagado', nombre)}
                        disabled={procesando}
                        className={`${claseBoton('secundario', 'lg')} flex-1`}
                      >
                        {procesando ? <><Girando /> Procesando…</> : 'Apagar motor'}
                      </button>
                    )}
                  </div>
                  {estado !== 'Encendido' && (
                    <p className="mt-2 text-sm text-tinta-suave">La lectura de contadores se registra con el motor encendido.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Sin motores */}
        {motoresConEstado.length === 0 && !loading && !error && (
          <Panel titulo="No hay motores registrados" descripcion="No se encontraron motores en Airtable.">
            <button type="button" onClick={cargarDatosMotores} className={claseBoton('secundario')}>
              Volver a cargar
            </button>
          </Panel>
        )}

        {/* Modal de Confirmación */}
        <ModalConfirmacion />

        {/* Modal de Protocolo */}
        <ModalProtocolo />

        {/* Modal de Monitoreo */}
        <ModalMonitoreo />
      </Pagina>
    </TurnoGuard>
  );
}
