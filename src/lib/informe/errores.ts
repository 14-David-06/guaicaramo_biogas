import 'server-only';

import { NextResponse } from 'next/server';
import { ErrorAirtable, ErrorConfiguracion } from './airtable-server';

/** Traduce los errores conocidos del módulo de informes a respuestas HTTP. */
export function respuestaDeError(origen: string, error: unknown) {
  if (error instanceof ErrorConfiguracion) {
    console.error(`[${origen}] Configuración incompleta:`, error.message);
    return NextResponse.json(
      { error: 'El servidor no está configurado para esta operación.', detalle: error.message },
      { status: 500 }
    );
  }
  if (error instanceof ErrorAirtable) {
    console.error(`[${origen}] Error de Airtable:`, error.message);
    return NextResponse.json(
      { error: 'No se pudieron obtener los datos de la planta.', detalle: error.message },
      { status: 502 }
    );
  }
  console.error(`[${origen}] Error inesperado:`, error);
  return NextResponse.json({ error: 'Error interno al generar el informe.' }, { status: 500 });
}
