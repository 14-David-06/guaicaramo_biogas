import { NextRequest, NextResponse } from 'next/server';
import { respuestaDeError } from '@/lib/informe/errores';
import { ayerBogota, esFechaValida, hoyBogota } from '@/lib/informe/fechas';
import { bloqueDelDia } from '@/lib/servicios-industriales/informe';

// GET /api/servicios-industriales/bloque-produccion?fecha=YYYY-MM-DD
//
// Bloque de biogás del informe "Datos Producción y Pérdidas" de la extractora:
// calidad del gas con sus normas, horas Jenbacher y kWh/m³ del mes por día.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const fecha = request.nextUrl.searchParams.get('fecha') ?? ayerBogota();
  if (!esFechaValida(fecha)) {
    return NextResponse.json({ error: 'Fecha inválida. Se espera el formato YYYY-MM-DD.' }, { status: 400 });
  }
  if (fecha > hoyBogota()) {
    return NextResponse.json({ error: 'No se puede generar el bloque de una fecha futura.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await bloqueDelDia(fecha));
  } catch (error) {
    return respuestaDeError('bloque-produccion', error);
  }
}
