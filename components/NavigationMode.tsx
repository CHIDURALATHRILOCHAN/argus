
import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { getCameraStream } from '../services/cameraService';
import { analyzeNavigationFrame } from '../services/geminiService';
import { triggerHapticFeedback, triggerUrgentHapticFeedback } from '../utils/feedback';
import { SettingsContext } from '../contexts/SettingsContext';
import { HomeIcon, MicrophoneIcon, MicrophoneOffIcon } from './shared/Icons';
import Spinner from './shared/Spinner';
import { NavigationAnalysis } from '../types';

interface NavigationModeProps {
  onBack: () => void;
  isListening: boolean;
  voiceStatus: string;
  speak: (text: string) => Promise<void>;
}

const NavigationMode: React.FC<NavigationModeProps> = ({ onBack, isListening, voiceStatus, speak }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState('Initializing...');
  const [analysis, setAnalysis] = useState<NavigationAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { settings } = useContext(SettingsContext)!;

  const isMountedRef = useRef(true);
  const detectionTimeoutRef = useRef<number | null>(null);
  const lastAnnouncementRef = useRef('');

  const urgentHapticFeedback = useCallback(() => {
    if (settings?.haptic) triggerUrgentHapticFeedback();
  }, [settings?.haptic]);

  const gentleHapticFeedback = useCallback(() => {
    if (settings?.haptic) triggerHapticFeedback();
  }, [settings?.haptic]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const processAndAnnounce = useCallback(async (result: NavigationAnalysis) => {
    // If urgency is high, trigger stronger haptics
    if (result.urgency === 'high') {
        urgentHapticFeedback();
    } else if (result.urgency === 'medium') {
        gentleHapticFeedback();
    }

    // Announce if the instruction has changed
    if (result.instruction !== lastAnnouncementRef.current) {
        await speak(result.instruction);
        lastAnnouncementRef.current = result.instruction;
    }
  }, [speak, urgentHapticFeedback, gentleHapticFeedback]);

  const captureAndDetect = useCallback(async () => {
    if (!isMountedRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;

    const MAX_WIDTH = 640;
    const scale = MAX_WIDTH / video.videoWidth;
    canvas.width = MAX_WIDTH;
    canvas.height = video.videoHeight * scale;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    await new Promise<void>((resolve) => {
      canvas.toBlob(async (blob) => {
        if (blob && isMountedRef.current) {
          try {
            const result = await analyzeNavigationFrame(blob);
            if (isMountedRef.current) {
              setAnalysis(result);
              await processAndAnnounce(result);
            }
          } catch (error) {
            const errorMessage = (error as Error).message;
            if (isMountedRef.current) {
              setStatus(errorMessage);
              // Only speak error if it hasn't been spoken recently or if it's critical?
              // For now, simpler error handling to avoid loops
              console.error(errorMessage);
            }
          }
        }
        resolve();
      }, 'image/jpeg', 0.8);
    });
  }, [processAndAnnounce]);

  const detectionLoop = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    await captureAndDetect();
    
    if (!isMountedRef.current) return;

    if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
    // Loop every 3-4 seconds for navigation updates
    detectionTimeoutRef.current = window.setTimeout(detectionLoop, 3500);

  }, [captureAndDetect]);

  const stopNavigation = useCallback(() => {
    if (detectionTimeoutRef.current) clearTimeout(detectionTimeoutRef.current);
    detectionTimeoutRef.current = null;
    
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onplaying = null;
    }
  }, []);

  const startNavigation = useCallback(async () => {
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
          setStatus('Navigation started.');
          await speak('Navigation active. Scanning path.');
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
    startNavigation();
    return () => {
      stopNavigation();
    };
  }, [startNavigation, stopNavigation]);
  
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
        
        {/* Instruction Overlay */}
        {analysis && !isLoading && (
             <div className="absolute bottom-32 left-4 right-4 bg-black/70 backdrop-blur-md p-6 rounded-2xl border-l-8 border-argus-primary shadow-lg transition-all duration-300">
                <h2 className="text-3xl font-bold text-white leading-tight">{analysis.instruction}</h2>
                {analysis.urgency === 'high' && (
                    <div className="mt-2 flex items-center text-red-400 uppercase tracking-wider font-bold text-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
                        Caution
                    </div>
                )}
            </div>
        )}
      </main>

      <footer className="z-20 mt-auto bg-black/60 backdrop-blur-sm rounded-xl p-4">
        <h3 className="font-bold text-sm uppercase tracking-widest text-gray-400 mb-1">Detected Obstacles</h3>
        {analysis && analysis.obstacles.length > 0 ? (
           <p className="text-lg text-white font-medium truncate">
               {analysis.obstacles.join(', ')}
           </p>
        ) : (
          <p className="text-gray-500 italic">Path clear</p>
        )}
      </footer>
    </div>
  );
};

export default NavigationMode;
