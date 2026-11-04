import { NextRequest, NextResponse } from 'next/server';
import { respuestaDeError } from '@/lib/informe/errores';
import { diasDelRango, esFechaValida, hoyBogota } from '@/lib/informe/fechas';
import { generarExcelServiciosIndustriales, nombreArchivoServiciosIndustriales } from '@/lib/servicios-industriales/excel';
import { informeAcumulado, informeDiario } from '@/lib/servicios-industriales/informe';
import { generarPdfServiciosIndustriales } from '@/lib/servicios-industriales/pdf';

// GET /api/servicios-industriales?vista=acumulado&anio=2026&formato=json|xlsx|pdf
// GET /api/servicios-industriales?vista=diario&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&titulo=…&formato=json|xlsx|pdf
//
// Informe de Servicios Industriales — Biogás: acumulados del año por mes, o
// detalle diario de una semana o un mes.

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Un mes completo cabe; más días exceden lo que se lee bien en una tabla diaria. */
const MAX_DIAS_DIARIO = 62;
const PRIMER_ANIO = 2024;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const vista = params.get('vista') ?? 'acumulado';
  const formato = params.get('formato') ?? 'json';
  const hoy = hoyBogota();

  if (formato !== 'json' && formato !== 'xlsx' && formato !== 'pdf') {
    return NextResponse.json({ error: 'Formato inválido. Use "json", "xlsx" o "pdf".' }, { status: 400 });
  }

  let construir;
  if (vista === 'acumulado') {
    const anio = Number(params.get('anio') ?? hoy.slice(0, 4));
    if (!Number.isInteger(anio) || anio < PRIMER_ANIO || anio > Number(hoy.slice(0, 4))) {
      return NextResponse.json({ error: 'Año inválido.' }, { status: 400 });
    }
    construir = () => informeAcumulado(anio);
  } else if (vista === 'diario') {
    const desde = params.get('desde') ?? '';
    const hastaPedido = params.get('hasta') ?? '';
    if (!esFechaValida(desde) || !esFechaValida(hastaPedido)) {
      return NextResponse.json({ error: 'Fechas inválidas. Se espera el formato YYYY-MM-DD.' }, { status: 400 });
    }
    if (desde > hastaPedido) {
      return NextResponse.json({ error: 'La fecha inicial es posterior a la final.' }, { status: 400 });
    }
    if (desde > hoy) {
      return NextResponse.json({ error: 'El período todavía no empieza.' }, { status: 400 });
    }
    // Una semana o un mes en curso se recorta a hoy.
    const hasta = hastaPedido > hoy ? hoy : hastaPedido;
    if (diasDelRango(desde, hasta).length > MAX_DIAS_DIARIO) {
      return NextResponse.json({ error: `El rango máximo es de ${MAX_DIAS_DIARIO} días.` }, { status: 400 });
    }
    const titulo = (params.get('titulo') ?? 'Informe diario — Biogás').slice(0, 80);
    construir = () => informeDiario(desde, hasta, titulo);
  } else {
    return NextResponse.json({ error: 'Vista inválida. Use "acumulado" o "diario".' }, { status: 400 });
  }

  try {
    const informe = await construir();
    if (formato === 'json') return NextResponse.json(informe);

    const archivo = formato === 'xlsx' ? generarExcelServiciosIndustriales(informe) : generarPdfServiciosIndustriales(informe);
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        'Content-Type':
          formato === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf',
        'Content-Disposition': `attachment; filename="${nombreArchivoServiciosIndustriales(informe, formato)}"`,
        'Content-Length': String(archivo.length),
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    return respuestaDeError('servicios-industriales', error);
  }
}
