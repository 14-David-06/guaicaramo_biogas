// Bloque blanco de contenido. El título va en la condensada para separarlo
// de los datos sin agregar colores.

export default function Panel({ titulo, descripcion, acciones, children, className = '', as: Etiqueta = 'section' }: {
  titulo?: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'form';
}) {
  return (
    <Etiqueta className={`bg-superficie border border-linea rounded-xl p-4 sm:p-6 ${className}`}>
      {(titulo || acciones) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {titulo && <h2 className="font-condensada font-bold text-xl sm:text-2xl text-tinta">{titulo}</h2>}
            {descripcion && <p className="text-tinta-suave mt-0.5">{descripcion}</p>}
          </div>
          {acciones && <div className="flex items-center gap-2 shrink-0">{acciones}</div>}
        </div>
      )}
      {children}
    </Etiqueta>
  );
}
