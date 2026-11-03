// Franja de indicadores al tope de una página: el estado de un vistazo. Es una
// sola banda dividida en celdas, como un tablero de instrumentos, no tarjetas
// sueltas. El tono solo cambia cuando el valor pide atención.

export type TonoIndicador = 'neutro' | 'ok' | 'alerta' | 'critico';

export interface Indicador {
  etiqueta: string;
  valor: React.ReactNode;
  /** Unidad pequeña junto al valor (kW, %, ppm). */
  unidad?: string;
  detalle?: React.ReactNode;
  tono?: TonoIndicador;
}

const TONO_VALOR: Record<TonoIndicador, string> = {
  neutro: 'text-tinta',
  ok: 'text-bosque',
  alerta: 'text-ambar',
  critico: 'text-rojo'
};

const TONO_MARCA: Record<TonoIndicador, string> = {
  neutro: 'bg-transparent',
  ok: 'bg-hoja',
  alerta: 'bg-ambar-borde',
  critico: 'bg-rojo'
};

export default function Indicadores({ items }: { items: Indicador[] }) {
  const columnas = items.length >= 4 ? 'lg:grid-cols-4' : items.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <dl className={`grid grid-cols-2 ${columnas} bg-superficie border border-linea rounded-xl overflow-hidden`}>
      {items.map((item, i) => {
        const tono = item.tono ?? 'neutro';
        return (
          <div
            key={item.etiqueta}
            className={`relative px-4 py-4 sm:px-5 border-linea ${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${
              i > 0 ? 'lg:border-l' : ''
            }`}
          >
            <span className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-r ${TONO_MARCA[tono]}`} aria-hidden="true" />
            <dt className="text-sm font-semibold text-tinta-suave">{item.etiqueta}</dt>
            <dd className={`mt-1 font-condensada font-bold text-3xl sm:text-4xl leading-none tabular-nums ${TONO_VALOR[tono]}`}>
              {item.valor}
              {item.unidad && <span className="ml-1 text-lg font-semibold text-tinta-suave">{item.unidad}</span>}
            </dd>
            {item.detalle && <dd className="mt-1.5 text-sm text-tinta-suave">{item.detalle}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
