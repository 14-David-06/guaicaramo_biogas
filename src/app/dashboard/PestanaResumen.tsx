import Panel from '@/components/ui/Panel';
import type { EstadoMotor } from '@/utils/airtable';
import { type DatosTablero, CLASE_TONO_TEXTO, dec, fechaCorta, nombreDeMotor, tonoGas } from './formato';
import type { TonoIndicador } from '@/components/ui/Indicadores';

// Pestaña "Resumen": motores, último registro Jenbacher, alertas, actividad
// reciente y promedios del período cargado.

function Cargando({ texto }: { texto: string }) {
  return (
    <div className="flex items-center gap-3 py-6 justify-center text-tinta-suave" role="status">
      <span className="w-5 h-5 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

function Dato({ etiqueta, valor, unidad, tono = 'neutro' }: { etiqueta: string; valor: React.ReactNode; unidad?: string; tono?: TonoIndicador }) {
  const fondo = tono === 'critico' ? 'bg-rojo-claro border-rojo-borde' : tono === 'alerta' ? 'bg-ambar-claro border-ambar-borde' : 'bg-superficie-2 border-linea';
  return (
    <div className={`rounded-lg border px-3 py-3 ${fondo}`}>
      <dt className="text-sm font-semibold text-tinta-suave">{etiqueta}</dt>
      <dd className={`mt-0.5 font-condensada font-bold text-2xl leading-tight tabular-nums ${CLASE_TONO_TEXTO[tono]}`}>
        {valor}
        {unidad && <span className="ml-1 text-base font-semibold text-tinta-suave">{unidad}</span>}
      </dd>
    </div>
  );
}

function MiniDato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="bg-superficie-2 rounded-md px-2 py-1.5 text-center">
      <p className="font-semibold text-tinta tabular-nums">{valor}</p>
      <p className="text-xs text-tinta-suave">{etiqueta}</p>
    </div>
  );
}

