
import React, { useContext, useState, useEffect } from 'react';
import { SettingsContext, AppSettings } from '../contexts/SettingsContext';
import { HomeIcon, VolumeUpIcon, VolumeOffIcon, MicrophoneIcon, MicrophoneOffIcon, VibrateIcon, EyeIcon, BatteryIcon, BoltIcon } from './shared/Icons';

interface SettingsModeProps {
  onBack: () => void;
  isListening: boolean;
  voiceStatus: string;
}

// --- Battery Status Service ---
export interface BatteryState {
  isSupported: boolean;
  level: number | null;
  charging: boolean | null;
}

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions | undefined): void;
  removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean | undefined): void;
}

declare global {
  interface Navigator {
    getBattery?(): Promise<BatteryManager>;
  }
}

class BatteryService {
    public state: BatteryState = {
        isSupported: typeof navigator !== 'undefined' && 'getBattery' in navigator,
        level: null,
        charging: null,
    };
    private batteryManager: BatteryManager | null = null;
    private listeners: ((state: BatteryState) => void)[] = [];

    constructor() {
        if (this.state.isSupported) {
            this.init();
        }
    }

    private async init() {
        try {
            const manager = await navigator.getBattery?.();
            if (!manager) return;
            this.batteryManager = manager;
            this.updateBatteryStatus();
            this.batteryManager.addEventListener('levelchange', this.updateBatteryStatus);
            this.batteryManager.addEventListener('chargingchange', this.updateBatteryStatus);
        } catch (error) {
            console.error("Could not initialize battery service", error);
            this.state.isSupported = false;
            this.notifyListeners();
        }
    }

    private updateBatteryStatus = () => {
        if (this.batteryManager) {
            this.state = {
                isSupported: true,
                level: Math.round(this.batteryManager.level * 100),
                charging: this.batteryManager.charging,
            };
            this.notifyListeners();
        }
    };

    public subscribe(listener: (state: BatteryState) => void) {
        this.listeners.push(listener);
        listener(this.state);
    }

    public unsubscribe(listener: (state: BatteryState) => void) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener(this.state));
    }

    public getStatusString(): string {
        if (!this.state.isSupported) {
            return "Battery status is not available on this device.";
        }
        if (this.state.level === null) {
            return "Accessing battery status.";
        }
        const chargingStatus = this.state.charging ? "and charging" : "and not charging";
        return `Battery is at ${this.state.level} percent ${chargingStatus}.`;
    }

    public cleanup() {
        if (this.batteryManager) {
            this.batteryManager.removeEventListener('levelchange', this.updateBatteryStatus);
            this.batteryManager.removeEventListener('chargingchange', this.updateBatteryStatus);
        }
    }
}

export const batteryService = new BatteryService();


const useBatteryStatus = (): BatteryState => {
  const [batteryState, setBatteryState] = useState<BatteryState>(batteryService.state);

  useEffect(() => {
    const handleStateChange = (newState: BatteryState) => {
        setBatteryState(newState);
    };
    batteryService.subscribe(handleStateChange);

    return () => {
        batteryService.unsubscribe(handleStateChange);
    };
  }, []);

  return batteryState;
};
// --- End Battery Status Service ---


