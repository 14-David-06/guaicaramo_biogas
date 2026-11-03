'use client';

import { useState } from 'react';
import VoiceRecorder from '@/components/VoiceRecorder';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { AREAS, DEFINICION_AREAS, type Area } from '@/lib/consumo-barraje/tipos';
import { leerConsumo, validarConsumo } from '@/lib/consumo-barraje/validacion';
import { formatoDia, formatoKw } from './resumen';

// Captura de un día de la planilla, agrupado como el formato en papel: los
// dos totales de la red, las cuatro áreas con línea 1 y línea 2, y las demás.

const LINEAS: { nombre: string; l1: Area; l2: Area }[] = [
  { nombre: 'Recepción', l1: 'recepcionL1', l2: 'recepcionL2' },
  { nombre: 'Clarificación', l1: 'clarificacionL1', l2: 'clarificacionL2' },
  { nombre: 'Trituración', l1: 'trituracionL1', l2: 'trituracionL2' },
  { nombre: 'Extracción', l1: 'extraccionL1', l2: 'extraccionL2' }
];
const GENERALES: Area[] = ['barraje', 'subestacion'];
const OTRAS: Area[] = ['tusas', 'desfibracion', 'pko'];
const PROCESO: Area[] = [...LINEAS.flatMap((l) => [l.l1, l.l2]), ...OTRAS];

const VACIO = Object.fromEntries(AREAS.map((a) => [a, ''])) as Record<Area, string>;

function CampoKw({ area, valor, onChange, etiquetaOculta = false }: {
  area: Area;
  valor: string;
  onChange: (v: string) => void;
  /** En la grilla de líneas la etiqueta visible es la fila y la columna. */
  etiquetaOculta?: boolean;
}) {
  const invalido = leerConsumo(valor) === 'invalido';
  return (
    <div>
      <label htmlFor={`kw-${area}`} className={etiquetaOculta ? 'sr-only' : claseEtiqueta}>{DEFINICION_AREAS[area].etiqueta}</label>
      <div className="relative">
        <input
          id={`kw-${area}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={invalido || undefined}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={`${claseCampo} pr-10 text-lg font-semibold tabular-nums ${invalido ? 'border-rojo bg-rojo-claro' : ''}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-tinta-tenue pointer-events-none">kW</span>
      </div>
    </div>
  );
}

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-linea pt-5">
      <h3 className="font-condensada font-bold text-lg text-tinta">{titulo}</h3>
      {nota && <p className="text-tinta-suave text-sm mt-0.5">{nota}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function FormularioConsumo({ hoy, fechaInicial, registrados, operador, onCancelar, onGuardado }: {
  hoy: string;
  fechaInicial: string;
  /** Fechas que ya tienen registro, para avisar antes de enviar. */
  registrados: Set<string>;
  operador: string;
  onCancelar: () => void;
  onGuardado: (mensaje: string, fecha: string) => void;
}) {
  const [fecha, setFecha] = useState(fechaInicial);
  const [valores, setValores] = useState<Record<Area, string>>(VACIO);
  const [observaciones, setObservaciones] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const yaRegistrado = registrados.has(fecha);
  const cambiar = (area: Area) => (v: string) => setValores((actual) => ({ ...actual, [area]: v }));

  const numerosProceso = PROCESO.map((a) => leerConsumo(valores[a])).filter((n): n is number => typeof n === 'number');
  const suma = numerosProceso.reduce((t, n) => t + n, 0);

  const guardar = async () => {
    const cuerpo = { fecha, operador, valores, observaciones };
    const { lectura, errores: encontrados } = validarConsumo(cuerpo, hoy);
    setErrores(encontrados);
    if (!lectura) return;

    setGuardando(true);
    try {
      const respuesta = await fetch('/api/consumo-barraje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setErrores(resultado.errores ?? [resultado.detalle || resultado.error]);
        return;
      }
      onGuardado(`Consumo del ${formatoDia(fecha)} guardado.`, fecha);
    } catch {
      setErrores(['No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.']);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="bg-superficie border-2 border-bosque rounded-xl p-4 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">Registrar consumo del día</h2>
          <p className="text-tinta-suave">Registra <span className="font-semibold text-tinta">{operador || 'sin sesión'}</span></p>
        </div>
        <button type="button" onClick={onCancelar} className={claseBoton('secundario', 'sm')}>
          Cerrar
        </button>
      </div>

      <div className="max-w-xs">
        <label htmlFor="fecha-consumo" className={claseEtiqueta}>Día del consumo</label>
        <input
          id="fecha-consumo"
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => {
            setFecha(e.target.value);
            setErrores([]);
          }}
          className={claseCampo}
        />
      </div>
      {yaRegistrado && (
        <Aviso tono="alerta" titulo={`El ${formatoDia(fecha)} ya tiene consumo registrado`}>
          Elija otro día. Para corregir un día ya guardado, avise a la jefatura de planta.
        </Aviso>
      )}

      <Bloque titulo="Red" nota="Escriba el consumo del día que marca cada medidor. Deje en blanco lo que no se midió.">
        <div className="grid grid-cols-2 gap-3 max-w-xl">
          {GENERALES.map((a) => <CampoKw key={a} area={a} valor={valores[a]} onChange={cambiar(a)} />)}
        </div>
      </Bloque>

      <Bloque titulo="Áreas con dos líneas">
        <div className="grid grid-cols-[6.5rem_1fr_1fr] sm:grid-cols-[9rem_1fr_1fr] gap-x-3 gap-y-2 items-end max-w-2xl">
          <div />
          <p className="text-sm font-semibold text-tinta-suave">Línea 1</p>
          <p className="text-sm font-semibold text-tinta-suave">Línea 2</p>
          {LINEAS.map((linea) => (
            <div key={linea.nombre} className="contents">
              <p className="font-condensada font-bold text-lg text-tinta pb-2.5">{linea.nombre}</p>
              {[linea.l1, linea.l2].map((a) => (
                <CampoKw key={a} area={a} valor={valores[a]} onChange={cambiar(a)} etiquetaOculta />
              ))}
            </div>
          ))}
        </div>
      </Bloque>

      <Bloque titulo="Otras áreas">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl">
          {OTRAS.map((a) => <CampoKw key={a} area={a} valor={valores[a]} onChange={cambiar(a)} />)}
        </div>
        <p className="mt-3 text-tinta-suave">
          Suma de las áreas de proceso:{' '}
          <span className="font-semibold text-tinta tabular-nums">{numerosProceso.length ? `${formatoKw(Math.round(suma * 100) / 100)} kW` : '—'}</span>
          <span className="text-sm"> (sin Barraje #2 ni Subestación)</span>
        </p>
      </Bloque>

      <Bloque titulo="Observaciones" nota="Opcional. Escriba o toque el micrófono para dictar; lo dictado se agrega al final.">
        <div className="flex items-start gap-3">
          <textarea
            id="observaciones-consumo"
            aria-label="Observaciones"
            rows={2}
            maxLength={1000}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className={`${claseCampo} flex-1 min-w-0`}
          />
          <VoiceRecorder
            size="sm"
            disabled={guardando}
            onTranscription={(t) => setObservaciones((o) => [o.trim(), t.trim()].filter(Boolean).join(' ').slice(0, 1000))}
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

      <button type="submit" disabled={guardando || yaRegistrado || !operador || !fecha} className={`${claseBoton('primario', 'lg')} w-full`}>
        {guardando ? 'Guardando…' : fecha ? `Guardar consumo del ${formatoDia(fecha)}` : 'Guardar consumo'}
      </button>
    </form>
  );
}
