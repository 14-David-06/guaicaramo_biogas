'use client';

import { AREAS, DEFINICION_AREAS, type DiaConsumo, type RespuestaConsumo } from '@/lib/consumo-barraje/tipos';
import { diasDelMes, formatoKw } from './resumen';

// El mes como en la planilla en papel: una fila por día y las mismas columnas,
// con total y promedio al pie.

const CELDA = 'px-2 py-2 text-right tabular-nums whitespace-nowrap';

export default function TablaConsumo({ datos, puedeRegistrar, onRegistrar }: {
  datos: RespuestaConsumo;
  puedeRegistrar: boolean;
  onRegistrar: (fecha: string) => void;
}) {
  const porFecha = new Map<string, DiaConsumo>(datos.dias.map((d) => [d.fecha, d]));
  const total = (area: (typeof AREAS)[number]) => {
    const valores = datos.dias.map((d) => d.valores[area]).filter((v): v is number => v !== null);
    return valores.length ? { suma: valores.reduce((t, v) => t + v, 0), n: valores.length } : null;
  };
  const encabezado = 'px-2 py-2 font-condensada font-semibold text-tinta align-bottom';

  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
      <table className="w-full text-sm text-tinta">
        <thead className="bg-superficie-2 border-b border-linea">
          <tr>
            <th className={`${encabezado} text-left sticky left-0 z-10 bg-superficie-2`}>Día</th>
            {AREAS.map((a) => (
              <th key={a} className={`${encabezado} text-right ${a === 'recepcionL1' || a === 'tusas' ? 'border-l border-linea' : ''}`}>
                {DEFINICION_AREAS[a].etiqueta}
              </th>
            ))}
            <th className={`${encabezado} text-left border-l border-linea`}>Registró</th>
          </tr>
        </thead>
        <tbody>
          {diasDelMes(datos.mes).map((fecha) => {
            const dia = porFecha.get(fecha);
            const esHoy = fecha === datos.hoy;
            const falta = !dia && fecha < datos.hoy;
            const futuro = fecha > datos.hoy;
            return (
              <tr key={fecha} className={`border-t border-linea ${esHoy ? 'bg-hoja-claro' : 'bg-superficie'} ${futuro ? 'text-tinta-tenue' : ''}`}>
                <td className="px-2 py-2 font-condensada font-bold sticky left-0 bg-inherit">{Number(fecha.slice(8))}</td>
                {AREAS.map((a) => (
                  <td key={a} className={`${CELDA} ${a === 'recepcionL1' || a === 'tusas' ? 'border-l border-linea' : ''} ${dia ? '' : 'text-tinta-tenue'}`}>
                    {dia ? formatoKw(dia.valores[a]) : ''}
                  </td>
                ))}
                <td className="px-2 py-1.5 whitespace-nowrap border-l border-linea">
                  {dia ? (
                    <span title={dia.observaciones || undefined}>
                      {dia.operador.split(' ')[0] || '—'}
                      {dia.observaciones && <span className="ml-1 text-tinta-suave">· con observación</span>}
                    </span>
                  ) : falta || esHoy ? (
                    puedeRegistrar ? (
                      <button
                        type="button"
                        onClick={() => onRegistrar(fecha)}
                        className={`font-semibold underline underline-offset-2 ${falta ? 'text-rojo' : 'text-bosque'}`}
                      >
                        {falta ? 'Registrar (falta)' : 'Registrar'}
                      </button>
                    ) : (
                      falta && <span className="font-semibold text-rojo">Sin registro</span>
                    )
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-superficie-2 border-t-2 border-linea-fuerte font-semibold">
          <tr>
            <td className="px-2 py-2 font-condensada font-bold sticky left-0 bg-superficie-2">Total</td>
            {AREAS.map((a) => {
              const t = total(a);
              return <td key={a} className={`${CELDA} ${a === 'recepcionL1' || a === 'tusas' ? 'border-l border-linea' : ''}`}>{t ? formatoKw(Math.round(t.suma * 100) / 100) : '—'}</td>;
            })}
            <td className="border-l border-linea" />
          </tr>
          <tr className="border-t border-linea text-tinta-suave">
            <td className="px-2 py-2 font-condensada font-bold sticky left-0 bg-superficie-2">Promedio</td>
            {AREAS.map((a) => {
              const t = total(a);
              return <td key={a} className={`${CELDA} ${a === 'recepcionL1' || a === 'tusas' ? 'border-l border-linea' : ''}`}>{t ? formatoKw(Math.round((t.suma / t.n) * 100) / 100) : '—'}</td>;
            })}
            <td className="border-l border-linea" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
