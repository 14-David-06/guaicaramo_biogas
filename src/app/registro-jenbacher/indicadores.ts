import type { Indicador, TonoIndicador } from '@/components/ui/Indicadores';
import { UMBRALES_PLANILLA_GAS } from '@/lib/informe/umbrales';
import type { RespuestaPlanilla } from '@/lib/planilla/tipos';
import { estadoDeValor } from '@/lib/planilla/validacion';

// Resumen de una planilla Jenbacher para la franja de indicadores. Lo usan la
// planilla y el inicio.

const TONO_DE_ESTADO: Record<ReturnType<typeof estadoDeValor>, TonoIndicador> = {
  vacio: 'neutro',
  invalido: 'critico',
  ok: 'ok',
  advertencia: 'alerta',
  critica: 'critico'
};

export function indicadoresPlanilla(datos: RespuestaPlanilla): Indicador[] {
  const registradas = datos.franjas.filter((f) => f.estado === 'registrada').length;
  const porRegistrar = datos.franjas.filter((f) => f.registrable).length;
  const perdidas = datos.franjas.filter((f) => f.estado === 'pendiente' && !f.registrable).length;
  const ultima = [...datos.franjas].reverse().find((f) => f.lectura);
  const l = ultima?.lectura;

  const ch4 = l?.gas.salida_biochar.ch4 ?? null;
  const umbralCh4 = UMBRALES_PLANILLA_GAS.salida_biochar.ch4;
  const conPotencia = l?.motores.filter((m) => m.potenciaKw !== null) ?? [];
  const potencia = conPotencia.reduce((total, m) => total + (m.potenciaKw ?? 0), 0);

  return [
    {
      etiqueta: 'Horas registradas',
      valor: registradas,
      unidad: 'de 24',
      detalle:
        [
          porRegistrar > 0 && `${porRegistrar} por registrar`,
          perdidas > 0 && `${perdidas} sin registro`
        ].filter(Boolean).join(', ') || 'Al día',
      tono: perdidas > 0 ? 'critico' : porRegistrar > 0 ? 'alerta' : registradas > 0 ? 'ok' : 'neutro'
    },
    {
      etiqueta: 'Última lectura',
      valor: ultima?.hora ?? '—',
      detalle: l ? `${l.operador.split(' ')[0]}, guardada a las ${l.guardadaA}` : 'Aún no hay lecturas'
    },
    {
      etiqueta: 'CH4 que entra al motor',
      valor: ch4 === null ? '—' : ch4.toLocaleString('es-CO'),
      unidad: ch4 === null ? undefined : '%',
      detalle: `Salida biochar, rango ${umbralCh4.referencia}`,
      tono: TONO_DE_ESTADO[estadoDeValor(ch4, umbralCh4)]
    },
    {
      etiqueta: 'Potencia generada',
      valor: conPotencia.length ? potencia.toLocaleString('es-CO') : '—',
      unidad: conPotencia.length ? 'kW' : undefined,
      detalle: conPotencia.length
        ? conPotencia.map((m) => `${m.nombre} ${m.potenciaKw?.toLocaleString('es-CO')}`).join(', ')
        : 'En la última lectura'
    }
  ];
}
