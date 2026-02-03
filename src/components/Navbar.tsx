'use client';

import { useState, useEffect } from "react";
import { useTurnoStatus } from "@/hooks/useTurnoStatus";
import Image from 'next/image';
import Link from 'next/link';

interface User {
  id: string;
  nombre: string;
  cargo: string;
  cedula: string;
}

interface NavbarProps {
  onLoginClick: () => void;
  loggedInUser?: User | null;
  onLogout?: () => void;
}

interface DropdownItem {
  name: string;
  href: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface MenuSection {
  name: string;
  items: DropdownItem[];
}

export default function Navbar({ onLoginClick, loggedInUser, onLogout }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const turnoStatus = useTurnoStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Evitar problemas de hidratación
  if (!mounted) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <Image
                src="/logo-Guaicaramo.png"
                alt="Logo Guaicaramo"
                width={48}
                height={48}
                className="h-8 sm:h-10 md:h-12 w-auto object-contain"
                priority
              />
            </div>
            <div className="hidden md:flex items-center space-x-6">
              <div className="w-8 h-8"></div>
            </div>
            <div className="md:hidden">
              <div className="w-8 h-8"></div>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  // Configuración del menú de navegación por secciones
  const menuSections: Record<string, MenuSection> = {
    operaciones: {
      name: "Operaciones",
      items: [
        {
          name: "Gestión de Turnos",
          href: "/turnos",
          description: "Abrir y cerrar turnos operativos"
        },
        {
          name: "Monitoreo de Motores",
          href: "/monitoreo-motores",
          description: "Control y supervisión de motores"
        },
        {
          name: "Registro Jerbacher",
          href: "/registro-jerbacher",
          description: "Parámetros diarios del sistema"
        },
        {
          name: "Registro de Limpiezas",
          href: "/limpiezas",
          description: "Control de limpiezas en la planta"
        },
        {
          name: "Bitácora de Eventos",
          href: "/bitacora-biogas",
          description: "Registro de incidencias"
        }
      ]
    },
    monitoreo: {
      name: "Monitoreo",
      items: [
        {
          name: "Dashboard Principal",
          href: "/dashboard",
          description: "Vista general del sistema"
        },
        {
          name: "Histórico de Registros",
          href: "/sensores",
          description: "Histórico de datos registrados"
        }
      ]
    },
    Biodigestores: {
      name: "Biodigestores",
      items: [
        {
          name: "Registro de biodigestores",
          href: "/registro-biodigestores",
          description: "Registro y gestión de biodigestores"
        },
        {
          name: "Monitoreo de biodigestores",
          href: "/monitoreo-biodigestores",
          description: "Monitoreo y control en tiempo real"
        }
      ]
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  const toggleDropdown = (dropdown: string) => {
    setActiveDropdown(activeDropdown === dropdown ? null : dropdown);
  };

  const closeDropdowns = () => {
    setActiveDropdown(null);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              prefetch={true}
              className="flex items-center space-x-3 hover:opacity-80 transition-opacity duration-300"
            >
              <Image
                src="/logo-Guaicaramo.png"
                alt="Logo Guaicaramo"
                width={48}
                height={48}
                className="h-8 sm:h-10 md:h-12 w-auto object-contain transition-transform duration-200"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          {loggedInUser && (
            <div className="hidden lg:flex items-center space-x-6">
              {Object.entries(menuSections).map(([key, section]) => (
                <div key={key} className="relative">
                  <button
                    onClick={() => toggleDropdown(key)}
                    className="flex items-center space-x-1 text-white/90 hover:text-white transition-colors duration-200 font-medium drop-shadow-md"
                  >
                    <span>{section.name}</span>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${
                      activeDropdown === key ? 'rotate-180' : ''
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === key && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-gradient-to-br from-green-900/95 to-emerald-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 py-3 z-50 animate-in slide-in-from-top-2 duration-200">
                      <div className="px-4 py-2 border-b border-white/20">
                        <h3 className="text-sm font-semibold text-white/90">{section.name}</h3>
                      </div>
                      {section.items.map((item) => (
                        <Link
                          key={item.name}
                          href={item.href}
                          prefetch={true}
                          className="group flex items-center px-4 py-3 text-sm text-white/90 hover:text-white hover:bg-white/10 transition-all duration-200 mx-2 rounded-lg"
                          onClick={closeDropdowns}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium group-hover:translate-x-1 transition-transform duration-200">
                              {item.name}
                            </span>
                            {item.description && (
                              <span className="text-xs text-white/60 mt-1">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* User Section */}
          <div className="flex items-center space-x-4">
            {/* Indicador de Turno Activo */}
            {loggedInUser && turnoStatus.hayTurnoActivo && turnoStatus.esElOperadorDelTurno && (
              <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-400"></div>
                <span>En Turno</span>
              </div>
            )}

            {loggedInUser ? (
              <>
                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={toggleUserMenu}
                    className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 rounded-md p-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="hidden lg:block">{loggedInUser.nombre?.split(' ')[0]}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-200/50">
                        <p className="text-sm font-medium text-gray-900">{loggedInUser.nombre}</p>
                        <p className="text-xs text-gray-600">{loggedInUser.cargo}</p>
                        <p className="text-xs text-gray-500">Cédula: {loggedInUser.cedula}</p>
                      </div>
                      <button
                        onClick={onLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={onLoginClick}
                className="inline-flex items-center justify-center px-6 py-2 text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-green-600/80 to-emerald-600/80 hover:from-green-700/90 hover:to-emerald-700/90 transition-all duration-300 transform hover:scale-105 backdrop-blur-sm border border-white/20 shadow-xl drop-shadow-lg"
              >
                Acceder al Sistema
              </button>
            )}

            {/* Mobile menu button */}
            {loggedInUser && (
              <div className="lg:hidden">
                <button
                  onClick={toggleMenu}
                  className="text-white hover:text-white/80 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 rounded-md p-2"
                >
                  {isMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && loggedInUser && (
        <div className="lg:hidden fixed inset-x-0 top-20 z-40 animate-in slide-in-from-top-2 duration-300">
          <div className="mx-4 mt-2 bg-gradient-to-br from-green-900/95 to-emerald-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
            <div className="px-4 pt-4 pb-2 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
              {/* User Info Mobile */}
              <div className="px-4 py-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 mb-4">
                <p className="text-white font-semibold text-base">{loggedInUser.nombre}</p>
                <p className="text-white/80 text-sm">{loggedInUser.cargo}</p>
                <p className="text-white/60 text-xs">Cédula: {loggedInUser.cedula}</p>
              </div>

              {/* Menu Sections */}
              {Object.entries(menuSections).map(([key, section]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center px-4 py-2 bg-gradient-to-r from-green-800/30 to-emerald-700/30 rounded-xl">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-3"></div>
                    <h3 className="text-white/90 text-sm font-semibold uppercase tracking-wider">{section.name}</h3>
                  </div>
                  {section.items.map((item) => (
                    <Link
                      key={item.name}
                      href={item.href}
                      prefetch={true}
                      className="group flex items-center text-white/90 hover:text-white hover:bg-white/15 px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 mx-2 backdrop-blur-sm border border-transparent hover:border-white/20"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <span className="w-1 h-1 bg-white/60 rounded-full mr-3 group-hover:bg-white group-hover:scale-150 transition-all duration-200"></span>
                      <span className="group-hover:translate-x-1 transition-transform duration-200">{item.name}</span>
                    </Link>
                  ))}
                </div>
              ))}

              {/* Logout Button */}
              <div className="pt-2 border-t border-white/20">
                <button
                  onClick={() => {
                    onLogout?.();
                    setIsMenuOpen(false);
                  }}
                  className="group flex items-center w-full text-red-300 hover:text-red-200 hover:bg-red-500/20 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 backdrop-blur-sm border border-transparent hover:border-red-400/30"
                >
                  <svg className="w-4 h-4 mr-3 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="group-hover:translate-x-1 transition-transform duration-200">Cerrar Sesión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop for dropdown */}
      {activeDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </nav>
  );
}