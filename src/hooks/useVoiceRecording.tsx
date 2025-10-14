'use client';

import { useState, useRef, useCallback } from 'react';

interface UseVoiceRecordingResult {
  isRecording: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  error: string | null;
}

export const useVoiceRecording = (): UseVoiceRecordingResult => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Solicitar permisos de micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Configurar MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !isRecording) {
        reject(new Error('No hay grabación activa'));
        return;
      }

      mediaRecorderRef.current.onstop = async () => {
        try {
          setIsRecording(false);
          setIsTranscribing(true);

          // Crear blob de audio
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: 'audio/webm;codecs=opus' 
          });

          // Transcribir audio
          const transcription = await transcribeAudio(audioBlob);
          
          setIsTranscribing(false);
          resolve(transcription);

        } catch (err) {
          console.error('Error processing audio:', err);
          setIsTranscribing(false);
          setError('Error al procesar el audio');
          reject(err);
        }
      };

      mediaRecorderRef.current.stop();
      
      // Detener todos los tracks del stream
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    });
  }, [isRecording]);

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      // Convertir webm a formato compatible con OpenAI (mp3)
      const formData = new FormData();
      
      // Crear un archivo temporal con extensión mp3
      const audioFile = new File([audioBlob], 'audio.webm', { 
        type: 'audio/webm' 
      });
      
      formData.append('file', audioFile);
      formData.append('model', 'whisper-1');
      formData.append('language', 'es'); // Español
      formData.append('response_format', 'text');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API Error:', errorData);
        throw new Error(`Error de transcripción: ${response.status}`);
      }

      const transcription = await response.text();
      return transcription.trim();

    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Error al transcribir el audio');
    }
  };

  return {
    isRecording,
    isTranscribing,
    startRecording,
    stopRecording,
    error
  };
};