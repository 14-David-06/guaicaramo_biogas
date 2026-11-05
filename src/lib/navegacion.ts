// Mapa de la aplicación: lo usan la barra de navegación y los accesos del
// inicio, para que una página nueva aparezca en ambos lugares a la vez.

export interface PaginaMenu {
  nombre: string;
  href: string;
  descripcion: string;
}

export interface SeccionMenu {
  id: string;
  nombre: string;
  paginas: PaginaMenu[];
}

export const SECCIONES_MENU: SeccionMenu[] = [
  {
    id: 'operaciones',
    nombre: 'Operación',
    paginas: [
      { nombre: 'Turnos', href: '/turnos', descripcion: 'Abrir y cerrar el turno' },
      { nombre: 'Monitoreo de motores', href: '/monitoreo-motores', descripcion: 'Estado y lecturas de cada motor' },
      { nombre: 'Registro Jenbacher', href: '/registro-jenbacher', descripcion: 'Parámetros de cada motor, gas y biofiltro' },
      { nombre: 'Consumo barraje #2', href: '/consumo-barraje', descripcion: 'Consumo diario por área de la planta de beneficio' },
      { nombre: 'Apagones', href: '/apagones', descripcion: 'Reportar cortes de energía y su restablecimiento' },
      { nombre: 'Limpiezas', href: '/limpiezas', descripcion: 'Limpiezas de equipos y áreas' },
      { nombre: 'Bitácora de eventos', href: '/bitacora-biogas', descripcion: 'Incidencias y novedades del turno' }
    ]
  },
  {
    id: 'monitoreo',
    nombre: 'Monitoreo',
    paginas: [
      { nombre: 'Tablero general', href: '/dashboard', descripcion: 'Vista general de la planta' },
      { nombre: 'Histórico de registros', href: '/sensores', descripcion: 'Consultar lecturas anteriores' },
      { nombre: 'Informe diario', href: '/informe-diario', descripcion: 'Consolidado del día en PDF y Excel' },
      { nombre: 'Informe Servicios Industriales', href: '/informe-servicios-industriales', descripcion: 'Acumulados de biogás por mes, semana y día' },
      { nombre: 'Remoción de H2S', href: '/remocion-h2s', descripcion: 'H2S antes y después del filtro' }
    ]
  },
  {
    id: 'biodigestores',
    nombre: 'Biodigestores',
    paginas: [
      { nombre: 'Registro de biodigestores', href: '/registro-biodigestores', descripcion: 'Mediciones por biodigestor' },
      { nombre: 'Monitoreo de biodigestores', href: '/monitoreo-biodigestores', descripcion: 'Seguimiento de cada biodigestor' }
    ]
  }
];

export function seccionDeRuta(ruta: string): SeccionMenu | undefined {
  return SECCIONES_MENU.find((s) => s.paginas.some((p) => ruta === p.href || ruta.startsWith(`${p.href}/`)));
}
