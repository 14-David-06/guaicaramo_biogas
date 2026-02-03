'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import BackgroundLayout from '@/components/BackgroundLayout';
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
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/20">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl p-4">
                <Image
                  src="/logo-guaicaramo.png"
                  alt="logo-guaicaramoo"
                  width={80}
                  height={80}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            
            {/* Icono de advertencia */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-bold text-red-600 mb-3 text-center">Acceso Denegado</h2>
            <p className="text-gray-600 mb-6 text-center text-sm sm:text-base">{fallbackMessage}</p>
            
            <div className="space-y-3">
              {!isAuthenticated ? (
                <button
                  onClick={() => router.push('/')}
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Iniciar Sesión</span>
                </button>
              ) : (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-[1.02] shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Ir al Dashboard</span>
                </button>
              )}
              
              <button
                onClick={() => router.back()}
                className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-200 transition-all duration-300 flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span>Volver</span>
              </button>
            </div>
          </div>
        </div>
      </BackgroundLayout>
    );
  }

  return <>{children}</>;
}