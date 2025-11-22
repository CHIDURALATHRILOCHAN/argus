
// Fix: Import SpeechRecognition from the central types file.
import { SpeechRecognition } from "../types";

// Fix: Define missing VoiceControllerOptions interface.
export interface VoiceControllerOptions {
    autoStart?: boolean;
    language?: string;
    provideFeedback?: boolean;
    onNavigationOpen?: () => void;
    onTextReadOpen?: () => void;
    onSettingsOpen?: () => void;
    onModeClose?: () => void;
    onVoiceStatusChange?: (status: string, isListening: boolean) => void;
    onToggleSetting?: (setting: 'haptic' | 'audio', value: boolean) => void;
    onCheckBattery?: () => string;
}

export class VoiceController {
    private recognition: SpeechRecognition | null = null;
    public isListening: boolean = false;
    private speechSynthesis: SpeechSynthesis;
    private currentUtterance: SpeechSynthesisUtterance | null = null;
    private config: Required<Omit<VoiceControllerOptions, 'onTextReadOpen' | 'onToggleSetting' | 'onCheckBattery'>> & {
        onTextReadOpen?: () => void;
        onToggleSetting?: (setting: 'haptic' | 'audio', value: boolean) => void;
        onCheckBattery?: () => string;
    };
    
    // Callbacks
    private onNavigationOpen: () => void;
    private onTextReadOpen: () => void;
    private onSettingsOpen: () => void;
    private onModeClose: () => void;
    private onVoiceStatusChange: (status: string, isListening: boolean) => void;

    private restartTimer: number | null = null;
    private errorRetryCount: number = 0;
    private isErrorRecovery: boolean = false;
    private isSpeaking: boolean = false;

    constructor(options: VoiceControllerOptions = {}) {
        this.speechSynthesis = window.speechSynthesis;
        
        const defaults = {
            autoStart: true,
            language: 'en-US',
            provideFeedback: true,
            onNavigationOpen: () => console.log('Navigation opened'),
            onTextReadOpen: () => console.log('Text Read opened'),
            onSettingsOpen: () => console.log('Settings opened'),
            onModeClose: () => console.log('Returned to home'),
            onVoiceStatusChange: () => {},
            onToggleSetting: (setting: 'haptic' | 'audio', value: boolean) => console.warn('onToggleSetting not implemented.'),
            onCheckBattery: () => 'Battery status check not implemented.',
        };

        this.config = { ...defaults, ...options };
        
        this.onNavigationOpen = this.config.onNavigationOpen;
        this.onTextReadOpen = this.config.onTextReadOpen!;
        this.onSettingsOpen = this.config.onSettingsOpen;
        this.onModeClose = this.config.onModeClose;
        this.onVoiceStatusChange = this.config.onVoiceStatusChange;
        
        this.init();
    }

    private init() {
        if (this.setupVoiceRecognition() && this.config.autoStart) {
            this.startListening();
        }
    }

    private setupVoiceRecognition(): boolean {
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognitionAPI) {
            console.error('Speech recognition not supported in this browser');
            this.onVoiceStatusChange('Speech recognition not supported', false);
            return false;
        }

        this.recognition = new SpeechRecognitionAPI();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = this.config.language;

        this.recognition.onstart = () => {
            this.isListening = true;
            this.onVoiceStatusChange('Listening...', true);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.isErrorRecovery || this.isSpeaking) {
                return;
            }

