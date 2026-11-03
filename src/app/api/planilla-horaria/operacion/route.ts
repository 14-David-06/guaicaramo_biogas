import { NextRequest, NextResponse } from 'next/server';
import { todosLosMotores } from '@/lib/informe/airtable-server';
import { respuestaDeError } from '@/lib/informe/errores';
import { esFechaValida, formatearFechaCorta } from '@/lib/informe/fechas';
import { nombreCortoMotor } from '@/lib/planilla/campos';
import { planillaEditable } from '@/lib/planilla/franjas';
import { bloqueoDe, mensajeBloqueo, validarOperacion } from '@/lib/planilla/operacion';
import { guardarOperacion, operacionDelDia, turnoActivo } from '@/lib/planilla/servidor';
import { esIdRegistro } from '@/lib/planilla/validacion';

// Datos de operación de la planilla Jenbacher (una vez por día y por motor).
//
// POST /api/planilla-horaria/operacion -> crea el registro del día con los
// iniciales o, si ya existen, lo completa con los finales y los arranques.
// No admite datos de una planilla mientras la anterior tenga datos sin cerrar.

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const { fecha, motorId } = cuerpo;
  if (typeof fecha !== 'string' || !esFechaValida(fecha) || !esIdRegistro(motorId)) {
    return NextResponse.json({ error: 'Fecha o motor inválidos.' }, { status: 400 });
  }
  const ahora = new Date();
  if (!planillaEditable(fecha, ahora)) {
    return NextResponse.json({ error: 'Solo se registra en la planilla actual o en la anterior.' }, { status: 400 });
  }

  try {
    const [operacion, registrosMotores] = await Promise.all([operacionDelDia(fecha), todosLosMotores()]);
    const motores = registrosMotores.map((m) => ({ id: m.id, nombre: String(m.fields['Nombre Motor'] ?? '').trim() }));
    const motor = motores.find((m) => m.id === motorId);
    if (!motor) {
      return NextResponse.json({ error: 'El motor no existe en la base.' }, { status: 400 });
    }
    const nombre = nombreCortoMotor(motor.nombre);

    const bloqueo = bloqueoDe(fecha, operacion, motores, ahora);
    if (bloqueo) {
      const mensaje = mensajeBloqueo(bloqueo.fechaAnterior, bloqueo.motores);
      return NextResponse.json({ error: mensaje, errores: [mensaje] }, { status: 409 });
    }

    const existente = operacion.registros.find((r) => r.motorId === motorId) ?? null;

    if (existente?.final) {
      return NextResponse.json(
        {
          error: 'Datos ya registrados.',
          errores: [`Los datos de operación de ${nombre} del ${formatearFechaCorta(fecha)} ya están completos. Para corregirlos, avise a la jefatura de planta.`]
        },
        { status: 409 }
      );
    }

    const { entrada, errores } = validarOperacion(cuerpo, existente?.inicial ?? null);
    if (!entrada) {
      return NextResponse.json({ error: 'Revise los datos antes de guardar.', errores }, { status: 400 });
    }

    const turno = await turnoActivo();
    const id = await guardarOperacion(entrada, existente, nombre, turno?.id ?? null);
    return NextResponse.json({ id, completo: entrada.final !== null }, { status: existente ? 200 : 201 });
  } catch (error) {
    return respuestaDeError('planilla-horaria/operacion', error);
  }
}
