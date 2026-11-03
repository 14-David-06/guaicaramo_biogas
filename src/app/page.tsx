'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Login from '@/components/Login';
import SessionAlert from '@/components/SessionAlert';
import Indicadores from '@/components/ui/Indicadores';
import { claseBoton } from '@/components/ui/estilos';
import { useAuth, User } from '@/hooks/useAuth';
import { useTurnoStatus } from '@/hooks/useTurnoStatus';
import { SECCIONES_MENU } from '@/lib/navegacion';
import type { RespuestaPlanilla } from '@/lib/planilla/tipos';
import { indicadoresPlanilla } from './registro-jenbacher/indicadores';

const ZONA = 'America/Bogota';

function saludo(): string {
  const hora = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hourCycle: 'h23', timeZone: ZONA }).format(new Date()));
  return hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
}

function fechaDeHoy(): string {
  const texto = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function Cargando() {
  return (
    <div className="min-h-screen bg-fondo flex items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-tinta-suave">
        <span className="w-6 h-6 rounded-full border-[3px] border-linea border-t-bosque animate-spin" aria-hidden="true" />
        Verificando sesión…
      </div>
    </div>
  );
}

/** Inicio del operador: quién está en turno, cómo va la planilla y a dónde ir. */
function Inicio({ usuario, onLogout }: { usuario: User; onLogout: () => void }) {
  const turno = useTurnoStatus();
  const [planilla, setPlanilla] = useState<RespuestaPlanilla | null>(null);
  const [errorPlanilla, setErrorPlanilla] = useState(false);

  useEffect(() => {
    let vigente = true;
    fetch('/api/planilla-horaria')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((datos: RespuestaPlanilla) => vigente && setPlanilla(datos))
      .catch(() => vigente && setErrorPlanilla(true));
    return () => {
      vigente = false;
    };
  }, []);

  const inicioTurno = turno.turnoActivo
    ? new Date(turno.turnoActivo.fechaInicio).toLocaleString('es-CO', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-fondo text-tinta">
      <SessionAlert />
      <Navbar onLoginClick={() => {}} loggedInUser={usuario} onLogout={onLogout} />

      <main className="flex-grow pt-16">
        {/* La planta, de fondo del saludo: es lo único fotográfico de las páginas internas. */}
        <section className="relative h-60 sm:h-72 overflow-hidden">
          <Image src="/DSC_3884-Mejorado-NR_ghtz72.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#141b12]/85 via-[#141b12]/55 to-[#141b12]/10" />
          <div className="relative h-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-6 sm:pb-8 text-white">
            <p className="font-semibold text-white/85">{fechaDeHoy()}</p>
            <h1 className="font-condensada font-bold text-4xl sm:text-5xl leading-tight">
              {saludo()}, {usuario.nombre.split(' ')[0]}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {turno.loading ? (
                <span className="text-white/80">Consultando el turno…</span>
              ) : turno.hayTurnoActivo && turno.turnoActivo ? (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/95 text-tinta px-3 py-1 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-hoja" aria-hidden="true" />
                  {turno.esElOperadorDelTurno ? 'Usted está en turno' : `En turno: ${turno.turnoActivo.nombreOperador}`}
                  <span className="font-normal text-tinta-suave">desde {inicioTurno}</span>
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/95 text-tinta px-3 py-1 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-ambar-borde" aria-hidden="true" />
                    No hay turno abierto
                  </span>
                  <Link href="/turnos" className={claseBoton('primario', 'sm')}>Abrir turno</Link>
                </>
              )}
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
          <section aria-labelledby="titulo-planilla">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <div>
                <h2 id="titulo-planilla" className="font-condensada font-bold text-2xl sm:text-3xl">Planilla Jenbacher de hoy</h2>
                <p className="text-tinta-suave">Gas, biofiltro y potencia hora a hora, de 06:00 a 05:00.</p>
              </div>
              <Link href="/registro-jenbacher" className={claseBoton('secundario')}>Abrir planilla</Link>
            </div>
            {planilla ? (
              <Indicadores items={indicadoresPlanilla(planilla)} />
            ) : errorPlanilla ? (
              <p className="bg-superficie border border-linea rounded-xl px-5 py-6 text-tinta-suave">
                No se pudo consultar la planilla. Ábrala para ver el detalle.
              </p>
            ) : (
              <div className="h-[118px] bg-superficie border border-linea rounded-xl animate-pulse" aria-label="Cargando la planilla" />
            )}
          </section>

          <section aria-labelledby="titulo-accesos">
            <h2 id="titulo-accesos" className="font-condensada font-bold text-2xl sm:text-3xl mb-3">Ir a</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {SECCIONES_MENU.map((seccion) => (
                <nav key={seccion.id} aria-label={seccion.nombre} className="bg-superficie border border-linea rounded-xl overflow-hidden">
                  <h3 className="px-5 pt-4 pb-2 font-condensada font-bold text-xl">{seccion.nombre}</h3>
                  <ul>
                    {seccion.paginas.map((pagina) => (
                      <li key={pagina.href} className="border-t border-linea">
                        <Link href={pagina.href} className="group flex items-center gap-3 px-5 py-3 hover:bg-superficie-2">
                          <span className="flex-1">
                            <span className="block font-semibold text-tinta group-hover:text-bosque">{pagina.nombre}</span>
                            <span className="block text-sm text-tinta-suave">{pagina.descripcion}</span>
                          </span>
                          <svg className="w-5 h-5 text-tinta-tenue group-hover:text-bosque shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function Home() {
  const [showLogin, setShowLogin] = useState(false);
  const { user: loggedInUser, isLoading, login, logout } = useAuth();

  const handleLoginSuccess = (user: User) => {
    login(user);
    setShowLogin(false);
  };

  // Mostrar loading mientras se verifica la sesión
  if (isLoading) return <Cargando />;

  if (showLogin) {
    return <Login onBack={() => setShowLogin(false)} onLoginSuccess={handleLoginSuccess} />;
  }

  if (loggedInUser) return <Inicio usuario={loggedInUser} onLogout={logout} />;

  return (
    <div className="relative min-h-screen flex flex-col">
      <div className="fixed inset-0 w-full h-full z-0">
        <video autoPlay loop muted playsInline className="w-full h-full object-cover">
          <source src="/video_landing_page_biogas.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141b12]/90 via-[#141b12]/45 to-[#141b12]/20" />
      </div>

      <Navbar onLoginClick={() => setShowLogin(true)} />

      <main id="inicio" className="relative z-10 flex-grow flex items-end pt-16">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
          <p className="font-semibold text-white/85 text-lg">Guaicaramo S.A.S</p>
          <h1 className="mt-1 font-condensada font-bold text-white text-5xl sm:text-7xl leading-[0.95] max-w-3xl">
            Planta de biogás
          </h1>
          <p className="mt-4 text-white/90 text-lg sm:text-xl max-w-xl">
            Turnos, motores Jenbacher, biodigestores e informes diarios de la planta, en un solo lugar.
          </p>
          <button type="button" onClick={() => setShowLogin(true)} className={`${claseBoton('primario', 'lg')} mt-8`}>
            Ingresar
          </button>
        </div>
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}
