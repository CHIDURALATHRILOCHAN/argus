
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { getCameraStream } from '../services/cameraService';
import { readTextFromImage } from '../services/geminiService';
import { triggerHapticFeedback } from '../utils/feedback';
import { SettingsContext } from '../contexts/SettingsContext';
import { HomeIcon, MicrophoneIcon, MicrophoneOffIcon } from './shared/Icons';
import Spinner from './shared/Spinner';

interface TextReaderModeProps {
  onBack: () => void;
  isListening: boolean;
  voiceStatus: string;
  speak: (text: string) => Promise<void>;
}

const TextReaderMode: React.FC<TextReaderModeProps> = ({ onBack, isListening, voiceStatus, speak }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState('Initializing...');
  const [recognizedText, setRecognizedText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const { settings } = useContext(SettingsContext)!;
  const isMountedRef = useRef(true);
  const detectionTimeoutRef = useRef<number | null>(null);
  const lastSpokenTextRef = useRef<string>('');

  const hapticFeedback = useCallback(() => {
    if (settings?.haptic) triggerHapticFeedback();
  }, [settings?.haptic]);
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const captureAndRecognize = useCallback(async () => {
    if (!isMountedRef.current || !videoRef.current || !canvasRef.current) return;
  
    const video = videoRef.current;
    const canvas = canvasRef.current;
  
    if (video.readyState < 2 || video.videoWidth === 0) return;
  
    const context = canvas.getContext('2d');
    if (!context) return;
  
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    await new Promise<void>((resolve) => {
      canvas.toBlob(async (blob) => {
        if (blob && isMountedRef.current) {
          try {
            setStatus('Recognizing text...');
            const text = await readTextFromImage(blob);
            if (isMountedRef.current) {
              const cleanedText = text.trim();
              setRecognizedText(cleanedText);
        
              const isMeaningful = cleanedText.length > 2 && cleanedText !== 'No text detected.';
              const isNew = cleanedText !== lastSpokenTextRef.current;
      
              if (isMeaningful && isNew) {
                hapticFeedback();
                lastSpokenTextRef.current = cleanedText;
                await speak(cleanedText);
              } else if (!isMeaningful && lastSpokenTextRef.current !== '') {
                lastSpokenTextRef.current = '';
              }
              setStatus('Looking for text...');
            }
          } catch (error) {
            console.error("Gemini OCR error:", error);
            if (isMountedRef.current) {
              const errorMessage = (error as Error).message;
              setStatus(errorMessage);
              await speak(errorMessage);
            }
          }
        }
        resolve();
      }, 'image/jpeg');
    });

  }, [hapticFeedback, speak]);
  
  const detectionLoop = useCallback(async () => {
    if (!isMountedRef.current) return;

    await captureAndRecognize();

    if (isMountedRef.current) {
        detectionTimeoutRef.current = window.setTimeout(detectionLoop, 3000);
    }
  }, [captureAndRecognize]);

  const stopReader = useCallback(() => {
    if (detectionTimeoutRef.current) {
      clearTimeout(detectionTimeoutRef.current);
      detectionTimeoutRef.current = null;
    }

    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startReader = useCallback(async () => {
    if (!isMountedRef.current) return;
    setStatus('Starting camera...');
    setIsLoading(true);

    const { stream, error } = await getCameraStream();
    if (!isMountedRef.current) {
        stream?.getTracks().forEach(track => track.stop());
        return;
    }

    if (error) {
      setStatus(error);
      await speak(error);
      setIsLoading(false);
      return;
    }

    if (videoRef.current && stream) {
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.onplaying = async () => {
        if (isMountedRef.current) {
          setStatus('Text Reader started. Looking for text...');
          await speak('Text reader ready.');
          setIsLoading(false);
          detectionLoop();
        }
      };
      videoRef.current.play().catch(async (playError) => {
        console.error("Video play failed:", playError);
        if (isMountedRef.current) {
          const message = "Could not start camera playback.";
          setStatus(message);
          await speak(message);
          setIsLoading(false);
        }
      });
    }
  }, [speak, detectionLoop]);

  useEffect(() => {
    startReader();
    return () => {
      stopReader();
    };
  }, [startReader, stopReader]);
  
  return (
    <div className="flex flex-col h-full bg-black text-white p-4">
      <header className="flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-3 bg-black/50 rounded-full hover:bg-black/75 transition-colors" aria-label="Go to Home Screen">
              <HomeIcon className="w-6 h-6" />
            </button>
            <div 
              className={`p-3 rounded-full transition-colors ${isListening ? 'bg-argus-primary text-white animate-pulse-fast' : 'bg-red-600/80'}`}
              aria-live="polite" 
              aria-label={isListening ? 'Microphone is active' : 'Microphone is inactive'}
            >
              {isListening ? <MicrophoneIcon className="w-6 h-6" /> : <MicrophoneOffIcon className="w-6 h-6" />}
            </div>
        </div>
        <div className="text-lg font-semibold text-right truncate pl-2">{voiceStatus || status}</div>
      </header>

      <main className="absolute inset-0 flex items-center justify-center -mt-16 z-10">
        {isLoading && <Spinner />}
        <video
          ref={videoRef}
          className="w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: isLoading ? 0 : 1 }}
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />
        <div className="absolute inset-0 border-8 border-white/20 rounded-3xl pointer-events-none" style={{ margin: '3rem' }}></div>
      </main>

      <footer className="z-20 mt-auto bg-black/60 backdrop-blur-sm rounded-xl p-4 max-h-40 overflow-y-auto">
        <h3 className="font-bold text-lg mb-2">Recognized Text:</h3>
        {recognizedText ? (
          <p className="text-base whitespace-pre-wrap">{recognizedText}</p>
        ) : (
          <p className="text-gray-400">Point the camera at some text.</p>
        )}
      </footer>
    </div>
  );
};

export default TextReaderMode;