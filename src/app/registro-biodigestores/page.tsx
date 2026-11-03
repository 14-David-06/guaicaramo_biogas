'use client';

import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { airtableService, MedicionBiodigestores, Biodigestor } from '@/utils/airtable';
import VoiceRecorder from '@/components/VoiceRecorder';
import Pagina from '@/components/ui/Pagina';
import EncabezadoPagina from '@/components/ui/EncabezadoPagina';
import Indicadores, { type Indicador } from '@/components/ui/Indicadores';
import Panel from '@/components/ui/Panel';
import Aviso, { type TonoAviso } from '@/components/ui/Aviso';
import { claseBoton, claseCampo, claseEtiqueta } from '@/components/ui/estilos';
import {
  UMBRALES_BIODIGESTOR, biodigestoresDistintos, cifra, claseCeldaGas, esDeHoy, fechaDeMedicion, horaCorta,
  medicionMasReciente, numero, tonoGas
} from '../monitoreo-biodigestores/resumen';

export default function RegistroBiodigestoresPage() {
  const { user: loggedInUser } = useAuth();

  // Estados del formulario
  const [ch4, setCh4] = useState<string>('');
  const [co2, setCo2] = useState<string>('');
  const [o2, setO2] = useState<string>('');
  const [h2s, setH2s] = useState<string>('');
  const [co, setCo] = useState<string>('');
  const [no, setNo] = useState<string>('');
  const [biodigestorSeleccionado, setBiodigestorSeleccionado] = useState<string>('');
  const [enviandoFormulario, setEnviandoFormulario] = useState(false);
  // Resultado del último envío (antes era un alert()).
  const [aviso, setAviso] = useState<{ tono: TonoAviso; texto: string } | null>(null);

  // Estados para datos
  const [biodigestores, setBiodigestores] = useState<Biodigestor[]>([]);
  const [mediciones, setMediciones] = useState<MedicionBiodigestores[]>([]);
  const [cargandoBiodigestores, setCargandoBiodigestores] = useState(true);
  const [cargandoMediciones, setCargandoMediciones] = useState(true);
  const [mostrarMediciones, setMostrarMediciones] = useState(false);

  // Cargar datos al montar el componente
  useEffect(() => {
    if (loggedInUser) {
      cargarBiodigestores();
      cargarMediciones();
      // Debug: explorar tabla desconocida
      airtableService.explorarTablaDesconocida();
    }
  }, [loggedInUser]);

  const cargarBiodigestores = async () => {
    setCargandoBiodigestores(true);
    try {
      const biodigestoresData = await airtableService.obtenerBiodigestores();
      setBiodigestores(biodigestoresData);
    } catch (error) {
      console.error('Error cargando biodigestores:', error);
    } finally {
      setCargandoBiodigestores(false);
    }
  };

  const cargarMediciones = async () => {
    setCargandoMediciones(true);
    try {
      const medicionesData = await airtableService.obtenerMedicionesBiodigestores();
      setMediciones(medicionesData);
    } catch (error) {
      console.error('Error cargando mediciones:', error);
    } finally {
      setCargandoMediciones(false);
    }
  };

  // Función para obtener el nombre del biodigestor a partir de su ID
  const obtenerNombreBiodigestor = (medicion: MedicionBiodigestores): string => {
    // Intentar obtener el ID del biodigestor desde el campo de relación
    const biodigestorId = medicion.fields['Biodigestor Monitoreado']?.[0];

    if (!biodigestorId) {
      return 'No especificado';
    }

    // Buscar el biodigestor en el listado cargado
    const biodigestor = biodigestores.find(b => b.id === biodigestorId);

    return biodigestor?.fields['Nombre Biodigestores'] || 'Biodigestor desconocido';
  };

  if (!loggedInUser) {
    return (
      <Pagina>
        <Panel className="max-w-md mx-auto text-center">
          <h1 className="font-condensada font-bold text-2xl text-tinta">Inicie sesión para continuar</h1>
          <p className="mt-2 text-tinta-suave">El registro de biodigestores solo está disponible con una sesión abierta.</p>
          <Link href="/" className={`${claseBoton('primario', 'lg')} w-full mt-5`}>
            Ir a iniciar sesión
          </Link>
        </Panel>
      </Pagina>
    );
  }

  // Manejar selección de biodigestor
  const handleBiodigestorChange = (biodigestorId: string) => {
    setBiodigestorSeleccionado(biodigestorId);
  };

  // Validar formulario
  const isFormValid = () => {
    return ch4.trim() !== '' &&
           co2.trim() !== '' &&
           o2.trim() !== '' &&
           h2s.trim() !== '' &&
           co.trim() !== '' &&
           no.trim() !== '' &&
           biodigestorSeleccionado.trim() !== '';
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid()) {
      setAviso({ tono: 'alerta', texto: 'Complete los seis valores y elija el biodigestor antes de guardar.' });
      return;
    }

    setEnviandoFormulario(true);
    setAviso(null);

    try {
      await airtableService.crearMedicionBiodigestores(
        parseFloat(ch4),
        parseFloat(co2),
        parseFloat(o2),
        parseFloat(h2s),
        parseFloat(co),
        parseFloat(no),
        loggedInUser.nombre,
        biodigestorSeleccionado ? [biodigestorSeleccionado] : []
      );

      const nombre = biodigestores.find(b => b.id === biodigestorSeleccionado)?.fields['Nombre Biodigestores'];
      setAviso({ tono: 'exito', texto: `Medición guardada${nombre ? ` para ${nombre}` : ''}.` });

      // Limpiar formulario
      setCh4('');
      setCo2('');
      setO2('');
      setH2s('');
      setCo('');
      setNo('');
      setBiodigestorSeleccionado('');

      // Recargar mediciones
      await cargarMediciones();

    } catch (error) {
      console.error('Error al registrar medición:', error);
      setAviso({ tono: 'error', texto: 'No se pudo guardar la medición. Revise la conexión e intente de nuevo; los valores siguen en el formulario.' });
    } finally {
      setEnviandoFormulario(false);
    }
  };

  // Formatear fecha para mostrar
  const formatearFecha = (fechaISO: string) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString('es-CO', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para procesar la transcripción y extraer valores
  const procesarTranscripcion = (transcripcion: string) => {
    console.log('Transcripción completa:', transcripcion);
    const texto = transcripcion.toLowerCase();
    
    // Patrones para extraer valores numéricos de gases
    const patrones = {
      ch4: /(?:ch4|metano)[^\d]*(\d+(?:[.,]\d+)?)/i,
      co2: /(?:co2|di[óo]xido|carbono)[^\d]*(\d+(?:[.,]\d+)?)/i,
      o2: /(?:o2|ox[íi]geno)[^\d]*(\d+(?:[.,]\d+)?)/i,
      h2s: /(?:h2s|h dos s|[áa]cido sulfh[íi]drico|sulfh[íi]drico|sulfuro(?: de hidr[óo]geno)?|gas sulfh[íi]drico)[^\d]*(\d+(?:[.,]\d+)?)/i,
      co: /\bco\b[^\d]*(\d+(?:[.,]\d+)?)/i,
      no: /(?:no|[óo]xido n[íi]trico)[^\d]*(\d+(?:[.,]\d+)?)/i
    };

    // Patrones alternativos si los primeros no funcionan
    const patronesAlternativos = {
      ch4: /(\d+(?:[.,]\d+)?)[^\d]*(?:ch4|metano)/i,
      co2: /(\d+(?:[.,]\d+)?)[^\d]*(?:co2|di[óo]xido|carbono)/i,
      o2: /(\d+(?:[.,]\d+)?)[^\d]*(?:o2|ox[íi]geno)/i,
      h2s: /(\d+(?:[.,]\d+)?)[^\d]*(?:h2s|h dos s|[áa]cido sulfh[íi]drico|sulfh[íi]drico|sulfuro(?: de hidr[óo]geno)?)/i,
      co: /(\d+(?:[.,]\d+)?)[^\d]*\bco\b/i,
      no: /(\d+(?:[.,]\d+)?)[^\d]*(?:no|[óo]xido n[íi]trico)/i
    };

    const valoresExtraidos: Record<string, string> = {};
    
    // Intentar con patrones principales
    Object.entries(patrones).forEach(([campo, patron]) => {
      const match = texto.match(patron);
      if (match && match[1]) {
        valoresExtraidos[campo] = match[1].replace(',', '.');
        console.log(`Encontrado ${campo}:`, match[1]);
      }
    });

    // Si no encontró suficientes valores, intentar con patrones alternativos
    if (Object.keys(valoresExtraidos).length < 3) {
      Object.entries(patronesAlternativos).forEach(([campo, patron]) => {
        if (!valoresExtraidos[campo]) {
          const match = texto.match(patron);
          if (match && match[1]) {
            valoresExtraidos[campo] = match[1].replace(',', '.');
            console.log(`Encontrado alternativo ${campo}:`, match[1]);
          }
        }
      });
    }

    console.log('Valores extraídos:', valoresExtraidos);

    // Buscar biodigestor mencionado en la transcripción
    let biodigestorEncontrado: Biodigestor | null = null;
    
    // Primero intentar coincidencia exacta
    for (const biodigestor of biodigestores) {
      const nombreBiodigestor = biodigestor.fields['Nombre Biodigestores']?.toLowerCase();
      if (nombreBiodigestor && texto.includes(nombreBiodigestor)) {
        biodigestorEncontrado = biodigestor;
        break;
      }
    }
    
    // Si no encontró coincidencia exacta, intentar con patrones más flexibles
    if (!biodigestorEncontrado) {
      const patronesBiodigestor = [
        /biodigestor\s*(\d+)/i,  // "biodigestor 1", "biodigestor 2", etc.
        /digestor\s*(\d+)/i,     // "digestor 1", "digestor 2", etc.
        /tanque\s*(\d+)/i,       // "tanque 1", "tanque 2", etc.
        /(\d+)/i                 // Solo números
      ];
      
      for (const patron of patronesBiodigestor) {
        const match = texto.match(patron);
        if (match && match[1]) {
          const numero = match[1];
          // Buscar biodigestor que contenga ese número en su nombre
          for (const biodigestor of biodigestores) {
            const nombreBiodigestor = biodigestor.fields['Nombre Biodigestores']?.toLowerCase();
            if (nombreBiodigestor && (nombreBiodigestor.includes(numero) || nombreBiodigestor.includes(` ${numero}`))) {
              biodigestorEncontrado = biodigestor;
              break;
            }
          }
          if (biodigestorEncontrado) break;
        }
      }
    }

    // Actualizar los campos con los valores encontrados
    if (Object.keys(valoresExtraidos).length > 0) {
      if (valoresExtraidos.ch4) setCh4(valoresExtraidos.ch4);
      if (valoresExtraidos.co2) setCo2(valoresExtraidos.co2);
      if (valoresExtraidos.o2) setO2(valoresExtraidos.o2);
      if (valoresExtraidos.h2s) setH2s(valoresExtraidos.h2s);
      if (valoresExtraidos.co) setCo(valoresExtraidos.co);
      if (valoresExtraidos.no) setNo(valoresExtraidos.no);
    }

    // Seleccionar biodigestor si se encontró uno
    if (biodigestorEncontrado) {
      setBiodigestorSeleccionado(biodigestorEncontrado.id);
    }
  };

  // Campos de medición: valor, setter, etiqueta, unidad y paso del original.
  const campos = [
    { id: 'ch4', etiqueta: 'CH4 máximo', unidad: '%', valor: ch4, cambiar: setCh4, step: '0.01', placeholder: '0,00' },
    { id: 'co2', etiqueta: 'CO2', unidad: '%', valor: co2, cambiar: setCo2, step: '0.01', placeholder: '0,00' },
    { id: 'o2', etiqueta: 'O2', unidad: '%', valor: o2, cambiar: setO2, step: '0.01', placeholder: '0,00' },
    { id: 'h2s', etiqueta: 'H2S', unidad: 'ppm', valor: h2s, cambiar: setH2s, step: '0.1', placeholder: '0,0' },
    { id: 'co', etiqueta: 'CO', unidad: 'ppm', valor: co, cambiar: setCo, step: '0.1', placeholder: '0,0' },
    { id: 'no', etiqueta: 'NO', unidad: 'ppm', valor: no, cambiar: setNo, step: '0.1', placeholder: '0,0' }
  ];

  // Resumen de arriba: sale de las mediciones que la página ya cargó.
  const resumen: Indicador[] = (() => {
    const ultima = medicionMasReciente(mediciones);
    const deHoy = mediciones.filter(esDeHoy);
    const ch4Ultima = ultima ? numero(ultima.fields['CH4 (Max) %']) : null;
    const h2sUltima = ultima ? numero(ultima.fields['H2S']) : null;
    return [
      {
        etiqueta: 'Última medición',
        valor: horaCorta(ultima ? fechaDeMedicion(ultima) : null),
        detalle: ultima
          ? `${obtenerNombreBiodigestor(ultima)}, ${ultima.fields['Realiza Registro'] || 'sin operador'}`
          : 'Aún no hay mediciones'
      },
      {
        etiqueta: 'Mediciones de hoy',
        valor: deHoy.length,
        detalle: `${biodigestoresDistintos(deHoy)} de ${biodigestores.length} biodigestores medidos`
      },
      {
        etiqueta: 'CH4 en la última',
        valor: cifra(ch4Ultima, 1),
        unidad: ch4Ultima === null ? undefined : '%',
        detalle: `Rango ${UMBRALES_BIODIGESTOR.ch4.referencia}`,
        tono: tonoGas(ch4Ultima, 'ch4')
      },
      {
        etiqueta: 'H2S en la última',
        valor: cifra(h2sUltima, 0),
        unidad: h2sUltima === null ? undefined : 'ppm',
        detalle: `Rango ${UMBRALES_BIODIGESTOR.h2s.referencia}`,
        tono: tonoGas(h2sUltima, 'h2s')
      }
    ];
  })();

  const chip = (activo: boolean) =>
    `min-w-12 min-h-11 px-4 py-2.5 rounded-lg border-2 font-semibold text-lg transition-colors ${
      activo ? 'bg-bosque border-bosque text-white' : 'bg-superficie border-linea-fuerte text-tinta hover:border-bosque'
    }`;

  const formularioCompleto = isFormValid();

  return (
    <Pagina>
      <EncabezadoPagina
        titulo="Mediciones por biodigestor"
        descripcion="Registre la composición del gas de cada biodigestor: CH4, CO2, O2, H2S, CO y NO."
      >
        <span>
          Registra <span className="font-semibold text-tinta">{loggedInUser.nombre}</span>
        </span>
      </EncabezadoPagina>

      {!cargandoMediciones && <Indicadores items={resumen} />}

      <form onSubmit={handleSubmit}>
        <Panel titulo="Nueva medición">
          <div className="space-y-6">
            {/* Selección de biodigestor */}
            <fieldset>
              <legend className="font-condensada font-bold text-lg text-tinta">
                Biodigestor medido <span className="text-rojo">*</span>
              </legend>
              <div className="mt-2">
                {cargandoBiodigestores ? (
                  <p className="flex items-center gap-3 text-tinta-suave" role="status">
                    <span className="w-5 h-5 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
                    Cargando biodigestores…
                  </p>
                ) : biodigestores.length === 0 ? (
                  <Aviso tono="alerta">No se encontraron biodigestores. Recargue la página; si sigue igual, avise al administrador.</Aviso>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {biodigestores.map((biodigestor) => {
                      const activo = biodigestorSeleccionado === biodigestor.id;
                      return (
                        <button
                          key={biodigestor.id}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => handleBiodigestorChange(activo ? '' : biodigestor.id)}
                          className={chip(activo)}
                        >
                          {biodigestor.fields['Nombre Biodigestores'] || biodigestor.fields['ID'] || biodigestor.id}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </fieldset>

            {/* Dictado por voz */}
            <div className="flex items-center gap-4 bg-superficie-2 border border-linea rounded-lg p-3 sm:p-4">
              <VoiceRecorder size="md" disabled={enviandoFormulario} onTranscription={procesarTranscripcion} />
              <div className="min-w-0">
                <p className="font-semibold text-tinta">Dictar la medición</p>
                <p className="text-sm text-tinta-suave">
                  Toque el micrófono y diga el biodigestor y cada gas con su valor. Al terminar, revise los campos antes de guardar.
                </p>
              </div>
            </div>

            {/* Mediciones de gases */}
            <fieldset>
              <legend className="font-condensada font-bold text-lg text-tinta">Valores medidos</legend>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {campos.map((campo) => (
                  <div key={campo.id}>
                    <label htmlFor={`medicion-${campo.id}`} className={claseEtiqueta}>
                      {campo.etiqueta} ({campo.unidad}) <span className="text-rojo">*</span>
                    </label>
                    <input
                      id={`medicion-${campo.id}`}
                      type="number"
                      inputMode="decimal"
                      step={campo.step}
                      min="0"
                      value={campo.valor}
                      onChange={(e) => campo.cambiar(e.target.value)}
                      className={`${claseCampo} text-lg font-semibold tabular-nums placeholder:font-normal`}
                      placeholder={campo.placeholder}
                      required
                    />
                  </div>
                ))}
              </div>
            </fieldset>

            {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

            {/* Botón de envío */}
            <div>
              <button
                type="submit"
                disabled={enviandoFormulario || !formularioCompleto}
                className={`${claseBoton('primario', 'lg')} w-full`}
              >
                {enviandoFormulario ? 'Guardando…' : 'Guardar medición'}
              </button>
              {!formularioCompleto && !enviandoFormulario && (
                <p className="mt-2 text-sm text-tinta-suave text-center">
                  Elija el biodigestor y complete los seis valores para guardar.
                </p>
              )}
            </div>
          </div>
        </Panel>
      </form>

      {/* Mediciones anteriores */}
      <Panel
        titulo="Mediciones anteriores"
        descripcion={mostrarMediciones ? 'Ámbar o rojo: fuera del rango de entrada al biofiltro.' : undefined}
        acciones={
          <button
            type="button"
            aria-expanded={mostrarMediciones}
            onClick={() => setMostrarMediciones(!mostrarMediciones)}
            className={claseBoton('secundario')}
          >
            {mostrarMediciones ? 'Ocultar tabla' : 'Ver tabla'}
          </button>
        }
      >
        {!mostrarMediciones ? (
          <p className="text-tinta-suave">
            {cargandoMediciones ? 'Cargando…' : `${mediciones.length} mediciones cargadas. `}
            {!cargandoMediciones && (
              <>
                Para gráficas y filtros vaya a{' '}
                <Link href="/monitoreo-biodigestores" className="font-semibold text-bosque underline underline-offset-2">
                  monitoreo de biodigestores
                </Link>
                .
              </>
            )}
          </p>
        ) : cargandoMediciones ? (
          <p className="flex items-center gap-3 py-6 justify-center text-tinta-suave" role="status">
            <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
            Cargando mediciones…
          </p>
        ) : mediciones.length === 0 ? (
          <p className="text-tinta-suave text-center py-6">Todavía no hay mediciones registradas.</p>
        ) : (
          <div className="-mx-4 sm:mx-0 border-y sm:border border-linea sm:rounded-xl overflow-x-auto">
            <table className="w-full text-left tabular-nums">
              <thead className="bg-superficie-2">
                <tr className="font-condensada font-semibold text-tinta-suave whitespace-nowrap">
                  <th scope="col" className="px-4 py-3">Fecha</th>
                  <th scope="col" className="px-4 py-3">Biodigestor</th>
                  <th scope="col" className="px-4 py-3 text-right">CH4 (%)</th>
                  <th scope="col" className="px-4 py-3 text-right">CO2 (%)</th>
                  <th scope="col" className="px-4 py-3 text-right">O2 (%)</th>
                  <th scope="col" className="px-4 py-3 text-right">H2S (ppm)</th>
                  <th scope="col" className="px-4 py-3 text-right">CO (ppm)</th>
                  <th scope="col" className="px-4 py-3 text-right">NO (ppm)</th>
                  <th scope="col" className="px-4 py-3">Operador</th>
                </tr>
              </thead>
              <tbody>
                {mediciones.map((medicion) => (
                  <tr key={medicion.id} className="border-t border-linea">
                    <td className="px-4 py-3 whitespace-nowrap text-tinta">{formatearFecha(medicion.fields['Fecha Medicion'])}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold text-tinta">{obtenerNombreBiodigestor(medicion)}</td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(numero(medicion.fields['CH4 (Max) %']), 'ch4')}`}>
                      {cifra(numero(medicion.fields['CH4 (Max) %']))}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(numero(medicion.fields['CO2 %']), 'co2')}`}>
                      {cifra(numero(medicion.fields['CO2 %']))}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(numero(medicion.fields['02 %']), 'o2')}`}>
                      {cifra(numero(medicion.fields['02 %']))}
                    </td>
                    <td className={`px-4 py-3 text-right ${claseCeldaGas(numero(medicion.fields['H2S']), 'h2s')}`}>
                      {cifra(numero(medicion.fields['H2S']))}
                    </td>
                    <td className="px-4 py-3 text-right text-tinta">{cifra(numero(medicion.fields['CO']))}</td>
                    <td className="px-4 py-3 text-right text-tinta">{cifra(numero(medicion.fields['NO']))}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-tinta-suave">{medicion.fields['Realiza Registro']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Pagina>
  );
}
