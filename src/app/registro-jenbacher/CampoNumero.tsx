'use client';

import type { UmbralPlanilla } from '@/lib/informe/umbrales';
import { estadoDeValor, leerNumero } from '@/lib/planilla/validacion';

// Campo numérico del registro Jenbacher. El borde dice cómo va el valor contra
// el umbral del formato: verde dentro de rango, ámbar o rojo por fuera, rojo
// con anillo si no es un número.

const ESTILO_ESTADO: Record<ReturnType<typeof estadoDeValor>, string> = {
  vacio: 'border-linea-fuerte bg-superficie',
  invalido: 'border-rojo bg-rojo-claro ring-1 ring-rojo',
  ok: 'border-hoja bg-superficie',
  advertencia: 'border-ambar-borde bg-ambar-claro',
  critica: 'border-rojo-borde bg-rojo-claro'
};

export default function CampoNumero({ id, etiqueta, valor, onChange, umbral, ejemplo, ocultarEtiqueta = false }: {
  id: string;
  etiqueta: string;
  /** La etiqueta solo para lectores de pantalla (en tablas, donde la dan la fila y la columna). */
  ocultarEtiqueta?: boolean;
  valor: string;
  onChange: (v: string) => void;
  umbral?: UmbralPlanilla;
  /** Texto de ayuda dentro del campo cuando no hay umbral. */
  ejemplo?: string;
}) {
  const estado = estadoDeValor(leerNumero(valor), umbral);
  return (
    <div>
      <label htmlFor={id} className={ocultarEtiqueta ? 'sr-only' : 'block text-sm font-semibold text-tinta-suave mb-1'}>{etiqueta}</label>
      <input
        id={id}
        aria-invalid={estado === 'invalido' || undefined}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={umbral ? umbral.referencia : ejemplo ?? ''}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border-2 rounded-lg px-3 py-2.5 text-lg text-tinta font-semibold tabular-nums placeholder:font-normal placeholder:text-base placeholder:text-tinta-tenue focus:outline-none focus:ring-2 focus:ring-bosque/30 focus:border-bosque ${ESTILO_ESTADO[estado]}`}
      />
    </div>
  );
}
