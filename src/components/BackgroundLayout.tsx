'use client';

import Image from 'next/image';
import { memo } from 'react';

interface BackgroundLayoutProps {
  children: React.ReactNode;
  className?: string;
}

// Memoizado para evitar re-renders innecesarios
const BackgroundLayout = memo(function BackgroundLayout({ children, className = '' }: BackgroundLayoutProps) {
  return (
    <div className={`min-h-screen relative ${className}`}>
      {/* Background Image - Optimizado con placeholder blur */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/18032025-DSC_2933.jpg"
          alt="Planta de Biogas Guaicaramo"
          fill
          className="object-cover"
          priority
          placeholder="blur"
          blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYH/8QAHxAAAgICAQUAAAAAAAAAAAAAAQIDBAARIQYSFDFB/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAZEQEAAwEBAAAAAAAAAAAAAAABAAIDESH/2gAMAwEAAhEDEEA/ANK6evJYrVp5DCquxaQKuxocHXuMY6Ov/9k="
          sizes="100vw"
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
});

export default BackgroundLayout;