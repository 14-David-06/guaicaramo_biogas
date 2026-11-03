import type { ChartOptions } from 'chart.js';
import type { DatosTablero } from './formato';

// Datos y opciones de las gráficas del tablero. La preparación de datos es la
// misma que tenía la página; solo cambian los colores y el estilo.
//
// Ojo: varias funciones ordenan `registrosJenbacher` / `estadosMotores` en el
// mismo arreglo del estado (sort en sitio), como en la versión anterior.

export const COLOR = {
  bosque: '#4b5a32',
  hoja: '#7a9c4b',
  ambar: '#d9a33f',
  rojo: '#b42318',
  gris: '#6b7564',
  rejilla: '#d8dcd0',
  ejes: '#525c4b'
};

/** Barlow tal como la cargó next/font (el nombre real lleva un sufijo). */
function fuente(): string {
  if (typeof window === 'undefined') return 'Barlow, system-ui, sans-serif';
  const variable = getComputedStyle(document.documentElement).getPropertyValue('--font-barlow').trim();
  return variable ? `${variable}, system-ui, sans-serif` : 'Barlow, system-ui, sans-serif';
}

function hora(valor: unknown): string {
  const fecha = typeof valor === 'string' ? new Date(valor) : new Date();
  return fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function porFechaRegistro(datos: DatosTablero) {
  return datos.registrosJenbacher.sort((a, b) => {
    const fechaA = typeof a.fields['Fecha Registro'] === 'string' ? new Date(a.fields['Fecha Registro']).getTime() : 0;
    const fechaB = typeof b.fields['Fecha Registro'] === 'string' ? new Date(b.fields['Fecha Registro']).getTime() : 0;
    return fechaA - fechaB;
  });
}

function serie(color: string, extra: Record<string, unknown> = {}) {
  return {
    borderColor: color,
    backgroundColor: color,
    borderWidth: 2,
    tension: 0.3,
    fill: false,
    pointRadius: 2,
    pointHoverRadius: 5,
    ...extra
  };
}

// ── Datos ───────────────────────────────────────────────────────────────────

export function obtenerDatosH2S(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  const registros = datos.registrosJenbacher;
  const ultimoRegistro = registros[registros.length - 1];
  const h2s = ultimoRegistro.fields['ACIDO SULFIDRICO(H2S)'] || 0;
  const maxH2S = Math.max(...registros.map((r) => r.fields['ACIDO SULFIDRICO(H2S)'] || 0));
  const promedioH2S = registros.reduce((sum, r) => sum + (r.fields['ACIDO SULFIDRICO(H2S)'] || 0), 0) / registros.length;
  return { actual: h2s, maximo: maxH2S, promedio: promedioH2S };
}

export function prepararDatosComposicionGas(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  const registros = datos.registrosJenbacher;
  const ultimoRegistro = registros[registros.length - 1];

  const ch4 = ultimoRegistro.fields['METANO(CH4)%'] || 0;
  const o2 = ultimoRegistro.fields['OXIGENO(O2) %'] || 0;
  const co2 = ultimoRegistro.fields['DIOXIDO DE CARBONO(CO2) %'] || 0;
  const otros = 100 - (ch4 + o2 + co2);

  return {
    labels: ['CH4 (metano)', 'O2 (oxígeno)', 'CO2', 'Otros'],
    datasets: [{
      data: [ch4, o2, co2, Math.max(0, otros)],
      backgroundColor: [COLOR.bosque, COLOR.ambar, COLOR.gris, COLOR.rejilla],
      borderColor: '#ffffff',
      borderWidth: 2
    }]
  };
}

export function prepararDatosTendenciaQuimicos(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  // Limitar a los últimos 100 registros para evitar sobrecargar las gráficas
  const registrosLimitados = porFechaRegistro(datos).slice(-100);

  return {
    labels: registrosLimitados.map((r) => hora(r.fields['Fecha Registro'])),
    datasets: [
      { label: 'CH4 (%)', data: registrosLimitados.map((r) => r.fields['METANO(CH4)%'] || 0), ...serie(COLOR.bosque) },
      { label: 'O2 (%)', data: registrosLimitados.map((r) => r.fields['OXIGENO(O2) %'] || 0), ...serie(COLOR.hoja) },
      { label: 'CO2 (%)', data: registrosLimitados.map((r) => r.fields['DIOXIDO DE CARBONO(CO2) %'] || 0), ...serie(COLOR.gris) },
      {
        label: 'H2S (ppm)',
        data: registrosLimitados.map((r) => r.fields['ACIDO SULFIDRICO(H2S)'] || 0),
        ...serie(COLOR.ambar, { borderDash: [6, 4] }),
        yAxisID: 'y1'
      }
    ]
  };
}

export function prepararDatosPotenciaVsBiogas(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  // Limitar a los últimos 100 registros
  const registrosLimitados = porFechaRegistro(datos).slice(-100);

  return {
    labels: registrosLimitados.map((r) => hora(r.fields['Fecha Registro'])),
    datasets: [
      {
        label: 'Potencia generada (kW)',
        data: registrosLimitados.map((r) => r.fields['POTENCIA GENERADA(Kw)'] || 0),
        backgroundColor: COLOR.bosque,
        borderColor: COLOR.bosque,
        borderWidth: 1,
        yAxisID: 'y'
      },
      {
        label: 'Biogás consumido (m³)',
        data: registrosLimitados.map((r) => r.fields['M3 DE BIOGAS (M3)'] || 0),
        backgroundColor: COLOR.hoja,
        borderColor: COLOR.hoja,
        borderWidth: 1,
        yAxisID: 'y1'
      }
    ]
  };
}

export function prepararDatosTemperaturasBiofiltro(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  // Limitar a los últimos 100 registros
  const registrosLimitados = porFechaRegistro(datos).slice(-100);

  return {
    labels: registrosLimitados.map((r) => hora(r.fields['Fecha Registro'])),
    datasets: [
      { label: 'Entrada (°C)', data: registrosLimitados.map((r) => r.fields['TEMP. ENTRADA BIOFILTRO'] || 0), ...serie(COLOR.bosque) },
      { label: 'Salida (°C)', data: registrosLimitados.map((r) => r.fields['TEMP. SALIDA BIOFILTRO'] || 0), ...serie(COLOR.hoja, { borderDash: [6, 4] }) }
    ]
  };
}

export function prepararDatosPresionesBiofiltro(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  const registros = porFechaRegistro(datos);

  return {
    labels: registros.map((r) => hora(r.fields['Fecha Registro'])),
    datasets: [
      { label: 'Entrada (cm H2O)', data: registros.map((r) => r.fields['PRESION BIOFILTRO ENTRADA (cm de h20)'] || 0), ...serie(COLOR.bosque) },
      { label: 'Salida (cm H2O)', data: registros.map((r) => r.fields['PRESION BIOFILTRO SALIDA (cm de h2o)'] || 0), ...serie(COLOR.hoja, { borderDash: [6, 4] }) }
    ]
  };
}

export function prepararDatosEstadosMotores(datos: DatosTablero | null) {
  if (!datos || datos.estadosMotores.length === 0) return null;

  const estados = datos.estadosMotores.sort((a, b) => {
    const fechaA = typeof a.fields['Fecha y Hora'] === 'string' ? new Date(a.fields['Fecha y Hora']).getTime() : 0;
    const fechaB = typeof b.fields['Fecha y Hora'] === 'string' ? new Date(b.fields['Fecha y Hora']).getTime() : 0;
    return fechaA - fechaB;
  });

  return {
    labels: estados.map((e) => hora(e.fields['Fecha y Hora'])),
    datasets: [{
      label: 'Estado del motor',
      data: estados.map((estado) => (estado.fields['Estado Motor'] === 'Encendido' ? 1 : 0)),
      borderColor: COLOR.bosque,
      backgroundColor: 'rgba(122, 156, 75, 0.15)',
      borderWidth: 2,
      stepped: true,
      fill: true,
      pointRadius: 3,
      pointHoverRadius: 6
    }]
  };
}

export function prepararDatosEficienciaMotor(datos: DatosTablero | null) {
  if (!datos || datos.registrosJenbacher.length === 0) return null;
  const registros = porFechaRegistro(datos);

  return {
    labels: registros.map((r) => hora(r.fields['Fecha Registro'])),
    datasets: [{
      label: 'Eficiencia (kW/m³)',
      data: registros.map((r) => {
        const potencia = r.fields['POTENCIA GENERADA(Kw)'] || 0;
        const biogas = r.fields['M3 DE BIOGAS (M3)'] || 1; // Evitar división por cero
        return biogas > 0 ? potencia / biogas : 0;
      }),
      ...serie(COLOR.bosque, { pointRadius: 3 })
    }]
  };
}

// ── Opciones ────────────────────────────────────────────────────────────────

function eje(titulo: string, extra: Record<string, unknown> = {}) {
  const familia = fuente();
  return {
    ticks: { color: COLOR.ejes, font: { family: familia, size: 12 } },
    grid: { color: COLOR.rejilla },
    border: { color: COLOR.rejilla },
    title: titulo ? { display: true, text: titulo, color: COLOR.ejes, font: { family: familia, size: 12, weight: 600 } } : undefined,
    ...extra
  };
}

function leyenda(mostrar = true, posicion: 'top' | 'bottom' = 'top') {
  const familia = fuente();
  return {
    display: mostrar,
    position: posicion,
    labels: { color: COLOR.ejes, font: { family: familia, size: 13 }, boxWidth: 14, boxHeight: 14, usePointStyle: false }
  };
}

function tooltip() {
  const familia = fuente();
  return {
    backgroundColor: '#1e271b',
    titleFont: { family: familia, size: 13, weight: 600 },
    bodyFont: { family: familia, size: 13 },
    padding: 10
  };
}

export function opcionesComposicion(): ChartOptions<'doughnut'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '58%',
    animation: false,
    plugins: { legend: leyenda(true, 'bottom'), tooltip: tooltip() }
  } as ChartOptions<'doughnut'>;
}

