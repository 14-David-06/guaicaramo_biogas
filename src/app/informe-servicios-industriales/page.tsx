'use client';

import { useState } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import VistaAcumulados from './VistaAcumulados';
import VistaDiaria from './VistaDiaria';
import VistaBloque from './VistaBloque';

// Informe de Servicios Industriales — Biogás: los mismos datos que hoy se
// pasan a mano al Excel de Servicios Industriales y al informe de producción
// de la extractora, calculados desde la app.

const VISTAS = [
  { id: 'acumulados', nombre: 'Acumulados del año' },
  { id: 'diario', nombre: 'Por semana o mes' },
  { id: 'produccion', nombre: 'Bloque para producción' }
] as const;
type IdVista = (typeof VISTAS)[number]['id'];

function ContenidoServiciosIndustriales() {
  const [vista, setVista] = useState<IdVista>('acumulados');
  return (
    <Pagina ancho="amplio">
      <EncabezadoPagina
        titulo="Informe Servicios Industriales — Biogás"
        descripcion="Horas, energía, biogás, arranques y calidad del gas de cada Jenbacher, por mes, semana y día. Se descarga en Excel o PDF."
      />

      <div role="tablist" aria-label="Vista del informe" className="flex flex-wrap gap-1 border-b border-linea">
        {VISTAS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={vista === v.id}
            onClick={() => setVista(v.id)}
            className={`px-4 py-2.5 -mb-px border-b-[3px] font-semibold min-h-[44px] transition-colors ${
              vista === v.id ? 'border-bosque text-bosque-oscuro' : 'border-transparent text-tinta-suave hover:text-tinta'
            }`}
          >
            {v.nombre}
          </button>
        ))}
      </div>

      {vista === 'acumulados' && <VistaAcumulados />}
      {vista === 'diario' && <VistaDiaria />}
      {vista === 'produccion' && <VistaBloque />}
    </Pagina>
  );
}

export default function InformeServiciosIndustrialesPage() {
  return (
    <RoleGuard
      allowedRoles={['Ingeniera - Jefe de planta', 'Jefe director de planta', 'Desarrollador', 'CTO', 'CEO']}
      fallbackMessage="El informe de Servicios Industriales está disponible solo para jefatura y dirección."
    >
      <ContenidoServiciosIndustriales />
    </RoleGuard>
  );
}
