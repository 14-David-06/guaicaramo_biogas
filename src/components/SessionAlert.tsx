'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function SessionAlert() {
  const { isSessionExpiringSoon, extendSession } = useAuth();
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (isSessionExpiringSoon()) {
      setShowAlert(true);
      // Auto-ocultar después de 10 segundos
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, 10000);
      
      return () => clearTimeout(timer);
    }
  }, [isSessionExpiringSoon]);

  const handleExtendSession = () => {
    extendSession();
    setShowAlert(false);
  };

  if (!showAlert) return null;

  return (
    <div className="fixed top-4 right-4 z-50 backdrop-blur-lg bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 shadow-xl max-w-sm">
      <div className="flex items-start space-x-3">
        <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-yellow-300 font-medium text-sm">Sesión por expirar</p>
          <p className="text-yellow-200 text-xs mb-3">Tu sesión expirará pronto</p>
          <div className="flex space-x-2">
            <button
              onClick={handleExtendSession}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-md font-medium transition-colors"
            >
              Extender
            </button>
            <button
              onClick={() => setShowAlert(false)}
              className="px-3 py-1 bg-gray-600/50 hover:bg-gray-600/70 text-white text-xs rounded-md font-medium transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
