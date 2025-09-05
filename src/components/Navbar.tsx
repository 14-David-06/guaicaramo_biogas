'use client';

import Image from "next/image";
import { useState } from "react";

interface NavbarProps {
  onLoginClick: () => void;
}

export default function Navbar({ onLoginClick }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="relative z-10 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        {/* Logo y nombre */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center">
            <Image
              src="/logo-guaicaramo.png"
              alt="Logo Guaicaramo"
              width={100}
              height={80}
              className="sm:w-[150px] sm:h-[100px] mr-2 sm:mr-3"
            />
          </div>
          <div className="flex items-center">
            <Image
              src="/logo.png"
              alt="Logo Sirius"
              width={100}
              height={80}
              className="sm:w-[130px] sm:h-[100px] mr-2 sm:mr-3"
            />
          </div>
          
        </div>

        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center space-x-6 xl:space-x-8">         
          {/* Botón de acceso */}
          <button
            onClick={onLoginClick}
            className="relative bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white px-6 py-3 xl:px-8 xl:py-3 rounded-full font-semibold transition-all duration-500 transform hover:scale-110 hover:shadow-2xl shadow-lg backdrop-blur-sm border border-white/20 overflow-hidden group text-sm xl:text-base"
          >
            <span className="relative z-10">Acceder a la Plataforma</span>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="lg:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-white hover:text-green-400 transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-white/20 z-50">
          <div className="px-4 py-6 space-y-4">
            <a href="#inicio" className="block text-white hover:text-green-400 transition-colors font-medium py-2 text-base" onClick={() => setIsMenuOpen(false)}>
              Inicio
            </a>
            <a href="#plataforma" className="block text-white hover:text-green-400 transition-colors font-medium py-2 text-base" onClick={() => setIsMenuOpen(false)}>
              Plataforma
            </a>
            <a href="#nosotros" className="block text-white hover:text-green-400 transition-colors font-medium py-2 text-base" onClick={() => setIsMenuOpen(false)}>
              Nosotros
            </a>
            <a href="#contacto" className="block text-white hover:text-green-400 transition-colors font-medium py-2 text-base" onClick={() => setIsMenuOpen(false)}>
              Contacto
            </a>
            <button
              onClick={() => {
                onLoginClick();
                setIsMenuOpen(false);
              }}
              className="w-full relative bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white px-6 py-3 rounded-full font-semibold transition-all duration-500 transform hover:scale-105 hover:shadow-xl shadow-lg backdrop-blur-sm border border-white/20 overflow-hidden group mt-4 text-base"
            >
              <span className="relative z-10">Acceder a la Plataforma</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-teal-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
