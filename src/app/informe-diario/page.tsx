'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BackgroundLayout from '@/components/BackgroundLayout';
import RoleGuard from '@/components/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { ayerBogota, hoyBogota, sumarDias } from '@/lib/informe/fechas';
import type { InformeDiario, Severidad } from '@/lib/informe/tipos';

const ESTILO_SEVERIDAD: Record<Severidad, { chip: string; borde: string; etiqueta: string }> = {
  critica: { chip: 'bg-red-500/20 text-red-300 border-red-400/40', borde: 'border-l-red-500', etiqueta: 'Crítica' },
  advertencia: { chip: 'bg-amber-500/20 text-amber-300 border-amber-400/40', borde: 'border-l-amber-500', etiqueta: 'Advertencia' },
  informativa: { chip: 'bg-gray-500/20 text-gray-300 border-gray-400/40', borde: 'border-l-gray-500', etiqueta: 'Informativa' }
};

function valor(v: number | null, unidad = ''): string {
  if (v === null) return '—';
  return `${v.toLocaleString('es-CO')}${unidad ? ' ' + unidad : ''}`;
}

/** Descarga un archivo de una API route y lo guarda con el nombre indicado. */
async function descargar(url: string, nombre: string) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => null);
    throw new Error(datos?.detalle || datos?.error || 'No se pudo generar el archivo.');
  }
  const blob = await respuesta.blob();
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(blob);
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(enlace.href);
}

