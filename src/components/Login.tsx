'use client';

import { useState } from 'react';
import Image from 'next/image';

interface LoginProps {
  onBack: () => void;
}

export default function Login({ onBack }: LoginProps) {
  const [step, setStep] = useState<'cedula' | 'password'>('cedula');
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCedulaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!cedula.trim()) {
      setError('Por favor ingrese su cédula');
      return;
    }

    // Validación básica de cédula (solo números)
    if (!/^\d+$/.test(cedula)) {
      setError('La cédula debe contener solo números');
      return;
    }

    setStep('password');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!password.trim()) {
      setError('Por favor ingrese su contraseña');
      return;
    }

    setIsLoading(true);
    
    // Simular autenticación
    setTimeout(() => {
      setIsLoading(false);
      // Aquí iría la lógica real de autenticación
      alert('Login exitoso! Redirigiendo a la plataforma...');
    }, 2000);
  };

  const handleBack = () => {
    if (step === 'password') {
      setStep('cedula');
      setPassword('');
      setError('');
    } else {
      onBack();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-gray-900 to-black flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-black/50">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)`
        }}></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center items-center mb-4 sm:mb-6">
            <Image
              src="/logo-guaicaramo.png"
              alt="Logo Guaicaramo Biogas"
              width={120}
              height={80}
              className="sm:w-[150px] sm:h-[100px] lg:w-[180px] lg:h-[120px]"
            />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Acceso a la Plataforma
          </h2>
          <p className="text-gray-400 text-sm sm:text-base px-4">
            {step === 'cedula' ? 'Ingrese su número de cédula' : 'Ingrese su contraseña'}
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl">
          {step === 'cedula' ? (
            <form onSubmit={handleCedulaSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="cedula" className="block text-sm font-medium text-gray-200 mb-2 sm:mb-3">
                  Número de Cédula
                </label>
                <input
                  type="text"
                  id="cedula"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  className="w-full px-4 py-3 sm:py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Ej: 1234567890"
                  autoComplete="username"
                />
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-green-500 hover:bg-green-600 text-white py-3 sm:py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-sm sm:text-base"
              >
                Continuar
              </button>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 sm:space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2 sm:mb-3">
                  Contraseña
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 sm:py-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm sm:text-base"
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                />
              </div>

              <div className="text-sm text-gray-400 bg-white/5 rounded-lg p-3">
                <span className="font-medium">Cédula:</span> {cedula}
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white py-3 sm:py-4 px-6 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:transform-none text-sm sm:text-base"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Ingresando...
                  </div>
                ) : (
                  'Ingresar a la Plataforma'
                )}
              </button>
            </form>
          )}

          {/* Back button */}
          <button
            onClick={handleBack}
            className="w-full mt-4 text-gray-400 hover:text-white transition-colors py-2 text-sm"
          >
            ← Volver
          </button>

          {/* Help text */}
          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-gray-400 text-sm">
              ¿Problemas para acceder?{' '}
              <a href="#contacto" className="text-green-400 hover:text-green-300 transition-colors">
                Contacta soporte
              </a>
            </p>
          </div>
        </div>

        {/* Development indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center bg-white/5 backdrop-blur-sm rounded-full px-3 py-2 sm:px-4 border border-white/10">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-2"></div>
            <span className="text-white text-xs sm:text-sm font-medium">Plataforma en Desarrollo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