export default function PestanaResumen({ datosTurno, cargandoDatos, ultimosEstados, obtenerNombreMotor }: {
  datosTurno: DatosTablero | null;
  cargandoDatos: boolean;
  ultimosEstados: EstadoMotor[];
  obtenerNombreMotor: (id: string | string[]) => string;
}) {
  const apagados = ultimosEstados.filter((estado) => estado.fields['Estado Motor'] === 'Apagado');
  const temperaturasAltas = datosTurno
    ? datosTurno.monitoreoMotores.filter((monitoreo) => {
        const temp = monitoreo.fields['Temperatura'];
        return typeof temp === 'number' && temp > 40;
      })
    : [];

  return (
    <>
      {/* Estado de cada motor */}
      {datosTurno && (
        <Panel titulo="Motores" descripcion="Último estado registrado de cada motor.">
          {ultimosEstados.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {ultimosEstados.map((estado, index) => {
                const nombreMotor = nombreDeMotor(estado.fields['Motor'], obtenerNombreMotor, index);
                const estaEncendido = estado.fields['Estado Motor'] === 'Encendido';
                return (
                  <li
                    key={estado.id || index}
                    className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${
                      estaEncendido ? 'bg-superficie-2 border-linea' : 'bg-rojo-claro border-rojo-borde'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full shrink-0 ${estaEncendido ? 'bg-hoja' : 'bg-rojo'}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-tinta truncate" title={nombreMotor}>{nombreMotor}</p>
                      <p className={`text-sm ${estaEncendido ? 'text-tinta-suave' : 'text-rojo font-semibold'}`}>
                        {estaEncendido ? 'Encendido' : 'Apagado'} desde {fechaCorta(estado.fields['Fecha y Hora'], 'fecha desconocida')}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-tinta-suave">No hay estados de motores registrados.</p>
          )}
        </Panel>
      )}

      {/* Valores del último registro Jenbacher */}
      {datosTurno && datosTurno.registrosJenbacher.length > 0 && (
        <Panel
          titulo="Biogás y potencia"
          descripcion={`Registro Jenbacher del ${fechaCorta(datosTurno.registrosJenbacher[0]?.fields['Fecha Registro'])}`}
        >
          {(() => {
            const ultimoRegistro = datosTurno.registrosJenbacher[0];
            const ch4 = Number(ultimoRegistro?.fields['METANO(CH4)%']) || 0;
            const o2 = Number(ultimoRegistro?.fields['OXIGENO(O2) %']) || 0;
            const co2 = Number(ultimoRegistro?.fields['DIOXIDO DE CARBONO(CO2) %']) || 0;
            const h2s = Number(ultimoRegistro?.fields['ACIDO SULFIDRICO(H2S)']) || 0;
            const potencia = Number(ultimoRegistro?.fields['POTENCIA GENERADA(Kw)']) || 0;
            const m3Biogas = Number(ultimoRegistro?.fields['M3 DE BIOGAS (M3)']) || 0;
            const presion = Number(ultimoRegistro?.fields['PRESION DE BIOGAS(mbar)']) || 0;
            const horasMotor = Number(ultimoRegistro?.fields['HORAS MOTOR']) || 0;

            return (
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Dato etiqueta="CH4 (metano)" valor={dec(ch4, 1)} unidad="%" tono={tonoGas('METANO(CH4)%', ch4)} />
                <Dato etiqueta="O2 (oxígeno)" valor={dec(o2, 2)} unidad="%" tono={tonoGas('OXIGENO(O2) %', o2)} />
                <Dato etiqueta="CO2" valor={dec(co2, 1)} unidad="%" tono={tonoGas('DIOXIDO DE CARBONO(CO2) %', co2)} />
                <Dato etiqueta="H2S" valor={dec(h2s)} unidad="ppm" tono={tonoGas('ACIDO SULFIDRICO(H2S)', h2s)} />
                <Dato etiqueta="Potencia" valor={dec(potencia)} unidad="kW" />
                <Dato etiqueta="Biogás" valor={dec(m3Biogas, 1)} unidad="m³" />
                <Dato etiqueta="Presión" valor={presion} unidad="mbar" />
                <Dato etiqueta="Horas motor" valor={dec(horasMotor)} unidad="h" />
              </dl>
            );
          })()}
        </Panel>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Alertas */}
        <Panel titulo="Alertas" descripcion="Motores apagados y temperaturas sobre 40 °C.">
          {cargandoDatos ? (
            <Cargando texto="Cargando alertas…" />
          ) : datosTurno ? (
            <ul className="space-y-2">
              {apagados.map((estado, index) => {
                const nombreMotor = nombreDeMotor(estado.fields['Motor'], obtenerNombreMotor, index);
                return (
                  <li key={estado.id || index} className="flex items-start gap-3 rounded-lg border border-rojo-borde bg-rojo-claro px-3 py-3">
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-rojo shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-semibold text-rojo">{nombreMotor} apagado</p>
                      <p className="text-sm text-tinta-suave">
                        Fuera de operación desde {fechaCorta(estado.fields['Fecha y Hora'], 'fecha desconocida')}
                      </p>
                    </div>
                  </li>
                );
              })}

              {temperaturasAltas.slice(0, 2).map((monitoreo, index) => {
                const nombreMotor = nombreDeMotor(monitoreo.fields['Motor'], obtenerNombreMotor, index);
                const temp = monitoreo.fields['Temperatura'];
                return (
                  <li key={monitoreo.id || index} className="flex items-start gap-3 rounded-lg border border-ambar-borde bg-ambar-claro px-3 py-3">
                    <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-ambar-borde shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="font-semibold text-ambar">{nombreMotor}: temperatura de {temp} °C</p>
                      <p className="text-sm text-tinta-suave">
                        Por encima de 40 °C. Medida el {fechaCorta(monitoreo.fields['Fecha Monitoreo'])}
                      </p>
                    </div>
                  </li>
                );
              })}

              {apagados.length === 0 && temperaturasAltas.length === 0 && (
                <li className="flex items-center gap-3 rounded-lg border border-linea bg-superficie-2 px-3 py-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-hoja shrink-0" aria-hidden="true" />
                  <p className="text-tinta">Sin alertas: todos los motores están encendidos.</p>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-tinta-suave">No hay datos. Revise la conexión y toque «Actualizar».</p>
          )}
        </Panel>

        {/* Actividad reciente */}
        <Panel
          titulo="Últimos registros"
          descripcion={
            datosTurno
              ? `${datosTurno.registrosJenbacher.length + datosTurno.medicionBiodigestores.length + datosTurno.bitacoraBiogas.length} registros cargados entre Jenbacher, biodigestores y bitácora.`
              : undefined
          }
        >
          {cargandoDatos ? (
            <Cargando texto="Cargando actividad…" />
          ) : datosTurno ? (
            <ul className="divide-y divide-linea -my-2">
              {datosTurno.registrosJenbacher.slice(0, 2).map((registro, index) => {
                const m3 = registro.fields['M3 DE BIOGAS (M3)'] || 0;
                const potencia = registro.fields['POTENCIA GENERADA(Kw)'] || 0;
                const ch4 = registro.fields['METANO(CH4)%'] || 0;
                return (
                  <li key={registro.id || index} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-tinta">Registro Jenbacher n.º {datosTurno.registrosJenbacher.length - index}</p>
                      <p className="text-sm text-tinta-suave whitespace-nowrap">{fechaCorta(registro.fields['Fecha Registro'])}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <MiniDato etiqueta="Biogás" valor={`${typeof m3 === 'number' ? dec(m3, 1) : m3} m³`} />
                      <MiniDato etiqueta="Potencia" valor={`${potencia} kW`} />
                      <MiniDato etiqueta="CH4" valor={`${typeof ch4 === 'number' ? dec(ch4, 1) : ch4} %`} />
                    </div>
                  </li>
                );
              })}

              {datosTurno.medicionBiodigestores.slice(0, 1).map((medicion, index) => {
                const ch4Max = medicion.fields['CH4 (Max) %'] || 0;
                const co2Max = medicion.fields['CO2 (Max) %'] || 0;
                const h2sMax = medicion.fields['H2S (Max) ppm'] || 0;
                return (
                  <li key={medicion.id || index} className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold text-tinta">Medición de biodigestor</p>
                      <p className="text-sm text-tinta-suave whitespace-nowrap">{fechaCorta(medicion.fields['Fecha Medicion'])}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <MiniDato etiqueta="CH4 máx." valor={`${ch4Max} %`} />
                      <MiniDato etiqueta="CO2 máx." valor={`${co2Max} %`} />
                      <MiniDato etiqueta="H2S máx." valor={`${h2sMax} ppm`} />
                    </div>
                  </li>
                );
              })}

              {datosTurno.bitacoraBiogas.slice(0, 1).map((bitacora, index) => (
                <li key={bitacora.id || index} className="py-3 flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-tinta">Entrada en la bitácora</p>
                  <p className="text-sm text-tinta-suave whitespace-nowrap">{fechaCorta(bitacora.fields['Fecha de creacion'])}</p>
                </li>
              ))}

              {datosTurno.registrosJenbacher.length === 0 &&
                datosTurno.medicionBiodigestores.length === 0 &&
                datosTurno.bitacoraBiogas.length === 0 && (
                  <li className="py-3 text-tinta-suave">No hay registros en este período.</li>
                )}
            </ul>
          ) : (
            <p className="text-tinta-suave">No hay datos. Revise la conexión y toque «Actualizar».</p>
          )}
        </Panel>
      </div>

      {/* Promedios del período cargado */}
      {datosTurno && datosTurno.registrosJenbacher.length > 0 && (
        <Panel titulo="Promedios del período" descripcion="Calculados con los registros Jenbacher cargados.">
          {(() => {
            const registros = datosTurno.registrosJenbacher;
            const promedioCH4 = registros.reduce((sum, r) => sum + (r.fields['METANO(CH4)%'] || 0), 0) / registros.length;
            const promedioPotencia = registros.reduce((sum, r) => sum + (r.fields['POTENCIA GENERADA(Kw)'] || 0), 0) / registros.length;
            const totalBiogas = registros.reduce((sum, r) => sum + (r.fields['M3 DE BIOGAS (M3)'] || 0), 0);
            const maxH2S = Math.max(...registros.map((r) => r.fields['ACIDO SULFIDRICO(H2S)'] || 0));
            return (
              <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <Dato etiqueta="CH4 promedio (meta > 50 %)" valor={dec(promedioCH4, 1)} unidad="%" tono={tonoGas('METANO(CH4)%', promedioCH4)} />
                <Dato etiqueta="Potencia promedio" valor={dec(promedioPotencia, 0)} unidad="kW" />
                <Dato etiqueta="Biogás total" valor={dec(totalBiogas, 1)} unidad="m³" />
                <Dato etiqueta="H2S máximo" valor={dec(maxH2S)} unidad="ppm" tono={tonoGas('ACIDO SULFIDRICO(H2S)', maxH2S)} />
              </dl>
            );
          })()}
        </Panel>
      )}
    </>
  );
}
