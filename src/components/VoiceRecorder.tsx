'use client';

import { useVoiceRecording } from '@/hooks/useVoiceRecording';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function VoiceRecorder({ 
  onTranscription, 
  disabled = false, 
  size = 'md',
  className = '' 
}: VoiceRecorderProps) {
  const {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    error: voiceError
  } = useVoiceRecording();

  // Función para manejar la grabación de voz
  const handleVoiceRecording = async () => {
    if (isRecording) {
      try {
        const transcripcion = await stopRecording();
        onTranscription(transcripcion);
      } catch (error) {
        console.error('Error al detener grabación:', error);
      }
    } else {
      try {
        await startRecording();
      } catch (error) {
        console.error('Error al iniciar grabación:', error);
      }
    }
  };

  // Tamaños del botón
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16', 
    lg: 'w-20 h-20'
  };

  // Tamaños del ícono
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <button
        type="button"
        onClick={handleVoiceRecording}
        disabled={disabled || isTranscribing}
        className={`flex items-center justify-center ${sizeClasses[size]} rounded-full transition-all duration-300 transform hover:scale-105 ${
          isRecording 
            ? 'bg-red-600 hover:bg-red-500 animate-pulse' 
            : isTranscribing
              ? 'bg-yellow-600 cursor-not-allowed'
              : disabled
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500'
        }`}
      >
        {isRecording ? (
          <svg className={`${iconSizes[size]} text-white`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd"/>
          </svg>
        ) : isTranscribing ? (
          <svg className={`${iconSizes[size]} text-white animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
        ) : (
          <svg className={`${iconSizes[size]} text-white`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
        )}
      </button>

      {/* Indicadores de estado opcionales */}
      {(isRecording || isTranscribing) && (
        <div className="mt-2 text-xs text-center">
          {isRecording && (
            <div className="flex items-center text-red-400">
              <div className="w-2 h-2 bg-red-400 rounded-full mr-2 animate-pulse"></div>
              Grabando...
            </div>
          )}
          {isTranscribing && (
            <div className="flex items-center text-yellow-400">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mr-2 animate-pulse"></div>
              Procesando...
            </div>
          )}
        </div>
      )}

      {/* Mostrar errores si hay */}
      {voiceError && (
        <div className="mt-2 text-xs text-red-400 text-center">
          ❌ {voiceError}
        </div>
      )}
    </div>
  );
}