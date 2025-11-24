'use client';

interface BackgroundLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function BackgroundLayout({ children, className = '' }: BackgroundLayoutProps) {
  return (
    <div className={`min-h-screen relative ${className}`}>
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <img
          src="/18032025-DSC_2933.jpg"
          alt="Planta de Biogas Guaicaramo"
          className="object-cover w-full h-full"
        />
        {/* Dark overlay for better content readability */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px]"></div>
      </div>
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}