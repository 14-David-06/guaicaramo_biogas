// Silueta de una página del sistema claro mientras carga: barra, encabezado,
// franja de indicadores y un bloque de contenido.

export default function EsqueletoPagina() {
  return (
    <div className="min-h-screen bg-fondo" aria-busy="true" aria-label="Cargando">
      <div className="fixed top-0 inset-x-0 h-16 bg-superficie border-b-2 border-fruto" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 space-y-6 animate-pulse">
        <div className="space-y-3">
          <div className="h-9 w-2/3 max-w-md rounded bg-linea" />
          <div className="h-5 w-full max-w-xl rounded bg-linea/70" />
        </div>
        <div className="h-28 rounded-xl bg-superficie border border-linea" />
        <div className="h-72 rounded-xl bg-superficie border border-linea" />
      </div>
    </div>
  );
}
