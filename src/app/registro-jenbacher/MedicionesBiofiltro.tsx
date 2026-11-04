'use client';

import { useCallback, useEffect, useState } from 'react';
import Aviso from '@/components/ui/Aviso';
import Panel from '@/components/ui/Panel';
import { claseBoton } from '@/components/ui/estilos';
import { formatearFechaCorta } from '@/lib/informe/fechas';
import {
  ETIQUETA_MEDICION, GASES_MEDICION, TOMAS_POR_DIA, validarMediciones, type GasMedicion, type TomaRegistrada
} from '@/lib/planilla/mediciones';
import type { RespuestaPlanilla } from '@/lib/planilla/tipos';
import CampoNumero from './CampoNumero';

// Bloque "Mediciones antes del biofiltro" de la hoja: CH4, H2S, O2 y CO2 de
// cada digestor, dos tomas al día. Una fila por digestor; se guardan solo las
// filas digitadas, cada una con la hora en que se guarda.

type Fila = Record<GasMedicion, string>;
const FILA_VACIA: Fila = { ch4: '', h2s: '', o2: '', co2: '' };

export default function MedicionesBiofiltro({ datos, operador, onGuardado }: {
  datos: RespuestaPlanilla;
  operador: string;
  onGuardado: (mensaje: string) => void;
}) {
  const [tomas, setTomas] = useState<TomaRegistrada[]>([]);
  const [filas, setFilas] = useState<Record<string, Fila>>({});
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const respuesta = await fetch(`/api/registro-jenbacher/mediciones?fecha=${datos.fechaActual}`);
      const resultado = await respuesta.json();
      if (respuesta.ok) setTomas(resultado.tomas);
    } catch {
      // Sin la lista de tomas el formulario sigue funcionando.
    }
  }, [datos.fechaActual]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombre = (id: string) => datos.biodigestores.find((d) => d.id === id)?.nombre ?? 'Digestor';
  const cuerpo = () => ({
    operador,
    mediciones: datos.biodigestores.map((d) => ({ digestorId: d.id, valores: filas[d.id] ?? FILA_VACIA }))
  });

  const guardar = async () => {
    const { mediciones, errores: encontrados } = validarMediciones(cuerpo(), nombre);
    setErrores(encontrados);
    if (encontrados.length > 0) return;

    setGuardando(true);
    try {
      const respuesta = await fetch('/api/registro-jenbacher/mediciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo())
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setErrores(resultado.errores ?? [resultado.detalle || resultado.error]);
        return;
      }
      setFilas({});
      await cargar();
      onGuardado(`Mediciones antes del biofiltro guardadas: ${mediciones.map((m) => nombre(m.digestorId)).join(', ')}.`);
    } catch {
      setErrores(['No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.']);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Panel
      titulo="Mediciones antes del biofiltro"
      descripcion={`Gas de cada digestor, ${TOMAS_POR_DIA} tomas al día. Digite solo los digestores medidos; la hora es la de guardado. Planilla del ${formatearFechaCorta(datos.fechaActual)}.`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-separate border-spacing-x-2 border-spacing-y-2">
            <thead>
              <tr className="text-sm font-semibold text-tinta-suave">
                <th className="text-left">Digestor</th>
                <th className="text-left">Tomas del día</th>
                {GASES_MEDICION.map((g) => (
                  <th key={g} className="text-center">{ETIQUETA_MEDICION[g]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.biodigestores.map((d) => {
                const delDigestor = tomas.filter((t) => t.digestorId === d.id);
                const completas = delDigestor.length >= TOMAS_POR_DIA;
                return (
                  <tr key={d.id}>
                    <th scope="row" className="text-left font-condensada font-bold text-lg text-tinta whitespace-nowrap">{d.nombre}</th>
                    <td className="text-sm whitespace-nowrap">
                      {delDigestor.length === 0 ? (
                        <span className="text-tinta-tenue">Ninguna</span>
                      ) : (
                        <span className={completas ? 'text-bosque font-semibold' : 'text-ambar font-semibold'}>
                          {delDigestor.map((t) => t.hora).join(' · ')}
                        </span>
                      )}
                    </td>
                    {GASES_MEDICION.map((g) => (
                      <td key={g}>
                        <CampoNumero
                          id={`medicion-${d.id}-${g}`}
                          etiqueta={`${d.nombre} ${ETIQUETA_MEDICION[g]}`}
                          ocultarEtiqueta
                          valor={filas[d.id]?.[g] ?? ''}
                          onChange={(v) => {
                            setFilas((actual) => ({ ...actual, [d.id]: { ...(actual[d.id] ?? FILA_VACIA), [g]: v } }));
                            setErrores([]);
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {errores.length > 0 && (
          <Aviso tono="error" titulo="No se guardó. Corrija lo siguiente:">
            <ul className="list-disc pl-5 space-y-0.5">
              {errores.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </Aviso>
        )}

        <button type="submit" disabled={guardando || !operador} className={`${claseBoton('primario')} w-full sm:w-auto min-h-[46px]`}>
          {guardando ? 'Guardando…' : 'Guardar mediciones'}
        </button>
      </form>
    </Panel>
  );
}
