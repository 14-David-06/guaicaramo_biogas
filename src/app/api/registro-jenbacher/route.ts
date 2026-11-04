import { NextRequest, NextResponse } from 'next/server';
import { respuestaDeError } from '@/lib/informe/errores';
import { formatearFechaCorta } from '@/lib/informe/fechas';
import { CAMPOS, nombreCortoMotor } from '@/lib/planilla/campos';
import { franjaYaEmpezo, planillaEditable } from '@/lib/planilla/franjas';
import { bloqueoDe, mensajeBloqueo } from '@/lib/planilla/operacion';
import {
  biodigestores, guardarHora, motoresConEstado, operacionOpcional, registrosDePlanilla, turnoActivo
} from '@/lib/planilla/servidor';
import { alertasDeUmbral, validarLectura } from '@/lib/planilla/validacion';

// POST /api/registro-jenbacher
//
// Lectura horaria del registro Jenbacher: un registro de "Registros Diarios
// Jenbacher" por cada motor incluido (uno o los dos), con la composición del
// gas repetida, como siempre, más los campos nuevos del formato (hora de
// lectura, gas en entrada y salida del biofiltro, sopladores y observaciones). Los datos del motor y del día se leen con la API de la
// planilla (GET /api/planilla-horaria).

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const { lectura, errores } = validarLectura(cuerpo);
  if (!lectura) {
    return NextResponse.json({ error: 'Revise el registro antes de guardar.', errores }, { status: 400 });
  }

  const ahora = new Date();
  if (!planillaEditable(lectura.fecha, ahora)) {
    return NextResponse.json({ error: 'Solo se registran lecturas de la planilla actual o de la anterior.' }, { status: 400 });
  }
  if (!franjaYaEmpezo(lectura.fecha, lectura.hora, ahora)) {
    return NextResponse.json({ error: `La hora de las ${lectura.hora} todavía no llega.` }, { status: 400 });
  }

  try {
    const [digestores, turno, operacion, motores, existentes] = await Promise.all([
      biodigestores(),
      turnoActivo(),
      operacionOpcional(lectura.fecha),
      motoresConEstado(),
      registrosDePlanilla(lectura.fecha, lectura.hora)
    ]);

    // El servidor vuelve a comprobar que cada motor esté encendido y con monitoreo.
    const elegidos = lectura.motores.map((l) => motores.find((m) => m.id === l.motorId));
    if (elegidos.some((m) => !m || !m.encendido || !m.tieneMonitoreo)) {
      return NextResponse.json(
        { error: 'Un motor ya no está encendido o no tiene monitoreo. Recargue la página e intente de nuevo.' },
        { status: 409 }
      );
    }
    const seleccion = elegidos as NonNullable<(typeof elegidos)[number]>[];

    // Un motor tiene una sola lectura por hora de planilla.
    const yaRegistrados = new Set(existentes.map((r) => nombreCortoMotor(String(r.fields[CAMPOS.nombreMotor] ?? ''))));
    const repetidos = seleccion.map((m) => nombreCortoMotor(m.nombre)).filter((n) => yaRegistrados.has(n));
    if (repetidos.length > 0) {
      return NextResponse.json(
        {
          error: `${repetidos.join(' y ')} ya ${repetidos.length === 1 ? 'tiene' : 'tienen'} la lectura de las ${lectura.hora} ` +
            `de la planilla del ${formatearFechaCorta(lectura.fecha)}.`
        },
        { status: 409 }
      );
    }

    const bloqueo = bloqueoDe(lectura.fecha, operacion, motores, ahora);
    if (bloqueo) {
      return NextResponse.json({ error: mensajeBloqueo(bloqueo.fechaAnterior, bloqueo.motores) }, { status: 409 });
    }

    const idsDigestores = new Set(digestores.map((d) => d.id));
    if (!lectura.digestores.every((id) => idsDigestores.has(id))) {
      return NextResponse.json({ error: 'Hay un biodigestor que no existe en la base.' }, { status: 400 });
    }

    const creados = await guardarHora(lectura, seleccion, turno?.id ?? null);
    return NextResponse.json({ ids: creados.map((r) => r.id), alertas: alertasDeUmbral(lectura).length }, { status: 201 });
  } catch (error) {
    return respuestaDeError('registro-jenbacher', error);
  }
}
