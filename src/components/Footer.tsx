import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative z-10 bg-gray-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main footer content */}
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Logo y descripción */}
          <div className="md:col-span-2">
            <div className="flex items-center mb-6">
              <Image
                              src="/logo-guaicaramo.png"
                              alt="Logo Guaicaramo - Ir al inicio"
                              width={268}
                              height={118}
                              className="w-[134px] h-[59px] sm:w-[268px] sm:h-[118px] mr-2 sm:mr-3"
                            />
            </div>
            <p className="text-gray-400 mb-6 max-w-md leading-relaxed">
              Plataforma colaborativa para la gestión y monitoreo de sistemas de biogás. 
              Desarrollando soluciones sostenibles para un futuro más verde.
            </p>
          </div>

          {/* Enlaces rápidos */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Enlaces Rápidos</h3>
            <ul className="space-y-3">
              <li>
                <a href="#inicio" className="text-gray-400 hover:text-white transition-colors">
                  Inicio
                </a>
              </li>
              <li>
                <a href="#plataforma" className="text-gray-400 hover:text-white transition-colors">
                  Plataforma
                </a>
              </li>
              <li>
                <a href="#nosotros" className="text-gray-400 hover:text-white transition-colors">
                  Nosotros
                </a>
              </li>
              <li>
                <a href="#contacto" className="text-gray-400 hover:text-white transition-colors">
                  Contacto
                </a>
              </li>
            </ul>
          </div>

          {/* Información de contacto */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Contacto</h3>
            <ul className="space-y-3 text-gray-400">
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                Guaicaramo, Colombia
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
                info@guaicaramobiogas.com
              </li>
              <li className="flex items-center">
                <svg className="w-4 h-4 mr-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                +57 (123) 456-7890
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-400 text-sm">
                &copy; 2025 Sirius Regenerative Solutions S.A.S ZOMAC. Todos los derechos reservados. 
                <br />Desarrollado para Guaicaramo - Biogas con ❤️ 
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
