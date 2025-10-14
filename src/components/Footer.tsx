import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white/10 backdrop-blur-md border-t border-white/20 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Logo y descripción */}
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Image
                  src="/logo-Guaicaramo.png"
                  alt="Logo Guaicaramo"
                  width={320}
                  height={140}
                  className="h-15 w-auto object-contain"
                />
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                Sistema integral de monitoreo y gestión para plantas de biogás. 
                Tecnología sostenible para un futuro verde.
              </p>
            </div>

            {/* Enlaces rápidos */}
            <div className="space-y-4">
              <h3 className="text-white/90 font-semibold text-base drop-shadow-md">
                Enlaces Rápidos
              </h3>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="/dashboard" 
                    className="text-white/70 hover:text-white transition-colors duration-200 text-sm hover:translate-x-1 transform transition-transform inline-block"
                  >
                    Dashboard Principal
                  </a>
                </li>
                <li>
                  <a 
                    href="/sensores" 
                    className="text-white/70 hover:text-white transition-colors duration-200 text-sm hover:translate-x-1 transform transition-transform inline-block"
                  >
                    Monitoreo en Tiempo Real
                  </a>
                </li>
                <li>
                  <a 
                    href="/reportes/operativos" 
                    className="text-white/70 hover:text-white transition-colors duration-200 text-sm hover:translate-x-1 transform transition-transform inline-block"
                  >
                    Reportes
                  </a>
                </li>
                <li>
                  <a 
                    href="/mantenimiento/programa" 
                    className="text-white/70 hover:text-white transition-colors duration-200 text-sm hover:translate-x-1 transform transition-transform inline-block"
                  >
                    Mantenimiento
                  </a>
                </li>
              </ul>
            </div>

            {/* Información de contacto */}
            <div className="space-y-4">
              <h3 className="text-white/90 font-semibold text-base drop-shadow-md">
                Información
              </h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-white/70">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm">Guaicaramo, Boyacá</span>
                </div>
                <div className="flex items-center space-x-3 text-white/70">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">24/7 Monitoreo</span>
                </div>
                <div className="flex items-center space-x-3 text-white/70">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">Sistema Certificado</span>
                </div>
              </div>
            </div>
          </div>

          {/* Línea divisoria */}
          <div className="border-t border-white/20 mt-8 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              {/* Copyright */}
              <div className="text-white/60 text-sm">
                © {new Date().getFullYear()} Guaicaramo Biogás Platform. Todos los derechos reservados.
              </div>

              {/* Links adicionales */}
              <div className="flex space-x-6">
                <a 
                  href="#" 
                  className="text-white/60 hover:text-white/80 transition-colors duration-200 text-sm"
                >
                  Política de Privacidad
                </a>
                <a 
                  href="#" 
                  className="text-white/60 hover:text-white/80 transition-colors duration-200 text-sm"
                >
                  Términos de Uso
                </a>
                <a 
                  href="#" 
                  className="text-white/60 hover:text-white/80 transition-colors duration-200 text-sm"
                >
                  Soporte Técnico
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
