'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/hooks/useAuth';

// Marco común de las páginas internas: barra, contenido sobre fondo claro y
// pie. Reemplaza a BackgroundLayout, que pone la foto de la planta detrás.

const ANCHO = {
  normal: 'max-w-6xl',
  amplio: 'max-w-7xl'
};

export default function Pagina({ children, ancho = 'normal' }: { children: React.ReactNode; ancho?: keyof typeof ANCHO }) {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-fondo text-tinta">
      <Navbar onLoginClick={() => {}} loggedInUser={user} onLogout={logout} />
      <main className="flex-grow pt-16">
        <div className={`${ANCHO[ancho]} mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6`}>{children}</div>
      </main>
      <Footer />
    </div>
  );
}
