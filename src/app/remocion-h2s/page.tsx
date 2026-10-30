'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import TurnoGuard from '@/components/TurnoGuard';
import { useAuth } from '@/hooks/useAuth';

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

export default function RemocionH2SPage() {
  const { user: loggedInUser, logout } = useAuth();
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
      setMensaje({ tipo: 'ok', texto: 'Medición registrada.' });
      cargar();
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo registrar la medición.' });
    } finally {
      setGuardando(false);
    }
  };

  const previaBiofiltro = vistaPrevia(entrada, salidaBiofiltro);
  const previaTotal = vistaPrevia(entrada, salidaBiochar || salidaBiofiltro);
  const totales = mediciones.map((m) => m.remocionTotal).filter((v): v is number => v !== null);
  const promedio = totales.length ? Math.round((totales.reduce((a, b) => a + b, 0) / totales.length) * 10) / 10 : null;
  const ultima = mediciones[0];

  const campo =
    'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <TurnoGuard>
      <BackgroundLayout>
        <div className="min-h-screen flex flex-col">
          <Navbar onLoginClick={() => {}} loggedInUser={loggedInUser} onLogout={logout} />

          <main className="pt-20 px-4 sm:px-6 lg:px-8 flex-grow">
            <div className="max-w-5xl mx-auto py-8">
              <div className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">Remoción de H2S</h1>
                <p className="text-gray-400 text-sm sm:text-base">
                  H2S antes y después del biofiltro y del filtro de biochar, con el porcentaje removido por etapa
                </p>
              </div>

              <div className="grid lg:grid-cols-5 gap-6 mb-8">
                <form onSubmit={guardar} className="lg:col-span-3 bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                  <h2 className="text-white font-semibold">Nueva medición (ppm)</h2>
                  <div>
                    <label htmlFor="entrada" className="block text-sm text-gray-300 mb-2">Entrada al biofiltro *</label>
                    <input id="entrada" type="number" inputMode="decimal" min="0" step="any" required value={entrada} onChange={(e) => setEntrada(e.target.value)} className={campo} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="salidaBiofiltro" className="block text-sm text-gray-300 mb-2">Salida del biofiltro</label>
                      <input id="salidaBiofiltro" type="number" inputMode="decimal" min="0" step="any" value={salidaBiofiltro} onChange={(e) => setSalidaBiofiltro(e.target.value)} className={campo} />
                    </div>
                    <div>
                      <label htmlFor="salidaBiochar" className="block text-sm text-gray-300 mb-2">Salida del filtro de biochar</label>
                      <input id="salidaBiochar" type="number" inputMode="decimal" min="0" step="any" value={salidaBiochar} onChange={(e) => setSalidaBiochar(e.target.value)} className={campo} />
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Remoción biofiltro: <strong className="text-white">{valor(previaBiofiltro, '%')}</strong>
                    {' · '}Remoción total: <strong className="text-white">{valor(previaTotal, '%')}</strong>
                  </p>
                  {mensaje && (
                    <p className={mensaje.tipo === 'ok' ? 'text-green-300 text-sm' : 'text-red-300 text-sm'}>{mensaje.texto}</p>
                  )}
                  <button
                    type="submit"
                    disabled={guardando || !entrada || (!salidaBiofiltro && !salidaBiochar)}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {guardando ? 'Guardando…' : 'Registrar medición'}
                  </button>
                </form>

                <div className="lg:col-span-2 grid grid-cols-2 lg:grid-cols-1 gap-4 content-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Remoción promedio (30 días)</p>
                    <p className={`text-3xl font-bold mt-1 ${promedio !== null && promedio < remocionMinima ? 'text-amber-400' : 'text-white'}`}>
                      {valor(promedio, '%')}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">Mínimo esperado {remocionMinima} %</p>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <p className="text-gray-400 text-xs uppercase tracking-wide">Última medición</p>
                    <p className="text-3xl font-bold mt-1 text-white">{valor(ultima?.remocionTotal ?? null, '%')}</p>
                    <p className="text-gray-500 text-xs mt-1">{ultima ? `${ultima.fecha} ${ultima.hora} · ${ultima.operador}` : 'Sin mediciones'}</p>
                  </div>
                </div>
              </div>

              <section>
                <h2 className="text-lg font-semibold text-white mb-3">Mediciones de los últimos 30 días</h2>
                {cargando ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-500"></div>
                  </div>
                ) : mediciones.length === 0 ? (
                  <p className="text-gray-400 text-sm">Aún no hay mediciones registradas.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-white/10">
                        <tr>
                          {['Fecha', 'Hora', 'Entrada', 'Salida biofiltro', 'Salida biochar', '% biofiltro', '% biochar', '% total', 'Operador'].map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-gray-300 font-medium whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mediciones.map((m) => (
                          <tr key={m.id} className="border-t border-white/5 text-gray-200">
                            <td className="px-3 py-2 whitespace-nowrap">{m.fecha}</td>
                            <td className="px-3 py-2">{m.hora}</td>
                            <td className="px-3 py-2">{valor(m.entradaBiofiltro)}</td>
                            <td className="px-3 py-2">{valor(m.salidaBiofiltro)}</td>
                            <td className="px-3 py-2">{valor(m.salidaBiochar)}</td>
                            <td className="px-3 py-2">{valor(m.remocionBiofiltro, '%')}</td>
                            <td className="px-3 py-2">{valor(m.remocionBiochar, '%')}</td>
                            <td className={`px-3 py-2 font-semibold ${m.remocionTotal !== null && m.remocionTotal < remocionMinima ? 'text-amber-400' : ''}`}>
                              {valor(m.remocionTotal, '%')}
                            </td>
                            <td className="px-3 py-2">{m.operador || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </main>

          <Footer />
        </div>
      </BackgroundLayout>
    </TurnoGuard>
  );
}
