import React, { createContext, useState, useEffect, useMemo, ReactNode } from 'react';

export interface AppSettings {
  audio: boolean;
  haptic: boolean;
  highContrast: boolean;
}

interface SettingsContextType {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}

const defaultSettings: AppSettings = {
  audio: true,
  haptic: true,
  highContrast: false,
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const storedSettings = window.localStorage.getItem('argus-settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        // Clean up legacy 'voice' setting if it exists
        delete parsed.voice;
        return { ...defaultSettings, ...parsed };
      }
      return defaultSettings;
    } catch (error) {
      console.error("Could not load settings from localStorage", error);
      return defaultSettings;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('argus-settings', JSON.stringify(settings));
    } catch (error) {
      console.error("Could not save settings to localStorage", error);
    }

    // Apply high contrast theme
    if (settings.highContrast) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);
  
  const value = useMemo(() => ({ settings, setSettings }), [settings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};