            if (this.config.autoStart) {
                if (this.restartTimer) clearTimeout(this.restartTimer);
                this.restartTimer = window.setTimeout(() => this.startListening(), 250);
            } else {
                 this.onVoiceStatusChange('Voice disabled', false);
            }
        };

        this.recognition.onresult = (event: any) => {
            this.errorRetryCount = 0;
            if (!event.results || event.results.length === 0 || event.results[event.results.length - 1].length === 0) {
                return;
            }
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            if (!transcript) {
                return;
            }
            this.onVoiceStatusChange(`Heard: "${transcript}"`, true);
            this.processVoiceCommand(transcript);
        };

        this.recognition.onerror = (event: any) => {
            this.isListening = false;
            
            if (event.error === 'aborted') {
                console.log('Recognition aborted.');
                // Don't set status to paused, as the onend handler will restart it.
                return;
            }

            if (event.error === 'no-speech') {
                console.warn('No speech detected.');
                return;
            }

            this.isErrorRecovery = true;

            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                console.error('Speech recognition permission denied.');
                this.onVoiceStatusChange('Microphone permission denied', false);
                this.config.autoStart = false; // Stop trying if permission is denied.
                return;
            }
            
            if (event.error === 'audio-capture') {
                console.error('Microphone could not be started.');
                this.onVoiceStatusChange('Microphone not available', false);
                this.config.autoStart = false; // Stop trying if mic is unavailable.
                return;
            }
            
            this.errorRetryCount++;
            const baseDelay = 500;
            const jitter = Math.random() * 250;
            const backoffDelay = Math.min(30000, Math.pow(2, this.errorRetryCount) * baseDelay) + jitter;

            console.error(`Speech recognition error: ${event.error}. Retrying in ${backoffDelay.toFixed(0)}ms. Attempt #${this.errorRetryCount}.`);
            this.onVoiceStatusChange(`Voice connection issue. Retrying...`, false);

            if (this.restartTimer) clearTimeout(this.restartTimer);
            this.restartTimer = window.setTimeout(() => {
                this.isErrorRecovery = false;
                this.startListening();
            }, backoffDelay);
        };
        return true;
    }

    private processVoiceCommand(command: string) {
        const commands = {
            navigation: ['open navigation', 'navigation', 'navigate'],
            textRead: ['open text', 'text read', 'read text', 'open reader'],
            settings: ['open settings', 'settings', 'preferences'],
            close: ['close', 'go home', 'home screen', 'exit', 'stop', 'stop navigation', 'stop text reader'],
        };

        if (commands.close.some(p => command.includes(p))) {
            this.stopSpeaking();
            this.onModeClose();
            if (this.config.provideFeedback) this.speak('Returning to home screen');
            return;
        } 
        
        if (commands.navigation.some(p => command.includes(p))) {
            this.onNavigationOpen();
            if (this.config.provideFeedback) this.speak('Opening Navigation');
            return;
        } 
        
        if (commands.textRead.some(p => command.includes(p))) {
            this.onTextReadOpen();
            if (this.config.provideFeedback) this.speak('Opening Text Reader');
            return;
        } 
        
        if (commands.settings.some(p => command.includes(p))) {
            this.onSettingsOpen();
            if (this.config.provideFeedback) this.speak('Opening Settings');
            return;
        }

        const toggleableSettings: Array<{ name: 'haptic' | 'audio', keywords: string[] }> = [
            { name: 'haptic', keywords: ['haptic', 'haptics', 'vibration'] },
            { name: 'audio', keywords: ['audio', 'sound', 'feedback'] }
        ];

        for (const setting of toggleableSettings) {
            const settingPattern = new RegExp(`\\b(${setting.keywords.join('|')})\\b`);
            if (settingPattern.test(command)) {
                const capitalizedSetting = setting.name.charAt(0).toUpperCase() + setting.name.slice(1);

                if (/\b(on|enable|start)\b/.test(command)) {
                    this.config.onToggleSetting?.(setting.name, true);
                    if (this.config.provideFeedback) this.speak(`${capitalizedSetting} enabled.`);
                    return;
                }
                if (/\b(off|disable|stop)\b/.test(command)) {
                    this.config.onToggleSetting?.(setting.name, false);
                    if (this.config.provideFeedback) this.speak(`${capitalizedSetting} disabled.`);
                    return;
                }
            }
        }

        if (command.includes('battery')) {
            const status = this.config.onCheckBattery?.();
            if (status && this.config.provideFeedback) {
                this.speak(status);
            }
            return;
        }
    }

    public speak(text: string): Promise<void> {
       return new Promise((resolve) => {
            if (!this.speechSynthesis || !this.config.provideFeedback || !text) {
                resolve();
                return;
            }
            
            const wasListening = this.isListening && this.config.autoStart;
            
            this.speechSynthesis.cancel();

            if (wasListening) {
                this.isSpeaking = true;
                this.recognition?.stop();
            }
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => {
                this.currentUtterance = null;
                if (wasListening) {
                    this.isSpeaking = false;
                    if (this.restartTimer) clearTimeout(this.restartTimer);
                    this.startListening();
                }
                resolve();
            };
            utterance.onerror = (event) => {
                if (event.error !== 'interrupted' && event.error !== 'canceled' && event.error !== 'not-allowed') {
                    console.error('Speech synthesis error:', event.error);
                }
                this.currentUtterance = null;
                 if (wasListening) {
                    this.isSpeaking = false;
                    if (this.restartTimer) clearTimeout(this.restartTimer);
                    this.startListening();
                }
                resolve();
            };
            
            this.currentUtterance = utterance;
            this.speechSynthesis.speak(utterance);
       });
    }

    public stopSpeaking() {
        if (this.speechSynthesis) {
            // This will trigger the `onend` event of the current utterance,
            // which will handle resetting the `isSpeaking` state and restarting recognition.
            this.speechSynthesis.cancel();
        }
    }

    public startListening() {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        if (this.recognition && !this.isListening) {
            try {
                this.recognition.start();
            } catch (error) {
                console.warn('Could not start recognition (may already be running):', error);
                if (!this.isErrorRecovery) {
                    // Manually trigger the error handler for consistent retry logic
                    this.recognition.onerror({ error: 'start-failed' });
                }
            }
        }
    }

    public stopListening() {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        if (this.recognition) {
            this.recognition.abort();
        }
        this.isListening = false;
        this.onVoiceStatusChange('Voice paused', false);
    }
    
    public updateConfig(newConfig: Partial<VoiceControllerOptions>) {
        this.config = { ...this.config, ...newConfig };
        
        if (this.recognition) {
            this.recognition.lang = this.config.language;
        }
    }

    public destroy() {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.config.autoStart = false;
        if (this.recognition) this.recognition.abort();
        this.speechSynthesis.cancel();
    }
}
