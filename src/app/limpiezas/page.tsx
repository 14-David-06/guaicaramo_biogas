'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { airtableService } from '@/utils/airtable';
import type { LimpiezaRegistro } from '@/utils/airtable';
import { AREAS, indicadoresLimpiezas, resumenRegistro, type CampoArea } from './resumen';

type Respuesta = 'Sí' | 'No' | 'Parcialmente';

const OPCIONES: { valor: Respuesta; texto: string; activa: string }[] = [
  { valor: 'Sí', texto: 'Sí', activa: 'bg-bosque border-bosque text-white' },
  { valor: 'No', texto: 'No', activa: 'bg-rojo border-rojo text-white' },
  { valor: 'Parcialmente', texto: 'Parcial', activa: 'bg-ambar-claro border-ambar-borde text-ambar ring-1 ring-ambar-borde' }
];

const ESTILO_RESULTADO = {
  ok: 'bg-hoja-claro text-bosque-oscuro',
  alerta: 'bg-ambar-claro text-ambar',
  critico: 'bg-rojo-claro text-rojo'
};

export default function LimpiezasPage() {
  const { user: loggedInUser } = useAuth();
  const { isRecording, isTranscribing, startRecording, stopRecording, error: voiceError } = useVoiceRecording();
  const [formData, setFormData] = useState({
    pisosLimpios: '',
    ventanasLimpias: '',
    tablerosLimpios: '',
    estructurasLibres: '',
    equiposLimpios: '',
    jenbacherLimpios: '',
    observaciones: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registros, setRegistros] = useState<LimpiezaRegistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    cargarRegistros();
  }, []);

  const cargarRegistros = async () => {
    try {
      setLoading(true);
      const data = await airtableService.obtenerRegistrosLimpiezas();
      setRegistros(data);
    } catch (error) {
      console.error('Error al cargar registros de limpiezas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleVoiceRecording = async () => {
    try {
      if (isRecording) {
        // Detener grabación y obtener transcripción
        const transcription = await stopRecording();

        // Agregar la transcripción al campo de observaciones
        const currentObservations = formData.observaciones;
        const newObservations = currentObservations
          ? `${currentObservations} ${transcription}`
          : transcription;

        handleInputChange('observaciones', newObservations);
      } else {
        // Iniciar grabación
        await startRecording();
      }
    } catch (error) {
      console.error('Error con grabación de voz:', error);
    }
  };

  const marcarTodoComoSi = () => {
    setFormData(prev => ({
      ...prev,
      pisosLimpios: 'Sí',
      ventanasLimpias: 'Sí',
      tablerosLimpios: 'Sí',
      estructurasLibres: 'Sí',
      equiposLimpios: 'Sí',
      jenbacherLimpios: 'Sí'
    }));
  };

  const limpiarFormulario = () => {
    setFormData({
      pisosLimpios: '',
      ventanasLimpias: '',
      tablerosLimpios: '',
      estructurasLibres: '',
      equiposLimpios: '',
      jenbacherLimpios: '',
      observaciones: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!loggedInUser) {
      alert('Inicie sesión para guardar la limpieza.');
      return;
    }

    // Validar que al menos un campo de limpieza esté completado
    const camposLimpieza = [
      formData.pisosLimpios,
      formData.ventanasLimpias,
      formData.tablerosLimpios,
      formData.estructurasLibres,
      formData.equiposLimpios,
      formData.jenbacherLimpios
    ];

    if (camposLimpieza.every(campo => !campo.trim())) {
      alert('Marque al menos un área antes de guardar.');
      return;
    }

    setIsSubmitting(true);

    try {
      const registroLimpieza = {
        fields: {
          'Pisos y andén limpios (cuarto de control y área externa)': formData.pisosLimpios,
          'Ventanas limpias con retal húmedo?': formData.ventanasLimpias,
          'Tableros limpios (con precaución en perillas y controles)?': formData.tablerosLimpios,
          'Estructuras libres de polvo y telarañas?': formData.estructurasLibres,
          'Equipos (manómetros, tuberías, medidores) limpios?': formData.equiposLimpios,
          'Equipos Jenbacher limpios (cuidado con controles)?': formData.jenbacherLimpios,
          'Observaciones': formData.observaciones,
          'Realiza Registro': loggedInUser.nombre
        }
      };

      await airtableService.crearRegistroLimpieza(registroLimpieza);

      // Limpiar formulario
      setFormData({
        pisosLimpios: '',
        ventanasLimpias: '',
        tablerosLimpios: '',
        estructurasLibres: '',
        equiposLimpios: '',
        jenbacherLimpios: '',
        observaciones: ''
      });

      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);

      // Recargar registros
      await cargarRegistros();

    } catch (error) {
      console.error('Error al enviar registro de limpieza:', error);
      alert('No se pudo guardar la limpieza. Revise la conexión e intente de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!loggedInUser) {
    return (
      <TurnoGuard>
        <Pagina>
          <Aviso titulo="Inicie sesión para continuar">
            Para registrar limpiezas, <Link href="/" className="font-semibold text-bosque underline underline-offset-2">ingrese con su cédula y contraseña</Link>.
          </Aviso>
        </Pagina>
      </TurnoGuard>
    );
  }

  const camposCompletos = AREAS.filter((area) => formData[area.estado].trim()).length;
  const progreso = (camposCompletos / AREAS.length) * 100;

  return (
    <TurnoGuard>
      <Pagina>
        <EncabezadoPagina
          titulo="Limpieza de la planta"
          descripcion="Revise cada área y marque cómo la encontró. Lo que quede pendiente, anótelo en observaciones."
        />

        {!loading && <Indicadores items={indicadoresLimpiezas(registros)} />}

        {submitSuccess && <Aviso tono="exito">Limpieza guardada. Ya aparece en el historial.</Aviso>}

        {/* Formulario de registro */}
        <form onSubmit={handleSubmit}>
          <Panel
            as="div"
            titulo="Nueva inspección"
            descripcion="Sí: limpia. Parcial: falta una parte. No: sin limpiar."
          >
            <FormularioContenido
              formData={formData}
              onCambio={handleInputChange}
              onTodoConforme={marcarTodoComoSi}
              onBorrar={limpiarFormulario}
            />
            {/* Observaciones */}
            <div className="mt-5">
              <label htmlFor="observaciones" className={claseEtiqueta}>
                Observaciones <span className="font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => handleInputChange('observaciones', e.target.value)}
                  rows={3}
                  className={`${claseCampo} pr-16 resize-none`}
                  placeholder="Qué quedó pendiente o qué hay que reportar"
                />
                <button
                  type="button"
                  onClick={handleVoiceRecording}
                  disabled={isTranscribing}
                  aria-label={isRecording ? 'Detener y transcribir' : isTranscribing ? 'Transcribiendo' : 'Dictar por voz'}
                  title={isRecording ? 'Detener y transcribir' : isTranscribing ? 'Transcribiendo…' : 'Dictar por voz'}
                  className={`absolute right-2 top-2 w-11 h-11 flex items-center justify-center rounded-full text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque ${
                    isRecording
                      ? 'bg-rojo hover:bg-[#912018] ring-4 ring-rojo/25 animate-pulse'
                      : isTranscribing
                        ? 'bg-ambar-borde cursor-wait'
                        : 'bg-bosque hover:bg-bosque-oscuro'
                  }`}
                >
                  {isRecording ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                  ) : isTranscribing ? (
                    <span className="w-5 h-5 rounded-full border-[3px] border-white/40 border-t-white animate-spin" aria-hidden="true" />
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>
              {isRecording && (
                <p className="text-rojo text-sm font-semibold mt-2 flex items-center gap-2" role="status">
                  <span className="w-2 h-2 bg-rojo rounded-full animate-pulse" aria-hidden="true" />
                  Grabando. Toque el botón para detener.
                </p>
              )}
              {isTranscribing && <p className="text-ambar text-sm font-semibold mt-2" role="status">Transcribiendo…</p>}
              {voiceError && <p className="text-rojo text-sm mt-2" role="alert">{voiceError}</p>}
            </div>

            {/* Progreso y botón guardar */}
            <div className="mt-6 pt-5 border-t border-linea flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-tinta-suave whitespace-nowrap">
                  Áreas revisadas: <span className="font-condensada font-bold text-xl text-tinta tabular-nums">{camposCompletos} de {AREAS.length}</span>
                </span>
                <div className="flex-1 sm:w-32 sm:flex-none h-2 bg-linea rounded-full overflow-hidden" aria-hidden="true">
                  <div className="h-full bg-bosque transition-all duration-500" style={{ width: `${progreso}%` }} />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className={`${claseBoton('primario', 'lg')} w-full sm:w-auto`}>
                {isSubmitting ? 'Guardando…' : 'Guardar limpieza'}
              </button>
            </div>
          </Panel>
        </form>

        {/* Historial de registros */}
        <section className="space-y-3">
          <h2 className="font-condensada font-bold text-xl sm:text-2xl text-tinta">Historial de inspecciones</h2>
          {loading ? (
            <div className="flex items-center gap-3 py-10 justify-center text-tinta-suave bg-superficie border border-linea rounded-xl" role="status">
              <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
              Cargando el historial…
            </div>
          ) : registros.length === 0 ? (
            <p className="py-10 text-center text-tinta-suave bg-superficie border border-linea rounded-xl">
              Todavía no hay inspecciones registradas.
            </p>
          ) : (
            <>
            {/* En celular, una lista; desde tablet, la tabla */}
            <ul className="sm:hidden bg-superficie border border-linea rounded-xl">
              {registros.map((registro, index) => {
                const r = resumenRegistro(registro);
                return (
                  <li key={registro.id || index} className="px-4 py-3 border-t border-linea first:border-t-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-tinta tabular-nums">{r.fechaTexto}</p>
                        <p className="text-sm text-tinta-suave">{registro.fields['Realiza Registro']}</p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-md text-sm font-semibold ${ESTILO_RESULTADO[r.tono]}`}>
                        {r.estadoTexto} ({Math.round(r.porcentaje)} %)
                      </span>
                    </div>
                    {r.pendientes.length > 0 && (
                      <p className="mt-1 text-sm text-tinta-suave">Pendiente: {r.pendientes.join(', ')}</p>
                    )}
                    {registro.fields['Observaciones'] && (
                      <p className="mt-1 text-sm text-tinta">{registro.fields['Observaciones']}</p>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="hidden sm:block bg-superficie border border-linea rounded-xl overflow-x-auto">
              <table className="w-full text-left min-w-[640px]">
                <thead className="bg-superficie-2">
                  <tr>
                    <th className="px-4 py-3 font-condensada font-semibold text-tinta-suave">Fecha</th>
                    <th className="px-4 py-3 font-condensada font-semibold text-tinta-suave">Operador</th>
                    <th className="px-4 py-3 font-condensada font-semibold text-tinta-suave">Resultado</th>
                    <th className="px-4 py-3 font-condensada font-semibold text-tinta-suave">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro, index) => {
                    const r = resumenRegistro(registro);
                    return (
                      <tr key={registro.id || index} className="border-t border-linea align-top">
                        <td className="px-4 py-3 text-tinta tabular-nums whitespace-nowrap">{r.fechaTexto}</td>
                        <td className="px-4 py-3 font-semibold text-tinta">{registro.fields['Realiza Registro']}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-1 rounded-md text-sm font-semibold whitespace-nowrap ${ESTILO_RESULTADO[r.tono]}`}>
                            {r.estadoTexto} ({Math.round(r.porcentaje)} %)
                          </span>
                          {r.pendientes.length > 0 && (
                            <p className="mt-1 text-sm text-tinta-suave">Pendiente: {r.pendientes.join(', ')}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-tinta-suave max-w-xs">
                          {registro.fields['Observaciones'] || <span className="text-tinta-tenue">Sin notas</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </Pagina>
    </TurnoGuard>
  );
}

/** Las seis áreas con sus tres opciones y las acciones rápidas. */
function FormularioContenido({ formData, onCambio, onTodoConforme, onBorrar }: {
  formData: Record<CampoArea | 'observaciones', string>;
  onCambio: (name: string, value: string) => void;
  onTodoConforme: () => void;
  onBorrar: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2 mb-4">
        <button type="button" onClick={onTodoConforme} className={claseBoton('secundario')}>
          Marcar todo como limpio
        </button>
        <button type="button" onClick={onBorrar} className={claseBoton('sutil')}>
          Borrar respuestas
        </button>
      </div>

      <ul className="border border-linea rounded-lg">
        {AREAS.map((area) => (
          <li
            key={area.estado}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-linea first:border-t-0"
          >
            <div>
              <p className="font-semibold text-tinta">{area.titulo}</p>
              <p className="text-sm text-tinta-suave">{area.nota}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:w-72 shrink-0" role="group" aria-label={area.titulo}>
              {OPCIONES.map((opcion) => {
                const activa = formData[area.estado] === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => onCambio(area.estado, opcion.valor)}
                    className={`min-h-11 px-3 py-2 rounded-lg border-2 font-semibold transition-colors ${
                      activa ? opcion.activa : 'bg-superficie border-linea-fuerte text-tinta hover:border-bosque'
                    }`}
                  >
                    {opcion.texto}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
