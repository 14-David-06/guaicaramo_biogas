'use client';

import { useEffect, useState } from 'react';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { ayerBogota, formatearFechaCorta, formatearFechaLarga, hoyBogota } from '@/lib/informe/fechas';
import { bloqueComoTexto, filaKwhPorM3ComoTexto, type BloqueProduccion } from '@/lib/servicios-industriales/bloque-produccion';
import { formatear } from '@/lib/servicios-industriales/indicadores';
import { Cargando, useConsulta } from './comun';

function Estado({ estado }: { estado: 'OK' | 'Atención' | null }) {
  if (!estado) return <span className="text-tinta-tenue">—</span>;
  return estado === 'OK' ? (
    <span className="inline-block px-2 rounded bg-hoja-claro text-bosque-oscuro font-semibold">OK</span>
  ) : (
    <span className="inline-block px-2 rounded bg-ambar-claro text-ambar font-semibold">Atención</span>
  );
}

export default function VistaBloque() {
  const [fecha, setFecha] = useState(ayerBogota());
  const { datos: bloque, cargando, error, consultar } = useConsulta<BloqueProduccion>();
  const [copiado, setCopiado] = useState<string | null>(null);

  useEffect(() => {
    consultar(`/api/servicios-industriales/bloque-produccion?fecha=${fecha}`);
  }, [fecha, consultar]);

  const copiar = async (clave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      setCopiado('error');
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        titulo="Bloque de biogás para el informe de producción"
        descripcion="La parte de biogás del informe «Datos Producción y Pérdidas» de la extractora, lista para copiar y pegar en su Excel."
        acciones={
          <div>
            <label htmlFor="fecha-bloque" className={claseEtiqueta}>Día</label>
            <input
              id="fecha-bloque"
              type="date"
              value={fecha}
              max={hoyBogota()}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              className={`${claseCampo} min-h-[46px] w-auto`}
            />
          </div>
        }
      >
        {error && <Aviso tono="error" titulo="No se pudo consultar el bloque">{error}</Aviso>}
        {copiado === 'error' && (
          <Aviso tono="alerta" className="mb-4">El navegador no permitió copiar. Seleccione la tabla y cópiela a mano.</Aviso>
        )}
        {cargando && !bloque && <Cargando texto="Consultando el día…" />}

        {bloque && (
          <div className={`space-y-6 transition-opacity ${cargando ? 'opacity-50' : ''}`}>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-condensada font-bold text-xl text-tinta">
                  Información calidad biogás · {formatearFechaLarga(bloque.fecha)}
                </h3>
                <button type="button" onClick={() => copiar('bloque', bloqueComoTexto(bloque))} className={`${claseBoton('primario')} min-h-[44px]`}>
                  {copiado === 'bloque' ? 'Copiado' : 'Copiar bloque'}
                </button>
              </div>
              {bloque.lecturas === 0 && (
                <Aviso tono="alerta" className="mb-3">No hay lecturas horarias de gas en este día.</Aviso>
              )}
              <div className="border border-linea rounded-xl overflow-x-auto">
                <table className="w-full text-sm text-tinta">
                  <thead className="bg-superficie-2">
                    <tr>
                      {['Variable', 'Valor', 'Referencia', 'Alerta'].map((h, i) => (
                        <th key={h} className={`px-3 py-2.5 font-condensada font-semibold text-base ${i === 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bloque.calidad.map((f) => (
                      <tr key={f.variable} className="border-t border-linea">
                        <td className="px-3 py-2 font-semibold">{f.variable}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatear(f.valor, f.decimales)}</td>
                        <td className="px-3 py-2 text-tinta-suave">{f.referencia}</td>
                        <td className="px-3 py-2"><Estado estado={f.estado} /></td>
                      </tr>
                    ))}
                    {bloque.horas.map((h) => (
                      <tr key={h.motor} className="border-t border-linea">
                        <td className="px-3 py-2 font-semibold">Horas Jenbacher {h.motor}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatear(h.horas, 2)}</td>
                        <td className="px-3 py-2 text-tinta-suave">Horómetro</td>
                        <td className="px-3 py-2" />
                      </tr>
                    ))}
                    <tr className="border-t-2 border-linea-fuerte bg-superficie-2">
                      <td className="px-3 py-2 font-semibold">Total horas Jenbacher</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatear(bloque.horasTotal, 2)}</td>
                      <td className="px-3 py-2 text-tinta-suave">Suma de los motores</td>
                      <td className="px-3 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-tinta-suave">
                {bloque.lecturas} lecturas horarias de los dos motores. El kWh/m³ se calcula como en el informe de producción: potencia
                promedio ÷ m³/h promedio de las lecturas.
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h3 className="font-condensada font-bold text-xl text-tinta">kWh/m³ biogás del mes, día por día</h3>
                <button
                  type="button"
                  onClick={() => copiar('fila', filaKwhPorM3ComoTexto(bloque))}
                  className={`${claseBoton('secundario')} min-h-[44px]`}
                >
                  {copiado === 'fila' ? 'Copiada' : 'Copiar fila'}
                </button>
              </div>
              <div className="border border-linea rounded-xl overflow-x-auto">
                <table className="text-sm text-tinta">
                  <thead className="bg-superficie-2">
                    <tr>
                      {bloque.kwhPorM3Dias.map((d) => (
                        <th key={d.fecha} className="px-2.5 py-2 font-condensada font-semibold text-center tabular-nums" title={formatearFechaCorta(d.fecha)}>
                          {Number(d.fecha.slice(8))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {bloque.kwhPorM3Dias.map((d) => (
                        <td key={d.fecha} className="px-2.5 py-2 text-center tabular-nums">{formatear(d.valor, 2)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                {bloque.kwhPorM3Semanas.map((s) => (
                  <div key={s.semana} className="flex gap-1.5">
                    <dt className="text-tinta-suave">Semana {s.semana}</dt>
                    <dd className="font-semibold tabular-nums">{formatear(s.valor, 2)}</dd>
                  </div>
                ))}
                <div className="flex gap-1.5">
                  <dt className="text-tinta-suave">Mes hasta el día</dt>
                  <dd className="font-semibold tabular-nums">{formatear(bloque.kwhPorM3Mes, 2)}</dd>
                </div>
              </dl>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
