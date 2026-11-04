import { NextRequest, NextResponse } from 'next/server';
import { respuestaDeError } from '@/lib/informe/errores';
import { esFechaValida } from '@/lib/informe/fechas';
import { fechaPlanillaDe } from '@/lib/planilla/franjas';
import { validarMediciones } from '@/lib/planilla/mediciones';
import { biodigestores, guardarMediciones, medicionesDePlanilla, turnoActivo } from '@/lib/planilla/servidor';

// "Mediciones antes del biofiltro" del registro Jenbacher.
//
// GET  /api/registro-jenbacher/mediciones?fecha=YYYY-MM-DD -> tomas de cada digestor en esa planilla
// POST /api/registro-jenbacher/mediciones                  -> una toma por cada digestor digitado

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get('fecha') ?? fechaPlanillaDe(new Date());
  if (!esFechaValida(fecha)) {
    return NextResponse.json({ error: 'Fecha inválida. Use el formato YYYY-MM-DD.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ fecha, tomas: await medicionesDePlanilla(fecha) });
  } catch (error) {
    return respuestaDeError('mediciones-biofiltro', error);
  }
}

export async function POST(request: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  try {
    const [digestores, turno] = await Promise.all([biodigestores(), turnoActivo()]);
    const nombres = new Map(digestores.map((d) => [d.id, d.nombre]));
    const { operador, mediciones, errores } = validarMediciones(cuerpo, (id) => nombres.get(id) ?? 'Digestor');
    if (errores.length > 0) {
      return NextResponse.json({ error: 'Revise las mediciones antes de guardar.', errores }, { status: 400 });
    }
    if (!mediciones.every((m) => nombres.has(m.digestorId))) {
      return NextResponse.json({ error: 'Hay un digestor que no existe en la base.' }, { status: 400 });
    }
    const creados = await guardarMediciones(mediciones, operador, turno?.id ?? null);
    return NextResponse.json({ ids: creados.map((r) => r.id) }, { status: 201 });
  } catch (error) {
    return respuestaDeError('mediciones-biofiltro', error);
  }
}
