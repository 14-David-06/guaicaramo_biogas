'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard, { PRIVILEGED_ROLES } from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { airtableService, Motor, EstadoMotor, MonitoreoMotor } from '@/utils/airtable';
import { evaluarDeltas, lecturasDeMonitoreo, type DeltaContador } from '@/lib/informe/contadores';
import { useState, useEffect } from 'react';

// Margen sobre el tiempo real transcurrido para el horómetro: la lectura anterior
// puede haberse digitado unos minutos después de tomarla.
const TOLERANCIA_HORAS = 0.5;

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

export default function MonitoreoMotoresPage() {
  const { user: loggedInUser, logout } = useAuth();
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
      setError('Error al cargar la información de los motores');
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
      alert(`✅ ${nombreMotor} encendido exitosamente\n\n📊 A continuación debes registrar los datos iniciales del motor (Horómetro, Arranques, M³, kW)`);

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();

      // NUEVO: Abrir automáticamente el modal de registro de datos del motor
      setTimeout(() => {
        abrirModalMonitoreo(motorId, nombreMotor);
      }, 1000); // Dar tiempo para que el usuario lea el mensaje
      
    } catch (error) {
      console.error('Error en el proceso de encendido:', error);
      alert(`❌ Error en el proceso de encendido. Intenta nuevamente.`);
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
        alert(`✅ ${nombreMotor} - Datos registrados exitosamente:\n• Registro anterior actualizado con valores finales\n• Nuevo registro creado con valores iniciales`);
      } else {
        alert(`✅ ${nombreMotor} - Primer registro de monitoreo creado exitosamente`);
      }

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();
      
    } catch (error) {
      console.error('Error al registrar datos del motor:', error);
      alert(`❌ Error al registrar datos del motor. Intenta nuevamente.`);
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

      // Mostrar mensaje de éxito (también lo haré personalizado)
      alert(`✅ ${nombreMotor} ${nuevoEstado.toLowerCase()} exitosamente`);

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();
      
    } catch (error) {
      console.error('Error al cambiar estado del motor:', error);
      alert(`❌ Error al cambiar el estado del motor. Intenta nuevamente.`);
    } finally {
      setProcesandoMotor(null);
    }
  };

  const getEstadoColor = (estado: string | undefined) => {
    switch (estado) {
      case 'Encendido': return { bg: 'bg-green-500', text: 'text-green-400', dot: 'bg-green-400' };
      case 'Apagado': return { bg: 'bg-red-500', text: 'text-red-400', dot: 'bg-red-400' };
      default: return { bg: 'bg-gray-500', text: 'text-gray-400', dot: 'bg-gray-400' };
    }
  };

  const formatearFecha = (fechaString: string | undefined) => {
    if (!fechaString) return 'Sin fecha';
    try {
      return new Date(fechaString).toLocaleString('es-ES', {
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

    const accion = modalConfirmacion.nuevoEstado === 'Encendido' ? 'ENCENDER' : 'APAGAR';
    const emoji = modalConfirmacion.nuevoEstado === 'Encendido' ? '▶️' : '⏹️';
    const colorBoton = modalConfirmacion.nuevoEstado === 'Encendido' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={modalConfirmacion.onCancel}
        />
        
        {/* Modal */}
        <div className="relative bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-lg rounded-2xl p-8 border border-slate-600/50 shadow-2xl max-w-md w-full mx-4 transform transition-all">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">{emoji}</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Confirmar Acción
            </h3>
            <p className="text-gray-300">
              ¿Está seguro que desea {accion.toLowerCase()} este motor?
            </p>
          </div>

          {/* Información del Motor */}
          <div className="bg-gray-800/30 rounded-lg p-4 mb-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Motor:</span>
                <span className="text-white font-medium">{modalConfirmacion.nombreMotor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Acción:</span>
                <span className={`font-bold ${modalConfirmacion.nuevoEstado === 'Encendido' ? 'text-green-400' : 'text-red-400'}`}>
                  {accion}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Operador:</span>
                <span className="text-white font-medium">{loggedInUser?.nombre}</span>
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex space-x-4">
            <button
              onClick={modalConfirmacion.onCancel}
              className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105"
            >
              Cancelar
            </button>
            <button
              onClick={modalConfirmacion.onConfirm}
              className={`flex-1 px-6 py-3 ${colorBoton} text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2`}
            >
              <span>{emoji}</span>
              <span>Confirmar</span>
            </button>
          </div>
        </div>
      </div>
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
        title: "🛡️ Seguridad",
        fields: [
          { key: 'Elementos de Protección Personal disponibles', label: 'EPP disponibles' },
          { key: 'Elementos de Protección Personal en buen estado', label: 'EPP en buen estado' }
        ]
      },
      {
        title: "🔧 Niveles",
        fields: [
          { key: 'Aceite al 50% (mirilla)', label: 'Aceite al 50%' },
          { key: 'Presión refrigerante 1.5 bar', label: 'Presión refrigerante 1.5 bar' }
        ]
      },
      {
        title: "🌬️ Gases", 
        fields: [
          { key: 'CH4 > 50%', label: 'CH4 > 50%' },
          { key: 'O2 < 3%', label: 'O2 < 3%' },
          { key: 'H2S < 300ppm', label: 'H2S < 300ppm' }
        ]
      },
      {
        title: "🔩 Mecánica",
        fields: [
          { key: 'Mangueras en buen estado', label: 'Mangueras OK' },
          { key: 'Válvulas de gas abiertas', label: 'Válvulas abiertas' },
          { key: 'Ventiladores encendidos', label: 'Ventiladores OK' }
        ]
      },
      {
        title: "⚙️ Equipos",
        fields: [
          { key: 'Equipos Biofiltro funcionando', label: 'Biofiltro OK' },
          { key: 'Encendido correcto', label: 'Secuencia encendido' },
          { key: 'Planilla actualizada', label: 'Planilla actualizada' }
        ]
      },
      {
        title: "📊 Operación",
        fields: [
          { key: 'Temperatura refrigerante 80-90°C', label: 'Temp. 80-90°C' },
          { key: 'Presión aceite 3.5 bar', label: 'Presión aceite 3.5 bar' },
          { key: 'Carga trabajo < 1000kW', label: 'Carga < 1000kW' },
          { key: 'Horómetro inicial registrado', label: 'Horómetro registrado' },
          { key: 'Composición de biogás controlada', label: 'Biogás controlado' },
          { key: 'Lavado de radiador (si aplica)', label: 'Radiador lavado (si aplica)' }
        ]
      }
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={modalProtocolo.onCancel}
        />
        
        {/* Modal */}
        <div className="relative bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-lg rounded-2xl p-6 border border-slate-600/50 shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📋</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Protocolo de Encendido
            </h3>
            <p className="text-gray-300">
              Motor: {modalProtocolo.nombreMotor}
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="max-h-[50vh] overflow-y-auto space-y-6 pr-2">
              {protocoloGroups.map((group) => (
                <div key={group.title} className="bg-gray-800/30 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    {group.title}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {group.fields.map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="block text-gray-300 text-sm font-medium">
                          {field.label}
                        </label>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => handleChange(field.key, 'Sí')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              formData[field.key as keyof typeof formData] === 'Sí'
                                ? 'bg-green-600 text-white border-2 border-green-400'
                                : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:border-green-400'
                            }`}
                          >
                            ✅ Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChange(field.key, 'No')}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              formData[field.key as keyof typeof formData] === 'No'
                                ? 'bg-red-600 text-white border-2 border-red-400'
                                : 'bg-gray-700 text-gray-300 border-2 border-gray-600 hover:border-red-400'
                            }`}
                          >
                            ❌ No
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {/* Observaciones */}
              <div className="bg-gray-800/30 rounded-lg p-4">
                <label className="block text-white text-sm font-medium mb-2">
                  Observaciones generales
                </label>
                <div className="relative">
                  <textarea
                    value={formData['Observaciones generales']}
                    onChange={(e) => handleChange('Observaciones generales', e.target.value)}
                    className="w-full px-3 py-2 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="Ingrese observaciones adicionales..."
                    disabled={isRecording || isTranscribing}
                  />
                  
                  {/* Botón de Micrófono */}
                  <button
                    type="button"
                    onClick={handleVoiceRecording}
                    disabled={isTranscribing}
                    className={`absolute top-2 right-2 p-2 rounded-lg transition-all duration-300 ${
                      isRecording 
                        ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    } ${isTranscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isRecording ? 'Detener grabación' : 'Iniciar grabación de voz'}
                  >
                    {isTranscribing ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <span className="text-white text-sm">
                        {isRecording ? '🔴' : '🎤'}
                      </span>
                    )}
                  </button>
                </div>
                
                {/* Estado de la grabación */}
                {(isRecording || isTranscribing) && (
                  <div className="mt-2 text-sm">
                    {isRecording && (
                      <p className="text-red-400 flex items-center">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                        Grabando... Presiona el micrófono nuevamente para detener
                      </p>
                    )}
                    {isTranscribing && (
                      <p className="text-blue-400 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></span>
                        Transcribiendo audio...
                      </p>
                    )}
                  </div>
                )}
                
                {/* Error de grabación */}
                {recordingError && (
                  <div className="mt-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                    {recordingError}
                  </div>
                )}
              </div>
            </div>

            {/* Botones */}
            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={modalProtocolo.onCancel}
                className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all duration-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <span>▶️</span>
                <span>Encender Motor</span>
              </button>
            </div>
          </form>
        </div>
      </div>
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

    const campos = [
      { key: 'Horometro Inicial', label: 'Horómetro Inicial', unit: 'hrs', placeholder: 'Ej: 1250.5' },
      { key: 'Arranques Inicio', label: 'Arranques Inicio', unit: 'arranques', placeholder: 'Ej: 150' },
      { key: 'M3 de Inicio', label: 'M³ de Inicio', unit: 'm³', placeholder: 'Ej: 2500.25' },
      { key: 'Kw de Inicio', label: 'kW de Inicio', unit: 'kW', placeholder: 'Ej: 850.75' }
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={modalMonitoreo.onCancel}
        />
        
        <div className="relative bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-lg rounded-2xl p-6 border border-slate-600/50 shadow-2xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              Registro de Datos del Motor
            </h3>
            <p className="text-gray-300 mb-2">
              Motor: <span className="text-blue-400 font-semibold">{modalMonitoreo.nombreMotor}</span>
            </p>
            <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3 text-sm text-blue-300">
              <p className="flex items-center justify-center gap-2">
                <span>ℹ️</span>
                <span>Completa los datos iniciales del motor después del encendido</span>
              </p>
            </div>
          </div>

          {revision && ultimoRegistro ? (
            <RevisionMonitoreo
              revision={revision}
              ultimoRegistro={ultimoRegistro}
              puedeForzar={puedeForzar}
              onCorregir={() => setModalMonitoreo(prev => ({ ...prev, revision: null }))}
              onGuardar={() => guardar(revision.datos)}
            />
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campos.map((campo) => (
                <div key={campo.key} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                  <label className="block text-white text-sm font-medium mb-2 flex items-center gap-2">
                    <span className="text-blue-400">
                      {campo.key === 'Horometro Inicial' && '⏰'}
                      {campo.key === 'Arranques Inicio' && '🔄'}
                      {campo.key === 'M3 de Inicio' && '📦'}
                      {campo.key === 'Kw de Inicio' && '⚡'}
                    </span>
                    {campo.label} ({campo.unit})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={datosMonitoreo[campo.key as keyof typeof datosMonitoreo]}
                    onChange={(e) => handleChange(campo.key, e.target.value)}
                    placeholder={campo.placeholder}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              ))}
            </div>

            <div className="flex space-x-4 pt-4 sticky bottom-0 bg-gradient-to-t from-slate-900 to-transparent pt-6 -mx-6 px-6 pb-2">
              <button
                type="button"
                onClick={modalMonitoreo.onCancel}
                className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all duration-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={ultimoRegistro === undefined}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-wait text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl"
              >
                <span>📊</span>
                <span>{ultimoRegistro === undefined ? 'Cargando lectura anterior…' : 'Completar Registro'}</span>
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
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
        <div className={`rounded-lg p-4 border text-sm ${bloqueado
          ? 'bg-red-500/10 border-red-400/40 text-red-200'
          : 'bg-blue-500/10 border-blue-400/30 text-blue-200'}`}>
          <p className="font-semibold mb-1">
            {bloqueado ? '⛔ Revisa la lectura antes de guardar' : '✅ Confirma lo que vas a registrar'}
          </p>
          <p>
            Desde la lectura anterior ({fechaAnterior}
            {ultimoRegistro.fields['Realiza Registro'] ? `, ${ultimoRegistro.fields['Realiza Registro']}` : ''}
            {revision.horasTranscurridas !== null ? `, hace ${fmt(revision.horasTranscurridas)} h` : ''}):
          </p>
        </div>

        <div className="space-y-2">
          {revision.deltas.map(d => (
            <div key={d.etiqueta} className={`rounded-lg p-3 border ${d.problema
              ? 'bg-red-500/10 border-red-400/40'
              : 'bg-gray-800/30 border-gray-700/50'}`}>
              <div className="flex justify-between items-baseline gap-4">
                <span className="text-gray-300 capitalize">{d.etiqueta}</span>
                <span className={`font-semibold ${d.problema ? 'text-red-300' : 'text-white'}`}>
                  {fmt(d.valor, d.etiqueta === 'arranques' ? 0 : 2)} {d.unidad}
                </span>
              </div>
              {d.problema === 'negativo' && (
                <p className="text-xs text-red-300 mt-1">
                  El contador no puede retroceder: la lectura anterior fue {fmt(valorAnterior[d.etiqueta], 2)}.
                </p>
              )}
              {d.problema === 'excesivo' && (
                <p className="text-xs text-red-300 mt-1">
                  Supera el máximo posible ({fmt(d.maximo)} {d.unidad}) para el tiempo transcurrido.
                  La lectura anterior fue {fmt(valorAnterior[d.etiqueta], 2)}.
                </p>
              )}
            </div>
          ))}
        </div>

        {bloqueado && (
          <p className="text-xs text-gray-400">
            Si el contador se cambió o la lectura anterior quedó mal digitada, avisa a la jefatura de planta.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onCorregir}
            className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium transition-all duration-300"
          >
            Corregir
          </button>
          {!bloqueado && (
            <button
              type="button"
              onClick={onGuardar}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-lg font-medium transition-all duration-300 shadow-lg"
            >
              Confirmar y guardar
            </button>
          )}
          {bloqueado && puedeForzar && (
            <button
              type="button"
              onClick={onGuardar}
              className="flex-1 px-6 py-3 border border-red-400/60 text-red-200 hover:bg-red-500/20 rounded-lg font-medium transition-all duration-300"
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
        <BackgroundLayout>
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="text-white text-center bg-black/50 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 max-w-md w-full">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mb-3">Acceso Requerido</h1>
              <p className="text-gray-300 mb-6 text-sm sm:text-base">Debes iniciar sesión para acceder al monitoreo de motores.</p>
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
      </TurnoGuard>
    );
  }

  if (loading) {
    return (
      <TurnoGuard>
        <BackgroundLayout>
          <div className="min-h-screen flex flex-col">
            <Navbar 
              onLoginClick={() => {}} 
              loggedInUser={loggedInUser}
              onLogout={logout}
            />
          
          <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-white text-lg">Cargando información de motores...</p>
            </div>
          </main>
          </div>
        </BackgroundLayout>
      </TurnoGuard>
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
            
            {/* Banner de Inicio de Turno */}
            {mostrarBannerTurno && resumenInicioTurno && (
              <div className="mb-8 bg-gradient-to-r from-green-500/20 via-emerald-500/20 to-green-500/20 border border-green-400/40 rounded-2xl p-6 relative overflow-hidden">
                {/* Fondo decorativo */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5"></div>
                
                <div className="relative">
                  {/* Header del banner */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500/30 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-green-400">¡Turno Iniciado!</h3>
                        <p className="text-green-300 text-sm">
                          {new Date(resumenInicioTurno.fechaTurno).toLocaleString('es-CO', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setMostrarBannerTurno(false)}
                      className="text-gray-400 hover:text-white transition-colors p-1"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Resumen de motores */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Motores encendidos */}
                    <div className="bg-green-500/10 rounded-xl p-4 border border-green-400/20">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <span className="text-green-300 font-medium text-sm">Motores Encendidos ({resumenInicioTurno.motoresEncendidos.length})</span>
                      </div>
                      {resumenInicioTurno.motoresEncendidos.length > 0 ? (
                        <ul className="space-y-1">
                          {resumenInicioTurno.motoresEncendidos.map((m, i) => (
                            <li key={i} className="text-white text-sm">• {m.nombre} - {m.modelo}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 text-sm italic">Ninguno</p>
                      )}
                    </div>
                    
                    {/* Motores apagados */}
                    <div className="bg-red-500/10 rounded-xl p-4 border border-red-400/20">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                        <span className="text-red-300 font-medium text-sm">Motores Apagados ({resumenInicioTurno.motoresApagados.length})</span>
                      </div>
                      {resumenInicioTurno.motoresApagados.length > 0 ? (
                        <ul className="space-y-1">
                          {resumenInicioTurno.motoresApagados.map((m, i) => (
                            <li key={i} className="text-white text-sm">• {m.nombre} - {m.modelo}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-400 text-sm italic">Ninguno</p>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-300 text-xs mt-4 text-center">
                    💡 Este es el estado de los motores al momento de recibir el turno
                  </p>
                </div>
              </div>
            )}

            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-white mb-4">
                <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  Monitoreo de Motores
                </span>
              </h1>
              <p className="text-gray-300 text-lg max-w-2xl mx-auto">
                Supervisión en tiempo real del estado operativo de los motores Jenbacher
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-8 bg-red-500/20 border border-red-400/30 rounded-xl p-6 text-center">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={cargarDatosMotores}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Resumen de Estado */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 max-w-4xl mx-auto">
              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-600/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Motores</p>
                    <p className="text-3xl font-bold text-white">
                      {motoresConEstado.filter(m => {
                        const nombreMotor = m.motor.fields['Nombre Motor'];
                        return nombreMotor !== 'Jenbacher 3' && nombreMotor !== 'Jenbacher 4';
                      }).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⚙️</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-800/50 to-green-900/50 backdrop-blur-sm rounded-2xl p-6 border border-green-600/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Encendidos</p>
                    <p className="text-3xl font-bold text-green-400">
                      {motoresConEstado.filter(m => {
                        const nombreMotor = m.motor.fields['Nombre Motor'];
                        return (nombreMotor !== 'Jenbacher 3' && nombreMotor !== 'Jenbacher 4') && 
                               m.ultimoEstado?.fields['Estado Motor'] === 'Encendido';
                      }).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">✅</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-red-800/50 to-red-900/50 backdrop-blur-sm rounded-2xl p-6 border border-red-600/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Apagados</p>
                    <p className="text-3xl font-bold text-red-400">
                      {motoresConEstado.filter(m => {
                        const nombreMotor = m.motor.fields['Nombre Motor'];
                        return (nombreMotor !== 'Jenbacher 3' && nombreMotor !== 'Jenbacher 4') && 
                               m.ultimoEstado?.fields['Estado Motor'] === 'Apagado';
                      }).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-red-500/20 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⭕</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estado Detallado de Motores */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {motoresConEstado
                .filter((motorData) => {
                  // 🔧 TEMPORALMENTE OCULTOS: Jenbacher 3 y Jenbacher 4
                  // Motivo: No tienen registros de estado en Airtable
                  // Para mostrarlos nuevamente, remover o comentar este filtro
                  const nombreMotor = motorData.motor.fields['Nombre Motor'];
                  return nombreMotor !== 'Jenbacher 3' && nombreMotor !== 'Jenbacher 4';
                })
                .map((motorData, index) => {
                const { motor, ultimoEstado } = motorData;
                const estadoColor = getEstadoColor(ultimoEstado?.fields['Estado Motor']);
                
                return (
                  <div key={motor.id} className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm rounded-2xl p-8 border border-slate-600/30 hover:border-slate-500/50 transition-all duration-300">
                    {/* Header del Motor */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                          <span className="text-xl">🏭</span>
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {motor.fields['Nombre Motor'] || `Motor ${index + 1}`}
                          </h3>
                          <p className="text-gray-400 text-sm">ID: {motor.fields['ID']}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${estadoColor.dot} animate-pulse`}></div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${estadoColor.text} bg-opacity-20 ${estadoColor.bg}`}>
                          {ultimoEstado?.fields['Estado Motor'] || 'Sin Estado'}
                        </span>
                      </div>
                    </div>

                    {/* Información del Estado */}
                    {ultimoEstado ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-800/30 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-1">Última Actualización</p>
                            <p className="text-white font-medium">
                              {formatearFecha(ultimoEstado.fields['Fecha y Hora'])}
                            </p>
                          </div>
                          
                          <div className="bg-gray-800/30 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-1">Registrado por</p>
                            <p className="text-white font-medium">
                              {ultimoEstado.fields['Realiza Registro'] || 'No especificado'}
                            </p>
                          </div>
                        </div>

                        {ultimoEstado.fields['Observaciones'] && (
                          <div className="bg-gray-800/30 rounded-lg p-4">
                            <p className="text-gray-400 text-sm mb-2">Observaciones</p>
                            <p className="text-white text-sm leading-relaxed">
                              {ultimoEstado.fields['Observaciones']}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-center">
                        <p className="text-yellow-400">Sin registros de estado disponibles</p>
                        <p className="text-yellow-300 text-sm mt-1">No se han encontrado estados registrados para este motor</p>
                      </div>
                    )}

                    {/* Botones de Control */}
                    <div className="mt-6 pt-6 border-t border-gray-700/50">
                      <p className="text-gray-400 text-sm mb-3">Control del Motor</p>
                      
                      {/* Botones Encender/Apagar */}
                      <div className="flex space-x-3 mb-3">
                        <button
                          onClick={() => cambiarEstadoMotor(motor.id, 'Encendido', motor.fields['Nombre Motor'] || `Motor ${index + 1}`)}
                          disabled={procesandoMotor === motor.id || ultimoEstado?.fields['Estado Motor'] === 'Encendido'}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105 disabled:transform-none"
                        >
                          {procesandoMotor === motor.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Procesando...</span>
                            </>
                          ) : (
                            <>
                              <span>▶️</span>
                              <span>Encender</span>
                            </>
                          )}
                        </button>
                        
                        <button
                          onClick={() => cambiarEstadoMotor(motor.id, 'Apagado', motor.fields['Nombre Motor'] || `Motor ${index + 1}`)}
                          disabled={procesandoMotor === motor.id || ultimoEstado?.fields['Estado Motor'] === 'Apagado'}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105 disabled:transform-none"
                        >
                          {procesandoMotor === motor.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Procesando...</span>
                            </>
                          ) : (
                            <>
                              <span>⏹️</span>
                              <span>Apagar</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Botón Registrar Datos */}
                      <button
                        onClick={() => abrirModalMonitoreo(motor.id, motor.fields['Nombre Motor'] || `Motor ${index + 1}`)}
                        disabled={procesandoMotor === motor.id || ultimoEstado?.fields['Estado Motor'] !== 'Encendido'}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all duration-300 transform hover:scale-105 disabled:transform-none"
                      >
                        {procesandoMotor === motor.id ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Procesando...</span>
                          </>
                        ) : ultimoEstado?.fields['Estado Motor'] !== 'Encendido' ? (
                          <>
                            <span>📊</span>
                            <span>Motor Apagado</span>
                          </>
                        ) : (
                          <>
                            <span>📊</span>
                            <span>Registrar Datos</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {motoresConEstado.length === 0 && !loading && !error && (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-gray-700/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🏭</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">No hay motores registrados</h3>
                <p className="text-gray-400 mb-6">No se encontraron motores en el sistema.</p>
                <button
                  onClick={cargarDatosMotores}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                  Recargar Datos
                </button>
              </div>
            )}
          </div>
        </main>

        <Footer />

        {/* Modal de Confirmación */}
        <ModalConfirmacion />
        
        {/* Modal de Protocolo */}
        <ModalProtocolo />
        
        {/* Modal de Monitoreo */}
        <ModalMonitoreo />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}