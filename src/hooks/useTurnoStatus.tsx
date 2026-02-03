'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { airtableService } from '@/utils/airtable';
import { useAuth } from './useAuth';

// Field IDs desde variables de entorno
const FIELD_IDS = {
  ID_OPERADOR: process.env.NEXT_PUBLIC_FIELD_ID_OPERADOR!,
  REALIZA_REGISTRO: process.env.NEXT_PUBLIC_FIELD_REALIZA_REGISTRO!,
  FECHA_INICIO: process.env.NEXT_PUBLIC_FIELD_FECHA_INICIO!
};

// Cache para evitar llamadas duplicadas
const CACHE_DURATION = 30000; // 30 segundos de caché
let cachedTurno: { data: unknown; timestamp: number } | null = null;

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
  
  const isFirstMount = useRef(true);

  const verificarTurno = useCallback(async (forceRefresh = false) => {
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
      // Usar caché si está disponible y no ha expirado
      const now = Date.now();
      if (!forceRefresh && cachedTurno && (now - cachedTurno.timestamp) < CACHE_DURATION) {
        const turno = cachedTurno.data as { id?: string; fields: Record<string, unknown> } | null;
        if (turno && turno.fields) {
          const operadorIds = turno.fields[FIELD_IDS.ID_OPERADOR] || [];
          const operadorId = Array.isArray(operadorIds) ? operadorIds[0] : operadorIds;
          
          setStatus({
            hayTurnoActivo: true,
            esElOperadorDelTurno: operadorId === user.id,
            turnoActivo: {
              id: turno.id!,
              operadorId: String(operadorId),
              nombreOperador: String(turno.fields[FIELD_IDS.REALIZA_REGISTRO] || 'Operador desconocido'),
              fechaInicio: String(turno.fields[FIELD_IDS.FECHA_INICIO] || new Date().toISOString())
            },
            loading: false,
            error: null
          });
          return;
        }
      }

      // Solo mostrar loading en primera carga
      if (isFirstMount.current) {
        setStatus(prev => ({ ...prev, loading: true, error: null }));
      }
      
      const turno = await airtableService.obtenerTurnoActivo();
      
      // Actualizar caché
      cachedTurno = { data: turno, timestamp: Date.now() };
      
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
      
      isFirstMount.current = false;
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