'use client';

import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-superficie border-t border-linea mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-sm text-tinta-suave">
        <Image
          src="/logo-guaicaramo.png"
          alt="Guaicaramo"
          width={90}
          height={36}
          className="h-8 w-auto object-contain"
        />
        <p className="text-center sm:text-left">
          Desarrollado por <span className="font-semibold text-tinta">Sirius Regenerative Solutions S.A.S ZOMAC</span>{' '}
          para <span className="font-semibold text-tinta">Guaicaramo S.A.S</span> con mucho cariño.
        </p>
        <p className="sm:ml-auto whitespace-nowrap">© {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
