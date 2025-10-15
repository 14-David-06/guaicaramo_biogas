import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white/10 backdrop-blur-md border-t border-white/20 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-10">
          {/* Contenido principal */}
          <div className="flex flex-col items-center space-y-6">
            {/* Logo */}
            <div className="flex justify-center">
              <Image
                src="/logo-Guaicaramo.png"
                alt="Logo Guaicaramo"
                width={280}
                height={120}
                className="h-14 w-auto object-contain opacity-90"
              />
            </div>

            {/* Descripción */}
            <p className="text-white/70 text-sm text-center max-w-2xl leading-relaxed">
              Sistema integral de monitoreo y gestión para plantas de biogás.
              <br />
              Tecnología sostenible para un futuro verde.
            </p>

            {/* Línea divisoria */}
            <div className="w-full border-t border-white/20 my-6"></div>

            {/* Información de empresas */}
            <div className="text-center space-y-2">
              <p className="text-white/60 text-xs">
                Desarrollado por{" "}
                <span className="text-white/80 font-medium">
                  Sirius Regenerative Solutions S.A.S ZOMAC
                </span>
              </p>
              <p className="text-white/60 text-xs">
                para{" "}
                <span className="text-white/80 font-medium">
                  Guaicaramo S.A.S con mucho cariño 💚
                </span>
              </p>
            </div>

            {/* Copyright y enlaces */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-white/50 text-xs">
              <span>
                © {new Date().getFullYear()} Todos los derechos reservados
              </span>
              <span className="hidden md:inline text-white/30">•</span>
              <a
                href="#"
                className="hover:text-white/70 transition-colors duration-200"
              >
                Privacidad
              </a>
              <span className="hidden md:inline text-white/30">•</span>
              <a
                href="#"
                className="hover:text-white/70 transition-colors duration-200"
              >
                Términos
              </a>
              <span className="hidden md:inline text-white/30">•</span>
              <a
                href="#"
                className="hover:text-white/70 transition-colors duration-200"
              >
                Soporte
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}