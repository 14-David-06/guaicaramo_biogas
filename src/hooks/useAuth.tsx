'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  nombre: string;
  cargo: string;
  cedula: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AUTH_STORAGE_KEY = 'biogas_auth_session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

export const useAuth = () => {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Función para guardar sesión en localStorage
  const saveSession = useCallback((user: User) => {
    const sessionData = {
      user,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION,
    };
    
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionData));
      setAuthState({
        user,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Error al guardar la sesión:', error);
    }
  }, []);

  // Función para cargar sesión desde localStorage
  const loadSession = useCallback(() => {
    try {
      const storedSession = localStorage.getItem(AUTH_STORAGE_KEY);
      
      if (!storedSession) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const sessionData = JSON.parse(storedSession);
      const now = Date.now();

      // Verificar si la sesión no ha expirado
      if (sessionData.expiresAt && now < sessionData.expiresAt) {
        setAuthState({
          user: sessionData.user,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        // Sesión expirada, limpiar storage
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error al cargar la sesión:', error);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Función para cerrar sesión
  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      setAuthState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
      
      // Redireccionar al landing page después del logout
      console.log('🚪 Cerrando sesión y redirigiendo al landing page...');
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  }, [router]);

  // Función para login
  const login = useCallback((user: User) => {
    saveSession(user);
  }, [saveSession]);

  // Función para extender sesión
  const extendSession = useCallback(() => {
    if (authState.user) {
      saveSession(authState.user);
    }
  }, [authState.user, saveSession]);

  // Función para verificar si la sesión está próxima a expirar
  const isSessionExpiringSoon = useCallback(() => {
    try {
      const storedSession = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!storedSession) return false;

      const sessionData = JSON.parse(storedSession);
      const now = Date.now();
      const timeUntilExpiry = sessionData.expiresAt - now;
      
      // Retorna true si la sesión expira en menos de 1 hora
      return timeUntilExpiry < (60 * 60 * 1000);
    } catch {
      return false;
    }
  }, []);

  // Cargar sesión al inicializar el hook
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Listener para cambios en localStorage (para sincronizar entre tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        loadSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadSession]);

  // Auto-extender sesión cada 30 minutos si el usuario está activo
  useEffect(() => {
    if (!authState.isAuthenticated) return;

    const intervalId = setInterval(() => {
      if (isSessionExpiringSoon()) {
        extendSession();
      }
    }, 30 * 60 * 1000); // 30 minutos

    return () => clearInterval(intervalId);
  }, [authState.isAuthenticated, isSessionExpiringSoon, extendSession]);

  return {
    user: authState.user,
    isLoading: authState.isLoading,
    isAuthenticated: authState.isAuthenticated,
    login,
    logout,
    extendSession,
    isSessionExpiringSoon,
  };
};
