import { NextRequest, NextResponse } from 'next/server';
import { ahoraBogota, apagonPorId, cerrarApagon } from '@/lib/apagones/servidor';
import { validarCierre } from '@/lib/apagones/validacion';
import { respuestaDeError } from '@/lib/informe/errores';

// PATCH /api/apagones/:id -> registra la hora en que volvió la energía.
// Un apagón ya cerrado no se reescribe desde la app (409).

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo de la solicitud inválido.' }, { status: 400 });
  }

  try {
    const apagon = await apagonPorId(id);
    if (!apagon) {
      return NextResponse.json({ error: 'No se encontró el apagón.', errores: ['No se encontró el apagón. Recargue la página.'] }, { status: 404 });
    }
    if (apagon.fin !== null) {
      return NextResponse.json(
        { error: 'El apagón ya está cerrado.', errores: ['Este apagón ya tiene hora de restablecimiento. Para corregirla, avise a la jefatura de planta.'] },
        { status: 409 }
      );
    }

    const { valor: cierre, errores } = validarCierre(cuerpo, apagon.inicio, ahoraBogota());
    if (!cierre) {
      return NextResponse.json({ error: 'Revise el cierre antes de guardar.', errores }, { status: 400 });
    }

    await cerrarApagon(apagon, cierre);
    return NextResponse.json({ id });
  } catch (error) {
    return respuestaDeError('apagones', error);
  }
}