function Tarjeta({ titulo, dato, sufijo }: { titulo: string; dato: number | null; sufijo?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <p className="text-gray-400 text-xs uppercase tracking-wide">{titulo}</p>
      <p className="text-white text-2xl font-bold mt-1">{valor(dato, sufijo)}</p>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function Tabla({ encabezados, filas }: { encabezados: string[]; filas: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-white/10">
          <tr>
            {encabezados.map((h) => (
              <th key={h} className="px-3 py-2 text-left text-gray-300 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-t border-white/5">
              {fila.map((celda, j) => (
                <td key={j} className="px-3 py-2 text-gray-200 align-top">{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContenidoInformeDiario() {
  const { user: loggedInUser, logout } = useAuth();
  const [fecha, setFecha] = useState(ayerBogota());
  const [informe, setInforme] = useState<InformeDiario | null>(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [desde, setDesde] = useState(sumarDias(ayerBogota(), -6));
  const [hasta, setHasta] = useState(ayerBogota());
  const [exportando, setExportando] = useState(false);

  const generar = useCallback(async (dia: string) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/informe-diario?fecha=${dia}&formato=json`);
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        throw new Error(datos.detalle || datos.error || 'No se pudo generar el informe.');
      }
      setInforme(datos);
    } catch (e) {
      setInforme(null);
      setError(e instanceof Error ? e.message : 'Error desconocido al generar el informe.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    generar(ayerBogota());
  }, [generar]);

  const descargarPdf = async () => {
    setDescargando(true);
    setError(null);
    try {
      const quien = loggedInUser?.nombre ? `Descargado por ${loggedInUser.nombre}` : 'Generación bajo demanda';
      await descargar(
        `/api/informe-diario?fecha=${fecha}&formato=pdf&generadoPor=${encodeURIComponent(quien)}`,
        `informe-biogas-${fecha}.pdf`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al descargar el PDF.');
    } finally {
      setDescargando(false);
    }
  };

  const exportarExcel = async () => {
    setExportando(true);
    setError(null);
    try {
      await descargar(
        `/api/consolidado?desde=${desde}&hasta=${hasta}`,
        desde === hasta ? `consolidado-biogas-${desde}.xlsx` : `consolidado-biogas-${desde}_a_${hasta}.xlsx`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido al exportar a Excel.');
    } finally {
      setExportando(false);
    }
  };

  const rangoRapido = (dias: number) => {
    setHasta(ayerBogota());
    setDesde(sumarDias(ayerBogota(), -(dias - 1)));
  };

  const criticas = informe?.excepciones.filter((e) => e.severidad === 'critica').length ?? 0;
  const advertencias = informe?.excepciones.filter((e) => e.severidad === 'advertencia').length ?? 0;

  const campoFecha =
    'w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-green-500';
  const botonSecundario =
    'bg-white/10 border border-white/20 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <BackgroundLayout>
      <div className="min-h-screen flex flex-col">
        <Navbar onLoginClick={() => {}} loggedInUser={loggedInUser} onLogout={logout} />

        <main className="pt-20 px-4 sm:px-6 lg:px-8 flex-grow">
          <div className="max-w-6xl mx-auto py-8">
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-white">Informe Diario</h1>
                  <p className="text-gray-400 text-sm sm:text-base">Consolidado de operación de un día completo, en PDF y Excel</p>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4 mb-8">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
                <h2 className="text-white font-semibold mb-3">Informe del día</h2>
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <div className="flex-grow">
                    <label htmlFor="fecha" className="block text-sm text-gray-300 mb-2">Fecha del informe</label>
                    <input
                      id="fecha"
                      type="date"
                      value={fecha}
                      max={hoyBogota()}
                      onChange={(e) => setFecha(e.target.value)}
                      className={campoFecha}
                    />
                  </div>
                  <button
                    onClick={() => generar(fecha)}
                    disabled={cargando}
                    className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cargando ? 'Generando…' : 'Generar'}
                  </button>
                  <button onClick={descargarPdf} disabled={descargando || cargando || !informe} className={botonSecundario}>
                    {descargando ? 'Preparando…' : 'PDF'}
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  El día se corta de 00:00 a 23:59 hora de Colombia, cubriendo los dos turnos de 12 horas.
                  Es el mismo contenido que se envía automáticamente por correo a las 6:00 a.m.
                </p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5">
                <h2 className="text-white font-semibold mb-3">Consolidado en Excel</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="desde" className="block text-sm text-gray-300 mb-2">Desde</label>
                    <input id="desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={campoFecha} />
                  </div>
                  <div>
                    <label htmlFor="hasta" className="block text-sm text-gray-300 mb-2">Hasta</label>
                    <input id="hasta" type="date" value={hasta} min={desde} max={hoyBogota()} onChange={(e) => setHasta(e.target.value)} className={campoFecha} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button onClick={() => rangoRapido(1)} className="text-xs text-gray-300 px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">Ayer</button>
                  <button onClick={() => rangoRapido(7)} className="text-xs text-gray-300 px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">Últimos 7 días</button>
                  <button onClick={() => rangoRapido(30)} className="text-xs text-gray-300 px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10">Últimos 30 días</button>
                  <button onClick={exportarExcel} disabled={exportando} className={`${botonSecundario} ml-auto`}>
                    {exportando ? 'Exportando…' : 'Descargar Excel'}
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-3">
                  Una fila por día con energía, m³, horas, calidad de gas y remoción de H2S, más hojas de detalle. Máximo 62 días.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-8 p-4 bg-red-500/10 border border-red-400/30 rounded-xl text-red-300">
                <p className="font-semibold">No se pudo completar la operación</p>
                <p className="text-sm text-red-300/80 mt-1">{error}</p>
              </div>
            )}

            {cargando && !informe && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
              </div>
            )}

            {informe && (
              <div className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
                <div className="mb-6">
                  <p className="text-white text-xl font-semibold capitalize">{informe.fechaLarga}</p>
                  <p className="text-gray-400 text-sm">
                    {informe.conteos.registrosJenbacher} registros Jenbacher ·{' '}
                    {informe.conteos.monitoreosMotor} monitoreos ·{' '}
                    {informe.conteos.cambiosEstado} cambios de estado ·{' '}
                    {informe.conteos.entradasBitacora} entradas de bitácora
                  </p>
                </div>

                {informe.sinDatos ? (
                  <div className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
                    <p className="text-white font-semibold">Sin registros operativos para esta fecha</p>
                    <p className="text-gray-400 text-sm mt-1">
                      No se encontró ningún turno, registro de operación ni bitácora en el día consultado.
                    </p>
                  </div>
                ) : (
                  <>
                    <Seccion titulo="Novedades y excepciones">
                      {informe.excepciones.length === 0 ? (
                        <div className="p-4 bg-green-500/10 border border-green-400/30 rounded-xl text-green-300 text-sm">
                          Sin novedades. Todos los parámetros dentro de rango y registros completos.
                        </div>
                      ) : (
                        <>
                          <p className="text-gray-400 text-sm mb-3">
                            {criticas} crítica(s), {advertencias} advertencia(s) — total{' '}
                            {informe.excepciones.length}
                          </p>
                          <div className="space-y-2">
                            {informe.excepciones.map((e, i) => {
                              const estilo = ESTILO_SEVERIDAD[e.severidad];
                              return (
                                <div key={i} className={`bg-white/5 border border-white/10 border-l-4 ${estilo.borde} rounded-xl p-4`}>
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${estilo.chip}`}>{estilo.etiqueta}</span>
                                    <span className="text-xs text-gray-400">{e.categoria}</span>
                                    {e.hora && <span className="text-xs text-gray-400">· {e.hora}</span>}
                                  </div>
                                  <p className="text-white font-medium">{e.titulo}</p>
                                  <p className="text-gray-400 text-sm mt-1">{e.detalle}</p>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </Seccion>

                    <Seccion titulo="Producción del día">
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                        <Tarjeta titulo="Energía generada" dato={informe.produccion.energiaGenerada} sufijo={informe.produccion.unidadEnergia} />
                        <Tarjeta titulo="Biogás consumido" dato={informe.produccion.m3Biogas} sufijo="m³" />
                        <Tarjeta titulo="Horas de operación" dato={informe.produccion.horasOperacion} sufijo="h" />
                        <Tarjeta titulo="Arranques" dato={informe.produccion.arranques} />
                        <Tarjeta titulo="Potencia promedio" dato={informe.produccion.potenciaPromedio} sufijo="kW" />
                        <Tarjeta titulo="Potencia máxima" dato={informe.produccion.potenciaMaxima} sufijo="kW" />
                      </div>
                      <p className="text-gray-500 text-xs mt-3">{informe.produccion.notaUnidades}</p>
                    </Seccion>

                    <Seccion titulo="Calidad del biogás">
                      <Tabla
                        encabezados={['Variable', 'Promedio', 'Mínimo', 'Máximo', 'Lecturas', 'Rango esperado', 'Fuera de rango']}
                        filas={informe.calidadGas.map((v) => [
                          `${v.nombre} (${v.unidad})`,
                          valor(v.promedio),
                          valor(v.minimo),
                          valor(v.maximo),
                          v.muestras,
                          v.referencia ?? '—',
                          v.fueraDeRango === undefined ? '—' : (
                            <span className={v.fueraDeRango > 0 ? 'text-red-400 font-semibold' : ''}>{v.fueraDeRango}</span>
                          )
                        ])}
                      />
                    </Seccion>

                    <Seccion titulo="Biofiltro">
                      <Tabla
                        encabezados={['Variable', 'Promedio', 'Mínimo', 'Máximo', 'Lecturas']}
                        filas={informe.biofiltro.map((v) => [
                          `${v.nombre} (${v.unidad})`,
                          valor(v.promedio),
                          valor(v.minimo),
                          valor(v.maximo),
                          v.muestras
                        ])}
                      />
                    </Seccion>

                    <Seccion titulo="Remoción de H2S">
                      {informe.remocionH2S.length === 0 ? (
                        <p className="text-gray-400 text-sm">
                          Sin mediciones de entrada y salida del filtro en este día. Se registran en{' '}
                          <a href="/remocion-h2s" className="text-green-400 underline">Remoción H2S</a>.
                        </p>
                      ) : (
                        <Tabla
                          encabezados={['Hora', 'Entrada ppm', 'Salida biofiltro', 'Salida biochar', '% biofiltro', '% biochar', '% total', 'Operador']}
                          filas={informe.remocionH2S.map((m) => [
                            m.hora,
                            valor(m.entradaBiofiltro),
                            valor(m.salidaBiofiltro),
                            valor(m.salidaBiochar),
                            valor(m.remocionBiofiltro, '%'),
                            valor(m.remocionBiochar, '%'),
                            <strong key="t">{valor(m.remocionTotal, '%')}</strong>,
                            m.operador || '—'
                          ])}
                        />
                      )}
                    </Seccion>

                    {informe.motores.length > 0 && (
                      <Seccion titulo="Motores">
                        <Tabla
                          encabezados={['Motor', 'Horas', 'Arranques', informe.produccion.unidadEnergia, 'm³', 'Estado final', 'Cambios de estado']}
                          filas={informe.motores.map((m) => [
                            <span key="n">
                              {m.nombre}
                              {m.registroIncompleto && (
                                <span className="text-amber-400" title="Producción parcial: registros sin cierre">{' '}*</span>
                              )}
                            </span>,
                            valor(m.horasOperacion),
                            valor(m.arranques),
                            valor(m.energiaGenerada),
                            valor(m.m3Consumidos),
                            m.estadoFinal ?? 'Sin cambios',
                            m.cambiosEstado.map((c) => `${c.hora} ${c.estado}`).join(' · ') || '—'
                          ])}
                        />
                        {informe.motores.some((m) => m.registroIncompleto) && (
                          <p className="text-gray-500 text-xs mt-2">
                            * Producción parcial: hay registros de monitoreo sin valores de cierre.
                          </p>
                        )}
                      </Seccion>
                    )}

                    {informe.turnos.length > 0 && (
                      <Seccion titulo="Turnos">
                        <Tabla
                          encabezados={['Operador', 'Inicio', 'Fin', 'Duración', 'Estado']}
                          filas={informe.turnos.map((t) => [
                            t.operador || '—',
                            t.inicio ?? '—',
                            t.fin ?? '—',
                            t.duracionHoras === null ? '—' : `${t.duracionHoras} h`,
                            <span key="e" className={t.cerrado ? 'text-gray-300' : 'text-amber-400'}>
                              {t.cerrado ? 'Cerrado' : 'Abierto'}
                            </span>
                          ])}
                        />
                      </Seccion>
                    )}

                    {informe.medicionesBiodigestores.length > 0 && (
                      <Seccion titulo="Mediciones de biodigestores">
                        <Tabla
                          encabezados={['Hora', 'Biodigestor', 'CH4 %', 'CO2 %', 'O2 %', 'H2S ppm', 'CO', 'NO', 'Operador']}
                          filas={informe.medicionesBiodigestores.map((m) => [
                            m.hora,
                            m.biodigestor || '—',
                            valor(m.ch4),
                            valor(m.co2),
                            valor(m.o2),
                            valor(m.h2s),
                            valor(m.co),
                            valor(m.no),
                            m.operador || '—'
                          ])}
                        />
                      </Seccion>
                    )}

                    {informe.bitacora.length > 0 && (
                      <Seccion titulo="Bitácora de operadores">
                        <div className="space-y-3">
                          {informe.bitacora.map((b, i) => (
                            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                              <p className="text-gray-400 text-xs mb-1">
                                {b.hora} · {b.operador || 'Operador no identificado'}
                              </p>
                              <p className="text-gray-200 text-sm">{b.informeEjecutivo || b.transcripcion}</p>
                            </div>
                          ))}
                        </div>
                      </Seccion>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </main>

        <Footer />
      </div>
    </BackgroundLayout>
  );
}

export default function InformeDiarioPage() {
  return (
    <RoleGuard
      allowedRoles={['Ingeniera - Jefe de planta', 'Jefe director de planta', 'Desarrollador', 'CTO', 'CEO']}
      fallbackMessage="El informe diario está disponible solo para jefatura y dirección."
    >
      <ContenidoInformeDiario />
    </RoleGuard>
  );
}
