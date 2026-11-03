'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { claseBoton } from '@/components/ui/estilos';
import Image from 'next/image';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallbackMessage?: string;
}

const ALLOWED_ROLES = [
  'Ingeniera - Jefe de planta',
  'Jefe director de planta',
  'Desarrollador',
  'CTO',
  'CEO'
];

export default function RoleGuard({
  children,
  allowedRoles = ALLOWED_ROLES,
  fallbackMessage = 'Su usuario no tiene permiso para ver esta página.'
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user || !allowedRoles.includes(user.cargo))) {
      // Redirect to dashboard or show message
      router.push('/dashboard');
    }
  }, [user, isLoading, isAuthenticated, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-fondo flex items-center justify-center" role="status">
        <div className="flex items-center gap-3 text-tinta-suave">
          <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
          Verificando permisos…
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user || !allowedRoles.includes(user.cargo)) {
    return (
      <div className="min-h-screen bg-fondo text-tinta flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-superficie border border-linea rounded-xl p-6 sm:p-8">
          <Image src="/logo-guaicaramo.png" alt="Guaicaramo" width={120} height={48} className="h-10 w-auto mb-5" priority />
          <h1 className="font-condensada font-bold text-2xl sm:text-3xl mb-2">Esta página no está disponible para su cargo</h1>
          <p className="text-tinta-suave">{fallbackMessage}</p>
          <div className="mt-6 flex flex-col gap-2">
            {!isAuthenticated ? (
              <button type="button" onClick={() => router.push('/')} className={claseBoton('primario', 'lg')}>
                Iniciar sesión
              </button>
            ) : (
              <button type="button" onClick={() => router.push('/dashboard')} className={claseBoton('primario', 'lg')}>
                Ir al tablero general
              </button>
            )}
            <button type="button" onClick={() => router.back()} className={claseBoton('secundario', 'lg')}>
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}