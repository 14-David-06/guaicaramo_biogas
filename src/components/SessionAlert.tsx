'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { claseBoton } from '@/components/ui/estilos';

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
    <div role="alert" className="fixed top-20 right-4 z-50 bg-superficie border border-ambar-borde border-l-4 rounded-lg p-4 shadow-lg max-w-sm text-tinta">
      <p className="font-semibold">Su sesión está por vencer</p>
      <p className="text-sm text-tinta-suave mt-0.5">Extiéndala para no perder lo que esté registrando.</p>
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={handleExtendSession} className={claseBoton('primario', 'sm')}>
          Extender sesión
        </button>
        <button type="button" onClick={() => setShowAlert(false)} className={claseBoton('secundario', 'sm')}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
