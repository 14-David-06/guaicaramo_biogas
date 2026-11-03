// Mensaje dentro de la página: confirmación, advertencia, error o nota.

export type TonoAviso = 'info' | 'exito' | 'alerta' | 'error';

const ESTILO: Record<TonoAviso, string> = {
  info: 'bg-superficie-2 border-linea-fuerte text-tinta',
  exito: 'bg-hoja-claro border-hoja text-bosque-oscuro',
  alerta: 'bg-ambar-claro border-ambar-borde text-ambar',
  error: 'bg-rojo-claro border-rojo-borde text-rojo'
};

export default function Aviso({ tono = 'info', titulo, children, className = '' }: {
  tono?: TonoAviso;
  titulo?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tono === 'error' || tono === 'alerta' ? 'alert' : 'status'}
      className={`border border-l-4 rounded-lg px-4 py-3 ${ESTILO[tono]} ${className}`}
    >
      {titulo && <p className="font-semibold">{titulo}</p>}
      {children && <div className={titulo ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}
