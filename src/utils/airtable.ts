// Utilidades para interactuar con Airtable
// Usando las variables existentes del .env.local
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_TOKEN || process.env.AIRTABLE_API_TOKEN;
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// IDs de tablas desde variables de entorno
const TURNOS_TABLE_ID = process.env.NEXT_PUBLIC_TURNOS_TABLE_ID;
const TURNOS_ALTERNATIVE_TABLE_ID = process.env.NEXT_PUBLIC_TURNOS_ALTERNATIVE_TABLE_ID;
const EQUIPO_BIOGAS_TABLE_ID = process.env.NEXT_PUBLIC_EQUIPO_BIOGAS_TABLE_ID;
const MOTORES_TABLE_ID = process.env.NEXT_PUBLIC_MOTORES_TABLE_ID;
const ESTADOS_MOTORES_TABLE_ID = process.env.NEXT_PUBLIC_ESTADOS_MOTORES_TABLE_ID;
const PROTOCOLO_ENCENDIDO_TABLE_ID = process.env.NEXT_PUBLIC_PROTOCOLO_ENCENDIDO_TABLE_ID;
const MONITOREO_MOTORES_TABLE_ID = process.env.NEXT_PUBLIC_MONITOREO_MOTORES_TABLE_ID;
const REGISTRO_DIARIOS_JENBACHER_TABLE_ID = process.env.NEXT_PUBLIC_REGISTRO_DIARIOS_JENBACHER_TABLE_ID;
const BIODIGESTORES_TABLE_ID = process.env.NEXT_PUBLIC_BIODIGESTORES_TABLE_ID;
const BITACORA_BIOGAS_TABLE_ID = process.env.NEXT_PUBLIC_BITACORA_BIOGAS_TABLE_ID;
const MEDICION_BIODIGESTORES_TABLE_ID = process.env.NEXT_PUBLIC_MEDICION_BIODIGESTORES_TABLE_ID;

// Debug de configuración
console.log('=== DEBUG AIRTABLE CONFIG ===');
console.log('API Key exists:', !!AIRTABLE_API_KEY);
console.log('API Key preview:', AIRTABLE_API_KEY ? `${AIRTABLE_API_KEY.substring(0, 10)}...` : 'NO KEY');
console.log('Base ID:', AIRTABLE_BASE_ID);
console.log('Turnos Table ID:', TURNOS_TABLE_ID);
console.log('Equipo BioGas Table ID:', EQUIPO_BIOGAS_TABLE_ID);

// Validar configuración crítica
if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !TURNOS_TABLE_ID || !EQUIPO_BIOGAS_TABLE_ID) {
  console.error('❌ ERROR CRÍTICO: Configuración de Airtable faltante');
  console.error('Verifica las variables de entorno en .env.local:');
  console.error('- NEXT_PUBLIC_AIRTABLE_API_TOKEN');
  console.error('- NEXT_PUBLIC_AIRTABLE_BASE_ID');
  console.error('- NEXT_PUBLIC_TURNOS_TABLE_ID');
  console.error('- NEXT_PUBLIC_EQUIPO_BIOGAS_TABLE_ID');
  throw new Error('Configuración de Airtable incompleta');
}

