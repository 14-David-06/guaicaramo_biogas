'use client';

import { useState } from 'react';
import Aviso from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import { AYUDA_ORIGEN, ORIGENES, ahoraEnBogota, formatoDuracion, minutosEntre, type Apagon, type Origen } from '@/lib/apagones/tipos';
import { validarCierre } from '@/lib/apagones/validacion';
import { Bloque, ListaErrores, Opciones, TextoConVoz } from './Controles';
import { formatoMomento } from './resumen';

// Registrar que volvió la energía: la hora, lo que se hizo y, si al reportar
// no se sabía, el origen.

export default function CierreApagon({ apagon, operador, onCancelar, onGuardado }: {
  apagon: Apagon;
  operador: string;
  onCancelar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const [fin, setFin] = useState(() => ahoraEnBogota());
  const [origen, setOrigen] = useState<Origen | null>(apagon.origen);
  const [acciones, setAcciones] = useState('');
  const [errores, setErrores] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  const duracion = fin ? minutosEntre(apagon.inicio, fin) : null;
  const origenSinSaber = !apagon.origen || apagon.origen === 'Desconocido';

  const guardar = async () => {
    const cuerpo = { fin, origen: origen !== apagon.origen ? origen : null, acciones, operador };
    const { valor, errores: encontrados } = validarCierre(cuerpo, apagon.inicio, ahoraEnBogota());
    setErrores(encontrados);
    if (!valor) return;

    setGuardando(true);
    try {
      const respuesta = await fetch(`/api/apagones/${apagon.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo)
      });
      const resultado = await respuesta.json();
      if (!respuesta.ok) {
        setErrores(resultado.errores ?? [resultado.detalle || resultado.error]);
        return;
      }
      onGuardado(`Energía restablecida. El apagón duró ${formatoDuracion(minutosEntre(apagon.inicio, valor.fin))}.`);
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
          <h2 className="font-condensada font-bold text-2xl sm:text-3xl text-tinta">Volvió la energía</h2>
          <p className="text-tinta-suave">
            Apagón desde el <span className="font-semibold text-tinta">{formatoMomento(apagon.inicio)}</span>
            {apagon.reporta && <> · reportó {apagon.reporta.split(' ')[0]}</>}
          </p>
        </div>
        <button type="button" onClick={onCancelar} className={claseBoton('secundario', 'sm')}>
          Cerrar
        </button>
      </div>

      <div className="max-w-xs">
        <label htmlFor="fin-cierre" className={claseEtiqueta}>Hora en que volvió</label>
        <input
          id="fin-cierre"
          type="datetime-local"
          value={fin}
          min={apagon.inicio}
          onChange={(e) => setFin(e.target.value)}
          className={claseCampo}
        />
        {duracion !== null && duracion > 0 && (
          <p className="mt-2 text-tinta-suave">
            Duración: <span className="font-semibold text-tinta tabular-nums">{formatoDuracion(duracion)}</span>
          </p>
        )}
      </div>

      <Bloque
        titulo="Origen"
        nota={origenSinSaber ? 'Al reportarlo no se sabía. Si ya se conoce, márquelo.' : 'Cámbielo solo si resultó ser otro.'}
      >
        <Opciones nombre="origen-cierre" opciones={ORIGENES} valor={origen} onChange={setOrigen} ayuda={AYUDA_ORIGEN} />
      </Bloque>

      <Bloque titulo="Acciones tomadas" nota="Opcional. Qué se hizo para restablecer la energía y arrancar los equipos.">
        <TextoConVoz id="acciones-cierre" etiqueta="Acciones tomadas" valor={acciones} onChange={setAcciones} deshabilitado={guardando} />
      </Bloque>

      {errores.length > 0 && (
        <Aviso tono="error" titulo="No se guardó. Corrija lo siguiente:">
          <ListaErrores errores={errores} />
        </Aviso>
      )}

      <button type="submit" disabled={guardando || !operador || !fin} className={`${claseBoton('primario', 'lg')} w-full`}>
        {guardando ? 'Guardando…' : 'Registrar regreso de la energía'}
      </button>
    </form>
  );
}
