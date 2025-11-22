
export enum AppMode {
  HOME,
  NAVIGATION,
  TEXT_READER,
  SETTINGS,
}

export interface NavigationAnalysis {
  instruction: string;
  obstacles: string[];
  urgency: 'high' | 'medium' | 'low';
}

export interface DetectedObject {
  label: string;
  distance: 'very close' | 'near' | 'far' | string;
  direction: 'in front' | 'to the left' | 'to the right' | string;
  urgency: 'high' | 'medium' | 'low';
  guidance?: string;
}

export interface CameraResult {
  stream: MediaStream | null;
  error: string | null;
}

// Fix: Moved Speech API types here from App.tsx to be globally accessible
// Add definitions for missing Web Speech API types
// Fix for: Cannot find name 'SpeechGrammarList'.
interface SpeechGrammar {
  src: string;
  weight: number;
}
export interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  addFromString(string: string, weight?: number): void;
  addFromURI(src: string, weight?: number): void;
  [index: number]: SpeechGrammar;
}

// SpeechRecognition interfaces for TypeScript
// Fix: SpeechRecognition must extend EventTarget to be compatible with the browser API.
export interface SpeechRecognition extends EventTarget {
  // properties
  grammars: SpeechGrammarList;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  serviceURI: string;

  // event handlers
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: any) => void) | null;
  onnomatch: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
  onsoundstart: (() => void) | null;
  onsoundend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  onstart: (() => void) | null;

  // methods
  abort(): void;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
  }
}
