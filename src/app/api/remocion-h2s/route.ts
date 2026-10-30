import { NextRequest, NextResponse } from 'next/server';
import { crearMedicionRemocion, registrosDelRango, TABLAS } from '@/lib/informe/airtable-server';
import { numero, porcentajeRemocion, texto } from '@/lib/informe/agregador';
import { respuestaDeError } from '@/lib/informe/errores';
import { aFechaBogota, aHoraBogota, hoyBogota, sumarDias } from '@/lib/informe/fechas';
import { REMOCION_H2S_MINIMA } from '@/lib/informe/umbrales';

// Mediciones de H2S antes y después del tren de filtrado.
//
// GET  /api/remocion-h2s?dias=30  -> mediciones recientes con el % de remoción calculado
// POST /api/remocion-h2s          -> registra una medición nueva
//
// La tabla "Entradas y Salidas de biofiltros" existía en la base pero nunca se
// alimentó (0 registros a oct. 2026). Este es el punto de captura que faltaba
// para el comparativo pedido por la Ing. Jimena.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const dias = Math.min(Math.max(Number(request.nextUrl.searchParams.get('dias') ?? 30) || 30, 1), 180);
  const hasta = hoyBogota();
  const desde = sumarDias(hasta, -(dias - 1));

  try {
    const registros = await registrosDelRango(TABLAS.biofiltros, 'Entradas y Salidas de biofiltros', desde, hasta);
    const mediciones = registros
      .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
      .map((r) => {
        const entrada = numero(r.fields['Entrada Biofiltro']);
        const salidaBiofiltro = numero(r.fields['Salida Biofiltro']);
        const salidaBiochar = numero(r.fields['Salida Filtro Biochar']);
        return {
          id: r.id,
          fecha: aFechaBogota(r.createdTime),
          hora: aHoraBogota(r.createdTime),
          operador: texto(r.fields['Nombre Operador']),
          entradaBiofiltro: entrada,
          salidaBiofiltro,
          salidaBiochar,
          remocionBiofiltro: porcentajeRemocion(entrada, salidaBiofiltro),
          remocionBiochar: porcentajeRemocion(salidaBiofiltro, salidaBiochar),
          remocionTotal: porcentajeRemocion(entrada, salidaBiochar ?? salidaBiofiltro)
        };
      });

    return NextResponse.json({ desde, hasta, remocionMinima: REMOCION_H2S_MINIMA, mediciones });
  } catch (error) {
    return respuestaDeError('remocion-h2s', error);
  }
}

function lecturaOpcional(valor: unknown): number | null | 'invalida' {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : 'invalida';
}

export async function POST(request: NextRequest) {
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const operador = typeof cuerpo.operador === 'string' ? cuerpo.operador.trim() : '';
  const entrada = lecturaOpcional(cuerpo.entradaBiofiltro);
  const salidaBiofiltro = lecturaOpcional(cuerpo.salidaBiofiltro);
  const salidaBiochar = lecturaOpcional(cuerpo.salidaBiochar);

  if (!operador) {
    return NextResponse.json({ error: 'Falta el nombre del operador.' }, { status: 400 });
  }
  if (entrada === null || entrada === 'invalida') {
    return NextResponse.json({ error: 'La lectura de entrada al biofiltro es obligatoria y debe ser ≥ 0.' }, { status: 400 });
  }
  if (salidaBiofiltro === 'invalida' || salidaBiochar === 'invalida') {
    return NextResponse.json({ error: 'Las lecturas de salida deben ser números ≥ 0.' }, { status: 400 });
  }
  if (salidaBiofiltro === null && salidaBiochar === null) {
    return NextResponse.json({ error: 'Registre al menos una lectura de salida para calcular la remoción.' }, { status: 400 });
  }

  try {
    const registro = await crearMedicionRemocion({ operador, entradaBiofiltro: entrada, salidaBiofiltro, salidaBiochar });
    return NextResponse.json({ id: registro.id }, { status: 201 });
  } catch (error) {
    return respuestaDeError('remocion-h2s', error);
  }
}
