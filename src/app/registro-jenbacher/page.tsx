'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Aviso from '@/components/ui/Aviso';
import { useAuth } from '@/hooks/useAuth';
import { formatearFechaLarga } from '@/lib/informe/fechas';
import { franjaActual } from '@/lib/planilla/franjas';
import { mensajeBloqueo } from '@/lib/planilla/operacion';
import type { RespuestaPlanilla } from '@/lib/planilla/tipos';
import DatosOperacion from './DatosOperacion';
import { indicadoresPlanilla } from './indicadores';
import LecturaHoraria from './LecturaHoraria';
import MedicionesBiofiltro from './MedicionesBiofiltro';

// Registro Jenbacher organizado como la hoja "Control diario a composición del
// biogás y potencia de Jenbacher":
//   1. Lectura horaria (la fila de cada hora): digestores, gas en 3 puntos,
//      biofiltro, potencia y m³ de cada Jenbacher, sopladores y observaciones.
//   2. Mediciones antes del biofiltro, por digestor (dos tomas al día).
//   3. Datos de operación de cada Jenbacher (inicial y final, una vez al día).

const SECCIONES = [
  { id: 'lectura-horaria', nombre: 'Lectura horaria', nota: 'cada hora' },
  { id: 'mediciones-biofiltro', nombre: 'Mediciones antes del biofiltro', nota: '2 veces al día' },
  { id: 'datos-operacion', nombre: 'Datos de operación', nota: 'inicio y cierre del día' }
];

export default function RegistroJenbacherPage() {
  const { user: loggedInUser } = useAuth();
  const operador = loggedInUser?.nombre ?? '';
  const [datos, setDatos] = useState<RespuestaPlanilla | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/planilla-horaria');
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.detalle || resultado.error);
      setDatos(resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el registro.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // La hora del formulario es fija: cuando cambia la hora, se recarga para que avance sola.
  const horaCargada = datos?.horaActual;
  useEffect(() => {
    if (!horaCargada) return;
    const reloj = setInterval(() => {
      if (franjaActual(new Date()).hora !== horaCargada) cargar();
    }, 30_000);
    return () => clearInterval(reloj);
  }, [horaCargada, cargar]);

  const guardado = (texto: string) => {
    setMensaje(texto);
    cargar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <TurnoGuard>
      <Pagina>
        <EncabezadoPagina
          titulo="Registro Jenbacher"
          descripcion="Control diario a composición del biogás y potencia de Jenbacher, en el mismo orden de la hoja."
        >
          {datos && (
            <>
              <span>
                Fecha: <span className="font-semibold text-tinta">{formatearFechaLarga(datos.fechaActual).replace(/^./, (c) => c.toUpperCase())}</span>
              </span>
              <span>
                Turno:{' '}
                {datos.turno ? <span className="font-semibold text-tinta">{datos.turno.operador || 'abierto'}</span> : 'sin turno abierto'}
              </span>
            </>
          )}
        </EncabezadoPagina>

        {datos && <Indicadores items={indicadoresPlanilla(datos)} />}

        <nav aria-label="Partes de la hoja" className="grid sm:grid-cols-3 gap-2">
          {SECCIONES.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-baseline gap-2 rounded-lg border border-linea bg-superficie px-4 py-3 hover:border-bosque transition-colors"
            >
              <span className="font-condensada font-bold text-xl text-bosque">{i + 1}</span>
              <span>
                <span className="font-semibold text-tinta">{s.nombre}</span>
                <span className="block text-sm text-tinta-suave">{s.nota}</span>
              </span>
            </a>
          ))}
        </nav>

        {datos?.bloqueo && (
          <Aviso tono="alerta" titulo="Primero cierre los datos de operación del día anterior">
            {mensajeBloqueo(datos.bloqueo.fechaAnterior, datos.bloqueo.motores)}
          </Aviso>
        )}
        {mensaje && <Aviso tono="exito">{mensaje}</Aviso>}
        {error && <Aviso tono="error" titulo="No se pudo cargar el registro">{error}</Aviso>}

        {cargando && !datos ? (
          <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
            <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
            Validando motores disponibles…
          </div>
        ) : datos ? (
          <>
            <div id="lectura-horaria" className="scroll-mt-20">
              {/* La key reinicia el formulario cuando cambia la planilla en curso. */}
              <LecturaHoraria key={datos.fechaActual} datos={datos} operador={operador} onGuardado={guardado} />
            </div>
            <div id="mediciones-biofiltro" className="scroll-mt-20">
              <MedicionesBiofiltro datos={datos} operador={operador} onGuardado={guardado} />
            </div>
            <div id="datos-operacion" className="scroll-mt-20">
              <DatosOperacion datos={datos} operador={operador} onGuardado={guardado} />
            </div>
          </>
        ) : null}

        <p className="text-tinta-suave">
          El historial de mediciones por digestor está en{' '}
          <Link href="/registro-biodigestores" className="font-semibold text-bosque underline underline-offset-2">registro de biodigestores</Link>.
        </p>
      </Pagina>
    </TurnoGuard>
  );
}
