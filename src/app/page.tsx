'use client';

import { useState } from 'react';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Login from '@/components/Login';

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin) {
    return <Login onBack={() => setShowLogin(false)} />;
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