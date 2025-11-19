'use client';

import { useState, useEffect, useCallback } from 'react';
import { airtableService } from '@/utils/airtable';
import { useAuth } from './useAuth';

// Field IDs desde variables de entorno
const FIELD_IDS = {
  ID_OPERADOR: process.env.NEXT_PUBLIC_FIELD_ID_OPERADOR!,
  REALIZA_REGISTRO: process.env.NEXT_PUBLIC_FIELD_REALIZA_REGISTRO!,
  FECHA_INICIO: process.env.NEXT_PUBLIC_FIELD_FECHA_INICIO!
};

interface TurnoStatus {
  hayTurnoActivo: boolean;
  esElOperadorDelTurno: boolean;
  turnoActivo: {
    id: string;
    operadorId: string;
    nombreOperador: string;
    fechaInicio: string;
  } | null;
  loading: boolean;
  error: string | null;
}

export function useTurnoStatus(): TurnoStatus {
  const { user } = useAuth();
  const [status, setStatus] = useState<TurnoStatus>({
    hayTurnoActivo: false,
    esElOperadorDelTurno: false,
    turnoActivo: null,
    loading: true,
    error: null
  });

  const verificarTurno = useCallback(async () => {
    if (!user) {
      setStatus({
        hayTurnoActivo: false,
        esElOperadorDelTurno: false,
        turnoActivo: null,
        loading: false,
        error: null
      });
      return;
    }

    try {
      setStatus(prev => ({ ...prev, loading: true, error: null }));
      
      const turno = await airtableService.obtenerTurnoActivo();
      
      if (turno && turno.fields) {
        const operadorIds = turno.fields[FIELD_IDS.ID_OPERADOR] || [];
        const operadorId = Array.isArray(operadorIds) ? operadorIds[0] : operadorIds;
        
        const turnoInfo = {
          id: turno.id!,
          operadorId: String(operadorId),
          nombreOperador: String(turno.fields[FIELD_IDS.REALIZA_REGISTRO] || 'Operador desconocido'),
          fechaInicio: String(turno.fields[FIELD_IDS.FECHA_INICIO] || new Date().toISOString())
        };

        setStatus({
          hayTurnoActivo: true,
          esElOperadorDelTurno: operadorId === user.id,
          turnoActivo: turnoInfo,
          loading: false,
          error: null
        });
      } else {
        setStatus({
          hayTurnoActivo: false,
          esElOperadorDelTurno: false,
          turnoActivo: null,
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Error verificando turno:', error);
      setStatus(prev => ({
        ...prev,
        loading: false,
        error: 'Error al verificar el estado del turno'
      }));
    }
  }, [user]);

  useEffect(() => {
    verificarTurno();
  }, [verificarTurno]);

  return status;
}