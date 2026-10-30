import { NextRequest, NextResponse } from 'next/server';
import { construirInformeDiario } from '@/lib/informe/agregador';
import { generarPdfInforme, nombreArchivoInforme } from '@/lib/informe/pdf';
import { respuestaDeError } from '@/lib/informe/errores';
import { ayerBogota, esFechaValida, hoyBogota } from '@/lib/informe/fechas';

// GET /api/informe-diario?fecha=YYYY-MM-DD&formato=json|pdf
//
// formato=json  -> datos del informe, para la vista previa en pantalla
// formato=pdf   -> el mismo informe renderizado, listo para descargar o adjuntar
//
// Sin `fecha` devuelve el día anterior, que es el que cubre el envío
// automático de las 06:00.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fecha = params.get('fecha') ?? ayerBogota();
  const formato = params.get('formato') ?? 'json';
  const generadoPor = params.get('generadoPor') ?? undefined;

  if (!esFechaValida(fecha)) {
    return NextResponse.json({ error: 'Fecha inválida. Se espera el formato YYYY-MM-DD.' }, { status: 400 });
  }
  if (fecha > hoyBogota()) {
    return NextResponse.json({ error: 'No se puede generar un informe de una fecha futura.' }, { status: 400 });
  }
  if (formato !== 'json' && formato !== 'pdf') {
    return NextResponse.json({ error: 'Formato inválido. Use "json" o "pdf".' }, { status: 400 });
  }

  try {
    const informe = await construirInformeDiario({ fecha, generadoPor });

    if (formato === 'json') {
      return NextResponse.json(informe);
    }

    const pdf = generarPdfInforme(informe);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivoInforme(fecha)}"`,
        'Content-Length': String(pdf.length),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return respuestaDeError('informe-diario', error);
  }
}
