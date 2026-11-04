'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import VoiceRecorder from '@/components/VoiceRecorder';
import Aviso from '@/components/ui/Aviso';
import Panel from '@/components/ui/Panel';
import { claseBoton, claseCampo } from '@/components/ui/estilos';
import { formatearFechaCorta, sumarDias } from '@/lib/informe/fechas';
import { UMBRALES_PLANILLA_BIOFILTRO, UMBRALES_PLANILLA_GAS } from '@/lib/informe/umbrales';
import { nombreCortoMotor } from '@/lib/planilla/campos';
import { franjaYaEmpezo } from '@/lib/planilla/franjas';
import {
  ETIQUETA_PUNTO, GASES, HORAS_PLANILLA, PUNTOS_MEDICION, SOPLADORES,
  type Gas, type HoraPlanilla, type PuntoMedicion, type RespuestaPlanilla, type Soplador
} from '@/lib/planilla/tipos';
import { alertasDeUmbral, validarLectura, type AlertaUmbral } from '@/lib/planilla/validacion';
import CampoNumero from './CampoNumero';

// Fila horaria del formato "Control diario a composición del biogás y potencia
// de Jenbacher", en el mismo orden de la hoja: digestores utilizados, hora,
// composición del gas en los tres puntos, presión y temperatura del biofiltro,
// potencia y m³ de cada Jenbacher. Al final, sopladores y observaciones.

type Biofiltro = 'presionEntrada' | 'presionSalida' | 'tempEntrada' | 'tempSalida';

const GAS_HOJA: Record<Gas, string> = {
  ch4: 'Metano (CH4) %',
  o2: 'Oxígeno (O2) %',
  co2: 'Dióxido de carbono (CO2) %',
  h2s: 'Ácido sulfhídrico (H2S) ppm'
};

const BIOFILTRO: { clave: Biofiltro; etiqueta: string }[] = [
  { clave: 'presionEntrada', etiqueta: 'Presión entrada (cm H2O)' },
  { clave: 'presionSalida', etiqueta: 'Presión salida (cm H2O)' },
  { clave: 'tempEntrada', etiqueta: 'Temp. entrada biofiltro (°C)' },
  { clave: 'tempSalida', etiqueta: 'Temp. salida biofiltro (°C)' }
];

const GAS_VACIO = (): Record<Gas, string> => ({ ch4: '', o2: '', co2: '', h2s: '' });
const GAS_INICIAL = (): Record<PuntoMedicion, Record<Gas, string>> => ({
  entrada_biofiltro: GAS_VACIO(),
  salida_biofiltro: GAS_VACIO(),
  salida_biochar: GAS_VACIO()
});
const BIOFILTRO_VACIO: Record<Biofiltro, string> = { presionEntrada: '', presionSalida: '', tempEntrada: '', tempSalida: '' };

interface EstadoMotor {
  incluido: boolean;
  potenciaKw: string;
  m3: string;
}

/** Un motor que se encendió después de abrir la página todavía no tiene estado. */
function estadoDe(motores: Record<string, EstadoMotor>, id: string): EstadoMotor {
  return motores[id] ?? { incluido: false, potenciaKw: '', m3: '' };
}

/** Dictado: "metano 52, oxígeno 2, potencia 540…" llena el gas que entra al motor, el biofiltro y la potencia. */
function valoresDictados(transcripcion: string) {
  const texto = transcripcion.toLowerCase();
  const leer = (patron: RegExp) => texto.match(patron)?.[1]?.replace(',', '.');
  return {
    gas: {
      ch4: leer(/(?:metano|ch4)[^\d]*(\d+(?:[.,]\d+)?)/i),
      o2: leer(/(?:ox[íi]geno|o2)[^\d]*(\d+(?:[.,]\d+)?)/i),
      co2: leer(/(?:di[óo]xido|co2|carbono)[^\d]*(\d+(?:[.,]\d+)?)/i),
      h2s: leer(/(?:[áa]cido|h2s|sulfh[íi]drico|sulfuro)[^\d]*(\d+(?:[.,]\d+)?)/i)
    },
    biofiltro: {
      presionEntrada: leer(/(?:presi[óo]n[^\d]*(?:entrada|ingreso))[^\d]*(\d+(?:[.,]\d+)?)/i),
      presionSalida: leer(/(?:presi[óo]n[^\d]*(?:salida|egreso))[^\d]*(\d+(?:[.,]\d+)?)/i),
      tempEntrada: leer(/(?:temperatura[^\d]*(?:entrada|ingreso))[^\d]*(\d+(?:[.,]\d+)?)/i),
      tempSalida: leer(/(?:temperatura[^\d]*(?:salida|egreso))[^\d]*(\d+(?:[.,]\d+)?)/i)
    },
    potenciaKw: leer(/(?:potencia|kw|kilovatios?)[^\d]*(\d+(?:[.,]\d+)?)/i),
    m3: leer(/(?:m3|metros c[úu]bicos|biog[áa]s)[^\d]*(\d+(?:[.,]\d+)?)/i)
  };
}