console.log('✅ Configuración de Airtable validada');
console.log('Base ID:', AIRTABLE_BASE_ID);
console.log('Turnos Table ID:', TURNOS_TABLE_ID);
console.log('Equipo BioGas Table ID:', EQUIPO_BIOGAS_TABLE_ID);
console.log('Motores Table ID:', MOTORES_TABLE_ID);
console.log('Estados Motores Table ID:', ESTADOS_MOTORES_TABLE_ID);
console.log('Protocolo Encendido Table ID:', PROTOCOLO_ENCENDIDO_TABLE_ID);
console.log('Monitoreo Motores Table ID:', MONITOREO_MOTORES_TABLE_ID);

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TURNOS_TABLE_ID}`;
const AIRTABLE_ALTERNATIVE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TURNOS_ALTERNATIVE_TABLE_ID}`;
const EQUIPO_BIOGAS_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${EQUIPO_BIOGAS_TABLE_ID}`;
const MOTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${MOTORES_TABLE_ID}`;
const ESTADOS_MOTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ESTADOS_MOTORES_TABLE_ID}`;
const PROTOCOLO_ENCENDIDO_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${PROTOCOLO_ENCENDIDO_TABLE_ID}`;
const MONITOREO_MOTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${MONITOREO_MOTORES_TABLE_ID}`;
const REGISTRO_DIARIOS_JENBACHER_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${REGISTRO_DIARIOS_JENBACHER_TABLE_ID}`;
const BIODIGESTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BIODIGESTORES_TABLE_ID}`;
const BITACORA_BIOGAS_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${BITACORA_BIOGAS_TABLE_ID}`;
const MEDICION_BIODIGESTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${MEDICION_BIODIGESTORES_TABLE_ID}`;

console.log('Turnos API URL:', AIRTABLE_API_URL);
console.log('Equipo BioGas API URL:', EQUIPO_BIOGAS_API_URL);
console.log('Motores API URL:', MOTORES_API_URL);
console.log('Estados Motores API URL:', ESTADOS_MOTORES_API_URL);
console.log('Protocolo Encendido API URL:', PROTOCOLO_ENCENDIDO_API_URL);
console.log('Monitoreo Motores API URL:', MONITOREO_MOTORES_API_URL);
console.log('Registro Diarios Jenbacher API URL:', REGISTRO_DIARIOS_JENBACHER_API_URL);
console.log('Biodigestores API URL:', BIODIGESTORES_API_URL);
console.log('Bitacora Biogas API URL:', BITACORA_BIOGAS_API_URL);
console.log('Medicion Biodigestores API URL:', MEDICION_BIODIGESTORES_API_URL);
console.log('Protocolo Encendido API URL:', PROTOCOLO_ENCENDIDO_API_URL);

export interface TurnoOperador {
  id?: string;
  fields: {
    [key: string]: string | string[] | number | boolean;
  };
}

// Field IDs para fácil referencia - usando variables de entorno
const FIELD_IDS = {
  FECHA_INICIO: process.env.NEXT_PUBLIC_FIELD_FECHA_INICIO!,
  FECHA_FIN: process.env.NEXT_PUBLIC_FIELD_FECHA_FIN!,
  REALIZA_REGISTRO: process.env.NEXT_PUBLIC_FIELD_REALIZA_REGISTRO!,
  NOMBRE_OPERADOR: process.env.NEXT_PUBLIC_FIELD_NOMBRE_OPERADOR!,
  ID_OPERADOR: process.env.NEXT_PUBLIC_FIELD_ID_OPERADOR!,
  ESTADOS_MOTORES: process.env.NEXT_PUBLIC_FIELD_ESTADOS_MOTORES!,
  MONITOREO_MOTORES: process.env.NEXT_PUBLIC_FIELD_MONITOREO_MOTORES!
};

// Field IDs para la tabla Equipo_BioGas - usando variables de entorno
const EQUIPO_BIOGAS_FIELDS = {
  ID: process.env.NEXT_PUBLIC_EQUIPO_FIELD_ID!,
  CARGO: process.env.NEXT_PUBLIC_EQUIPO_FIELD_CARGO!,
  NOMBRE: process.env.NEXT_PUBLIC_EQUIPO_FIELD_NOMBRE!,
  CEDULA: process.env.NEXT_PUBLIC_EQUIPO_FIELD_CEDULA!,
  TELEFONO: process.env.NEXT_PUBLIC_EQUIPO_FIELD_TELEFONO!,
  ESTADO_OPERADOR: process.env.NEXT_PUBLIC_EQUIPO_FIELD_ESTADO_OPERADOR!,
  ID_CHAT: process.env.NEXT_PUBLIC_EQUIPO_FIELD_ID_CHAT!
};

// Debug de Field IDs (después de declararlos)
console.log('=== DEBUG FIELD IDS ===');
console.log('Field IDs Turnos:', FIELD_IDS);
console.log('Field IDs Equipo BioGas:', EQUIPO_BIOGAS_FIELDS);

export interface OperadorBioGas {
  id: string;
  fields: {
    [key: string]: string | string[] | number | boolean;
  };
}

export interface Motor {
  id: string;
  fields: {
    'ID': string;
    'Nombre Motor': string;
    'Estados Motores'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface EstadoMotor {
  id: string;
  fields: {
    'ID': string;
    'Fecha y Hora': string;
    'Estado Motor': 'Apagado' | 'Encendido';
    'Observaciones'?: string;
    'Realiza Registro'?: string;
    'Motor'?: string[];
    'Turnos Operadores'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface ProtocoloEncendido {
  id?: string;
  fields: {
    'Motor': string[];
    'Realiza Registro': string;
    'EPP Disponibles': string;
    'EPP Buen Estado': string;
    'Aceite al 50% (mirilla)': string;
    'Presión refrigerante 1.5 bar': string;
    'CH4 > 50%': string;
    'O2 < 3%': string;
    'H2S < 300ppm': string;
    'Mangueras en buen estado': string;
    'Válvulas de gas abiertas': string;
    'Ventiladores encendidos': string;
    'Equipos Biofiltro funcionando': string;
    'Encendido correcto': string;
    'Planilla actualizada': string;
    'Temperatura refrigerante 80-90°C': string;
    'Presión aceite 3.5 bar': string;
    'Carga trabajo < 1000kW': string;
    'Horómetro inicial registrado': string;
    'Composición de biogás controlada': string;
    'Lavado de radiador (si aplica)': string;
    'Observaciones generales'?: string;
    'Turno'?: string[];
    'Estado Motor'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface MonitoreoMotor {
  id?: string;
  fields: {
    'Motor': string[];
    'Horometro Inicial': number;
    'Horometro Final'?: number;
    'Arranques Inicio': number;
    'Arranques Final'?: number;
    'M3 de Inicio': number;
    'M3 de Fin'?: number;
    'Kw de Inicio': number;
    'Kw de Fin'?: number;
    'Realiza Registro': string;
    'Turnos Operadores'?: string[];
    'Estados Motores'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface RegistroDiariosJenbacher {
  id?: string;
  fields: {
    'METANO(CH4)%': number;
    'OXIGENO(O2) %': number;
    'DIOXIDO DE CARBONO(CO2) %': number;
    'ACIDO SULFIDRICO(H2S)': number;
    'POTENCIA GENERADA(Kw)': number;
    'M3 DE BIOGAS (M3)': number;
    'PRESION BIOFILTRO ENTRADA (cm de h20)': number;
    'PRESION BIOFILTRO SALIDA (cm de h2o)': number;
    'TEMP. ENTRADA BIOFILTRO': number;
    'TEMP. SALIDA BIOFILTRO': number;
    'Realiza Registro': string;
    'Turno'?: string[];
    'Biodigestores Usados'?: string[];
    'Estados Motores'?: string[];
    'Monitoreo Motores'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface Biodigestor {
  id: string;
  fields: {
    'ID': string;
    'Nombre Biodigestores': string;
    'Registro Diario Jenbacher'?: string[];
    'Registro Medicion Biodigestores'?: string[];
    'Copia de Registro Diario Jenbacher'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface BitacoraBiogas {
  id?: string;
  fields: {
    'ID': string;
    'Fecha de creacion': string;
    'Transcripción Operador': string;
    'Informe ejecutivo': string;
    'Realiza Registro': string;
    'Turno Operador'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

export interface MedicionBiodigestores {
  id?: string;
  fields: {
    'ID': string;
    'Fecha Medicion': string;
    'CH4 (Max) %': number;
    'CO2 %': number;
    '02 %': number;
    'H2S': number;
    'CO': number;
    'NO': number;
    'Realiza Registro': string;
    'Turno Biogas'?: string[];
    'Biodigestor Monitoreado'?: string[];
    [key: string]: string | string[] | number | boolean | undefined;
  };
}

const headers = {
  'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

export const airtableService = {
  // Crear un nuevo turno (abrir turno)
  async crearTurno(operadorId: string, nombreOperador: string): Promise<TurnoOperador> {
    try {
      const now = new Date().toISOString();
      
      const data = {
        fields: {
          [FIELD_IDS.FECHA_INICIO]: now,
          [FIELD_IDS.REALIZA_REGISTRO]: nombreOperador,
          [FIELD_IDS.ID_OPERADOR]: [operadorId] // Array de IDs para el campo Link to another record
        }
      };

      console.log('Creando turno con data:', data);
      console.log('URL completa:', AIRTABLE_API_URL);
      console.log('Headers:', headers);
      console.log('API Key presente:', !!AIRTABLE_API_KEY);
      console.log('Base ID:', AIRTABLE_BASE_ID);
      console.log('Table ID:', TURNOS_TABLE_ID);
      console.log('Field IDs being used:', FIELD_IDS);
      console.log('Operador ID being linked:', operadorId);
      console.log('Body being sent:', JSON.stringify(data, null, 2));

      const response = await fetch(AIRTABLE_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      console.log('Create response status:', response.status);
      console.log('Create response statusText:', response.statusText);
      console.log('Create response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ ERROR RESPONSE:', errorText);
        console.error('❌ Status:', response.status);
        console.error('❌ Status Text:', response.statusText);
        throw new Error(`Error al crear turno: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ TURNO CREADO EXITOSAMENTE:', result);
      console.log('✅ Record ID:', result.id);
      console.log('✅ Fields created:', result.fields);
      return result;
    } catch (error) {
      console.error('Error al crear turno en Airtable:', error);
      throw error;
    }
  },

  // Actualizar un turno existente (cerrar turno)
  async cerrarTurno(recordId: string): Promise<TurnoOperador> {
    const now = new Date().toISOString();
    
    const data = {
      fields: {
        [FIELD_IDS.FECHA_FIN]: now,
      }
    };

    try {
      console.log('Cerrando turno:', recordId, 'con data:', data);
      
      const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      console.log('Close response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al cerrar turno:', errorText);
        throw new Error(`Error al cerrar turno: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Turno cerrado exitosamente:', result);
      return result;
    } catch (error) {
      console.error('Error al cerrar turno en Airtable:', error);
      throw error;
    }
  },

  // Obtener el turno activo (sin fecha de fin)
  async obtenerTurnoActivo(): Promise<TurnoOperador | null> {
    try {
      // Usar field IDs en lugar de nombres de campo
      const filterFormula = `AND({${FIELD_IDS.FECHA_INICIO}} != '', {${FIELD_IDS.FECHA_FIN}} = '')`;
      const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1&sort[0][field]=${FIELD_IDS.FECHA_INICIO}&sort[0][direction]=desc`;
      
      console.log('Obteniendo turno activo con URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Error al obtener turno activo: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Turno activo result:', result);
      return result.records.length > 0 ? result.records[0] : null;
    } catch (error) {
      console.error('Error al obtener turno activo:', error);
      throw error;
    }
  },

  // Obtener historial de turnos recientes
  async obtenerHistorialTurnos(limite: number = 10): Promise<TurnoOperador[]> {
    try {
      const url = `${AIRTABLE_API_URL}?maxRecords=${limite}&sort[0][field]=${FIELD_IDS.FECHA_INICIO}&sort[0][direction]=desc`;
      
      console.log('Obteniendo historial con URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener historial:', errorText);
        throw new Error(`Error al obtener historial: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Historial result:', result);
      return result.records || [];
    } catch (error) {
      console.error('Error al obtener historial de turnos:', error);
      throw error;
    }
  },

  // Obtener información de un operador específico
  async obtenerOperador(operadorId: string): Promise<OperadorBioGas | null> {
    try {
      const url = `${EQUIPO_BIOGAS_API_URL}/${operadorId}`;
      
      console.log('Obteniendo operador con URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener operador:', errorText);
        throw new Error(`Error al obtener operador: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Operador result:', result);
      return result;
    } catch (error) {
      console.error('Error al obtener información del operador:', error);
      throw error;
    }
  },

  // Obtener todos los motores
  async obtenerMotores(): Promise<Motor[]> {
    try {
      const url = `${MOTORES_API_URL}`;
      console.log('Obteniendo motores con URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener motores:', errorText);
        throw new Error(`Error al obtener motores: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Motores result:', result);
      return result.records || [];
    } catch (error) {
      console.error('Error al obtener motores:', error);
      throw error;
    }
  },

  // Obtener el último estado de un motor específico
  async obtenerUltimoEstadoMotor(motorId: string): Promise<EstadoMotor | null> {
    try {
      // Filtrar por motor y ordenar por fecha descendente para obtener el más reciente
      const filterFormula = `{Motor} = "${motorId}"`;
      const url = `${ESTADOS_MOTORES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1&sort[0][field]=Fecha y Hora&sort[0][direction]=desc`;
      
      console.log('Obteniendo último estado motor con URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener estado motor:', errorText);
        throw new Error(`Error al obtener estado motor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Estado motor result:', result);
      return result.records && result.records.length > 0 ? result.records[0] : null;
    } catch (error) {
      console.error('Error al obtener último estado del motor:', error);
      throw error;
    }
  },

  // Obtener todos los estados de motores (últimos registros)
  async obtenerEstadosMotores(): Promise<EstadoMotor[]> {
    try {
      // Ordenar por fecha descendente para obtener los más recientes
      const url = `${ESTADOS_MOTORES_API_URL}?sort[0][field]=Fecha y Hora&sort[0][direction]=desc`;
      
      console.log('Obteniendo estados motores con URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener estados motores:', errorText);
        throw new Error(`Error al obtener estados motores: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Estados motores result:', result);
      return result.records || [];
    } catch (error) {
      console.error('Error al obtener estados de motores:', error);
      throw error;
    }
  },

  // Crear un nuevo estado para un motor
  async crearEstadoMotor(motorId: string, estado: 'Encendido' | 'Apagado', operadorNombre: string): Promise<EstadoMotor> {
    try {
      // Obtener el turno activo para asociarlo al registro
      const turnoActivo = await this.obtenerTurnoActivo();
      
      const data = {
        fields: {
          'Estado Motor': estado,
          'Realiza Registro': operadorNombre,
          'Motor': [motorId],
          // Incluir el turno activo si existe
          ...(turnoActivo && { 'Turnos Operadores': [turnoActivo.id!] }),
          // Comentando observaciones temporalmente hasta verificar el nombre del campo
          // ...(observaciones && { 'Observaciones': observaciones })
        }
      };

      console.log('Creando estado motor con data:', data);
      console.log('Turno activo asociado:', turnoActivo?.id);

      const response = await fetch(ESTADOS_MOTORES_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al crear estado motor:', errorText);
        throw new Error(`Error al crear estado motor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Estado motor creado:', result);
      return result;
    } catch (error) {
      console.error('Error al crear estado del motor:', error);
      throw error;
    }
  },

  // Crear protocolo de encendido junto con el estado del motor
  async crearEncendidoConProtocolo(
    motorId: string, 
    operadorNombre: string,
    protocoloData: Record<string, string>
  ): Promise<{ estadoMotor: EstadoMotor; protocolo: ProtocoloEncendido }> {
    try {
      // Primero crear el estado del motor
      const nuevoEstado = await this.crearEstadoMotor(motorId, 'Encendido', operadorNombre);
      
      // Luego crear el protocolo relacionado con ese estado
      const protocolo = await this.crearProtocoloEncendido(motorId, nuevoEstado.id!, operadorNombre, protocoloData);
      
      return { estadoMotor: nuevoEstado, protocolo };
    } catch (error) {
      console.error('Error al crear encendido con protocolo:', error);
      throw error;
    }
  },

  // Debug: Obtener estructura de campos de Estados Motores
  async debugEstadosMotores(): Promise<void> {
    try {
      console.log('🔍 Verificando estructura de tabla Estados Motores...');
      
      const response = await fetch(`${ESTADOS_MOTORES_API_URL}?maxRecords=1`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Error al obtener registros de debug: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.records && data.records.length > 0) {
        console.log('📋 Estructura de campos encontrada:');
        console.log('Campos disponibles:', Object.keys(data.records[0].fields));
        console.log('Ejemplo de registro:', data.records[0]);
      } else {
        console.log('⚠️ No hay registros en la tabla para analizar estructura');
      }
    } catch (error) {
      console.error('Error al verificar estructura:', error);
    }
  },

  // Crear un nuevo registro de protocolo de encendido
  async crearProtocoloEncendido(
    motorId: string, 
    estadoMotorId: string,
    operadorNombre: string,
    protocoloData: Record<string, string>
  ): Promise<ProtocoloEncendido> {
    try {
      // Mapeo de nombres de campos del formulario a nombres en Airtable
      const fieldMapping: Record<string, string> = {
        'Elementos de Protección Personal disponibles': 'EPP Disponibles',
        'Elementos de Protección Personal en buen estado': 'EPP Buen Estado',
        'Aceite al 50% (mirilla)': 'Aceite al 50% (mirilla)',
        'Presión refrigerante 1.5 bar': 'Presión refrigerante 1.5 bar',
        'CH4 > 50%': 'CH4 > 50%',
        'O2 < 3%': 'O2 < 3%',
        'H2S < 300ppm': 'H2S < 300ppm',
        'Mangueras en buen estado': 'Mangueras en buen estado',
        'Válvulas de gas abiertas': 'Válvulas de gas abiertas',
        'Ventiladores encendidos': 'Ventiladores encendidos',
        'Equipos Biofiltro funcionando': 'Equipos Biofiltro funcionando',
        'Encendido correcto': 'Encendido correcto',
        'Planilla actualizada': 'Planilla actualizada',
        'Temperatura refrigerante 80-90°C': 'Temperatura refrigerante 80-90°C',
        'Presión aceite 3.5 bar': 'Presión aceite 3.5 bar',
        'Carga trabajo < 1000kW': 'Carga trabajo < 1000kW',
        'Horómetro inicial registrado': 'Horómetro inicial registrado',
        'Composición de biogás controlada': 'Composición de biogás controlada',
        'Lavado de radiador (si aplica)': 'Lavado de radiador (si aplica)',
        'Observaciones generales': 'Observaciones generales'
      };

      // Convertir los datos del formulario usando el mapeo
      const mappedData: Record<string, string> = {};
      Object.entries(protocoloData).forEach(([key, value]) => {
        const airtableFieldName = fieldMapping[key] || key;
        if (value && value.trim() !== '') {
          mappedData[airtableFieldName] = value;
        }
      });
      
      // Obtener el turno activo para asociarlo al registro
      const turnoActivo = await this.obtenerTurnoActivo();
      
      const data = {
        fields: {
          'Motor': [motorId], // El motor como array de IDs
          'Estado Motor': [estadoMotorId], // El estado del motor recién creado
          'Realiza Registro': operadorNombre, // Nombre del operador que hizo el registro
          ...mappedData,
          // Incluir el turno activo si existe
          ...(turnoActivo && { 'Turno': [turnoActivo.id!] })
        }
      };

      console.log('Creando protocolo de encendido con data:', data);

      const response = await fetch(PROTOCOLO_ENCENDIDO_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al crear protocolo de encendido:', errorText);
        throw new Error(`Error al crear protocolo de encendido: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Protocolo de encendido creado:', result);
      return result;
    } catch (error) {
      console.error('Error al crear protocolo de encendido:', error);
      throw error;
    }
  },

  // Crear registro de monitoreo de motor
  async crearMonitoreoMotor(
    motorId: string,
    operadorNombre: string,
    datosMonitoreo: Omit<MonitoreoMotor['fields'], 'Motor' | 'Realiza Registro' | 'Turnos Operadores' | 'Estados Motores'>
  ): Promise<MonitoreoMotor> {
    try {
      // Obtener el turno activo para asociarlo al registro
      const turnoActivo = await this.obtenerTurnoActivo();
      
      // Obtener el último estado del motor para asociarlo
      const ultimoEstado = await this.obtenerUltimoEstadoMotor(motorId);
      
      const data = {
        fields: {
          'Motor': [motorId],
          'Realiza Registro': operadorNombre,
          ...datosMonitoreo,
          // Incluir el turno activo si existe
          ...(turnoActivo && { 'Turnos Operadores': [turnoActivo.id!] }),
          // Incluir el estado del motor si existe
          ...(ultimoEstado && { 'Estados Motores': [ultimoEstado.id!] })
        }
      };

      console.log('Creando monitoreo de motor con data:', data);

      const response = await fetch(MONITOREO_MOTORES_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al crear monitoreo de motor:', errorText);
        throw new Error(`Error al crear monitoreo de motor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Monitoreo de motor creado:', result);
      return result;
    } catch (error) {
      console.error('Error al crear monitoreo de motor:', error);
      throw error;
    }
  },

  // Obtener el último registro de monitoreo de un motor
  async obtenerUltimoMonitoreoMotor(motorId: string): Promise<MonitoreoMotor | null> {
    try {
      const filterFormula = `{Motor} = "${motorId}"`;
      const url = `${MONITOREO_MOTORES_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&sort[0][field]=Fecha de creacion&sort[0][direction]=desc&maxRecords=1`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Error al obtener último monitoreo: ${response.status}`);
      }
      
      const data = await response.json();
      return data.records.length > 0 ? data.records[0] : null;
    } catch (error) {
      console.error('Error al obtener último monitoreo del motor:', error);
      return null;
    }
  },

  // Actualizar un registro de monitoreo existente
  async actualizarMonitoreoMotor(registroId: string, camposActualizar: Partial<MonitoreoMotor['fields']>): Promise<MonitoreoMotor> {
    try {
      const data = {
        fields: camposActualizar
      };

      console.log('Actualizando monitoreo de motor:', registroId, data);

      const response = await fetch(`${MONITOREO_MOTORES_API_URL}/${registroId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al actualizar monitoreo de motor:', errorText);
        throw new Error(`Error al actualizar monitoreo de motor: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Monitoreo de motor actualizado:', result);
      return result;
    } catch (error) {
      console.error('Error al actualizar monitoreo de motor:', error);
      throw error;
    }
  },

  // Registrar nuevos datos de monitoreo (actualiza el último y crea uno nuevo)
  async registrarNuevoMonitoreo(
    motorId: string,
    operadorNombre: string,
    nuevosDatos: { 
      'Horometro Inicial': number;
      'Arranques Inicio': number;
      'M3 de Inicio': number;
      'Kw de Inicio': number;
    }
  ): Promise<{ registroActualizado: MonitoreoMotor | null; nuevoRegistro: MonitoreoMotor }> {
    try {
      let registroActualizado = null;

      // 1. Obtener el último registro de monitoreo para este motor
      const ultimoRegistro = await this.obtenerUltimoMonitoreoMotor(motorId);

      // 2. Si existe un registro anterior, actualizarlo con los valores "Final"
      if (ultimoRegistro) {
        registroActualizado = await this.actualizarMonitoreoMotor(ultimoRegistro.id!, {
          'Horometro Final': nuevosDatos['Horometro Inicial'],
          'Arranques Final': nuevosDatos['Arranques Inicio'],
          'M3 de Fin': nuevosDatos['M3 de Inicio'],
          'Kw de Fin': nuevosDatos['Kw de Inicio']
        });
      }

      // 3. Crear un nuevo registro con los datos como valores "Inicio"
      const nuevoRegistro = await this.crearMonitoreoMotor(motorId, operadorNombre, nuevosDatos);

      return { registroActualizado, nuevoRegistro };
    } catch (error) {
      console.error('Error al registrar nuevo monitoreo:', error);
      throw error;
    }
  },

  // Obtener todos los biodigestores
  async obtenerBiodigestores(): Promise<Biodigestor[]> {
    try {
      const response = await fetch(BIODIGESTORES_API_URL, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener biodigestores:', errorText);
        throw new Error(`Error al obtener biodigestores: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('=== DEBUG BIODIGESTORES OBTENIDOS ===');
      console.log('Biodigestores data:', JSON.stringify(data, null, 2));
      console.log('Records count:', data.records?.length || 0);
      if (data.records && data.records.length > 0) {
        console.log('Primer biodigestor:', JSON.stringify(data.records[0], null, 2));
      }
      return data.records || [];
    } catch (error) {
      console.error('Error al obtener biodigestores:', error);
      throw error;
    }
  },

  // Obtener el turno actual activo desde tabla alternativa
  async obtenerTurnoActualAlternativo(): Promise<any> {
    try {
      console.log('Intentando obtener turno de tabla alternativa:', TURNOS_ALTERNATIVE_TABLE_ID);
      const response = await fetch(`${AIRTABLE_ALTERNATIVE_API_URL}?maxRecords=5`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener turno alternativo:', errorText);
        return null;
      }

      const data = await response.json();
      console.log('=== TURNOS TABLA ALTERNATIVA ===');
      console.log('Datos de la tabla alternativa:', JSON.stringify(data, null, 2));
      return data.records && data.records.length > 0 ? data.records[0] : null;
    } catch (error) {
      console.error('Error al obtener turno alternativo:', error);
      return null;
    }
  },

  // Obtener el turno actual activo
  async obtenerTurnoActual(): Promise<TurnoOperador | null> {
    try {
      // Filtrar por turnos que tienen fecha de inicio pero no fecha de fin (turnos activos)
      const filterFormula = `AND({${FIELD_IDS.FECHA_INICIO}} != '', {${FIELD_IDS.FECHA_FIN}} = '')`;
      const url = `${AIRTABLE_API_URL}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1&sort[0][field]=${FIELD_IDS.FECHA_INICIO}&sort[0][direction]=desc`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener turno actual:', errorText);
        throw new Error(`Error al obtener turno actual: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Turno actual encontrado:', data);
      return data.records && data.records.length > 0 ? data.records[0] : null;
    } catch (error) {
      console.error('Error al obtener turno actual:', error);
      throw error;
    }
  },

  // Crear un nuevo registro diario de Jenbacher
  async crearRegistroDiariosJenbacher(
    operadorNombre: string,
    estadoMotorId: string,
    monitoreoMotorId: string,
    biodigestoresSeleccionados: string[],
    parametros: {
      metano: number;
      oxigeno: number;
      dioxidoCarbono: number;
      acidoSulfidrico: number;
      potenciaGenerada: number;
      m3Biogas: number;
      presionBiofiltroEntrada: number;
      presionBiofiltroSalida: number;
      tempEntradaBiofiltro: number;
      tempSalidaBiofiltro: number;
    }
  ): Promise<RegistroDiariosJenbacher> {
    try {
      // Obtener el turno actual
      const turnoActual = await this.obtenerTurnoActual();
      
      const data = {
        fields: {
          'METANO(CH4)%': parametros.metano,
          'OXIGENO(O2) %': parametros.oxigeno,
          'DIOXIDO DE CARBONO(CO2) %': parametros.dioxidoCarbono,
          'ACIDO SULFIDRICO(H2S)': parametros.acidoSulfidrico,
          'POTENCIA GENERADA(Kw)': parametros.potenciaGenerada,
          'M3 DE BIOGAS (M3)': parametros.m3Biogas,
          'PRESION BIOFILTRO ENTRADA (cm de h20)': parametros.presionBiofiltroEntrada,
          'PRESION BIOFILTRO SALIDA (cm de h2o)': parametros.presionBiofiltroSalida,
          'TEMP. ENTRADA BIOFILTRO': parametros.tempEntradaBiofiltro,
          'TEMP. SALIDA BIOFILTRO': parametros.tempSalidaBiofiltro,
          'Realiza Registro': operadorNombre,
          'Estados Motores': [estadoMotorId],
          'Monitoreo Motores': [monitoreoMotorId],
          'Biodigestores Usados': biodigestoresSeleccionados,
          ...(turnoActual && { 'Turno': [turnoActual.id!] })
        }
      };

      console.log('Creando registro diario Jenbacher con data:', data);

      const response = await fetch(REGISTRO_DIARIOS_JENBACHER_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al crear registro diario Jenbacher:', errorText);
        throw new Error(`Error al crear registro diario Jenbacher: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Registro diario Jenbacher creado exitosamente:', result);
      return result;
    } catch (error) {
      console.error('Error al crear registro diario Jenbacher:', error);
      throw error;
    }
  },

  // Crear un nuevo registro en la bitácora de biogas
  async crearBitacoraBiogas(
    transcripcionOperador: string,
    informeEjecutivo: string,
    operadorNombre: string
  ): Promise<BitacoraBiogas> {
    try {
      // Obtener el turno actual
      const turnoActual = await this.obtenerTurnoActual();
      
      const data = {
        fields: {
          'Transcripción Operador': transcripcionOperador,
          'Informe ejecutivo': informeEjecutivo,
          'Realiza Registro': operadorNombre,
          ...(turnoActual && { 'Turno Operador': [turnoActual.id!] })
        }
      };

      console.log('Creando registro de bitácora biogas con data:', data);

      const response = await fetch(BITACORA_BIOGAS_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al crear bitácora biogas:', errorText);
        throw new Error(`Error al crear bitácora biogas: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Bitácora biogas creada exitosamente:', result);
      return result;
    } catch (error) {
      console.error('Error al crear bitácora biogas:', error);
      throw error;
    }
  },

  // Obtener registros de bitácora biogas
  async obtenerBitacoraBiogas(): Promise<BitacoraBiogas[]> {
    try {
      const response = await fetch(`${BITACORA_BIOGAS_API_URL}?sort[0][field]=Fecha de creacion&sort[0][direction]=desc`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener bitácora biogas:', errorText);
        throw new Error(`Error al obtener bitácora biogas: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Bitácora biogas obtenida:', data);
      return data.records || [];
    } catch (error) {
      console.error('Error al obtener bitácora biogas:', error);
      throw error;
    }
  },

  // Crear medición de biodigestores
  async crearMedicionBiodigestores(
    ch4: number,
    co2: number,
    o2: number,
    h2s: number,
    co: number,
    no: number,
    realizaRegistro: string,
    biodigestorMonitoreado?: string[]
  ): Promise<MedicionBiodigestores> {
    try {
      // Usar la tabla de turnos original - el campo está configurado para enlazar a ella
      const turnoActivo = await this.obtenerTurnoActual();
      let turnoId: string[] = [];

      if (turnoActivo) {
        turnoId = [turnoActivo.id!];
        console.log('Usando turno de tabla original:', turnoActivo.id);
      } else {
        console.log('No se encontró turno activo en tabla original');
      }

      console.log('=== DEBUG MEDICION BIODIGESTORES ===');
      console.log('Biodigestor seleccionado:', biodigestorMonitoreado);
      console.log('Turno activo completo:', turnoActivo);
      console.log('Turno activo ID:', turnoId);
      console.log('BIODIGESTORES_TABLE_ID:', BIODIGESTORES_TABLE_ID);
      console.log('MEDICION_BIODIGESTORES_TABLE_ID:', MEDICION_BIODIGESTORES_TABLE_ID);
      console.log('TURNOS_TABLE_ID (original):', TURNOS_TABLE_ID);

      const data = {
        fields: {
          'CH4 (Max) %': ch4,
          'CO2 %': co2,
          '02 %': o2,
          'H2S': h2s,
          'CO': co,
          'NO': no,
          'Realiza Registro': realizaRegistro,
          'Biodigestor Monitoreado': biodigestorMonitoreado || [],
          // Solo incluir turno si existe uno activo
          ...(turnoId.length > 0 && { 'Turno Biogas': turnoId })
        }
      };

      console.log('=== DEBUG MEDICION BIODIGESTORES ===');
      console.log('Biodigestor seleccionado:', biodigestorMonitoreado);
      console.log('Turno activo completo:', turnoActivo);
      console.log('Turno activo ID:', turnoId);
      console.log('BIODIGESTORES_TABLE_ID:', BIODIGESTORES_TABLE_ID);
      console.log('MEDICION_BIODIGESTORES_TABLE_ID:', MEDICION_BIODIGESTORES_TABLE_ID);
      console.log('TURNOS_TABLE_ID (original):', TURNOS_TABLE_ID);
      console.log('Datos a enviar para medición:', JSON.stringify(data, null, 2));

      const response = await fetch(MEDICION_BIODIGESTORES_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al crear medición de biodigestores:', errorText);
        throw new Error(`Error al crear medición de biodigestores: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Medición de biodigestores creada exitosamente:', result);
      return result;
    } catch (error) {
      console.error('Error al crear medición de biodigestores:', error);
      throw error;
    }
  },

  // Obtener mediciones de biodigestores
  async obtenerMedicionesBiodigestores(): Promise<MedicionBiodigestores[]> {
    try {
      const response = await fetch(`${MEDICION_BIODIGESTORES_API_URL}?sort[0][field]=Fecha Medicion&sort[0][direction]=desc`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al obtener mediciones de biodigestores:', errorText);
        throw new Error(`Error al obtener mediciones de biodigestores: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Mediciones de biodigestores obtenidas:', data);
      return data.records || [];
    } catch (error) {
      console.error('Error al obtener mediciones de biodigestores:', error);
      throw error;
    }
  },

  // Función de debug para explorar tabla desconocida
  async explorarTablaDesconocida(): Promise<any> {
    try {
      const tablaDesconocidaUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tbl07sqkXKq1O03dA`;
      const response = await fetch(tablaDesconocidaUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error al explorar tabla desconocida:', errorText);
        return null;
      }

      const data = await response.json();
      console.log('=== TABLA DESCONOCIDA tbl07sqkXKq1O03dA ===');
      console.log('Datos de la tabla:', JSON.stringify(data, null, 2));
      return data.records || [];
    } catch (error) {
      console.error('Error al explorar tabla desconocida:', error);
      return null;
    }
  }
};