import { NextRequest, NextResponse } from 'next/server';
import { ahoraBogota, apagonesDelMes, apagonesEnCurso, guardarApagon, motoresParaApagon } from '@/lib/apagones/servidor';
import { formatoDuracion, duracionMinutos, type RespuestaApagones } from '@/lib/apagones/tipos';
import { esMesValido, validarReporte } from '@/lib/apagones/validacion';
import { respuestaDeError } from '@/lib/informe/errores';
import { turnoActivo } from '@/lib/planilla/servidor';

// Reporte de apagones.
//
// GET  /api/apagones?mes=YYYY-MM -> apagones del mes, los que siguen en curso, motores y turno
// POST /api/apagones             -> reporta un apagón (en curso o ya terminado)

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ahora = ahoraBogota();
  const mes = request.nextUrl.searchParams.get('mes') ?? ahora.slice(0, 7);
  if (!esMesValido(mes)) {
    return NextResponse.json({ error: 'Mes inválido. Use el formato YYYY-MM.' }, { status: 400 });
  }

  try {
    const [{ apagones, enCurso }, motores, turno] = await Promise.all([apagonesDelMes(mes), motoresParaApagon(), turnoActivo()]);
    const respuesta: RespuestaApagones = { mes, ahora, apagones, enCurso, motores, turno };
    return NextResponse.json(respuesta);
  } catch (error) {
    return respuestaDeError('apagones', error);
  }
}

export async function POST(request: NextRequest) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  const ahora = ahoraBogota();
  const { valor: reporte, errores } = validarReporte(cuerpo, ahora);
  if (!reporte) {
    return NextResponse.json({ error: 'Revise el reporte antes de guardar.', errores }, { status: 400 });
  }

  try {
    // Dos operadores pueden reportar el mismo corte: solo un apagón en curso a la vez.
    if (reporte.fin === null) {
      const [abierto] = await apagonesEnCurso();
      if (abierto) {
        const desde = `${abierto.inicio.slice(8, 10)}/${abierto.inicio.slice(5, 7)} ${abierto.inicio.slice(11)}`;
        const mensaje =
          `Ya hay un apagón en curso desde el ${desde} (${formatoDuracion(duracionMinutos(abierto, ahora))}). ` +
          'Registre cuándo volvió la energía antes de reportar otro.';
        return NextResponse.json({ error: 'Ya hay un apagón en curso.', errores: [mensaje] }, { status: 409 });
      }
    }
    const turno = await turnoActivo();
    const id = await guardarApagon(reporte, turno?.id ?? null);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return respuestaDeError('apagones', error);
  }
}
