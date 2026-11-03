import { NextRequest, NextResponse } from 'next/server';
import { diasDelMes, existeDia, guardarDia } from '@/lib/consumo-barraje/servidor';
import type { RespuestaConsumo } from '@/lib/consumo-barraje/tipos';
import { esMesValido, validarConsumo } from '@/lib/consumo-barraje/validacion';
import { respuestaDeError } from '@/lib/informe/errores';
import { hoyBogota } from '@/lib/informe/fechas';
import { turnoActivo } from '@/lib/planilla/servidor';

// Planilla de consumo kW barraje #2.
//
// GET  /api/consumo-barraje?mes=YYYY-MM -> días registrados del mes y turno activo
// POST /api/consumo-barraje             -> registra el consumo de un día (uno por día)

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const hoy = hoyBogota();
  const mes = request.nextUrl.searchParams.get('mes') ?? hoy.slice(0, 7);
  if (!esMesValido(mes)) {
    return NextResponse.json({ error: 'Mes inválido. Use el formato YYYY-MM.' }, { status: 400 });
  }

  try {
    const [dias, turno] = await Promise.all([diasDelMes(mes), turnoActivo()]);
    const respuesta: RespuestaConsumo = { mes, hoy, dias, turno };
    return NextResponse.json(respuesta);
  } catch (error) {
    return respuestaDeError('consumo-barraje', error);
  }
}

export async function POST(request: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const { lectura, errores } = validarConsumo(cuerpo, hoyBogota());
  if (!lectura) {
    return NextResponse.json({ error: 'Revise el consumo antes de guardar.', errores }, { status: 400 });
  }

  try {
    if (await existeDia(lectura.fecha)) {
      return NextResponse.json(
        { error: 'Ese día ya tiene consumo registrado.', errores: ['Ese día ya tiene consumo registrado. Para corregirlo, avise a la jefatura de planta.'] },
        { status: 409 }
      );
    }
    const turno = await turnoActivo();
    const id = await guardarDia(lectura, turno?.id ?? null);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return respuestaDeError('consumo-barraje', error);
  }
}
