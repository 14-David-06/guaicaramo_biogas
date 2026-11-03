'use client';

import { useState } from 'react';
import Aviso from '@/components/ui/Aviso';
import Panel from '@/components/ui/Panel';
import { claseBoton, claseCampo } from '@/components/ui/estilos';
import { formatearFechaCorta } from '@/lib/informe/fechas';
import { nombreCortoMotor } from '@/lib/planilla/campos';
import {
  CONTADORES, CONTADORES_VACIOS, DEFINICION_CONTADOR, deltasDelDia, validarOperacion,
  type CamposContadores, type OperacionMotor, type ValoresContadores
} from '@/lib/planilla/operacion';
import type { MotorPlanilla, RespuestaPlanilla } from '@/lib/planilla/tipos';
import { leerNumero } from '@/lib/planilla/validacion';

// Bloque "Datos de operación" del formato en papel: horómetro, m³, kW y
// n.º de arranques, inicial y final, de cada motor, una vez por día.
// Los finales solo se habilitan después de guardar los iniciales.

const formato = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

function aCampos(v: ValoresContadores | undefined): CamposContadores {
  return v ? (Object.fromEntries(CONTADORES.map((c) => [c, String(v[c])])) as CamposContadores) : CONTADORES_VACIOS;
}

function Celda({ id, etiqueta, valor, onChange }: { id: string; etiqueta: string; valor: string; onChange: (v: string) => void }) {
  const invalido = leerNumero(valor) === 'invalido';
  return (
    <input
      id={id}
      aria-label={etiqueta}
      aria-invalid={invalido || undefined}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`${claseCampo} text-right text-lg font-semibold tabular-nums ${invalido ? 'border-rojo bg-rojo-claro' : ''}`}
    />
  );
}

function Valor({ valor }: { valor: number | null | undefined }) {
  return (
    <p className={`px-3 py-2.5 text-right text-lg font-semibold tabular-nums ${valor == null ? 'text-tinta-tenue' : 'text-tinta'}`}>
      {valor == null ? '—' : formato(valor)}
    </p>
  );
}

/** Casilla de final todavía no habilitada. */
function Bloqueada() {
  return (
    <div className="px-3 py-2.5 rounded-lg border border-dashed border-linea-fuerte bg-superficie text-right text-tinta-tenue" aria-hidden="true">
      —
    </div>
  );
}

