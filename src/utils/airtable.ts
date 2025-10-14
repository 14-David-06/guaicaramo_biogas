// Utilidades para interactuar con Airtable
// Usando las variables existentes del .env.local
const AIRTABLE_API_KEY = process.env.NEXT_PUBLIC_AIRTABLE_API_TOKEN || process.env.AIRTABLE_API_TOKEN;
const AIRTABLE_BASE_ID = process.env.NEXT_PUBLIC_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

// IDs de tablas desde variables de entorno
const TURNOS_TABLE_ID = process.env.NEXT_PUBLIC_TURNOS_TABLE_ID;
const EQUIPO_BIOGAS_TABLE_ID = process.env.NEXT_PUBLIC_EQUIPO_BIOGAS_TABLE_ID;

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

const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${TURNOS_TABLE_ID}`;
const EQUIPO_BIOGAS_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${EQUIPO_BIOGAS_TABLE_ID}`;

console.log('Turnos API URL:', AIRTABLE_API_URL);
console.log('Equipo BioGas API URL:', EQUIPO_BIOGAS_API_URL);

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
  }
};