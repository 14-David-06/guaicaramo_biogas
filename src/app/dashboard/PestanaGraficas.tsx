import { Bar, Doughnut, Line } from 'react-chartjs-2';
import Panel from '@/components/ui/Panel';
import { type DatosTablero, CLASE_TONO_TEXTO, dec, tonoH2S } from './formato';
import {
  obtenerDatosH2S,
  opcionesComposicion,
  opcionesEficiencia,
  opcionesEstados,
  opcionesPotencia,
  opcionesPresiones,
  opcionesTemperaturas,
  opcionesTendencia,
  prepararDatosComposicionGas,
  prepararDatosEficienciaMotor,
  prepararDatosEstadosMotores,
  prepararDatosPotenciaVsBiogas,
  prepararDatosPresionesBiofiltro,
  prepararDatosTemperaturasBiofiltro,
  prepararDatosTendenciaQuimicos
} from './graficas';

// Pestaña "Gráficas": calidad del gas, potencia, biofiltro y motores.

const BARRA_H2S = { ok: 'bg-hoja', alerta: 'bg-ambar-borde', critico: 'bg-rojo', neutro: 'bg-hoja' } as const;

function Cifra({ etiqueta, valor, unidad, nota }: { etiqueta: string; valor: string | number; unidad?: string; nota: string }) {
  return (
    <div className="rounded-lg border border-linea bg-superficie-2 px-3 py-3">
      <dt className="text-sm font-semibold text-tinta-suave">{etiqueta}</dt>
      <dd className="mt-0.5 font-condensada font-bold text-2xl leading-tight tabular-nums text-tinta">
        {valor}
        {unidad && <span className="ml-1 text-base font-semibold text-tinta-suave">{unidad}</span>}
      </dd>
      <dd className="text-sm text-tinta-suave">{nota}</dd>
    </div>
  );
}

