'use client';

import Image from 'next/image';

interface BackgroundLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export default function BackgroundLayout({ children, className = '' }: BackgroundLayoutProps) {
  return (
    <div className={`min-h-screen relative ${className}`}>
      {/* Background Image */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/18032025-DSC_2933.jpg"
          alt="Planta de Biogas Guaicaramo"
          fill
          className="object-cover"
          priority
          quality={75}
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