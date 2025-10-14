'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { airtableService, Motor, EstadoMotor } from '@/utils/airtable';
import { useState, useEffect } from 'react';

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

export default function MonitoreoMotoresPage() {
  const { user: loggedInUser, logout } = useAuth();
  const [motoresConEstado, setMotoresConEstado] = useState<MotorConEstado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesandoMotor, setProcesandoMotor] = useState<string | null>(null);
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

      // Mostrar mensaje de éxito
      alert(`✅ ${nombreMotor} encendido exitosamente`);

      // Recargar datos para mostrar el cambio
      await cargarDatosMotores();
      
    } catch (error) {
      console.error('Error en el proceso de encendido:', error);
      alert(`❌ Error en el proceso de encendido. Intenta nuevamente.`);
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

    const protocoloFields = [
      { key: 'Elementos de Protección Personal disponibles', label: '¿Tiene disponibles los elementos de protección personal?' },
      { key: 'Elementos de Protección Personal en buen estado', label: '¿Están en buen estado los elementos?' },
      { key: 'Aceite al 50% (mirilla)', label: '¿Mirilla de aceite está al 50%?' },
      { key: 'Presión refrigerante 1.5 bar', label: '¿Manómetro de presión refrigerante marca 1.5 bar?' },
      { key: 'CH4 > 50%', label: '¿CH4 por encima del 50%?' },
      { key: 'O2 < 3%', label: '¿O2 menor al 3%?' },
      { key: 'H2S < 300ppm', label: '¿H2S menor a 300ppm?' },
      { key: 'Mangueras en buen estado', label: '¿Mangueras en buen estado y sin fugas?' },
      { key: 'Válvulas de gas abiertas', label: '¿Todas las válvulas están abiertas?' },
      { key: 'Ventiladores encendidos', label: '¿Ventiladores funcionando correctamente?' },
      { key: 'Equipos Biofiltro funcionando', label: '¿Chiller, bombas Kubao y soplador funcionando correctamente?' },
      { key: 'Encendido correcto', label: '¿Se realizó la secuencia de encendido correctamente?' },
      { key: 'Planilla actualizada', label: '¿Registro de planilla actualizado?' },
      { key: 'Temperatura refrigerante 80-90°C', label: '¿Temperatura del refrigerante entre 80°C - 90°C?' },
      { key: 'Presión aceite 3.5 bar', label: '¿Presión del aceite 3,5 bar?' },
      { key: 'Carga trabajo < 1000kW', label: '¿Carga de trabajo menor a 1000 kW?' },
      { key: 'Horómetro inicial registrado', label: '¿Horómetro inicial registrado?' },
      { key: 'Composición de biogás controlada', label: '¿Composición de biogás controlada?' },
      { key: 'Lavado de radiador (si aplica)', label: '¿Se lavó el radiador si se operó más de 10 horas?' }
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-2">
              {protocoloFields.map((field) => (
                <div key={field.key} className="bg-gray-800/30 rounded-lg p-4">
                  <label className="block text-white text-sm font-medium mb-2">
                    {field.label}
                  </label>
                  <select
                    value={formData[field.key as keyof typeof formData]}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
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

  if (!loggedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <h1 className="text-2xl mb-4">Acceso Requerido</h1>
          <p>Debes iniciar sesión para acceder al monitoreo de motores.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <TurnoGuard>
        <div className="min-h-screen bg-gray-900 flex flex-col">
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
      </TurnoGuard>
    );
  }

  return (
    <TurnoGuard>
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <Navbar 
          onLoginClick={() => {}} 
          loggedInUser={loggedInUser}
          onLogout={logout}
        />
        
        <main className="pt-16 px-4 sm:px-6 lg:px-8 flex-grow">
          <div className="max-w-7xl mx-auto py-12">
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
                      <div className="flex space-x-3">
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
      </div>
    </TurnoGuard>
  );
}