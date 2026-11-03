// Clases compartidas del sistema visual. Son funciones y no componentes
// porque las mismas apariencias se aplican a <button>, <Link> y <a>.

export type VarianteBoton = 'primario' | 'secundario' | 'sutil' | 'peligro';

const BOTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bosque ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const BOTON_VARIANTE: Record<VarianteBoton, string> = {
  primario: 'bg-bosque text-white hover:bg-bosque-oscuro',
  secundario: 'bg-superficie text-tinta border border-linea-fuerte hover:bg-superficie-2',
  sutil: 'text-bosque hover:bg-hoja-claro',
  peligro: 'bg-rojo text-white hover:bg-[#912018]'
};

const BOTON_TAMANO = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5',
  lg: 'px-6 py-3.5 text-lg'
};

export function claseBoton(variante: VarianteBoton = 'primario', tamano: keyof typeof BOTON_TAMANO = 'md'): string {
  return `${BOTON_BASE} ${BOTON_VARIANTE[variante]} ${BOTON_TAMANO[tamano]}`;
}

/** Campo de texto, número, fecha o área de texto. */
export const claseCampo =
  'w-full bg-superficie border border-linea-fuerte rounded-lg px-3 py-2.5 text-tinta placeholder:text-tinta-tenue ' +
  'focus:outline-none focus:border-bosque focus:ring-2 focus:ring-bosque/25';

/** Etiqueta encima de un campo. */
export const claseEtiqueta = 'block text-sm font-semibold text-tinta-suave mb-1';
