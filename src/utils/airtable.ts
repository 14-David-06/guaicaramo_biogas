// Utilidades para interactuar con Airtable
// Usando las variables existentes del .env.local
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_TOKEN || process.env.AIRTABLE_API_TOKEN;
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// IDs de tablas desde variables de entorno
const TURNOS_TABLE_ID = process.env.NEXT_PUBLIC_TURNOS_TABLE_ID;
const EQUIPO_BIOGAS_TABLE_ID = process.env.NEXT_PUBLIC_EQUIPO_BIOGAS_TABLE_ID;
const MOTORES_TABLE_ID = process.env.NEXT_PUBLIC_MOTORES_TABLE_ID;
const ESTADOS_MOTORES_TABLE_ID = process.env.NEXT_PUBLIC_ESTADOS_MOTORES_TABLE_ID;
const PROTOCOLO_ENCENDIDO_TABLE_ID = process.env.NEXT_PUBLIC_PROTOCOLO_ENCENDIDO_TABLE_ID;

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

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TURNOS_TABLE_ID}`;
const EQUIPO_BIOGAS_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${EQUIPO_BIOGAS_TABLE_ID}`;
const MOTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${MOTORES_TABLE_ID}`;
const ESTADOS_MOTORES_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${ESTADOS_MOTORES_TABLE_ID}`;
const PROTOCOLO_ENCENDIDO_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${PROTOCOLO_ENCENDIDO_TABLE_ID}`;

console.log('Turnos API URL:', AIRTABLE_API_URL);
console.log('Equipo BioGas API URL:', EQUIPO_BIOGAS_API_URL);
console.log('Motores API URL:', MOTORES_API_URL);
console.log('Estados Motores API URL:', ESTADOS_MOTORES_API_URL);
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
  }
};