function sinVacios<T extends Record<string, string | undefined>>(valores: T): Partial<Record<keyof T, string>> {
  return Object.fromEntries(Object.entries(valores).filter(([, v]) => v !== undefined)) as Partial<Record<keyof T, string>>;
}

/** Los mensajes de validación de la planilla, en las palabras de la hoja. */
function enPalabrasDeLaHoja(errores: string[]): string[] {
  return errores.map((e) => e.replace(/^(CH4|O2|CO2|H2S) salida biochar/, '$1 salida biochar (gas al motor)'));
}

function Bloque({ numero, titulo, nota, acciones, children }: {
  numero: string;
  titulo: string;
  nota?: string;
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-linea pt-5 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-baseline gap-2 font-condensada font-bold text-xl text-tinta">
            <span className="text-bosque">{numero}</span>
            {titulo}
          </h3>
          {nota && <p className="text-tinta-suave text-sm mt-0.5">{nota}</p>}
        </div>
        {acciones}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function LecturaHoraria({ datos, operador, onGuardado }: {
  datos: RespuestaPlanilla;
  operador: string;
  onGuardado: (mensaje: string) => void;
}) {
  const disponibles = datos.motores.filter((m) => m.encendido && m.tieneMonitoreo);
  const ultima = useMemo(() => [...datos.franjas].reverse().find((f) => f.lectura)?.lectura ?? null, [datos.franjas]);

  const [hora, setHora] = useState<HoraPlanilla>(datos.horaActual);
  // Digestores y sopladores casi nunca cambian de una hora a otra: se precargan con la última lectura.
  const [digestores, setDigestores] = useState<string[]>(ultima?.digestorIds ?? []);
  const [gas, setGas] = useState(GAS_INICIAL);
  const [biofiltro, setBiofiltro] = useState(BIOFILTRO_VACIO);
  const [motores, setMotores] = useState<Record<string, EstadoMotor>>(() =>
    Object.fromEntries(disponibles.map((m) => [m.id, { incluido: true, potenciaKw: '', m3: '' }]))
  );
  const [sopladores, setSopladores] = useState<Soplador[]>(ultima?.sopladores ?? []);
  const [observaciones, setObservaciones] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [alertas, setAlertas] = useState<AlertaUmbral[] | null>(null);
  const [enviando, setEnviando] = useState(false);

  // La lectura de las 05:00 tomada a las 06:10 es de la planilla anterior.
  const fecha = franjaYaEmpezo(datos.fechaActual, hora, new Date()) ? datos.fechaActual : sumarDias(datos.fechaActual, -1);
  const registradosEnLaHora = useMemo(() => {
    if (fecha !== datos.fecha) return new Set<string>();
    const lectura = datos.franjas.find((f) => f.hora === hora)?.lectura;
    return new Set((lectura?.motores ?? []).map((m) => nombreCortoMotor(m.nombre)));
  }, [datos, fecha, hora]);

  const yaRegistrado = (nombre: string) => registradosEnLaHora.has(nombreCortoMotor(nombre));
  const incluidos = disponibles.filter((m) => estadoDe(motores, m.id).incluido && !yaRegistrado(m.nombre));

  const cambio = () => {
    setAlertas(null);
    setErrores([]);
  };
  const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const cuerpo = () => ({
    fecha,
    hora,
    operador,
    digestores,
    gas,
    ...biofiltro,
    motores: incluidos.map((m) => ({
      motorId: m.id,
      nombre: nombreCortoMotor(m.nombre),
      potenciaKw: estadoDe(motores, m.id).potenciaKw,
      m3: estadoDe(motores, m.id).m3
    })),
    sopladores,
    observaciones
  });

  const guardar = async (confirmado: boolean) => {
    if (incluidos.length === 0) {
      setErrores(['Incluya al menos un Jenbacher en la lectura.']);
      return;
    }
    const datosLectura = cuerpo();
    const { lectura, errores: encontrados } = validarLectura(datosLectura);
    setErrores(enPalabrasDeLaHoja(encontrados));
    if (!lectura) return;

    const fuera = alertasDeUmbral(lectura);
    if (fuera.length > 0 && !confirmado) {
      setAlertas(fuera);
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await fetch('/api/registro-jenbacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosLectura)
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setAlertas(null);
        setErrores(enPalabrasDeLaHoja(resultado.errores ?? [resultado.detalle || resultado.error]));
        return;
      }
      const nombres = incluidos.map((m) => nombreCortoMotor(m.nombre)).join(' y ');
      setGas(GAS_INICIAL());
      setBiofiltro(BIOFILTRO_VACIO);
      setMotores((actual) => Object.fromEntries(Object.entries(actual).map(([id, m]) => [id, { ...m, potenciaKw: '', m3: '' }])));
      setObservaciones('');
      setAlertas(null);
      onGuardado(`Lectura de las ${hora} guardada (${nombres}).`);
    } catch {
      setErrores(['No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.']);
    } finally {
      setEnviando(false);
    }
  };

  const chip = (activo: boolean) =>
    `min-w-12 px-4 py-2.5 rounded-lg border-2 font-semibold text-lg transition-colors ${
      activo ? 'bg-bosque border-bosque text-white' : 'bg-superficie border-linea-fuerte text-tinta hover:border-bosque'
    }`;

  if (disponibles.length === 0) {
    return (
      <Panel titulo="Lectura horaria">
        <Aviso tono="alerta" titulo="No hay motores disponibles para registro">
          <p>Para registrar la lectura, al menos un Jenbacher debe estar encendido y tener su registro de monitoreo.</p>
          <Link href="/monitoreo-motores" className={`${claseBoton('secundario')} mt-3`}>Ir a Monitoreo de motores</Link>
        </Aviso>
      </Panel>
    );
  }

  return (
    <Panel
      titulo="Lectura horaria"
      descripcion="Una fila de la hoja: se toma cada hora, de 06:00 a 05:00. Las casillas muestran el parámetro y se colorean si el valor queda por fuera."
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          guardar(false);
        }}
      >
        <Bloque numero="1" titulo="Hora y digestores utilizados">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <div>
              <label htmlFor="hora" className="block text-sm font-semibold text-tinta-suave mb-1">Hora</label>
              <div className="flex items-center gap-3">
                <select
                  id="hora"
                  value={hora}
                  onChange={(e) => {
                    setHora(e.target.value as HoraPlanilla);
                    cambio();
                  }}
                  className={`${claseCampo} min-h-[46px] text-lg font-semibold w-auto`}
                >
                  {HORAS_PLANILLA.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <span className="text-tinta-suave">Planilla del {formatearFechaCorta(fecha)}</span>
              </div>
            </div>
            <div>
              <span className="block text-sm font-semibold text-tinta-suave mb-1">Digestores utilizados</span>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Digestores utilizados">
                {datos.biodigestores.map((d) => {
                  const activo = digestores.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      aria-pressed={activo}
                      aria-label={d.nombre}
                      onClick={() => {
                        setDigestores((l) => alternar(l, d.id));
                        cambio();
                      }}
                      className={chip(activo)}
                    >
                      {d.nombre.replace(/biodigestor\s*/i, '')}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Bloque>

        <Bloque
          numero="2"
          titulo="Composición del biogás"
          nota="Salida biochar es obligatoria: es el gas que entra a los motores. Puede dictar con el micrófono («metano 52, oxígeno 2, potencia 540…»)."
          acciones={
            <VoiceRecorder
              size="sm"
              disabled={enviando}
              onTranscription={(texto) => {
                const v = valoresDictados(texto);
                setGas((g) => ({ ...g, salida_biochar: { ...g.salida_biochar, ...sinVacios(v.gas) } }));
                setBiofiltro((b) => ({ ...b, ...sinVacios(v.biofiltro) }));
                if (incluidos.length === 1) {
                  const id = incluidos[0].id;
                  setMotores((actual) => ({ ...actual, [id]: { ...estadoDe(actual, id), ...sinVacios({ potenciaKw: v.potenciaKw, m3: v.m3 }) } }));
                }
                cambio();
              }}
            />
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="w-44" />
                  {PUNTOS_MEDICION.map((p) => (
                    <th key={p} className="text-sm font-semibold text-tinta-suave text-center leading-tight">
                      {ETIQUETA_PUNTO[p]}
                      {p === 'salida_biochar' && <span className="text-rojo"> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {GASES.map((g) => (
                  <tr key={g}>
                    <th scope="row" className="text-left font-condensada font-bold text-lg text-tinta leading-tight">{GAS_HOJA[g]}</th>
                    {PUNTOS_MEDICION.map((p) => (
                      <td key={p}>
                        <CampoNumero
                          id={`gas-${p}-${g}`}
                          etiqueta={`${GAS_HOJA[g]} — ${ETIQUETA_PUNTO[p]}`}
                          ocultarEtiqueta
                          valor={gas[p][g]}
                          umbral={UMBRALES_PLANILLA_GAS[p][g]}
                          onChange={(valor) => {
                            setGas((actual) => ({ ...actual, [p]: { ...actual[p], [g]: valor } }));
                            cambio();
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Bloque>

        <Bloque numero="3" titulo="Biofiltro">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {BIOFILTRO.map(({ clave, etiqueta }) => (
              <CampoNumero
                key={clave}
                id={`biofiltro-${clave}`}
                etiqueta={etiqueta}
                valor={biofiltro[clave]}
                umbral={UMBRALES_PLANILLA_BIOFILTRO[clave]}
                onChange={(valor) => {
                  setBiofiltro((actual) => ({ ...actual, [clave]: valor }));
                  cambio();
                }}
              />
            ))}
          </div>
        </Bloque>

        <Bloque numero="4" titulo="Potencia generada y m³ de biogás" nota="Una columna por Jenbacher. Quite la marca de un motor si su lectura se toma después.">
          <div className="grid sm:grid-cols-2 gap-3">
            {datos.motores
              .filter((m) => m.encendido || m.tieneMonitoreo || /jenbacher\s*[12]\b/i.test(m.nombre))
              .map((m) => {
                const disponible = m.encendido && m.tieneMonitoreo;
                const registrado = disponible && yaRegistrado(m.nombre);
                const estado = estadoDe(motores, m.id);
                const activo = disponible && !registrado && estado.incluido;
                return (
                  <fieldset
                    key={m.id}
                    disabled={!disponible || registrado}
                    className={`rounded-lg border-2 p-3 sm:p-4 ${activo ? 'border-bosque bg-superficie' : 'border-linea bg-superficie-2'}`}
                  >
                    <legend className="sr-only">{m.nombre}</legend>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
                      <span className="font-condensada font-bold text-xl text-tinta">{m.nombre.replace(/\s+/g, ' ')}</span>
                      {!disponible ? (
                        <span className="text-sm font-semibold text-tinta-suave">{m.encendido ? 'Sin monitoreo' : 'Apagado'}</span>
                      ) : registrado ? (
                        <span className="text-sm font-semibold text-bosque">Ya registrado a las {hora}</span>
                      ) : (
                        <label className="ml-auto inline-flex items-center gap-2 font-semibold text-tinta cursor-pointer">
                          <input
                            type="checkbox"
                            checked={estado.incluido}
                            onChange={(e) => {
                              setMotores((actual) => ({ ...actual, [m.id]: { ...estadoDe(actual, m.id), incluido: e.target.checked } }));
                              cambio();
                            }}
                            className="w-5 h-5 accent-[var(--color-bosque)]"
                          />
                          Incluir
                        </label>
                      )}
                    </div>
                    {activo && (
                      <div className="grid grid-cols-2 gap-3">
                        <CampoNumero
                          id={`motor-${m.id}-potencia`}
                          etiqueta="Potencia generada (kW)"
                          ejemplo="Ej: 540"
                          valor={estado.potenciaKw}
                          onChange={(valor) => {
                            setMotores((actual) => ({ ...actual, [m.id]: { ...estadoDe(actual, m.id), potenciaKw: valor } }));
                            cambio();
                          }}
                        />
                        <CampoNumero
                          id={`motor-${m.id}-m3`}
                          etiqueta="M³ de biogás"
                          ejemplo="Ej: 380"
                          valor={estado.m3}
                          onChange={(valor) => {
                            setMotores((actual) => ({ ...actual, [m.id]: { ...estadoDe(actual, m.id), m3: valor } }));
                            cambio();
                          }}
                        />
                      </div>
                    )}
                  </fieldset>
                );
              })}
          </div>
        </Bloque>

        <Bloque numero="5" titulo="Sopladores" nota="Se precargan como estaban en la última lectura.">
          <div className="grid sm:grid-cols-3 gap-3">
            {SOPLADORES.map((s) => {
              const encendido = sopladores.includes(s);
              return (
                <div key={s} className="flex items-center justify-between gap-3 rounded-lg border border-linea bg-superficie-2 px-3 py-2">
                  <span className="font-semibold text-tinta">Soplador {s}</span>
                  <div className="inline-flex rounded-lg border-2 border-linea-fuerte overflow-hidden" role="group" aria-label={`Soplador ${s}`}>
                    {(['ON', 'OFF'] as const).map((opcion) => {
                      const activo = (opcion === 'ON') === encendido;
                      return (
                        <button
                          key={opcion}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => {
                            setSopladores((l) => (opcion === 'ON' ? [...new Set([...l, s])] : l.filter((x) => x !== s)));
                            cambio();
                          }}
                          className={`px-4 py-2 font-bold transition-colors ${
                            activo ? (opcion === 'ON' ? 'bg-bosque text-white' : 'bg-tinta-suave text-white') : 'bg-superficie text-tinta-suave'
                          }`}
                        >
                          {opcion}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Bloque>

        <Bloque numero="6" titulo="Observaciones" nota="Opcional. Escriba o dicte; lo dictado se agrega al final.">
          <div className="flex items-start gap-3">
            <textarea
              id="observaciones"
              aria-label="Observaciones"
              rows={3}
              maxLength={1000}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="flex-1 min-w-0 bg-superficie border-2 border-linea-fuerte rounded-lg px-3 py-2.5 text-tinta focus:outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/30"
            />
            <VoiceRecorder
              size="sm"
              disabled={enviando}
              onTranscription={(texto) => setObservaciones((o) => [o.trim(), texto.trim()].filter(Boolean).join(' ').slice(0, 1000))}
            />
          </div>
        </Bloque>

        {errores.length > 0 && (
          <Aviso tono="error" titulo="No se guardó. Corrija lo siguiente:">
            <ul className="list-disc pl-5 space-y-0.5">
              {errores.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </Aviso>
        )}

        {alertas && (
          <Aviso
            tono="alerta"
            titulo={`${alertas.length === 1 ? 'Hay 1 valor fuera de parámetro' : `Hay ${alertas.length} valores fuera de parámetro`}. ¿Confirma que son correctos?`}
          >
            <ul className="list-disc pl-5 space-y-0.5 text-tinta">
              {alertas.map((a) => (
                <li key={a.etiqueta}>
                  {a.etiqueta}: <strong>{a.valor.toLocaleString('es-CO')} {a.unidad}</strong> (parámetro {a.referencia})
                </li>
              ))}
            </ul>
            <button type="button" disabled={enviando} onClick={() => guardar(true)} className={`${claseBoton('secundario')} mt-3 w-full sm:w-auto`}>
              {enviando ? 'Guardando…' : 'Sí, guardar así'}
            </button>
          </Aviso>
        )}

        <button
          type="submit"
          disabled={enviando || !operador || incluidos.length === 0 || digestores.length === 0 || Boolean(datos.bloqueo)}
          className={`${claseBoton('primario', 'lg')} w-full`}
        >
          {enviando
            ? 'Guardando…'
            : digestores.length === 0
              ? 'Seleccione los digestores utilizados'
              : incluidos.length === 0
                ? 'Incluya al menos un Jenbacher'
                : `Guardar lectura de las ${hora} (${incluidos.map((m) => nombreCortoMotor(m.nombre)).join(' y ')})`}
        </button>
      </form>
    </Panel>
  );
}
