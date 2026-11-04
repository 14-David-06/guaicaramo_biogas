'use client';

// Piezas compartidas por las tres vistas del informe de Servicios Industriales.

import { useCallback, useState } from 'react';
import { formatearFechaCorta } from '@/lib/informe/fechas';
import type { Observacion } from '@/lib/servicios-industriales/indicadores';

/** Descarga un archivo de una API route y lo guarda con el nombre que manda el servidor. */
export async function descargar(url: string, nombrePorDefecto: string) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new Error(datos?.detalle || datos?.error || 'No se pudo generar el archivo.');
  }
  const disposicion = respuesta.headers.get('Content-Disposition') ?? '';
  const nombre = /filename="([^"]+)"/.exec(disposicion)?.[1] ?? nombrePorDefecto;
  const blob = await respuesta.blob();
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(enlace.href);
}

/** Consulta JSON con estado de carga y error. */
export function useConsulta<T>() {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async (url: string) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(url);
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.detalle || cuerpo.error || 'No se pudo consultar el informe.');
      setDatos(cuerpo as T);
    } catch (e) {
      setDatos(null);
      setError(e instanceof Error ? e.message : 'Error desconocido al consultar el informe.');
    } finally {
      setCargando(false);
    }
  }, []);

  return { datos, cargando, error, setError, consultar };
}

/** Botón que muestra "Preparando…" mientras corre la descarga. */
export function useDescarga(setError: (e: string | null) => void) {
  const [descargando, setDescargando] = useState<string | null>(null);
  const iniciar = async (clave: string, url: string, nombre: string) => {
    setDescargando(clave);
    setError(null);
    try {
      await descargar(url, nombre);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al descargar.');
    } finally {
      setDescargando(null);
    }
  };
  return { descargando, iniciar };
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 py-16 justify-center text-tinta-suave" role="status">
      <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

/** Correcciones y lecturas no sumadas, plegadas por defecto. */
export function ListaObservaciones({ observaciones }: { observaciones: Observacion[] }) {
  const faltantes = observaciones.filter((o) => o.detalle.includes('No se suma') || o.detalle.includes('sin valores de cierre'));
  const corregidas = observaciones.length - faltantes.length;
  if (observaciones.length === 0) {
    return <p className="text-tinta-suave">Todas las lecturas de contador del período cuadraron sin correcciones.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-tinta-suave">
        <strong className="text-tinta">{faltantes.length}</strong> registros de contador no entran en los totales (lectura imposible o
        sin cierre). <strong className="text-tinta">{corregidas}</strong> se corrigieron con el registro vecino del mismo motor o se
        repartieron entre los días que cubrieron, y sí se sumaron.
      </p>
      {[
        { titulo: `No sumados o incompletos (${faltantes.length})`, lista: faltantes },
        { titulo: `Corregidos o repartidos (${corregidas})`, lista: observaciones.filter((o) => !faltantes.includes(o)) }
      ].map(({ titulo, lista }) =>
        lista.length === 0 ? null : (
          <details key={titulo} className="border border-linea rounded-lg bg-superficie-2">
            <summary className="cursor-pointer px-4 py-2.5 font-semibold text-tinta">{titulo}</summary>
            <ul className="divide-y divide-linea border-t border-linea max-h-96 overflow-y-auto">
              {lista.map((o, i) => (
                <li key={i} className="px-4 py-2 text-sm">
                  <span className="font-semibold tabular-nums text-tinta">{formatearFechaCorta(o.fecha)}</span>
                  <span className="text-tinta-suave"> · {o.motor} · </span>
                  {o.detalle}
                </li>
              ))}
            </ul>
          </details>
        )
      )}
    </div>
  );
}
