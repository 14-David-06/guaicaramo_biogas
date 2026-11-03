'use client';

import { UMBRALES_PLANILLA_BIOFILTRO, UMBRALES_PLANILLA_GAS, type UmbralPlanilla } from '@/lib/informe/umbrales';
import { nombreCortoMotor } from '@/lib/planilla/campos';
import { ETIQUETA_GAS, GASES, PUNTOS_MEDICION, UNIDAD_GAS, type RespuestaPlanilla } from '@/lib/planilla/tipos';
import { estadoDeValor } from '@/lib/planilla/validacion';

// Vista de solo lectura con el mismo orden de columnas de la planilla en
// papel, para que la Ing. Jimena la revise como la conoce.

const SIGLA_PUNTO = { entrada_biofiltro: 'Ent.', salida_biofiltro: 'S. biof.', salida_biochar: 'S. bioch.' };

const COLOR_ESTADO = {
  vacio: 'text-tinta-tenue',
  invalido: 'text-rojo',
  ok: '',
  advertencia: 'bg-ambar-claro text-ambar font-semibold',
  critica: 'bg-rojo-claro text-rojo font-semibold'
};

function Celda({ valor, umbral }: { valor: number | null; umbral?: UmbralPlanilla }) {
  return (
    <td className={`px-2 py-1.5 text-center tabular-nums ${COLOR_ESTADO[estadoDeValor(valor, umbral)]}`}>
      {valor === null ? '—' : valor.toLocaleString('es-CO')}
    </td>
  );
}

export default function TablaPlanilla({ datos }: { datos: RespuestaPlanilla }) {
  // Columnas de motores: los que tienen lecturas ese día o, si no hay ninguna, los encendidos.
  const conLecturas = datos.franjas.flatMap((f) => f.lectura?.motores.map((m) => nombreCortoMotor(m.nombre)) ?? []);
  const encendidos = datos.motores.filter((m) => m.encendido).map((m) => nombreCortoMotor(m.nombre));
  const motores = [...new Set(conLecturas.length ? conLecturas : encendidos)].sort();
  const b = UMBRALES_PLANILLA_BIOFILTRO;
  const encabezado = 'px-2 py-2 font-condensada font-semibold text-tinta whitespace-nowrap text-center';

  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
      <table className="w-full text-sm text-tinta">
        <thead className="bg-superficie-2 border-b border-linea">
          <tr>
            <th rowSpan={2} className={`${encabezado} sticky left-0 z-10 bg-superficie-2`}>Hora</th>
            <th rowSpan={2} className={encabezado}>Digest.</th>
            {GASES.map((g) => (
              <th key={g} colSpan={3} className={`${encabezado} border-l border-linea`}>{ETIQUETA_GAS[g]} ({UNIDAD_GAS[g]})</th>
            ))}
            <th colSpan={2} className={`${encabezado} border-l border-linea`}>Presión (cm H2O)</th>
            <th colSpan={2} className={`${encabezado} border-l border-linea`}>Temp. biofiltro (°C)</th>
            <th colSpan={motores.length || 1} className={`${encabezado} border-l border-linea`}>Potencia (kW)</th>
            <th colSpan={motores.length || 1} className={`${encabezado} border-l border-linea`}>Biogás (m³)</th>
            <th rowSpan={2} className={`${encabezado} border-l border-linea`}>Sopl. ON</th>
            <th rowSpan={2} className={encabezado}>Registró</th>
            <th rowSpan={2} className={`${encabezado} text-left`}>Observaciones</th>
          </tr>
          <tr>
            {GASES.flatMap((g) =>
              PUNTOS_MEDICION.map((p, i) => (
                <th key={`${g}-${p}`} className={`${encabezado} text-xs ${i === 0 ? 'border-l border-linea' : ''}`}>{SIGLA_PUNTO[p]}</th>
              ))
            )}
            <th className={`${encabezado} text-xs border-l border-linea`}>Ent.</th>
            <th className={`${encabezado} text-xs`}>Sal.</th>
            <th className={`${encabezado} text-xs border-l border-linea`}>Ent.</th>
            <th className={`${encabezado} text-xs`}>Sal.</th>
            {[0, 1].flatMap((grupo) =>
              (motores.length ? motores : ['—']).map((m, i) => (
                <th key={`${grupo}-${m}`} className={`${encabezado} text-xs ${i === 0 ? 'border-l border-linea' : ''}`}>{m}</th>
              ))
            )}
          </tr>
          <tr className="bg-superficie-2 text-xs text-tinta-suave border-t border-linea">
            <td className="px-2 py-1 text-center" colSpan={2}>Parámetros</td>
            {GASES.flatMap((g) =>
              PUNTOS_MEDICION.map((p) => (
                <td key={`${g}-${p}`} className="px-2 py-1 text-center whitespace-nowrap">
                  {UMBRALES_PLANILLA_GAS[p][g].referencia.replace(` ${UNIDAD_GAS[g]}`, '')}
                </td>
              ))
            )}
            {[b.presionEntrada, b.presionSalida, b.tempEntrada, b.tempSalida].map((u) => (
              <td key={u.nombre} className="px-2 py-1 text-center whitespace-nowrap">{u.referencia.replace(` ${u.unidad}`, '')}</td>
            ))}
            <td colSpan={(motores.length || 1) * 2 + 3} />
          </tr>
        </thead>
        <tbody>
          {datos.franjas.map((f) => {
            const l = f.lectura;
            const actual = datos.fecha === datos.fechaActual && f.hora === datos.horaActual;
            const porMotor = new Map(l?.motores.map((m) => [nombreCortoMotor(m.nombre), m]) ?? []);
            return (
              <tr key={f.hora} className={`border-t border-linea ${actual ? 'bg-hoja-claro' : 'bg-superficie'} ${f.estado === 'futura' ? 'text-tinta-tenue' : ''}`}>
                <td className="px-2 py-1.5 font-condensada font-bold whitespace-nowrap sticky left-0 bg-inherit">{f.hora}</td>
                <td className="px-2 py-1.5 text-center whitespace-nowrap">
                  {l ? l.digestores.map((d) => d.replace(/biodigestor\s*/i, '')).join(' ') : '—'}
                </td>
                {GASES.flatMap((g) =>
                  PUNTOS_MEDICION.map((p) => <Celda key={`${g}-${p}`} valor={l?.gas[p][g] ?? null} umbral={UMBRALES_PLANILLA_GAS[p][g]} />)
                )}
                <Celda valor={l?.presionEntrada ?? null} umbral={b.presionEntrada} />
                <Celda valor={l?.presionSalida ?? null} umbral={b.presionSalida} />
                <Celda valor={l?.tempEntrada ?? null} umbral={b.tempEntrada} />
                <Celda valor={l?.tempSalida ?? null} umbral={b.tempSalida} />
                {(motores.length ? motores : ['—']).map((m) => <Celda key={`kw-${m}`} valor={porMotor.get(m)?.potenciaKw ?? null} />)}
                {(motores.length ? motores : ['—']).map((m) => <Celda key={`m3-${m}`} valor={porMotor.get(m)?.m3 ?? null} />)}
                <td className="px-2 py-1.5 text-center">{l ? l.sopladores.join(' ') || '—' : '—'}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{l ? `${l.operador} · ${l.guardadaA}` : f.estado === 'pendiente' ? <span className="font-semibold text-rojo">Sin registro</span> : '—'}</td>
                <td className="px-2 py-1.5 min-w-48">{l?.observaciones || ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
