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
            {/* Welcome Section */}
            <div className="text-center mb-8 sm:mb-12">
              <div className="backdrop-blur-lg bg-white/10 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl max-w-4xl mx-auto">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-4">
                  ¡Bienvenido a la <span className="text-green-400">Plataforma Biogás</span>!
                </h1>
                <p className="text-lg sm:text-xl text-gray-300 mb-6">
                  Gestión integral de sistemas de biogás
                </p>
                
                {/* User Info Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/20 max-w-md mx-auto">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-2xl">
                        {loggedInUser.nombre?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">{loggedInUser.nombre}</h3>
                  <p className="text-green-400 font-medium mb-1">{loggedInUser.cargo}</p>
                  <p className="text-gray-300 text-sm">Cédula: {loggedInUser.cedula}</p>
                </div>
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
              {/* Card 1 - Monitoreo */}
              <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Monitoreo en Tiempo Real</h3>
                </div>
                <p className="text-gray-300 text-sm">Visualiza los parámetros de tus biodigestores y sistemas de biogás en tiempo real.</p>
              </div>

              {/* Card 2 - Reportes */}
              <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Reportes y Análisis</h3>
                </div>
                <p className="text-gray-300 text-sm">Genera reportes detallados y analiza el rendimiento de tu sistema de biogás.</p>
              </div>

              {/* Card 3 - Alertas */}
              <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl hover:bg-white/15 transition-all duration-300">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-yellow-500 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white">Alertas y Notificaciones</h3>
                </div>
                <p className="text-gray-300 text-sm">Recibe alertas automáticas sobre el estado de tus equipos y procesos.</p>
              </div>
            </div>

            {/* Funciones Principales */}
            <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl mb-8">
              <h3 className="text-xl font-semibold text-white mb-6 text-center">Funciones Principales</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <button 
                  onClick={() => window.location.href = '/abrir-turno'}
                  className="flex flex-col items-center p-6 bg-green-600/20 border border-green-500/30 rounded-lg hover:bg-green-600/30 transition-all duration-300 group"
                >
                  <svg className="w-10 h-10 text-green-400 mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-white text-sm font-semibold mb-1">Abrir Turno</span>
                  <span className="text-gray-300 text-xs text-center">Iniciar turno operativo</span>
                </button>

                <button 
                  onClick={() => window.location.href = '/registro-jerbacher'}
                  className="flex flex-col items-center p-6 bg-blue-600/20 border border-blue-500/30 rounded-lg hover:bg-blue-600/30 transition-all duration-300 group"
                >
                  <svg className="w-10 h-10 text-blue-400 mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-white text-sm font-semibold mb-1">Registro Jerbacher</span>
                  <span className="text-gray-300 text-xs text-center">Parámetros diarios del sistema</span>
                </button>

                <button 
                  onClick={() => window.location.href = '/bitacora-biogas'}
                  className="flex flex-col items-center p-6 bg-purple-600/20 border border-purple-500/30 rounded-lg hover:bg-purple-600/30 transition-all duration-300 group"
                >
                  <svg className="w-10 h-10 text-purple-400 mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-white text-sm font-semibold mb-1">Bitácora Biogás</span>
                  <span className="text-gray-300 text-xs text-center">Eventos e incidencias</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="backdrop-blur-lg bg-white/10 rounded-xl p-6 border border-white/20 shadow-xl">
              <h3 className="text-xl font-semibold text-white mb-6 text-center">Acciones Rápidas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <button className="flex flex-col items-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-300">
                  <svg className="w-8 h-8 text-green-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-white text-sm font-medium">Ver Datos</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-300">
                  <svg className="w-8 h-8 text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                  <span className="text-white text-sm font-medium">Configurar</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-300">
                  <svg className="w-8 h-8 text-yellow-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-white text-sm font-medium">Ajustes</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-300">
                  <svg className="w-8 h-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="text-white text-sm font-medium">Soporte</span>
                </button>
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
      <main id="inicio" className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Hero Content with gradient background */}
          <div className="backdrop-blur-lg bg-gradient-to-br from-green-900/40 via-green-800/30 to-slate-900/40 rounded-3xl p-8 sm:p-12 border border-green-500/20 shadow-2xl mb-16">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-8 sm:mb-12 max-w-4xl mx-auto leading-relaxed">
              <span className="bg-gradient-to-r from-green-300 to-blue-300 bg-clip-text text-transparent">
                Plataforma Biogás
              </span>
              <br />
              <span className="text-gray-200 text-lg sm:text-xl md:text-2xl font-normal">
                Gestión integral de sistemas de biogás
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed">
              Monitorea, controla y optimiza tu producción de energía renovable en tiempo real con nuestra plataforma colaborativa.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center mb-12">
              <button
                onClick={() => setShowLogin(true)}
                className="relative bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-full text-lg sm:text-xl font-semibold transition-all duration-500 transform hover:scale-110 hover:shadow-2xl shadow-green-500/30 backdrop-blur-sm border border-green-400/20 overflow-hidden group"
              >
                <span className="relative z-10">Acceder a la Plataforma</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </button>
            </div>
          </div>
        </div>
      </main>


      <Footer />
    </div>
  );
}