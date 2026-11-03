import Panel from '@/components/ui/Panel';
import type { EstadoMotor } from '@/utils/airtable';
import { type DatosTablero, CLASE_TONO_CELDA, TABLA, fechaCorta, nombreDeMotor, tonoGas } from './formato';

// Pestaña "Detalle": turno, registros Jenbacher, estados y monitoreo de
// motores y bitácora, tal como llegan de Airtable.

function Contador({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-superficie-2 border border-linea px-3 py-0.5 text-sm font-semibold text-tinta-suave tabular-nums">
      {n}
    </span>
  );
}

function CampoTurno({ etiqueta, children, className = '' }: { etiqueta: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg bg-superficie-2 border border-linea px-3 py-2.5 min-w-0 ${className}`}>
      <dt className="text-sm text-tinta-suave">{etiqueta}</dt>
      <dd className="font-semibold text-tinta truncate">{children}</dd>
    </div>
  );
}

function celdaGas(campo: string, valor: unknown, unidad: string) {
  const tono = tonoGas(campo, valor);
  return (
    <td className={`${TABLA.td} ${CLASE_TONO_CELDA[tono]}`}>
      {valor ? `${valor} ${unidad}` : '—'}
    </td>
  );
}

export default function PestanaDetalle({ datosTurno, ultimosEstados, obtenerNombreMotor }: {
  datosTurno: DatosTablero;
  ultimosEstados: EstadoMotor[];
  obtenerNombreMotor: (id: string | string[]) => string;
}) {
  return (
    <>
      <Panel titulo="Turno">
        {datosTurno.turno ? (
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <CampoTurno etiqueta="Estado">
              <span className="inline-flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-hoja" aria-hidden="true" />
                Activo
              </span>
            </CampoTurno>
            <CampoTurno etiqueta="Operador">{datosTurno.turno.fields['Realiza Registro'] || '—'}</CampoTurno>
            <CampoTurno etiqueta="Inicio" className="col-span-2 sm:col-span-1">
              {fechaCorta(datosTurno.turno.fields['Fecha Inicio'], '—')}
            </CampoTurno>
            <CampoTurno etiqueta="Cierre" className="col-span-2 sm:col-span-1">
              {datosTurno.turno.fields['Fecha Fin'] ? fechaCorta(datosTurno.turno.fields['Fecha Fin'], '—') : 'En curso'}
            </CampoTurno>
            <CampoTurno etiqueta="ID del operador">
              <span className="font-mono text-sm">
                {Array.isArray(datosTurno.turno.fields['ID_Operador'])
                  ? String(datosTurno.turno.fields['ID_Operador'][0] || '').slice(0, 8)
                  : String(datosTurno.turno.fields['ID_Operador'] || 'N/A').slice(0, 8)}…
              </span>
            </CampoTurno>
            <CampoTurno etiqueta="Nombre">
              {Array.isArray(datosTurno.turno.fields['Nombre del Operador'])
                ? datosTurno.turno.fields['Nombre del Operador'].join(', ')
                : datosTurno.turno.fields['Nombre del Operador'] || '—'}
            </CampoTurno>
          </dl>
        ) : (
          <p className="text-tinta-suave">No hay un turno abierto.</p>
        )}
      </Panel>

      <Panel
        titulo="Registros Jenbacher"
        descripcion="En rojo o ámbar, los gases fuera del rango del protocolo de encendido."
        acciones={<Contador n={datosTurno.registrosJenbacher.length} />}
      >
        {datosTurno.registrosJenbacher.length > 0 ? (
          <div className={TABLA.contenedor}>
            <table className="w-full min-w-[760px] text-sm sm:text-base">
              <thead className={TABLA.thead}>
                <tr>
                  {['N.º', 'Fecha', 'Biogás (m³)', 'Potencia', 'CH4', 'O2', 'CO2', 'H2S'].map((t) => (
                    <th key={t} className={TABLA.th}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datosTurno.registrosJenbacher.map((registro, index) => (
                  <tr key={registro.id || index} className={TABLA.fila}>
                    <td className={`${TABLA.td} text-tinta-suave`}>{index + 1}</td>
                    <td className={TABLA.td}>{fechaCorta(registro.fields['Fecha Registro'], '—')}</td>
                    <td className={`${TABLA.td} font-semibold`}>{registro.fields['M3 DE BIOGAS (M3)'] || 0}</td>
                    <td className={TABLA.td}>{registro.fields['POTENCIA GENERADA(Kw)'] ? `${registro.fields['POTENCIA GENERADA(Kw)']} kW` : '—'}</td>
                    {celdaGas('METANO(CH4)%', registro.fields['METANO(CH4)%'], '%')}
                    {celdaGas('OXIGENO(O2) %', registro.fields['OXIGENO(O2) %'], '%')}
                    {celdaGas('DIOXIDO DE CARBONO(CO2) %', registro.fields['DIOXIDO DE CARBONO(CO2) %'], '%')}
                    {celdaGas('ACIDO SULFIDRICO(H2S)', registro.fields['ACIDO SULFIDRICO(H2S)'], 'ppm')}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-tinta-suave">No hay registros Jenbacher en este período.</p>
        )}
      </Panel>

      <Panel titulo="Estado actual de los motores" acciones={<Contador n={ultimosEstados.length} />}>
        {ultimosEstados.length > 0 ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ultimosEstados.map((estado, index) => {
              const nombreMotor = nombreDeMotor(estado.fields['Motor'], obtenerNombreMotor, index);
              const encendido = estado.fields['Estado Motor'] === 'Encendido';
              return (
                <li key={estado.id || index} className="flex items-center gap-3 rounded-lg border border-linea bg-superficie-2 px-3 py-3">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${encendido ? 'bg-hoja' : 'bg-rojo'}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-tinta truncate" title={nombreMotor}>{nombreMotor}</p>
                    <p className="text-sm text-tinta-suave truncate">
                      <span className={encendido ? 'text-bosque font-semibold' : 'text-rojo font-semibold'}>{estado.fields['Estado Motor']}</span>
                      {' · '}
                      {fechaCorta(estado.fields['Fecha y Hora'], '—')}
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

      <Panel titulo="Monitoreo de motores" descripcion="Lectura inicial y final de cada contador." acciones={<Contador n={datosTurno.monitoreoMotores.length} />}>
        {datosTurno.monitoreoMotores.length > 0 ? (
          <div className={TABLA.contenedor}>
            <table className="w-full min-w-[680px] text-sm sm:text-base">
              <thead className={TABLA.thead}>
                <tr>
                  {['N.º', 'Fecha', 'Motor', 'Horómetro', 'm³', 'kW'].map((t) => (
                    <th key={t} className={TABLA.th}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datosTurno.monitoreoMotores.map((monitoreo, index) => (
                  <tr key={monitoreo.id || index} className={TABLA.fila}>
                    <td className={`${TABLA.td} text-tinta-suave`}>{index + 1}</td>
                    <td className={TABLA.td}>{fechaCorta(monitoreo.fields['Fecha de creacion'], '—')}</td>
                    <td className={`${TABLA.td} font-semibold`}>{obtenerNombreMotor(monitoreo.fields['Nombre Motor'])}</td>
                    <td className={TABLA.td}>{monitoreo.fields['Horometro Inicial'] || 0} → {monitoreo.fields['Horometro Final'] || 0}</td>
                    <td className={TABLA.td}>{monitoreo.fields['M3 de Inicio'] || 0} → {monitoreo.fields['M3 de Fin'] || 0}</td>
                    <td className={TABLA.td}>{monitoreo.fields['Kw de Inicio'] || 0} → {monitoreo.fields['Kw de Fin'] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-tinta-suave">No hay monitoreo de motores registrado.</p>
        )}
      </Panel>

      <Panel titulo="Bitácora de biogás" acciones={<Contador n={datosTurno.bitacoraBiogas.length} />}>
        {datosTurno.bitacoraBiogas.length > 0 ? (
          <ul className="divide-y divide-linea -my-3">
            {datosTurno.bitacoraBiogas.map((bitacora, index) => (
              <li key={bitacora.id || index} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-2">
                  <span className="text-tinta-suave tabular-nums">n.º {index + 1}</span>
                  <span className="font-semibold text-tinta">{bitacora.fields['Realiza Registro'] || 'Sin operador'}</span>
                  <span className="text-sm text-tinta-suave">
                    {typeof bitacora.fields['Fecha de creacion'] === 'string'
                      ? new Date(bitacora.fields['Fecha de creacion']).toLocaleString('es-CO')
                      : 'Sin fecha'}
                  </span>
                </div>
                {bitacora.fields['Transcripción Operador'] && (
                  <div className="mb-2">
                    <p className="text-sm font-semibold text-tinta-suave mb-1">Lo que dictó el operador</p>
                    <p className="bg-superficie-2 border border-linea rounded-lg px-3 py-2 text-tinta whitespace-pre-line">{bitacora.fields['Transcripción Operador']}</p>
                  </div>
                )}
                {bitacora.fields['Informe ejecutivo'] && (
                  <div>
                    <p className="text-sm font-semibold text-tinta-suave mb-1">Informe</p>
                    <p className="bg-superficie-2 border border-linea rounded-lg px-3 py-2 text-tinta whitespace-pre-line">{bitacora.fields['Informe ejecutivo']}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-tinta-suave">No hay entradas en la bitácora.</p>
        )}
      </Panel>
    </>
  );
}
