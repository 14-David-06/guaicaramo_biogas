'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import BackgroundLayout from '@/components/BackgroundLayout';

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
  fallbackMessage = 'No tienes permisos para acceder a esta página.'
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
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      </BackgroundLayout>
    );
  }

  if (!isAuthenticated || !user || !allowedRoles.includes(user.cargo)) {
    return (
      <BackgroundLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
            <p className="text-gray-700 mb-6">{fallbackMessage}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition-colors"
            >
              Ir al Dashboard
            </button>
          </div>
        </div>
      </BackgroundLayout>
    );
  }

  return <>{children}</>;
}