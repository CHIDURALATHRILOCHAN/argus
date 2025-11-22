
import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { AppMode } from './types';
import NavigationMode from './components/NavigationMode';
import TextReaderMode from './components/TextReaderMode';
import SettingsMode, { batteryService } from './components/SettingsMode';
import { SettingsContext } from './contexts/SettingsContext';
import { EyeIcon, BookOpenIcon, SettingsIcon, MicrophoneIcon, MicrophoneOffIcon } from './components/shared/Icons';
import { VoiceController } from './services/voiceController';

interface ModeButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ label, icon, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-6 p-6 bg-argus-surface dark:bg-hc-surface rounded-2xl shadow-md hover:shadow-lg hover:scale-105 transition-all duration-200 border border-argus-border dark:border-hc-border"
  >
    {icon}
    <span className="text-2xl font-semibold">{label}</span>
  </button>
);


const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isListening, setIsListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Voice commands loading...');
  const { settings, setSettings } = useContext(SettingsContext)!;

  const voiceControllerRef = useRef<VoiceController | null>(null);

  const navigateTo = useCallback((newMode: AppMode) => {
    setMode(newMode);
  }, []);

  const goHome = useCallback(() => {
    voiceControllerRef.current?.stopSpeaking();
    navigateTo(AppMode.HOME);
  }, [navigateTo]);

  // Effect to initialize the VoiceController ONCE
  useEffect(() => {
    voiceControllerRef.current = new VoiceController({
      autoStart: true, // Voice commands are now always on by default
      provideFeedback: settings.audio,
      onNavigationOpen: () => navigateTo(AppMode.NAVIGATION),
      onTextReadOpen: () => navigateTo(AppMode.TEXT_READER),
      onSettingsOpen: () => navigateTo(AppMode.SETTINGS),
      onModeClose: () => navigateTo(AppMode.HOME),
      onVoiceStatusChange: (status, listening) => {
        setVoiceStatus(status);
        setIsListening(listening);
      },
      onToggleSetting(setting, value) {
        setSettings(s => ({ ...s, [setting]: value }));
      },
      onCheckBattery() {
        return batteryService.getStatusString();
      },
    });

    // Start the listener, as it's now always on
    voiceControllerRef.current.startListening();

    // Cleanup on unmount
    return () => {
      voiceControllerRef.current?.destroy();
      batteryService.cleanup();
    };
  }, [navigateTo, setSettings]);

  // Effect to sync the controller with settings changes
  useEffect(() => {
    if (!voiceControllerRef.current) return;

    voiceControllerRef.current.updateConfig({
        provideFeedback: settings.audio,
    });
    
  }, [settings.audio]);

  const speak = useCallback(async (text: string) => {
    await voiceControllerRef.current?.speak(text);
  }, []);

  const renderHomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full bg-argus-bg dark:bg-hc-bg text-argus-text-primary dark:text-hc-text-primary p-4">
      <header className="text-center mb-16">
        <h1 className="text-6xl font-bold tracking-tighter">Argus</h1>
        <p className="text-xl text-argus-text-secondary dark:text-hc-text-secondary mt-2">Your AI guide for the visually impaired.</p>
      </header>
      
      <main className="grid grid-cols-1 gap-6 w-full max-w-sm">
        <ModeButton
          label="Navigation"
          icon={<EyeIcon className="w-8 h-8" />}
          onClick={() => setMode(AppMode.NAVIGATION)}
        />
        <ModeButton
          label="Text Reader"
          icon={<BookOpenIcon className="w-8 h-8" />}
          onClick={() => setMode(AppMode.TEXT_READER)}
        />
        <ModeButton
          label="Settings"
          icon={<SettingsIcon className="w-8 h-8" />}
          onClick={() => setMode(AppMode.SETTINGS)}
        />
      </main>
    </div>
  );

  const commonVoiceProps = {
    isListening,
    voiceStatus,
    speak,
  };

  switch (mode) {
    case AppMode.NAVIGATION:
      return <NavigationMode onBack={goHome} {...commonVoiceProps} />;
    case AppMode.TEXT_READER:
      return <TextReaderMode onBack={goHome} {...commonVoiceProps} />;
    case AppMode.SETTINGS:
      return <SettingsMode onBack={goHome} {...commonVoiceProps} />;
    case AppMode.HOME:
    default:
      return renderHomeScreen();
  }
};

export default App;