export default function PestanaGraficas({ datosTurno }: { datosTurno: DatosTablero | null }) {
  const datosComposicion = prepararDatosComposicionGas(datosTurno);
  const h2s = obtenerDatosH2S(datosTurno);
  const datosPotencia = prepararDatosPotenciaVsBiogas(datosTurno);
  const datosTendencia = prepararDatosTendenciaQuimicos(datosTurno);

  return (
    <>
      {/* Calidad del gas */}
      {datosTurno && datosTurno.registrosJenbacher.length > 0 && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel titulo="Composición del gas" descripcion="Último registro Jenbacher.">
              <div className="h-56 sm:h-64">
                {datosComposicion && <Doughnut data={datosComposicion} options={opcionesComposicion()} />}
              </div>
              {h2s && (
                <div className="mt-5 rounded-lg border border-linea bg-superficie-2 p-4">
                  <div className="flex items-baseline justify-between gap-3 mb-2">
                    <span className="font-semibold text-tinta">H2S (ácido sulfhídrico)</span>
                    <span className={`font-condensada font-bold text-2xl tabular-nums ${CLASE_TONO_TEXTO[tonoH2S(h2s.actual)]}`}>
                      {dec(h2s.actual, 0)} <span className="text-base font-semibold text-tinta-suave">ppm</span>
                    </span>
                  </div>
                  <div className="relative h-2.5 bg-superficie border border-linea rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BARRA_H2S[tonoH2S(h2s.actual)]}`}
                      style={{ width: `${Math.min((h2s.actual / 500) * 100, 100)}%` }}
                    />
                    <span className="absolute top-0 bottom-0 w-0.5 bg-tinta-suave" style={{ left: '60%' }} aria-hidden="true" />
                  </div>
                  <div className="relative flex justify-between text-sm text-tinta-suave mt-1">
                    <span>0</span>
                    <span className="absolute -translate-x-1/2 font-semibold" style={{ left: '60%' }}>Límite 300</span>
                    <span>500 ppm</span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 mt-3">
                    <div className="text-center rounded-md bg-superficie border border-linea py-2">
                      <dt className="text-sm text-tinta-suave">Promedio</dt>
                      <dd className="font-semibold tabular-nums">{dec(h2s.promedio, 1)} ppm</dd>
                    </div>
                    <div className="text-center rounded-md bg-superficie border border-linea py-2">
                      <dt className="text-sm text-tinta-suave">Máximo</dt>
                      <dd className="font-semibold tabular-nums">{dec(h2s.maximo, 0)} ppm</dd>
                    </div>
                  </dl>
                </div>
              )}
            </Panel>

            <Panel titulo="Potencia y consumo de biogás" descripcion="Últimos 100 registros Jenbacher.">
              <div className="h-72 sm:h-96">
                {datosPotencia && <Bar data={datosPotencia} options={opcionesPotencia()} />}
              </div>
            </Panel>
          </div>

          <Panel titulo="Tendencia de los gases" descripcion="CH4, O2 y CO2 en porcentaje; H2S en ppm en el eje derecho (línea punteada).">
            <div className="h-72 sm:h-96">
              {datosTendencia && <Line data={datosTendencia} options={opcionesTendencia()} />}
            </div>
          </Panel>
        </>
      )}

      {/* Biofiltro y motores */}
      {datosTurno && (datosTurno.registrosJenbacher.length > 0 || datosTurno.estadosMotores.length > 0) && (
        <>
          {datosTurno.registrosJenbacher.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel titulo="Temperatura del biofiltro">
                <div className="h-64 sm:h-80">
                  {prepararDatosTemperaturasBiofiltro(datosTurno) && (
                    <Line data={prepararDatosTemperaturasBiofiltro(datosTurno)!} options={opcionesTemperaturas()} />
                  )}
                </div>
              </Panel>
              <Panel titulo="Presión del biofiltro">
                <div className="h-64 sm:h-80">
                  {prepararDatosPresionesBiofiltro(datosTurno) && (
                    <Line data={prepararDatosPresionesBiofiltro(datosTurno)!} options={opcionesPresiones()} />
                  )}
                </div>
              </Panel>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {datosTurno.estadosMotores.length > 0 && (
              <Panel titulo="Encendido y apagado de motores" descripcion="Cada cambio de estado registrado.">
                <div className="h-64 sm:h-80">
                  {prepararDatosEstadosMotores(datosTurno) && (
                    <Line data={prepararDatosEstadosMotores(datosTurno)!} options={opcionesEstados()} />
                  )}
                </div>
              </Panel>
            )}
            {datosTurno.registrosJenbacher.length > 0 && (
              <Panel titulo="Eficiencia del motor" descripcion="kW generados por cada m³ de biogás.">
                <div className="h-64 sm:h-80">
                  {prepararDatosEficienciaMotor(datosTurno) && (
                    <Line data={prepararDatosEficienciaMotor(datosTurno)!} options={opcionesEficiencia()} />
                  )}
                </div>
              </Panel>
            )}
          </div>

          {(() => {
            const registros = datosTurno.registrosJenbacher;
            const estados = datosTurno.estadosMotores;

            if (registros.length === 0 && estados.length === 0) return null;

            const tempEntradaPromedio = registros.length > 0
              ? registros.reduce((sum, r) => sum + (r.fields['TEMP. ENTRADA BIOFILTRO'] || 0), 0) / registros.length
              : 0;
            const tempSalidaPromedio = registros.length > 0
              ? registros.reduce((sum, r) => sum + (r.fields['TEMP. SALIDA BIOFILTRO'] || 0), 0) / registros.length
              : 0;
            const eficienciaPromedio = registros.length > 0
              ? registros.reduce((sum, r) => {
                  const potencia = r.fields['POTENCIA GENERADA(Kw)'] || 0;
                  const biogas = r.fields['M3 DE BIOGAS (M3)'] || 1;
                  return sum + (biogas > 0 ? potencia / biogas : 0);
                }, 0) / registros.length
              : 0;
            const tiempoEncendido = estados.filter((e) => e.fields['Estado Motor'] === 'Encendido').length;
            const disponibilidad = estados.length > 0 ? (tiempoEncendido / estados.length) * 100 : 0;

            return (
              <Panel titulo="Promedios del sistema">
                <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Cifra etiqueta="Diferencia de temperatura" valor={dec(tempEntradaPromedio - tempSalidaPromedio, 1)} unidad="°C" nota="Entrada menos salida del biofiltro" />
                  <Cifra etiqueta="Eficiencia" valor={dec(eficienciaPromedio, 2)} unidad="kW/m³" nota="Promedio de los registros" />
                  <Cifra etiqueta="Disponibilidad" valor={dec(disponibilidad, 1)} unidad="%" nota="Estados en encendido" />
                  <Cifra etiqueta="Encendidos" valor={tiempoEncendido} nota="Registros de encendido" />
                </dl>
              </Panel>
            );
          })()}
        </>
      )}

      {datosTurno && datosTurno.registrosJenbacher.length === 0 && datosTurno.estadosMotores.length === 0 && (
        <Panel>
          <p className="text-tinta-suave">No hay registros Jenbacher ni estados de motores en este período para graficar.</p>
        </Panel>
      )}
    </>
  );
}
