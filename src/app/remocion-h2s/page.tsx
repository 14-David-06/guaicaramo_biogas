'use client';

import { useCallback, useEffect, useState } from 'react';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import { hoyBogota } from '@/lib/informe/fechas';

// Captura y seguimiento de la remoción de H2S del tren de filtrado:
// entrada → biofiltro → filtro de biochar → motores.
// Con el equipo portátil se mide el H2S en cada punto; la app calcula el %
// removido por cada etapa y la tendencia, y el informe diario lo incluye.

interface Medicion {
  id: string;
  fecha: string;
  hora: string;
  operador: string;
  entradaBiofiltro: number | null;
  salidaBiofiltro: number | null;
  salidaBiochar: number | null;
  remocionBiofiltro: number | null;
  remocionBiochar: number | null;
  remocionTotal: number | null;
}

function valor(v: number | null, unidad = ''): string {
  if (v === null) return '—';
  return `${v.toLocaleString('es-CO')}${unidad ? ' ' + unidad : ''}`;
}

/** % de remoción calculado en vivo mientras el operario digita. */
function vistaPrevia(antes: string, despues: string): number | null {
  const a = Number(antes);
  const d = Number(despues);
  if (antes === '' || despues === '' || !Number.isFinite(a) || !Number.isFinite(d) || a <= 0) return null;
  return Math.round(((a - d) / a) * 1000) / 10;
}

const COLUMNAS: { titulo: string; derecha?: boolean }[] = [
  { titulo: 'Fecha' },
  { titulo: 'Hora' },
  { titulo: 'Entrada (ppm)', derecha: true },
  { titulo: 'Salida biofiltro (ppm)', derecha: true },
  { titulo: 'Salida biochar (ppm)', derecha: true },
  { titulo: '% biofiltro', derecha: true },
  { titulo: '% biochar', derecha: true },
  { titulo: '% total', derecha: true },
  { titulo: 'Operador' }
];