const SettingsMode: React.FC<SettingsModeProps> = ({ onBack, isListening, voiceStatus }) => {
  const context = useContext(SettingsContext);
  const batteryStatus = useBatteryStatus();

  if (!context) {
    throw new Error('SettingsMode must be used within a SettingsProvider');
  }
  const { settings, setSettings } = context;

  const handleToggle = (key: keyof AppSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full bg-argus-bg dark:bg-hc-bg text-argus-text-primary dark:text-hc-text-primary p-6">
      <header className="flex items-center justify-between pb-4 border-b border-argus-border dark:border-hc-border">
        <div className="flex items-center gap-2">
            <button 
              onClick={onBack} 
              className="p-3 rounded-full bg-argus-surface dark:bg-hc-surface hover:bg-gray-100 dark:hover:bg-gray-700 border border-argus-border dark:border-hc-border transition-colors">
              <HomeIcon className="w-6 h-6" />
            </button>
            <div 
              className={`p-3 rounded-full transition-colors border ${isListening ? 'bg-argus-primary border-argus-primary text-white animate-pulse' : 'bg-argus-surface dark:bg-hc-surface border-argus-border dark:border-hc-border'}`}
              aria-label={isListening ? 'Voice commands are active' : 'Voice commands are inactive'}
            >
              {isListening ? <MicrophoneIcon className="w-6 h-6" /> : <MicrophoneOffIcon className="w-6 h-6" />}
            </div>
        </div>
        <div className="flex flex-col items-center flex-1 mx-4">
            <h1 className="text-2xl font-bold tracking-wide">Settings</h1>
            <p className="text-sm font-semibold text-center truncate text-argus-text-secondary dark:text-hc-text-secondary">{voiceStatus}</p>
        </div>
      </header>
      
      <div className="flex-grow overflow-y-auto mt-6 space-y-8">
        <SettingsSection title="Audio Settings">
          <SettingsToggle
            label="Audio Feedback"
            enabled={settings.audio}
            onToggle={() => handleToggle('audio')}
            onIcon={<VolumeUpIcon className="w-6 h-6"/>}
            offIcon={<VolumeOffIcon className="w-6 h-6"/>}
          />
        </SettingsSection>

        <SettingsSection title="Haptic Settings">
          <SettingsToggle
            label="Haptic Feedback"
            enabled={settings.haptic}
            onToggle={() => handleToggle('haptic')}
            onIcon={<VibrateIcon className="w-6 h-6"/>}
            offIcon={<VibrateIcon className="w-6 h-6 opacity-50"/>}
          />
        </SettingsSection>

        <SettingsSection title="Visual Settings">
          <SettingsToggle
            label="High Contrast Mode"
            enabled={settings.highContrast}
            onToggle={() => handleToggle('highContrast')}
            onIcon={<EyeIcon className="w-6 h-6"/>}
            offIcon={<EyeIcon className="w-6 h-6 opacity-50"/>}
          />
        </SettingsSection>
        
        <SettingsSection title="Battery Status">
           <div className="bg-argus-surface dark:bg-hc-surface p-4 rounded-xl border border-argus-border dark:border-hc-border">
              <BatteryStatusDisplay status={batteryStatus} />
           </div>
        </SettingsSection>

      </div>
    </div>
  );
};

const BatteryStatusDisplay: React.FC<{ status: BatteryState }> = ({ status }) => {
  if (!status.isSupported) {
    return <p className="text-sm text-argus-text-secondary dark:text-hc-text-secondary">Battery status API not available on this device.</p>;
  }
  if (status.level === null) {
    return <p className="text-sm text-argus-text-secondary dark:text-hc-text-secondary">Accessing battery status...</p>;
  }
  
  const getBarColor = () => {
    if (status.level === null) return 'bg-gray-300';
    if (status.level <= 20) return 'bg-red-500';
    if (status.level <= 50) return 'bg-yellow-500';
    return 'bg-green-500 dark:bg-hc-green';
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-shrink-0">
        <BatteryIcon className="w-10 h-10 text-argus-text-primary dark:text-hc-text-primary" />
        {status.charging && <BoltIcon className="w-5 h-5 text-yellow-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
      </div>
      <div className="flex-grow w-full">
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-lg font-semibold text-argus-text-primary dark:text-hc-text-primary">{status.level}%</p>
          <p className="text-sm font-medium text-argus-text-secondary dark:text-hc-text-secondary">
            {status.charging ? 'Charging' : 'On Battery'}
          </p>
        </div>
        <div className="w-full bg-gray-200 dark:bg-hc-border rounded-full h-2">
            <div 
                className={`h-2 rounded-full transition-all duration-500 ease-in-out ${getBarColor()}`}
                style={{ width: `${status.level}%` }}>
            </div>
        </div>
      </div>
    </div>
  );
};


const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h2 className="text-lg font-semibold text-argus-text-secondary dark:text-hc-text-secondary mb-3 px-2">{title}</h2>
    <div className="space-y-2">
      {children}
    </div>
  </section>
);

interface SettingsToggleProps {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({ label, enabled, onToggle, onIcon, offIcon }) => (
  <button
    onClick={onToggle}
    className={`w-full flex items-center justify-between p-4 rounded-xl transition-colors duration-200 ${
      enabled 
      ? 'bg-green-100 text-green-800 dark:bg-hc-green dark:text-black' 
      : 'bg-yellow-100 text-yellow-800 dark:bg-hc-yellow dark:text-black'
    }`}
    aria-pressed={enabled}
  >
    <span className="text-lg font-medium">{label}</span>
    <div className="flex items-center justify-center w-8 h-8">
        {enabled ? onIcon : offIcon}
    </div>
  </button>
);

export default SettingsMode;