/** Línea o barras con eje izquierdo y, si se da, un segundo eje a la derecha. */
function opcionesEjes(tituloY: string, tituloY1?: string, extraY: Record<string, unknown> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: { legend: leyenda(), tooltip: tooltip() },
    scales: {
      x: eje('', { ticks: { color: COLOR.ejes, font: { family: fuente(), size: 11 }, maxRotation: 0, autoSkipPadding: 12 } }),
      y: eje(tituloY, { type: 'linear', position: 'left', ...extraY }),
      ...(tituloY1 ? { y1: eje(tituloY1, { type: 'linear', position: 'right', grid: { drawOnChartArea: false, color: COLOR.rejilla } }) } : {})
    }
  };
}

export const opcionesTendencia = (): ChartOptions<'line'> => opcionesEjes('Porcentaje (%)', 'H2S (ppm)') as ChartOptions<'line'>;
export const opcionesPotencia = (): ChartOptions<'bar'> => opcionesEjes('Potencia (kW)', 'Biogás (m³)') as ChartOptions<'bar'>;
export const opcionesTemperaturas = (): ChartOptions<'line'> => opcionesEjes('Temperatura (°C)') as ChartOptions<'line'>;
export const opcionesPresiones = (): ChartOptions<'line'> => opcionesEjes('Presión (cm H2O)') as ChartOptions<'line'>;
export const opcionesEficiencia = (): ChartOptions<'line'> => opcionesEjes('kW por m³') as ChartOptions<'line'>;

export function opcionesEstados(): ChartOptions<'line'> {
  const base = opcionesEjes('Estado', undefined, {
    min: 0,
    max: 1,
    ticks: {
      color: COLOR.ejes,
      font: { family: fuente(), size: 12 },
      stepSize: 1,
      callback: (tickValue: string | number) => (typeof tickValue === 'number' && tickValue === 1 ? 'Encendido' : 'Apagado')
    }
  });
  return { ...base, plugins: { ...base.plugins, legend: leyenda(false) } } as ChartOptions<'line'>;
}
