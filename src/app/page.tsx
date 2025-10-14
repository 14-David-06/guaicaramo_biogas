'use client';

import { useState } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Login from '@/components/Login';
import SessionAlert from '@/components/SessionAlert';
import { useAuth, User } from '@/hooks/useAuth';

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const { user: loggedInUser, isLoading, login, logout, isSessionExpiringSoon } = useAuth();

  const handleLoginSuccess = (user: User) => {
    login(user);
    setShowLogin(false);
  };

  const handleLogout = () => {
    logout();
  };

  // Mostrar loading mientras se verifica la sesión
  if (isLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center">
        <div className="fixed inset-0 w-full h-full z-0">
          <Image
            src="/DSC_3884-Mejorado-NR_ghtz72.jpg"
            alt="Background Biogas"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/50"></div>
        </div>
        <div className="relative z-10 backdrop-blur-lg bg-white/10 rounded-2xl p-8 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-center space-x-3">
            <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-white text-lg font-medium">Verificando sesión...</span>
          </div>
        </div>
      </div>
    );
  }

  if (showLogin) {
    return <Login onBack={() => setShowLogin(false)} onLoginSuccess={handleLoginSuccess} />;
  }

  if (loggedInUser) {
    return (
      <div className="relative min-h-screen">
        {/* Background Image */}
        <div className="fixed inset-0 w-full h-full z-0">
          <Image
            src="/DSC_3884-Mejorado-NR_ghtz72.jpg"
            alt="Background Biogas"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40"></div>
        </div>

        {/* Alerta de sesión */}
        <SessionAlert />

        {/* Navigation */}
        <Navbar 
          onLoginClick={() => setShowLogin(true)} 
          loggedInUser={loggedInUser}
          onLogout={handleLogout}
        />

        {/* Main Dashboard Content */}
        <main className="relative z-10 pt-20 pb-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Dashboard Content Placeholder */}
            <div className="text-center py-20">
              <div className="backdrop-blur-2xl bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-12 border border-white/20 shadow-custom">
                <h2 className="text-3xl font-bold text-white mb-6">
                  Sistema de Gestión de Biogás
                </h2>
                <p className="text-gray-300 text-lg">
                  Utiliza el menú de navegación para acceder a las diferentes funciones del sistema.
                </p>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Video Background */}
      <div className="fixed inset-0 w-full h-full z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/video_landing_page_biogas.mp4" type="video/mp4" />
          Tu navegador no soporta el elemento de video.
        </video>
      </div>

      {/* Navigation */}
      <Navbar onLoginClick={() => setShowLogin(true)} />

      {/* Hero Section */}
      <main id="inicio" className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 lg:px-8 pt-24 pb-8">
        <div className="max-w-7xl mx-auto w-full">
          {/* Hero Content with enhanced glassmorphism */}
          <div className="backdrop-blur-2xl bg-gradient-to-br from-green-900/50 via-emerald-800/40 to-slate-900/50 rounded-[2rem] p-10 sm:p-16 border border-green-400/30 shadow-[0_8px_32px_rgba(16,185,129,0.2)] mb-16 animate-fade-in-up">

            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-extrabold text-white mb-6 sm:mb-8 max-w-5xl mx-auto leading-tight tracking-tight">
              <span className="block bg-gradient-to-r from-green-300 via-emerald-300 to-blue-300 bg-clip-text text-transparent animate-slide-in-left font-poppins">
                Plataforma Biogás
              </span>
              <span className="block text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light mt-4 animate-slide-in-right">
                Gestión Inteligente de{' '}
                <span className="text-green-300 font-semibold">Energía Sostenible</span>
              </span>
            </h1>

            <p className="text-lg sm:text-xl md:text-2xl text-gray-200 mb-10 sm:mb-14 max-w-4xl mx-auto leading-relaxed font-light">
              Monitorea, controla y optimiza tu producción de energía renovable en tiempo real 
              con nuestra <span className="text-green-300 font-semibold">plataforma colaborativa de última generación</span>.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center">
              <button
                onClick={() => setShowLogin(true)}
                className="group relative bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-400 hover:via-emerald-400 hover:to-green-500 text-white px-10 sm:px-12 py-5 sm:py-6 rounded-2xl text-lg sm:text-xl font-bold transition-all duration-500 transform hover:scale-105 hover:-translate-y-1 shadow-[0_8px_30px_rgba(16,185,129,0.4)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.6)] border border-green-400/50 overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center">
                  Acceder a la Plataforma
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/30 to-teal-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </button>
            </div>
          </div>


        </div>
      </main>


      <Footer />
    </div>
  );
}