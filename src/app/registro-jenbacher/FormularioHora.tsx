'use client';

import { Fragment, useMemo, useState } from 'react';
import { UMBRALES_PLANILLA_BIOFILTRO, UMBRALES_PLANILLA_GAS, type UmbralPlanilla } from '@/lib/informe/umbrales';
import VoiceRecorder from '@/components/VoiceRecorder';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseEtiqueta } from '@/components/ui/estilos';
import { nombreCortoMotor } from '@/lib/planilla/campos';
import {
  ETIQUETA_GAS, ETIQUETA_PUNTO, GASES, PUNTOS_MEDICION, SOPLADORES, UNIDAD_GAS,
  type Gas, type HoraPlanilla, type PuntoMedicion, type RespuestaPlanilla, type Soplador
} from '@/lib/planilla/tipos';
import {
  alertasDeUmbral, estadoDeValor, leerNumero, validarLectura, type AlertaUmbral
} from '@/lib/planilla/validacion';

// Captura de una hora de la planilla. Los campos se colorean contra los
// umbrales del formato mientras se escribe; lo imposible se bloquea con la
// misma validación que aplica el servidor.

type Biofiltro = 'presionEntrada' | 'presionSalida' | 'tempEntrada' | 'tempSalida';

interface Borrador {
  digestores: string[];
  gas: Record<PuntoMedicion, Record<Gas, string>>;
  biofiltro: Record<Biofiltro, string>;
  motores: Record<string, { potenciaKw: string; m3: string }>;
  sopladores: Soplador[];
  observaciones: string;
}

const GAS_VACIO = (): Record<Gas, string> => ({ ch4: '', o2: '', co2: '', h2s: '' });

// El borde del campo dice cómo va el valor contra el umbral del formato.
const ESTILO_ESTADO: Record<ReturnType<typeof estadoDeValor>, string> = {
  vacio: 'border-linea-fuerte bg-superficie',
  invalido: 'border-rojo bg-rojo-claro ring-1 ring-rojo',
  ok: 'border-hoja bg-superficie',
  advertencia: 'border-ambar-borde bg-ambar-claro',
  critica: 'border-rojo-borde bg-rojo-claro'
};

