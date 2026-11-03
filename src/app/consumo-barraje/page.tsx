'use client';

import { useCallback, useEffect, useState } from 'react';
import TurnoGuard from '@/components/TurnoGuard';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { useAuth } from '@/hooks/useAuth';
import type { RespuestaConsumo } from '@/lib/consumo-barraje/tipos';
import FormularioConsumo from './FormularioConsumo';
import TablaConsumo from './TablaConsumo';
import { indicadoresConsumo, nombreMes } from './resumen';

// Planilla de consumo kW barraje #2: reemplaza el formato en papel de la
// planta de beneficio (generación de energía). Un registro por día.

export default function ConsumoBarrajePage() {
  const { user } = useAuth();
  /** null = el mes en curso. */
  const [mes, setMes] = useState<string | null>(null);
  const [datos, setDatos] = useState<RespuestaConsumo | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  /** Día que se está registrando, o null con el formulario cerrado. */
  const [formulario, setFormulario] = useState<string | null>(null);

  const cargar = useCallback(async (m: string | null) => {
    setCargando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/consumo-barraje${m ? `?mes=${m}` : ''}`);
      const resultado = await respuesta.json();
      if (!respuesta.ok) throw new Error(resultado.detalle || resultado.error);
      setDatos(resultado);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la planilla.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(mes);
  }, [cargar, mes]);

  const registrados = new Set(datos?.dias.map((d) => d.fecha) ?? []);
  const mesActual = datos?.hoy.slice(0, 7);
  const hoyRegistrado = datos ? registrados.has(datos.hoy) : false;

  const abrir = (fecha: string) => {
    setMensaje(null);
    setFormulario(fecha);
  };

  return (
    <TurnoGuard>
      <Pagina ancho="amplio">
        <EncabezadoPagina
          titulo="Consumo kW barraje #2"
          descripcion="Consumo del día de cada área de la planta de beneficio, como en la planilla en papel."
          acciones={
            <>
              <div>
                <label htmlFor="mes" className={claseEtiqueta}>Planilla de</label>
                <input
                  id="mes"
                  type="month"
                  value={datos?.mes ?? ''}
                  max={mesActual}
                  onChange={(e) => {
                    setFormulario(null);
                    setMensaje(null);
                    setMes(e.target.value || null);
                  }}
                  className={`${claseCampo} w-auto`}
                />
              </div>
              {datos && formulario === null && (
                <button type="button" onClick={() => abrir(hoyRegistrado ? '' : datos.hoy)} className={claseBoton('primario')}>
                  Registrar consumo
                </button>
              )}
            </>
          }
        >
          {datos && (
            <>
              <span className="font-semibold text-tinta">Planilla de {nombreMes(datos.mes)}</span>
              <span>
                Turno:{' '}
                {datos.turno ? <span className="font-semibold text-tinta">{datos.turno.operador || 'abierto'}</span> : 'sin turno abierto'}
              </span>
            </>
          )}
        </EncabezadoPagina>

        {datos && <Indicadores items={indicadoresConsumo(datos)} />}

        {mensaje && <Aviso tono="exito">{mensaje}</Aviso>}
        {error && <Aviso tono="error" titulo="No se pudo cargar la planilla">{error}</Aviso>}

        {datos && formulario !== null && (
          <FormularioConsumo
            key={formulario}
            hoy={datos.hoy}
            fechaInicial={formulario}
            registrados={registrados}
            operador={user?.nombre ?? ''}
            onCancelar={() => setFormulario(null)}
            onGuardado={(texto, fecha) => {
              setMensaje(texto);
              setFormulario(null);
              const mesGuardado = fecha.slice(0, 7);
              if (mesGuardado !== datos.mes) setMes(mesGuardado);
              else cargar(mes);
            }}
          />
        )}

        {cargando && !datos ? (
          <div className="flex items-center gap-3 py-12 justify-center text-tinta-suave" role="status">
            <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
            Cargando la planilla…
          </div>
        ) : datos ? (
          <Panel
            titulo={`Planilla de ${nombreMes(datos.mes)}`}
            descripcion="Consumo del día en kW. Toque «Registrar» en un día pendiente para llenarlo."
          >
            <TablaConsumo datos={datos} puedeRegistrar={!!user} onRegistrar={abrir} />
          </Panel>
        ) : null}
      </Pagina>
    </TurnoGuard>
  );
}