export default function RemocionH2SPage() {
  const { user: loggedInUser } = useAuth();
  const [mediciones, setMediciones] = useState<Medicion[]>([]);
  const [remocionMinima, setRemocionMinima] = useState(80);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const [entrada, setEntrada] = useState('');
  const [salidaBiofiltro, setSalidaBiofiltro] = useState('');
  const [salidaBiochar, setSalidaBiochar] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await fetch('/api/remocion-h2s?dias=30');
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.detalle || datos.error);
      setMediciones(datos.mediciones);
      setRemocionMinima(datos.remocionMinima);
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudieron cargar las mediciones.' });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggedInUser) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const respuesta = await fetch('/api/remocion-h2s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operador: loggedInUser.nombre,
          entradaBiofiltro: entrada,
          salidaBiofiltro,
          salidaBiochar
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos.detalle || datos.error);
      setEntrada('');
      setSalidaBiofiltro('');
      setSalidaBiochar('');
      setMensaje({ tipo: 'ok', texto: 'Medición guardada.' });
      cargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar la medición. Revise la conexión e intente de nuevo.' });
    } finally {
      setGuardando(false);
    }
  };

  const previaBiofiltro = vistaPrevia(entrada, salidaBiofiltro);
  const previaTotal = vistaPrevia(entrada, salidaBiochar || salidaBiofiltro);
  const totales = mediciones.map((m) => m.remocionTotal).filter((v): v is number => v !== null);
  const promedio = totales.length ? Math.round((totales.reduce((a, b) => a + b, 0) / totales.length) * 10) / 10 : null;
  const ultima = mediciones[0];

  // Resumen: solo con las mediciones de 30 días que ya trae la página.
  const bajoMinimo = (v: number | null) => v !== null && v < remocionMinima;
  const hoy = hoyBogota();
  const deHoy = mediciones.filter((m) => m.fecha === hoy).length;
  const fueraDeRango = mediciones.filter((m) => bajoMinimo(m.remocionTotal)).length;
  const puedeGuardar = !!entrada && (!!salidaBiofiltro || !!salidaBiochar);

  const indicadores = [
    {
      etiqueta: 'Última remoción total',
      valor: valor(ultima?.remocionTotal ?? null),
      unidad: ultima?.remocionTotal != null ? '%' : undefined,
      detalle: ultima ? `${ultima.fecha} ${ultima.hora}${ultima.operador ? ` · ${ultima.operador}` : ''}` : 'Sin mediciones',
      tono: bajoMinimo(ultima?.remocionTotal ?? null) ? ('alerta' as const) : undefined
    },
    {
      etiqueta: 'Promedio 30 días',
      valor: valor(promedio),
      unidad: promedio !== null ? '%' : undefined,
      detalle: `Mínimo esperado ${remocionMinima} %`,
      tono: bajoMinimo(promedio) ? ('alerta' as const) : undefined
    },
    {
      etiqueta: 'Mediciones hoy',
      valor: deHoy,
      detalle: `${mediciones.length} en los últimos 30 días`
    },
    {
      etiqueta: 'Bajo el mínimo',
      valor: fueraDeRango,
      detalle: `Remoción total menor a ${remocionMinima} % en 30 días`,
      tono: fueraDeRango > 0 ? ('alerta' as const) : undefined
    }
  ];

  const campoNumero = `${claseCampo} text-lg font-semibold tabular-nums`;

  return (
    <TurnoGuard>
      <Pagina>
        <EncabezadoPagina
          titulo="Remoción de H2S"
          descripcion="H2S antes y después del biofiltro y del filtro de biochar, con el porcentaje que remueve cada etapa."
        />

        {!cargando && <Indicadores items={indicadores} />}

        <form onSubmit={guardar}>
          <Panel
            titulo="Nueva medición"
            descripcion="Valores en ppm, tomados con el equipo portátil. La entrada y al menos una salida son obligatorias."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="entrada" className={claseEtiqueta}>Entrada al biofiltro</label>
                  <input id="entrada" type="number" inputMode="decimal" min="0" step="any" required value={entrada} onChange={(e) => setEntrada(e.target.value)} className={campoNumero} />
                </div>
                <div>
                  <label htmlFor="salidaBiofiltro" className={claseEtiqueta}>Salida del biofiltro</label>
                  <input id="salidaBiofiltro" type="number" inputMode="decimal" min="0" step="any" value={salidaBiofiltro} onChange={(e) => setSalidaBiofiltro(e.target.value)} className={campoNumero} />
                </div>
                <div>
                  <label htmlFor="salidaBiochar" className={claseEtiqueta}>Salida del filtro de biochar</label>
                  <input id="salidaBiochar" type="number" inputMode="decimal" min="0" step="any" value={salidaBiochar} onChange={(e) => setSalidaBiochar(e.target.value)} className={campoNumero} />
                </div>
              </div>
  
              <dl className="grid grid-cols-2 bg-superficie-2 border border-linea rounded-lg divide-x divide-linea">
                <div className="px-4 py-3">
                  <dt className="text-sm font-semibold text-tinta-suave">Remoción biofiltro</dt>
                  <dd className="font-condensada font-bold text-2xl tabular-nums text-tinta">{valor(previaBiofiltro, '%')}</dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="text-sm font-semibold text-tinta-suave">Remoción total</dt>
                  <dd className={`font-condensada font-bold text-2xl tabular-nums ${bajoMinimo(previaTotal) ? 'text-ambar' : 'text-tinta'}`}>
                    {valor(previaTotal, '%')}
                  </dd>
                </div>
              </dl>
  
              {mensaje && (
                <Aviso tono={mensaje.tipo === 'ok' ? 'exito' : 'error'}>{mensaje.texto}</Aviso>
              )}
  
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="submit"
                  disabled={guardando || !puedeGuardar}
                  className={`${claseBoton('primario', 'lg')} w-full sm:w-auto`}
                >
                  {guardando ? 'Guardando…' : 'Guardar medición'}
                </button>
                {!puedeGuardar && !guardando && (
                  <p className="text-sm text-tinta-suave">Digite la entrada y al menos una salida para guardar.</p>
                )}
              </div>
            </div>
          </Panel>
        </form>

        <Panel titulo="Mediciones de los últimos 30 días" descripcion={mediciones.length > 0 ? `En ámbar, las de remoción total menor a ${remocionMinima} %.` : undefined}>
          {cargando ? (
            <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
              <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
              Cargando las mediciones…
            </div>
          ) : mediciones.length === 0 ? (
            <p className="text-tinta-suave py-6 text-center">Todavía no hay mediciones registradas en los últimos 30 días.</p>
          ) : (
            <div className="bg-superficie border border-linea rounded-xl overflow-x-auto">
              <table className="w-full text-sm sm:text-base">
                <thead className="bg-superficie-2">
                  <tr>
                    {COLUMNAS.map((c) => (
                      <th
                        key={c.titulo}
                        scope="col"
                        className={`px-3 py-2.5 font-condensada font-semibold text-tinta whitespace-nowrap ${c.derecha ? 'text-right' : 'text-left'}`}
                      >
                        {c.titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mediciones.map((m) => (
                    <tr key={m.id} className="border-t border-linea text-tinta">
                      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{m.fecha}</td>
                      <td className="px-3 py-2.5 tabular-nums">{m.hora}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{valor(m.entradaBiofiltro)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{valor(m.salidaBiofiltro)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{valor(m.salidaBiochar)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{valor(m.remocionBiofiltro, '%')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{valor(m.remocionBiochar, '%')}</td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-semibold whitespace-nowrap ${
                          bajoMinimo(m.remocionTotal) ? 'bg-ambar-claro text-ambar' : ''
                        }`}
                      >
                        {valor(m.remocionTotal, '%')}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{m.operador || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Pagina>
    </TurnoGuard>
  );
}
