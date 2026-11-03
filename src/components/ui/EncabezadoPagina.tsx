// Título de la página, qué se hace en ella y, a la derecha, sus controles
// (fecha, filtros). Debajo, `children` para el contexto: turno, fecha, etc.

export default function EncabezadoPagina({ titulo, descripcion, acciones, children }: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <h1 className="font-condensada font-bold text-3xl sm:text-[2.5rem] leading-tight text-tinta">{titulo}</h1>
        {descripcion && <p className="mt-1 text-tinta-suave text-base sm:text-lg">{descripcion}</p>}
        {children && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-tinta-suave">{children}</div>}
      </div>
      {acciones && <div className="flex flex-wrap items-end gap-2">{acciones}</div>}
    </header>
  );
}
