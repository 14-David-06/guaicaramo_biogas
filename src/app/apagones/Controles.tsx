'use client';

import VoiceRecorder from '@/components/VoiceRecorder';
import { claseCampo } from '@/components/ui/estilos';
import { MAX_TEXTO } from '@/lib/apagones/validacion';

// Piezas comunes del reporte y del cierre: grupos de opciones grandes, fáciles
// de tocar con guantes o con el celular en una mano, y texto con dictado.

export function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-linea pt-5">
      <legend className="font-condensada font-bold text-lg text-tinta float-left w-full">{titulo}</legend>
      {nota && <p className="text-tinta-suave text-sm clear-left pt-0.5">{nota}</p>}
      <div className="mt-3 clear-left">{children}</div>
    </fieldset>
  );
}

export function Opciones<T extends string>({ nombre, opciones, valor, onChange, multiple = false, ayuda, etiquetas, columnas = 'sm:grid-cols-2 lg:grid-cols-4' }: {
  nombre: string;
  opciones: readonly T[];
  /** Una opción (radio) o varias (checkbox). */
  valor: T | null | T[];
  onChange: (valor: T) => void;
  multiple?: boolean;
  ayuda?: Partial<Record<T, string>>;
  /** Texto visible cuando la opción es un ID (p. ej. motores). */
  etiquetas?: Partial<Record<T, string>>;
  columnas?: string;
}) {
  const marcada = (o: T) => (Array.isArray(valor) ? valor.includes(o) : valor === o);
  return (
    <div className={`grid grid-cols-1 ${columnas} gap-2`}>
      {opciones.map((o) => {
        const activa = marcada(o);
        return (
          <label
            key={o}
            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
              activa ? 'border-bosque bg-hoja-claro' : 'border-linea-fuerte bg-superficie hover:bg-superficie-2'
            } has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-bosque`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={nombre}
              value={o}
              checked={activa}
              onChange={() => onChange(o)}
              className="mt-1 h-4 w-4 accent-[var(--color-bosque)] shrink-0"
            />
            <span>
              <span className={`block font-semibold ${activa ? 'text-bosque-oscuro' : 'text-tinta'}`}>{etiquetas?.[o] ?? o}</span>
              {ayuda?.[o] && <span className="block text-sm text-tinta-suave">{ayuda[o]}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function TextoConVoz({ id, etiqueta, valor, onChange, deshabilitado }: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <textarea
        id={id}
        aria-label={etiqueta}
        rows={3}
        maxLength={MAX_TEXTO}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`${claseCampo} flex-1 min-w-0`}
      />
      <VoiceRecorder
        size="sm"
        disabled={deshabilitado}
        onTranscription={(t) => onChange([valor.trim(), t.trim()].filter(Boolean).join(' ').slice(0, MAX_TEXTO))}
      />
    </div>
  );
}

export function ListaErrores({ errores }: { errores: string[] }) {
  return (
    <ul className="list-disc pl-5 space-y-0.5">
      {errores.map((e) => <li key={e}>{e}</li>)}
    </ul>
  );
}
