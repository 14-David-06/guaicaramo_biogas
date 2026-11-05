'use client';

import { ORIGEN_CORTO, duracionMinutos, formatoDuracion, type Apagon, type MotorApagon } from '@/lib/apagones/tipos';
import { formatoFin, formatoMomento } from './resumen';

// Apagones del mes, del más reciente al más antiguo.

const CELDA = 'px-3 py-2.5 align-top';
const ENCABEZADO = 'px-3 py-2 font-condensada font-semibold text-tinta text-left align-bottom whitespace-nowrap';

function nombreCorto(nombre: string): string {
  // "Jenbacher 1 J320 S599" → "J1"
  const m = /jenbacher\s*(\d+)/i.exec(nombre);
  return m ? `J${m[1]}` : nombre;
}

export default function TablaApagones({ apagones, motores, ahora, puedeCerrar, onCerrar }: {
  apagones: Apagon[];
  motores: MotorApagon[];
  ahora: string;
  puedeCerrar: boolean;
  onCerrar: (apagon: Apagon) => void;
}) {
  const nombres = new Map(motores.map((m) => [m.id, nombreCorto(m.nombre)]));

  if (apagones.length === 0) {
    return <p className="text-tinta-suave py-6 text-center">No se reportaron apagones este mes.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-linea">
      <table className="w-full text-sm text-tinta">
        <thead className="bg-superficie-2 border-b border-linea">
          <tr>
            <th className={ENCABEZADO}>Se fue</th>
            <th className={ENCABEZADO}>Volvió</th>
            <th className={`${ENCABEZADO} text-right`}>Duración</th>
            <th className={ENCABEZADO}>Origen</th>
            <th className={ENCABEZADO}>Afectado</th>
            <th className={ENCABEZADO}>Motores</th>
            <th className={ENCABEZADO}>Qué pasó</th>
            <th className={ENCABEZADO}>Reportó</th>
          </tr>
        </thead>
        <tbody>
          {apagones.map((a) => {
            const enCurso = a.fin === null;
            const afectado = [a.alcance === 'Áreas puntuales' ? null : a.alcance, ...a.areas].filter(Boolean).join(' · ');
            return (
              <tr key={a.id} className={`border-t border-linea ${enCurso ? 'bg-rojo-claro' : 'bg-superficie'}`}>
                <td className={`${CELDA} whitespace-nowrap font-semibold`}>{formatoMomento(a.inicio)}</td>
                <td className={`${CELDA} whitespace-nowrap`}>
                  {enCurso ? (
                    puedeCerrar ? (
                      <button type="button" onClick={() => onCerrar(a)} className="font-semibold text-rojo underline underline-offset-2">
                        En curso · registrar regreso
                      </button>
                    ) : (
                      <span className="font-semibold text-rojo">En curso</span>
                    )
                  ) : (
                    formatoFin(a)
                  )}
                </td>
                <td className={`${CELDA} text-right tabular-nums whitespace-nowrap ${enCurso ? 'text-rojo font-semibold' : ''}`}>
                  {formatoDuracion(duracionMinutos(a, ahora))}
                </td>
                <td className={`${CELDA} whitespace-nowrap`}>{a.origen ? ORIGEN_CORTO[a.origen] : '—'}</td>
                <td className={`${CELDA} min-w-[10rem]`}>{afectado || '—'}</td>
                <td className={`${CELDA} whitespace-nowrap`}>{a.motores.map((id) => nombres.get(id) ?? '?').join(', ') || '—'}</td>
                <td className={`${CELDA} min-w-[16rem] max-w-md text-tinta-suave`}>
                  {a.descripcion || a.acciones ? (
                    <>
                      {a.descripcion && <p className="line-clamp-3" title={a.descripcion}>{a.descripcion}</p>}
                      {a.acciones && (
                        <p className="line-clamp-2 mt-1" title={a.acciones}>
                          <span className="font-semibold text-tinta">Acciones:</span> {a.acciones}
                        </p>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${CELDA} whitespace-nowrap`}>
                  {a.reporta.split(' ')[0] || '—'}
                  {a.cierra && a.cierra !== a.reporta && <span className="block text-tinta-suave">cerró {a.cierra.split(' ')[0]}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
