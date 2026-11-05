'use client';

import { useState } from 'react';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import {
  ALCANCES, AREAS_BENEFICIO, AREAS_BIOGAS, AYUDA_ORIGEN, ORIGENES, ahoraEnBogota, formatoDuracion, minutosEntre,
  type Alcance, type AreaAfectada, type MotorApagon, type Origen
} from '@/lib/apagones/tipos';
import { validarReporte } from '@/lib/apagones/validacion';
import { Bloque, ListaErrores, Opciones, TextoConVoz } from './Controles';

// Reporte de un apagón. Lo normal es reportarlo mientras pasa («sigue sin
// energía»): queda en curso y se cierra después con la hora en que volvió.
// Si se reporta cuando ya pasó, se escriben las dos horas de una vez.

const AYUDA_ALCANCE: Record<Alcance, string> = {
  'Toda la planta': 'Biogás y planta de beneficio',
  'Planta de beneficio': 'Proceso de extracción',
  'Planta de biogás': 'Motores, biodigestores, biofiltro',
  'Áreas puntuales': 'Marque abajo cuáles'
};

function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
}

export default function FormularioApagon({ motores, hayEnCurso, operador, onCancelar, onGuardado }: {
  motores: MotorApagon[];
  /** Ya hay un apagón abierto: solo se puede reportar uno que ya terminó. */
  hayEnCurso: boolean;
  operador: string;
  onCancelar: () => void;
  onGuardado: (mensaje: string, mes: string) => void;
}) {
  const [yaVolvio, setYaVolvio] = useState(hayEnCurso);
  const [inicio, setInicio] = useState(() => ahoraEnBogota());
  const [fin, setFin] = useState('');
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [alcance, setAlcance] = useState<Alcance | null>(null);
  const [areas, setAreas] = useState<AreaAfectada[]>([]);
  const [motoresAfectados, setMotoresAfectados] = useState<string[]>([]);
  const [descripcion, setDescripcion] = useState('');
  const [acciones, setAcciones] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const duracion = yaVolvio && inicio && fin ? minutosEntre(inicio, fin) : null;

  const guardar = async () => {
    const cuerpo = {
      inicio,
      fin: yaVolvio ? fin : null,
      origen,
      alcance,
      areas,
      motores: motoresAfectados,
      descripcion,
      acciones: yaVolvio ? acciones : '',
      operador
    };
    if (yaVolvio && !fin) {
      setErrores(['Escriba la hora en que volvió la energía.']);
      return;
    }
    const { valor, errores: encontrados } = validarReporte(cuerpo, ahoraEnBogota());
    setErrores(encontrados);
    if (!valor) return;

    setGuardando(true);
    try {
      const respuesta = await fetch('/api/apagones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setErrores(resultado.errores ?? [resultado.detalle || resultado.error]);
        return;
      }
      onGuardado(
        valor.fin ? 'Apagón reportado con su hora de restablecimiento.' : 'Apagón reportado. Cuando vuelva la energía, toque «Ya volvió la energía».',
        valor.inicio.slice(0, 7)
      );
    } catch {
      setErrores(['No se pudo conectar con el servidor. Revise la conexión e intente de nuevo.']);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
      className="bg-superficie border-2 border-bosque rounded-xl p-4 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">Reportar apagón</h2>
          <p className="text-tinta-suave">Reporta <span className="font-semibold text-tinta">{operador || 'sin sesión'}</span></p>
        </div>
        <button type="button" onClick={onCancelar} className={claseBoton('secundario', 'sm')}>
          Cerrar
        </button>
      </div>

      {hayEnCurso && (
        <Aviso tono="alerta" titulo="Ya hay un apagón en curso">
          Para el apagón de ahora, registre cuándo volvió la energía en el aviso de arriba. Aquí solo puede reportar uno que ya terminó.
        </Aviso>
      )}

      <Bloque titulo="¿Ya volvió la energía?">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl">
          {[false, true].map((opcion) => {
            const activa = yaVolvio === opcion;
            const bloqueada = !opcion && hayEnCurso;
            return (
              <button
                key={String(opcion)}
                type="button"
                aria-pressed={activa}
                disabled={bloqueada}
                onClick={() => {
                  setYaVolvio(opcion);
                  setErrores([]);
                }}
                className={`rounded-lg border-2 px-4 py-3 text-left font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  activa ? 'border-bosque bg-hoja-claro text-bosque-oscuro' : 'border-linea-fuerte bg-superficie text-tinta hover:bg-superficie-2'
                }`}
              >
                {opcion ? 'Sí, ya volvió' : 'No, seguimos sin energía'}
                <span className="block text-sm font-normal text-tinta-suave">
                  {opcion ? 'Escriba la hora en que se fue y la hora en que volvió' : 'Queda en curso hasta que registre el regreso'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mt-4">
          <div>
            <label htmlFor="inicio-apagon" className={claseEtiqueta}>Se fue la energía</label>
            <input
              id="inicio-apagon"
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={claseCampo}
            />
          </div>
          {yaVolvio && (
            <div>
              <label htmlFor="fin-apagon" className={claseEtiqueta}>Volvió la energía</label>
              <input
                id="fin-apagon"
                type="datetime-local"
                value={fin}
                min={inicio || undefined}
                onChange={(e) => setFin(e.target.value)}
                className={claseCampo}
              />
            </div>
          )}
        </div>
        {duracion !== null && duracion > 0 && (
          <p className="mt-2 text-tinta-suave">
            Duración: <span className="font-semibold text-tinta tabular-nums">{formatoDuracion(duracion)}</span>
          </p>
        )}
      </Bloque>

      <Bloque titulo="Origen" nota="Si todavía no se sabe, marque «Desconocido»; se puede corregir al registrar el regreso.">
        <Opciones nombre="origen" opciones={ORIGENES} valor={origen} onChange={setOrigen} ayuda={AYUDA_ORIGEN} />
      </Bloque>

      <Bloque titulo="¿Qué se quedó sin energía?">
        <Opciones nombre="alcance" opciones={ALCANCES} valor={alcance} onChange={setAlcance} ayuda={AYUDA_ALCANCE} />
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-tinta-suave">
            Áreas afectadas {alcance === 'Áreas puntuales' ? '(marque al menos una)' : '(opcional)'}
          </p>
          <div>
            <p className="text-sm text-tinta-suave mb-1.5">Biogás</p>
            <Opciones
              nombre="areas-biogas"
              multiple
              opciones={AREAS_BIOGAS}
              valor={areas}
              onChange={(a) => setAreas((actual) => alternar(actual, a))}
            />
          </div>
          <div>
            <p className="text-sm text-tinta-suave mb-1.5">Planta de beneficio</p>
            <Opciones
              nombre="areas-beneficio"
              multiple
              opciones={AREAS_BENEFICIO}
              valor={areas}
              onChange={(a) => setAreas((actual) => alternar(actual, a))}
              columnas="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
            />
          </div>
        </div>
      </Bloque>

      {motores.length > 0 && (
        <Bloque titulo="Motores que se apagaron" nota="Opcional. Marque los Jenbacher que salieron por el apagón.">
          <Opciones
            nombre="motores"
            multiple
            opciones={motores.map((m) => m.id)}
            valor={motoresAfectados}
            onChange={(id) => setMotoresAfectados((actual) => alternar(actual, id))}
            etiquetas={Object.fromEntries(motores.map((m) => [m.id, m.nombre]))}
          />
        </Bloque>
      )}

      <Bloque titulo="¿Qué pasó?" nota="Opcional. Escriba o toque el micrófono para dictar.">
        <TextoConVoz id="descripcion-apagon" etiqueta="Descripción" valor={descripcion} onChange={setDescripcion} deshabilitado={guardando} />
      </Bloque>

      {yaVolvio && (
        <Bloque titulo="Acciones tomadas" nota="Opcional. Qué se hizo para restablecer la energía y los equipos.">
          <TextoConVoz id="acciones-apagon" etiqueta="Acciones tomadas" valor={acciones} onChange={setAcciones} deshabilitado={guardando} />
        </Bloque>
      )}

      {errores.length > 0 && (
        <Aviso tono="error" titulo="No se guardó. Corrija lo siguiente:">
          <ListaErrores errores={errores} />
        </Aviso>
      )}

      <button type="submit" disabled={guardando || !operador || (!yaVolvio && hayEnCurso)} className={`${claseBoton('primario', 'lg')} w-full`}>
        {guardando ? 'Guardando…' : 'Reportar apagón'}
      </button>
    </form>
  );
}
