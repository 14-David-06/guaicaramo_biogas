import type { Indicador } from '@/components/ui/Indicadores';
import type { LimpiezaRegistro } from '@/utils/airtable';

// Áreas del formato de limpieza y resumen de los registros ya cargados, para
// la franja de indicadores y la columna "Resultado" del historial.

export type CampoArea =
  | 'pisosLimpios'
  | 'ventanasLimpias'
  | 'tablerosLimpios'
  | 'estructurasLibres'
  | 'equiposLimpios'
  | 'jenbacherLimpios';

export const AREAS: { estado: CampoArea; campo: keyof LimpiezaRegistro['fields']; titulo: string; nota: string }[] = [
  { estado: 'pisosLimpios', campo: 'Pisos y andén limpios (cuarto de control y área externa)', titulo: 'Pisos y andén', nota: 'Cuarto de control y área externa' },
  { estado: 'ventanasLimpias', campo: 'Ventanas limpias con retal húmedo?', titulo: 'Ventanas', nota: 'Con retal húmedo' },
  { estado: 'tablerosLimpios', campo: 'Tableros limpios (con precaución en perillas y controles)?', titulo: 'Tableros eléctricos', nota: 'Con precaución en perillas y controles' },
  { estado: 'estructurasLibres', campo: 'Estructuras libres de polvo y telarañas?', titulo: 'Estructuras', nota: 'Sin polvo ni telarañas' },
  { estado: 'equiposLimpios', campo: 'Equipos (manómetros, tuberías, medidores) limpios?', titulo: 'Equipos de medición', nota: 'Manómetros, tuberías y medidores' },
  { estado: 'jenbacherLimpios', campo: 'Equipos Jenbacher limpios (cuidado con controles)?', titulo: 'Equipos Jenbacher', nota: 'Cuidado con los controles' }
];

export interface ResumenRegistro {
  fecha: Date | null;
  fechaTexto: string;
  sies: number;
  total: number;
  porcentaje: number;
  estadoTexto: string;
  tono: 'ok' | 'alerta' | 'critico';
  /** Áreas marcadas "No" o "Parcialmente". */
  pendientes: string[];
}

export function resumenRegistro(registro: LimpiezaRegistro): ResumenRegistro {
  const fechaCreacion = registro.fields['Fecha de creacion'] || registro.createdTime;
  const fecha = fechaCreacion ? new Date(fechaCreacion) : null;

  // Mismo cálculo de estado general que tenía la página
  const respuestas = AREAS.map((a) => registro.fields[a.campo]).filter((r) => r);
  const sies = respuestas.filter((r) => r === 'Sí').length;
  const total = respuestas.length;
  const porcentaje = total > 0 ? (sies / total) * 100 : 0;

  let estadoTexto = 'Deficiente';
  let tono: ResumenRegistro['tono'] = 'critico';
  if (porcentaje >= 80) {
    estadoTexto = 'Excelente';
    tono = 'ok';
  } else if (porcentaje >= 60) {
    estadoTexto = 'Bueno';
    tono = 'alerta';
  } else if (porcentaje >= 40) {
    estadoTexto = 'Regular';
    tono = 'alerta';
  }

  const pendientes = AREAS.flatMap((a) => {
    const valor = registro.fields[a.campo];
    if (valor === 'No') return [a.titulo];
    if (valor === 'Parcialmente') return [`${a.titulo} (parcial)`];
    return [];
  });

  return {
    fecha,
    fechaTexto: fecha
      ? fecha.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      : 'Sin fecha',
    sies,
    total,
    porcentaje,
    estadoTexto,
    tono,
    pendientes
  };
}

const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

function diaRelativo(fecha: Date): string {
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(hoy.getDate() - 1);
  if (mismoDia(fecha, hoy)) return 'Hoy';
  if (mismoDia(fecha, ayer)) return 'Ayer';
  return fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

/** Los registros llegan ordenados del más reciente al más antiguo. */
export function indicadoresLimpiezas(registros: LimpiezaRegistro[]): Indicador[] {
  const resumenes = registros.map(resumenRegistro);
  const ultimo = resumenes[0];
  const operador = registros[0]?.fields['Realiza Registro'];
  const ahora = new Date();
  const hace7Dias = ahora.getTime() - 7 * 24 * 3600_000;
  const hoy = resumenes.filter((r) => r.fecha && mismoDia(r.fecha, ahora)).length;
  const semana = resumenes.filter((r) => r.fecha && r.fecha.getTime() >= hace7Dias).length;

  return [
    {
      etiqueta: 'Última inspección',
      valor: ultimo?.fecha ? diaRelativo(ultimo.fecha) : '—',
      detalle: ultimo?.fecha
        ? `${ultimo.fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })}${operador ? `, ${operador}` : ''}`
        : 'Aún no hay inspecciones'
    },
    {
      etiqueta: 'Resultado de la última',
      valor: ultimo ? ultimo.sies : '—',
      unidad: ultimo ? `de ${ultimo.total} limpias` : undefined,
      detalle: ultimo ? (ultimo.pendientes.length ? `Pendiente: ${ultimo.pendientes.join(', ')}` : 'Todas las áreas limpias') : undefined,
      tono: ultimo ? ultimo.tono : 'neutro'
    },
    {
      etiqueta: 'Inspecciones hoy',
      valor: hoy
    },
    {
      etiqueta: 'Últimos 7 días',
      valor: semana,
      unidad: semana === 1 ? 'inspección' : 'inspecciones'
    }
  ];
}
