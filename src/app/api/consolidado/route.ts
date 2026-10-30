import { NextRequest, NextResponse } from 'next/server';
import { construirInformesDelRango } from '@/lib/informe/agregador';
import { generarExcelConsolidado, nombreArchivoConsolidado } from '@/lib/informe/excel';
import { respuestaDeError } from '@/lib/informe/errores';
import { ayerBogota, diasDelRango, esFechaValida, hoyBogota } from '@/lib/informe/fechas';

// GET /api/consolidado?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//
// Consolidado en Excel (.xlsx) del rango, una fila por día más hojas de detalle.
// Sin parámetros devuelve el día anterior, igual que el informe diario.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Límite para no exceder el tiempo de la función ni la cuota de Airtable (5 req/s). */
const MAX_DIAS = 62;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const hasta = params.get('hasta') ?? ayerBogota();
  const desde = params.get('desde') ?? hasta;

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    return NextResponse.json({ error: 'Fechas inválidas. Se espera el formato YYYY-MM-DD.' }, { status: 400 });
  }
  if (desde > hasta) {
    return NextResponse.json({ error: 'La fecha inicial es posterior a la final.' }, { status: 400 });
  }
  if (hasta > hoyBogota()) {
    return NextResponse.json({ error: 'No se puede consolidar una fecha futura.' }, { status: 400 });
  }
  if (diasDelRango(desde, hasta).length > MAX_DIAS) {
    return NextResponse.json({ error: `El rango máximo es de ${MAX_DIAS} días.` }, { status: 400 });
  }

  try {
    const { informes, datos } = await construirInformesDelRango(desde, hasta);
    const excel = generarExcelConsolidado({ informes, datos });

    return new NextResponse(new Uint8Array(excel), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${nombreArchivoConsolidado(desde, hasta)}"`,
        'Content-Length': String(excel.length),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return respuestaDeError('consolidado', error);
  }
}
