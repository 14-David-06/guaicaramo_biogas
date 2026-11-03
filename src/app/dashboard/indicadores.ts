import type { Indicador } from '@/components/ui/Indicadores';
import type { EstadoMotor, Motor, RegistroDiariosJenbacher } from '@/utils/airtable';
import { type DatosTablero, tonoGas, tonoH2S } from './formato';

// Resumen de la planta para la franja de indicadores del tablero. Sale solo de
// lo que la página ya cargó: el último estado de cada motor y el registro
// Jenbacher más reciente.

const num = (valor: unknown): number | null => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null);
const cifra = (valor: number, decimales = 0) => valor.toLocaleString('es-CO', { maximumFractionDigits: decimales });

/** El registro con la fecha más reciente, sin depender del orden del arreglo. */
export function registroMasReciente(registros: RegistroDiariosJenbacher[]): RegistroDiariosJenbacher | null {
  let mejor: RegistroDiariosJenbacher | null = null;
  let mejorFecha = -Infinity;
  for (const r of registros) {
    const fecha = typeof r.fields['Fecha Registro'] === 'string' ? new Date(r.fields['Fecha Registro']).getTime() : NaN;
    if (!Number.isNaN(fecha) && fecha > mejorFecha) {
      mejor = r;
      mejorFecha = fecha;
    }
  }
  return mejor ?? registros[0] ?? null;
}

export function indicadoresTablero(datos: DatosTablero, ultimosEstados: EstadoMotor[], motores: Motor[]): Indicador[] {
  const encendidos = ultimosEstados.filter((e) => e.fields['Estado Motor'] === 'Encendido').length;
  const apagados = ultimosEstados.filter((e) => e.fields['Estado Motor'] === 'Apagado');
  const total = ultimosEstados.length;
  const nombreCorto = (estado: EstadoMotor) => {
    const id = Array.isArray(estado.fields['Motor']) ? estado.fields['Motor'][0] : estado.fields['Motor'];
    const motor = motores.find((m) => m.id === id);
    return motor ? String(motor.fields['Nombre Motor']) : 'sin nombre';
  };

  const ultimo = registroMasReciente(datos.registrosJenbacher);
  const potencia = num(ultimo?.fields['POTENCIA GENERADA(Kw)']);
  const biogas = num(ultimo?.fields['M3 DE BIOGAS (M3)']);
  const ch4 = num(ultimo?.fields['METANO(CH4)%']);
  const h2s = num(ultimo?.fields['ACIDO SULFIDRICO(H2S)']);
  const maxH2S = datos.registrosJenbacher.length
    ? Math.max(...datos.registrosJenbacher.map((r) => r.fields['ACIDO SULFIDRICO(H2S)'] || 0))
    : null;
  const horaUltimo =
    typeof ultimo?.fields['Fecha Registro'] === 'string'
      ? new Date(ultimo.fields['Fecha Registro']).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : null;

  return [
    {
      etiqueta: 'Motores encendidos',
      valor: total ? encendidos : '—',
      unidad: total ? `de ${total}` : undefined,
      detalle: !total
        ? 'Sin estados registrados'
        : apagados.length
          ? `Apagado: ${apagados.map(nombreCorto).join(', ')}`
          : 'Todos en marcha',
      tono: !total ? 'neutro' : encendidos === 0 ? 'critico' : apagados.length ? 'alerta' : 'ok'
    },
    {
      etiqueta: 'Potencia generada',
      valor: potencia === null ? '—' : cifra(potencia),
      unidad: potencia === null ? undefined : 'kW',
      detalle: ultimo
        ? [biogas !== null && `${cifra(biogas, 1)} m³ de biogás`, horaUltimo && `registro del ${horaUltimo}`].filter(Boolean).join(', ')
        : 'Aún no hay registros Jenbacher'
    },
    {
      etiqueta: 'Metano (CH4)',
      valor: ch4 === null ? '—' : cifra(ch4, 1),
      unidad: ch4 === null ? undefined : '%',
      detalle: 'Último registro, mínimo 50 %',
      tono: !ch4 ? 'neutro' : tonoGas('METANO(CH4)%', ch4) === 'neutro' ? 'ok' : tonoGas('METANO(CH4)%', ch4)
    },
    {
      etiqueta: 'H2S',
      valor: h2s === null ? '—' : cifra(h2s),
      unidad: h2s === null ? undefined : 'ppm',
      detalle: maxH2S === null ? 'Límite 300 ppm' : `Límite 300 ppm, máximo del período ${cifra(maxH2S)}`,
      tono: h2s === null ? 'neutro' : tonoH2S(h2s)
    }
  ];
}