function TarjetaMotor({ datos, motor, registro, finalAnterior, operador, onGuardado }: {
  datos: RespuestaPlanilla;
  motor: MotorPlanilla;
  registro: OperacionMotor | null;
  finalAnterior: ValoresContadores | undefined;
  operador: string;
  onGuardado: (mensaje: string) => void;
}) {
  const nombre = nombreCortoMotor(motor.nombre);
  // Los iniciales se sugieren con los finales del día anterior: el contador sigue donde quedó.
  const [inicial, setInicial] = useState<CamposContadores>(() => aCampos(finalAnterior));
  const [final, setFinal] = useState<CamposContadores>(CONTADORES_VACIOS);
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const completo = registro?.final != null;
  const editable = datos.editable && !datos.bloqueo && !completo;
  const conInicial = registro?.inicial != null;

  const cuerpo = () =>
    conInicial
      ? { fecha: datos.fecha, motorId: motor.id, operador, final }
      : { fecha: datos.fecha, motorId: motor.id, operador, inicial };

  // Vista previa del día con lo que hay en pantalla, para ver errores de digitación antes de guardar.
  const inicialVista = registro?.inicial ?? (CONTADORES.every((c) => typeof leerNumero(inicial[c]) === 'number')
    ? (Object.fromEntries(CONTADORES.map((c) => [c, leerNumero(inicial[c])])) as ValoresContadores)
    : null);
  const finalVista = registro?.final ?? (conInicial && CONTADORES.every((c) => typeof leerNumero(final[c]) === 'number')
    ? (Object.fromEntries(CONTADORES.map((c) => [c, leerNumero(final[c])])) as ValoresContadores)
    : null);
  const deltas = inicialVista && finalVista ? deltasDelDia(inicialVista, finalVista) : null;

  const distintoDeAyer =
    !conInicial && finalAnterior && inicialVista
      ? CONTADORES.filter((c) => inicialVista[c] !== finalAnterior[c])
      : [];

  const guardar = async () => {
    const { entrada, errores: encontrados } = validarOperacion(cuerpo(), registro?.inicial ?? null);
    setErrores(encontrados);
    if (!entrada) return;

    setGuardando(true);
    try {
      const respuesta = await fetch('/api/planilla-horaria/operacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo())
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setErrores(resultado.errores ?? [resultado.detalle || resultado.error]);
        return;
      }
      onGuardado(
        resultado.completo
          ? `Datos de operación de ${nombre} completos para el ${formatearFechaCorta(datos.fecha)}.`
          : `Valores iniciales de ${nombre} guardados. Registre los finales al cerrar la planilla.`
      );
    } catch {
      setErrores(['No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.']);
    } finally {
      setGuardando(false);
    }
  };

  const estado = completo
    ? { texto: 'Completo', clase: 'bg-hoja-claro text-bosque' }
    : conInicial
      ? { texto: 'Faltan los finales', clase: 'bg-ambar-claro text-ambar' }
      : { texto: 'Sin registrar', clase: 'bg-superficie-2 text-tinta-suave' };

  const textoBoton = conInicial ? `Guardar finales de ${nombre}` : `Guardar iniciales de ${nombre}`;
  const finalHabilitado = editable && conInicial;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="bg-superficie-2 border border-linea rounded-lg p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-3">
        <span className="font-condensada font-bold text-xl text-tinta">{nombre}</span>
        <span className="text-sm text-tinta-suave">{motor.nombre}</span>
        <span className={`ml-auto px-2.5 py-0.5 rounded-full text-sm font-semibold ${estado.clase}`}>{estado.texto}</span>
      </div>

      <div className="grid grid-cols-[minmax(0,6.5rem)_1fr_1fr] gap-x-2 gap-y-2 items-center">
        <div />
        <p className="text-sm font-semibold text-tinta-suave text-right pr-3">Inicial</p>
        <p className="text-sm font-semibold text-tinta-suave text-right pr-3">Final</p>
        {CONTADORES.map((c) => {
          const def = DEFINICION_CONTADOR[c];
          return (
            <div key={c} className="contents">
              <p className="font-semibold text-tinta leading-tight">
                {def.etiqueta}
                {def.unidad && <span className="block text-xs font-normal text-tinta-suave">{def.unidad}</span>}
              </p>
              {editable && !conInicial ? (
                <Celda
                  id={`op-${motor.id}-${c}-inicial`}
                  etiqueta={`${def.etiqueta} inicial de ${nombre}`}
                  valor={inicial[c]}
                  onChange={(v) => setInicial((a) => ({ ...a, [c]: v }))}
                />
              ) : (
                <Valor valor={registro?.inicial?.[c]} />
              )}
              {finalHabilitado ? (
                <Celda
                  id={`op-${motor.id}-${c}-final`}
                  etiqueta={`${def.etiqueta} final de ${nombre}`}
                  valor={final[c]}
                  onChange={(v) => setFinal((a) => ({ ...a, [c]: v }))}
                />
              ) : editable ? (
                <Bloqueada />
              ) : (
                <Valor valor={registro?.final?.[c]} />
              )}
            </div>
          );
        })}
      </div>

      {editable && !conInicial && finalAnterior && (
        <p className="mt-2 text-sm text-tinta-suave">
          Los iniciales vienen con los finales del día anterior. Corríjalos si el contador marca otra cosa.
        </p>
      )}
      {distintoDeAyer.length > 0 && (
        <p className="mt-2 text-sm font-semibold text-ambar">
          No coincide con el final del día anterior en {distintoDeAyer.map((c) => DEFINICION_CONTADOR[c].etiqueta.toLowerCase()).join(', ')}.
        </p>
      )}
      {editable && !conInicial && (
        <p className="mt-2 text-sm text-tinta-suave">Los finales se habilitan cuando guarde los iniciales.</p>
      )}
      {finalHabilitado && (
        <p className="mt-2 text-sm text-tinta-suave">Registre los finales al cerrar la planilla. Hasta entonces no se puede empezar la planilla siguiente.</p>
      )}

      {deltas && (
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {deltas.map((d) => (
            <div key={d.etiqueta} className={`rounded-lg px-2 py-2 ${d.problema ? 'bg-rojo-claro text-rojo' : 'bg-superficie text-tinta'}`}>
              <dt className="text-xs font-semibold text-tinta-suave">{{ 'horómetro': 'Horas', 'm³': 'M³ del día', 'energía': 'Energía del día', arranques: 'Arranques del día' }[d.etiqueta]}</dt>
              <dd className="font-condensada font-bold text-lg tabular-nums">
                {d.valor === null ? '—' : d.etiqueta === 'arranques' ? formato(d.valor) : `${formato(d.valor)} ${d.unidad}`}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {(registro?.registraInicio || registro?.registraCierre) && (
        <p className="mt-2 text-sm text-tinta-suave">
          {registro.registraInicio && <>Iniciales: {registro.registraInicio}. </>}
          {registro.registraCierre && <>Finales: {registro.registraCierre}.</>}
        </p>
      )}

      {errores.length > 0 && (
        <Aviso tono="error" titulo="No se guardó. Corrija lo siguiente:" className="mt-3">
          <ul className="list-disc pl-5 space-y-0.5">
            {errores.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </Aviso>
      )}

      {editable && (
        <button type="submit" disabled={guardando || !operador} className={`${claseBoton('primario')} w-full mt-3`}>
          {guardando ? 'Guardando…' : textoBoton}
        </button>
      )}
    </form>
  );
}

export default function DatosOperacion({ datos, operador, onGuardado }: {
  datos: RespuestaPlanilla;
  operador: string;
  onGuardado: (mensaje: string) => void;
}) {
  const operacion = datos.operacion;
  const registroDe = (motorId: string) => operacion?.registros.find((r) => r.motorId === motorId) ?? null;
  // Como en el papel: los motores que operan ese día, más cualquiera que ya tenga datos.
  const motores = datos.motores.filter((m) => m.encendido || registroDe(m.id));
  const otros = datos.motores.filter((m) => !motores.includes(m));

  return (
    <Panel
      titulo="Datos de operación del día"
      descripcion="Una vez por día y por motor: primero los iniciales al empezar la planilla y, al cerrarla, los finales."
    >
      {!operacion ? (
        <Aviso tono="alerta" titulo="Este bloque todavía no está disponible">
          Falta configurar la tabla de datos de operación en el servidor (OPERACION_JENBACHER_TABLE_ID). Avise a soporte.
        </Aviso>
      ) : motores.length === 0 ? (
        <p className="text-tinta-suave">No hay motores encendidos en esta planilla.</p>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {motores.map((m) => (
            <TarjetaMotor
              key={`${datos.fecha}-${m.id}-${registroDe(m.id)?.final ? 'c' : registroDe(m.id) ? 'i' : 'n'}`}
              datos={datos}
              motor={m}
              registro={registroDe(m.id)}
              finalAnterior={operacion.finalAnterior[m.id]}
              operador={operador}
              onGuardado={onGuardado}
            />
          ))}
        </div>
      )}
      {operacion && otros.length > 0 && (
        <p className="text-tinta-suave text-sm mt-3">
          Sin datos de operación: {otros.map((m) => `${m.nombre} (apagado)`).join(', ')}.
        </p>
      )}
    </Panel>
  );
}
