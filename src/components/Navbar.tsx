'use client';

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTurnoStatus } from "@/hooks/useTurnoStatus";
import { SECCIONES_MENU, seccionDeRuta } from "@/lib/navegacion";
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

// Barra blanca con la línea naranja del logo como horizonte. La sección de la
// página actual queda subrayada en verde bosque.

function Logo() {
  return (
    <Link href="/" prefetch={true} className="flex items-center shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bosque">
      <Image
        src="/logo-guaicaramo.png"
        alt="Guaicaramo, inicio"
        width={120}
        height={48}
        className="h-9 sm:h-10 w-auto object-contain"
        priority
      />
    </Link>
  );
}

function Contenedor({ children }: { children: React.ReactNode }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-superficie border-b-2 border-fruto shadow-[0_1px_0_rgba(30,39,27,0.06)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-4">{children}</div>
      </div>
    </nav>
  );
}

export default function Navbar({ onLoginClick, loggedInUser, onLogout }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mounted, setMounted] = useState(false);
  const turnoStatus = useTurnoStatus();
  const ruta = usePathname();
  const seccionActual = seccionDeRuta(ruta)?.id;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Evitar problemas de hidratación
  if (!mounted) {
    return (
      <Contenedor>
        <Logo />
      </Contenedor>
    );
  }

  const enTurno = loggedInUser && turnoStatus.hayTurnoActivo && turnoStatus.esElOperadorDelTurno;

  return (
    <Contenedor>
      <Logo />

      {/* Navegación de escritorio */}
      {loggedInUser && (
        <div className="hidden lg:flex items-stretch self-stretch gap-1">
          {SECCIONES_MENU.map((seccion) => {
            const abierta = activeDropdown === seccion.id;
            const actual = seccionActual === seccion.id;
            return (
              <div key={seccion.id} className="relative flex">
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() => setActiveDropdown(abierta ? null : seccion.id)}
                  className={`flex items-center gap-1 px-3 font-condensada font-semibold text-[1.0625rem] border-b-[3px] -mb-0.5 transition-colors ${
                    actual ? 'border-bosque text-bosque' : 'border-transparent text-tinta-suave hover:text-tinta'
                  }`}
                >
                  {seccion.nombre}
                  <svg className={`w-4 h-4 transition-transform duration-200 ${abierta ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {abierta && (
                  <div className="absolute top-full left-0 mt-0.5 w-80 bg-superficie rounded-b-xl shadow-lg border border-linea border-t-0 py-2 z-50">
                    {seccion.paginas.map((pagina) => {
                      const activa = ruta === pagina.href;
                      return (
                        <Link
                          key={pagina.href}
                          href={pagina.href}
                          prefetch={true}
                          aria-current={activa ? 'page' : undefined}
                          onClick={() => setActiveDropdown(null)}
                          className={`block mx-2 px-3 py-2.5 rounded-lg ${activa ? 'bg-hoja-claro' : 'hover:bg-superficie-2'}`}
                        >
                          <span className={`block font-semibold ${activa ? 'text-bosque' : 'text-tinta'}`}>{pagina.nombre}</span>
                          <span className="block text-sm text-tinta-suave">{pagina.descripcion}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Usuario */}
      <div className="flex items-center gap-2 sm:gap-3">
        {enTurno && (
          <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold bg-hoja-claro text-bosque">
            <span className="w-2 h-2 rounded-full bg-hoja" aria-hidden="true"></span>
            En turno
          </span>
        )}

        {loggedInUser ? (
          <div className="relative">
            <button
              type="button"
              aria-expanded={showUserMenu}
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-tinta hover:bg-superficie-2 focus-visible:outline-2 focus-visible:outline-bosque"
            >
              <span className="w-8 h-8 rounded-full bg-bosque text-white grid place-items-center text-sm font-semibold" aria-hidden="true">
                {loggedInUser.nombre?.trim().charAt(0).toUpperCase()}
              </span>
              <span className="hidden lg:block font-medium">{loggedInUser.nombre?.split(' ')[0]}</span>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-superficie rounded-xl shadow-lg border border-linea py-2 z-50">
                <div className="px-4 py-3 border-b border-linea">
                  <p className="font-semibold text-tinta">{loggedInUser.nombre}</p>
                  <p className="text-sm text-tinta-suave">{loggedInUser.cargo}</p>
                  <p className="text-sm text-tinta-tenue">Cédula {loggedInUser.cedula}</p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2.5 text-sm font-semibold text-rojo hover:bg-rojo-claro"
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onLoginClick}
            className="px-5 py-2 rounded-lg font-semibold text-white bg-bosque hover:bg-bosque-oscuro transition-colors"
          >
            Ingresar
          </button>
        )}

        {loggedInUser && (
          <button
            type="button"
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-tinta hover:bg-superficie-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* Menú móvil */}
      {isMenuOpen && loggedInUser && (
        <div className="lg:hidden fixed inset-x-0 top-[66px] bottom-0 z-40 bg-superficie overflow-y-auto">
          <div className="px-4 py-4 space-y-5">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-linea">
              <div>
                <p className="font-semibold text-tinta">{loggedInUser.nombre}</p>
                <p className="text-sm text-tinta-suave">{loggedInUser.cargo}</p>
              </div>
              {enTurno && (
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-hoja-claro text-bosque">En turno</span>
              )}
            </div>

            {SECCIONES_MENU.map((seccion) => (
              <div key={seccion.id}>
                <h3 className="px-3 mb-1 font-condensada font-semibold text-tinta-tenue">{seccion.nombre}</h3>
                {seccion.paginas.map((pagina) => {
                  const activa = ruta === pagina.href;
                  return (
                    <Link
                      key={pagina.href}
                      href={pagina.href}
                      prefetch={true}
                      aria-current={activa ? 'page' : undefined}
                      onClick={() => setIsMenuOpen(false)}
                      className={`block px-3 py-3 rounded-lg border-l-[3px] ${
                        activa ? 'bg-hoja-claro border-bosque text-bosque font-semibold' : 'border-transparent text-tinta hover:bg-superficie-2'
                      }`}
                    >
                      {pagina.nombre}
                    </Link>
                  );
                })}
              </div>
            ))}

            <button
              type="button"
              onClick={() => {
                onLogout?.();
                setIsMenuOpen(false);
              }}
              className="w-full text-left px-3 py-3 rounded-lg font-semibold text-rojo hover:bg-rojo-claro border-t border-linea"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Clic afuera cierra los desplegables */}
      {(activeDropdown || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setActiveDropdown(null);
            setShowUserMenu(false);
          }}
        />
      )}
    </Contenedor>
  );
}
