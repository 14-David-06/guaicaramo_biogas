import { NextRequest, NextResponse } from 'next/server';
import { respuestaDeError } from '@/lib/informe/errores';
import { aHoraBogota, esFechaValida, formatearFechaCorta } from '@/lib/informe/fechas';
import { horaDesdeRegistros, CAMPOS } from '@/lib/planilla/campos';
import { franjaActual, franjaYaEmpezo, planillaEditable } from '@/lib/planilla/franjas';
import {
  biodigestores, guardarHora, motoresConEstado, operacionOpcional, registrosDePlanilla, turnoActivo
} from '@/lib/planilla/servidor';
import { bloqueoDe, mensajeBloqueo } from '@/lib/planilla/operacion';
import { HORAS_PLANILLA, type FranjaPlanilla, type RespuestaPlanilla } from '@/lib/planilla/tipos';
import { alertasDeUmbral, validarLectura } from '@/lib/planilla/validacion';

// Planilla horaria Jenbacher (formato nuevo de Servicios Industriales).
//
// GET  /api/planilla-horaria?fecha=YYYY-MM-DD -> las 24 franjas de la planilla con su estado,
//                                                motores, biodigestores y turno activo
// POST /api/planilla-horaria                  -> registra una hora (un registro por motor encendido)

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ahora = new Date();
  const actual = franjaActual(ahora);
  const fecha = request.nextUrl.searchParams.get('fecha') ?? actual.fecha;
  if (!esFechaValida(fecha)) {
    return NextResponse.json({ error: 'Fecha inválida. Use el formato YYYY-MM-DD.' }, { status: 400 });
  }

  try {
    const [registros, digestores, turno, operacion] = await Promise.all([
      registrosDePlanilla(fecha),
      biodigestores(),
      turnoActivo(),
      // Sin la tabla configurada la planilla horaria sigue funcionando; el bloque avisa.
      operacionOpcional(fecha)
    ]);
    const motores = await motoresConEstado();

    const porHora = new Map<string, typeof registros>();
    for (const r of registros) {
      const hora = String(r.fields[CAMPOS.hora] ?? '');
      porHora.set(hora, [...(porHora.get(hora) ?? []), r]);
    }

    const editable = planillaEditable(fecha, ahora);
    const bloqueo = editable ? bloqueoDe(fecha, operacion, motores, ahora) : null;
    const franjas: FranjaPlanilla[] = HORAS_PLANILLA.map((hora) => {
      const grupo = porHora.get(hora);
      const empezo = franjaYaEmpezo(fecha, hora, ahora);
      return {
        hora,
        estado: grupo ? 'registrada' : empezo ? 'pendiente' : 'futura',
        registrable: !grupo && empezo && editable && !bloqueo,
        lectura: grupo ? horaDesdeRegistros(grupo, aHoraBogota) : null
      };
    });

    const respuesta: RespuestaPlanilla = {
      fecha,
      fechaActual: actual.fecha,
      horaActual: actual.hora,
      editable,
      franjas,
      motores: motores.map(({ id, nombre, encendido, tieneMonitoreo }) => ({ id, nombre, encendido, tieneMonitoreo })),
      biodigestores: digestores,
      turno,
      operacion,
      bloqueo
    };
    return NextResponse.json(respuesta);
  } catch (error) {
    return respuestaDeError('planilla-horaria', error);
  }
}

export async function POST(request: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const { lectura, errores } = validarLectura(cuerpo);
  if (!lectura) {
    return NextResponse.json({ error: 'Revise la lectura antes de guardar.', errores }, { status: 400 });
  }

  const ahora = new Date();
  if (!planillaEditable(lectura.fecha, ahora)) {
    return NextResponse.json(
      { error: 'Solo se pueden registrar horas de la planilla actual o de la anterior.' },
      { status: 400 }
    );
  }
  if (!franjaYaEmpezo(lectura.fecha, lectura.hora, ahora)) {
    return NextResponse.json({ error: `La franja de las ${lectura.hora} todavía no empieza.` }, { status: 400 });
  }

  try {
    const existentes = await registrosDePlanilla(lectura.fecha, lectura.hora);
    if (existentes.length > 0) {
      return NextResponse.json(
        { error: `La hora ${lectura.hora} de la planilla del ${formatearFechaCorta(lectura.fecha)} ya está registrada.` },
        { status: 409 }
      );
    }

    const [digestores, turno, operacion] = await Promise.all([biodigestores(), turnoActivo(), operacionOpcional(lectura.fecha)]);
    const motores = await motoresConEstado();

    const bloqueo = bloqueoDe(lectura.fecha, operacion, motores, ahora);
    if (bloqueo) {
      return NextResponse.json({ error: mensajeBloqueo(bloqueo.fechaAnterior, bloqueo.motores) }, { status: 409 });
    }

    const idsDigestores = new Set(digestores.map((d) => d.id));
    if (!lectura.digestores.every((id) => idsDigestores.has(id))) {
      return NextResponse.json({ error: 'Hay un digestor que no existe en la base.' }, { status: 400 });
    }

    // El servidor decide qué motores se registran: no confía en lo que vio la tablet.
    const disponibles = motores.filter((m) => m.encendido && m.tieneMonitoreo);
    if (disponibles.length === 0) {
      return NextResponse.json(
        { error: 'No hay motores encendidos con monitoreo. Encienda el motor en Monitoreo de Motores antes de registrar la hora.' },
        { status: 409 }
      );
    }
    const enviados = new Set(lectura.motores.map((m) => m.motorId));
    const coinciden = enviados.size === disponibles.length && disponibles.every((m) => enviados.has(m.id));
    if (!coinciden) {
      return NextResponse.json(
        { error: 'El estado de los motores cambió desde que abrió la planilla. Recargue la página e intente de nuevo.' },
        { status: 409 }
      );
    }

    const creados = await guardarHora(lectura, disponibles, turno?.id ?? null);
    return NextResponse.json(
      { ids: creados.map((r) => r.id), alertas: alertasDeUmbral(lectura).length },
      { status: 201 }
    );
  } catch (error) {
    return respuestaDeError('planilla-horaria', error);
  }
}