function CampoNumero({ id, valor, onChange, umbral, etiqueta, compacto = false }: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  umbral?: UmbralPlanilla;
  etiqueta: string;
  compacto?: boolean;
}) {
  const estado = estadoDeValor(leerNumero(valor), umbral);
  return (
    <input
      id={id}
      aria-label={etiqueta}
      aria-invalid={estado === 'invalido' || undefined}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={umbral?.referencia.replace(` ${umbral.unidad}`, '') ?? ''}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border-2 rounded-lg text-tinta font-semibold tabular-nums placeholder:font-normal placeholder:text-tinta-tenue focus:outline-none focus:ring-2 focus:ring-bosque/30 focus:border-bosque ${
        compacto ? 'px-2 py-2.5 text-lg text-center' : 'px-3 py-2.5 text-lg'
      } ${ESTILO_ESTADO[estado]}`}
    />
  );
}

/** Subtítulo de cada bloque del formulario, con línea divisoria arriba. */
function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-linea pt-5">
      <h3 className="font-condensada font-bold text-lg text-tinta">{titulo}</h3>
      {nota && <p className="text-tinta-suave text-sm mt-0.5">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function FormularioHora({ datos, hora, operador, onCancelar, onGuardado }: {
  datos: RespuestaPlanilla;
  hora: HoraPlanilla;
  operador: string;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const disponibles = datos.motores.filter((m) => m.encendido && m.tieneMonitoreo);
  const sinRegistro = datos.motores.filter((m) => !(m.encendido && m.tieneMonitoreo));

  // Digestores y sopladores rara vez cambian de una hora a otra: se precargan
  // con la última hora registrada antes de esta.
  const anterior = useMemo(() => {
    const indice = datos.franjas.findIndex((f) => f.hora === hora);
    return datos.franjas.slice(0, indice).reverse().find((f) => f.lectura)?.lectura ?? null;
  }, [datos.franjas, hora]);

  const [borrador, setBorrador] = useState<Borrador>(() => ({
    digestores: anterior?.digestorIds ?? [],
    gas: { entrada_biofiltro: GAS_VACIO(), salida_biofiltro: GAS_VACIO(), salida_biochar: GAS_VACIO() },
    biofiltro: { presionEntrada: '', presionSalida: '', tempEntrada: '', tempSalida: '' },
    motores: Object.fromEntries(disponibles.map((m) => [m.id, { potenciaKw: '', m3: '' }])),
    sopladores: anterior?.sopladores ?? [],
    observaciones: ''
  }));
  const [errores, setErrores] = useState<string[]>([]);
  const [alertas, setAlertas] = useState<AlertaUmbral[] | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cambiar = (cambio: (b: Borrador) => Borrador) => {
    setBorrador(cambio);
    setAlertas(null);
  };
  const alternar = <T,>(lista: T[], valor: T) => (lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const cuerpo = () => ({
    fecha: datos.fecha,
    hora,
    operador,
    digestores: borrador.digestores,
    gas: borrador.gas,
    ...borrador.biofiltro,
    motores: disponibles.map((m) => ({
      motorId: m.id,
      nombre: nombreCortoMotor(m.nombre),
      potenciaKw: borrador.motores[m.id]?.potenciaKw ?? '',
      m3: borrador.motores[m.id]?.m3 ?? ''
    })),
    sopladores: borrador.sopladores,
    observaciones: borrador.observaciones
  });

  const guardar = async (confirmado: boolean) => {
    const datosHora = cuerpo();
    const { lectura, errores: encontrados } = validarLectura(datosHora);
    setErrores(encontrados);
    if (!lectura) return;

    const fuera = alertasDeUmbral(lectura);
    if (fuera.length > 0 && !confirmado) {
      setAlertas(fuera);
      return;
    }

    setGuardando(true);
    try {
      const respuesta = await fetch('/api/planilla-horaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosHora)
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setAlertas(null);
        setErrores(resultado.errores ?? [resultado.detalle || resultado.error]);
        return;
      }
      const motores = disponibles.map((m) => nombreCortoMotor(m.nombre)).join(' y ');
      onGuardado(`Hora ${hora} registrada (${motores}).`);
    } catch {
      setErrores(['No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.']);
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaBiofiltro: Record<Biofiltro, string> = {
    presionEntrada: 'Presión entrada (cm H2O)',
    presionSalida: 'Presión salida (cm H2O)',
    tempEntrada: 'Temperatura entrada (°C)',
    tempSalida: 'Temperatura salida (°C)'
  };

  const chip = (activo: boolean) =>
    `min-w-12 px-4 py-2.5 rounded-lg border-2 font-semibold text-lg transition-colors ${
      activo ? 'bg-bosque border-bosque text-white' : 'bg-superficie border-linea-fuerte text-tinta hover:border-bosque'
    }`;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar(false);
      }}
      className="bg-superficie border-2 border-bosque rounded-xl p-4 sm:p-6 space-y-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">Lectura de las {hora}</h2>
          <p className="text-tinta-suave">Registra <span className="font-semibold text-tinta">{operador || 'sin sesión'}</span></p>
        </div>
        <button type="button" onClick={onCancelar} className={claseBoton('secundario', 'sm')}>
          Cerrar
        </button>
      </div>

      <Bloque titulo="Digestores en uso" nota="Se precargan los de la hora anterior.">
        <div className="flex flex-wrap gap-2">
          {datos.biodigestores.map((d) => {
            const activo = borrador.digestores.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={activo}
                aria-label={d.nombre}
                onClick={() => cambiar((b) => ({ ...b, digestores: alternar(b.digestores, d.id) }))}
                className={chip(activo)}
              >
                {d.nombre.replace(/biodigestor\s*/i, '')}
              </button>
            );
          })}
        </div>
      </Bloque>

      <Bloque
        titulo="Composición del biogás"
        nota="Salida biochar es obligatoria: es el gas que entra al motor. Cada casilla muestra su rango; el borde se pone ámbar o rojo si el valor queda por fuera."
      >
        <div className="grid grid-cols-[3.25rem_repeat(3,minmax(0,1fr))] sm:grid-cols-[5rem_repeat(3,minmax(0,1fr))] gap-2 items-center">
          <div />
          {PUNTOS_MEDICION.map((p) => (
            <div key={p} className="text-sm font-semibold text-tinta-suave text-center leading-tight">
              {ETIQUETA_PUNTO[p]}
              {p === 'salida_biochar' && <span className="text-rojo"> *</span>}
            </div>
          ))}
          {GASES.map((g) => (
            <Fragment key={g}>
              <div className="font-condensada font-bold text-lg text-tinta leading-tight">
                {ETIQUETA_GAS[g]}
                <span className="block font-sans text-xs font-semibold text-tinta-suave">{UNIDAD_GAS[g]}</span>
              </div>
              {PUNTOS_MEDICION.map((p) => (
                <CampoNumero
                  key={p}
                  compacto
                  id={`gas-${p}-${g}`}
                  etiqueta={`${ETIQUETA_GAS[g]} ${ETIQUETA_PUNTO[p]}`}
                  valor={borrador.gas[p][g]}
                  umbral={UMBRALES_PLANILLA_GAS[p][g]}
                  onChange={(v) => cambiar((b) => ({ ...b, gas: { ...b.gas, [p]: { ...b.gas[p], [g]: v } } }))}
                />
              ))}
            </Fragment>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Biofiltro">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          {(Object.keys(etiquetaBiofiltro) as Biofiltro[]).map((campo) => (
            <div key={campo}>
              <label htmlFor={`biofiltro-${campo}`} className={claseEtiqueta}>{etiquetaBiofiltro[campo]}</label>
              <CampoNumero
                id={`biofiltro-${campo}`}
                etiqueta={etiquetaBiofiltro[campo]}
                valor={borrador.biofiltro[campo]}
                umbral={UMBRALES_PLANILLA_BIOFILTRO[campo]}
                onChange={(v) => cambiar((b) => ({ ...b, biofiltro: { ...b.biofiltro, [campo]: v } }))}
              />
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Motores">
        {disponibles.length === 0 ? (
          <Aviso tono="alerta" titulo="Esta hora todavía no se puede registrar">
            No hay motores encendidos con monitoreo. Encienda el motor en{' '}
            <a href="/monitoreo-motores" className="font-semibold underline underline-offset-2">Monitoreo de motores</a>.
          </Aviso>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {disponibles.map((m) => (
              <div key={m.id} className="bg-superficie-2 border border-linea rounded-lg p-3 sm:p-4">
                <p className="flex flex-wrap items-baseline gap-x-2 mb-2">
                  <span className="font-condensada font-bold text-xl text-tinta">{nombreCortoMotor(m.nombre)}</span>
                  <span className="text-sm text-tinta-suave">{m.nombre}</span>
                  <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-bosque">
                    <span className="w-2 h-2 rounded-full bg-hoja" aria-hidden="true" />
                    Encendido
                  </span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(['potenciaKw', 'm3'] as const).map((campo) => (
                    <div key={campo}>
                      <label htmlFor={`motor-${m.id}-${campo}`} className={claseEtiqueta}>
                        {campo === 'potenciaKw' ? 'Potencia (kW)' : 'Biogás (m³)'}
                      </label>
                      <CampoNumero
                        id={`motor-${m.id}-${campo}`}
                        etiqueta={`${m.nombre} ${campo === 'potenciaKw' ? 'potencia' : 'm³'}`}
                        valor={borrador.motores[m.id]?.[campo] ?? ''}
                        onChange={(v) =>
                          cambiar((b) => ({ ...b, motores: { ...b.motores, [m.id]: { ...b.motores[m.id], [campo]: v } } }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {sinRegistro.length > 0 && (
          <p className="text-tinta-suave text-sm mt-2">
            Sin lectura esta hora:{' '}
            {sinRegistro.map((m) => `${m.nombre} (${m.encendido ? 'encendido sin monitoreo' : 'apagado'})`).join(', ')}.
          </p>
        )}
      </Bloque>

      <Bloque titulo="Sopladores encendidos">
        <div className="flex flex-wrap gap-2">
          {SOPLADORES.map((s) => {
            const activo = borrador.sopladores.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={activo}
                onClick={() => cambiar((b) => ({ ...b, sopladores: alternar(b.sopladores, s) }))}
                className={`${chip(activo)} inline-flex items-center gap-2`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${activo ? 'bg-white' : 'border-2 border-linea-fuerte'}`} aria-hidden="true" />
                Soplador {s}
              </button>
            );
          })}
        </div>
      </Bloque>

      <Bloque titulo="Observaciones" nota="Escriba o toque el micrófono para dictar; lo dictado se agrega al final.">
        <div className="flex items-start gap-3">
          <textarea
            id="observaciones"
            aria-label="Observaciones"
            rows={3}
            maxLength={1000}
            value={borrador.observaciones}
            onChange={(e) => cambiar((b) => ({ ...b, observaciones: e.target.value }))}
            className="flex-1 min-w-0 bg-superficie border-2 border-linea-fuerte rounded-lg px-3 py-2.5 text-tinta focus:outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/30"
          />
          <VoiceRecorder
            size="sm"
            disabled={guardando}
            onTranscription={(texto) =>
              cambiar((b) => ({
                ...b,
                observaciones: [b.observaciones.trim(), texto.trim()].filter(Boolean).join(' ').slice(0, 1000)
              }))
            }
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
          titulo={`${alertas.length === 1 ? 'Hay 1 valor fuera de rango' : `Hay ${alertas.length} valores fuera de rango`}. ¿Confirma que son correctos?`}
        >
          <ul className="list-disc pl-5 space-y-0.5 text-tinta">
            {alertas.map((a) => (
              <li key={a.etiqueta}>
                {a.etiqueta}: <strong>{a.valor.toLocaleString('es-CO')} {a.unidad}</strong> (rango {a.referencia})
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={guardando}
            onClick={() => guardar(true)}
            className={`${claseBoton('secundario')} mt-3 w-full sm:w-auto`}
          >
            {guardando ? 'Guardando…' : 'Sí, guardar así'}
          </button>
        </Aviso>
      )}

      <button
        type="submit"
        disabled={guardando || disponibles.length === 0 || !operador}
        className={`${claseBoton('primario', 'lg')} w-full`}
      >
        {guardando ? 'Guardando…' : `Guardar hora ${hora}`}
      </button>
    </form>
  );
}
