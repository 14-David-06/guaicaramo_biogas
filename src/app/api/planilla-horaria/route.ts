import { NextRequest, NextResponse } from 'next/server';
import { respuestaDeError } from '@/lib/informe/errores';
import { aHoraBogota, esFechaValida } from '@/lib/informe/fechas';
import { horaDesdeRegistros, CAMPOS } from '@/lib/planilla/campos';
import { franjaActual, franjaYaEmpezo, planillaEditable } from '@/lib/planilla/franjas';
import {
  biodigestores, motoresConEstado, operacionOpcional, registrosDePlanilla, turnoActivo
} from '@/lib/planilla/servidor';
import { bloqueoDe } from '@/lib/planilla/operacion';
import { HORAS_PLANILLA, type FranjaPlanilla, type RespuestaPlanilla } from '@/lib/planilla/tipos';

// Planilla horaria Jenbacher: estado del día para el registro Jenbacher y el inicio.
//
// GET /api/planilla-horaria?fecha=YYYY-MM-DD -> las 24 horas de la planilla con su estado,
//                                               motores, biodigestores, turno activo y datos de operación
//
// El registro se guarda por POST /api/registro-jenbacher (un motor por envío).

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
