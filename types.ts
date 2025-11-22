export enum AppState {
  LANDING = 'LANDING',
  GENERATING = 'GENERATING',
  PLAYING = 'PLAYING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export enum AppMode {
  CHALLENGE = 'CHALLENGE',
  FREE_PLAY = 'FREE_PLAY'
}

export type ScaleType = 'pentatonic' | 'major' | 'minor' | 'blues' | 'chromatic';

export interface SoundProfile {
  oscillatorType: 'sine' | 'square' | 'sawtooth' | 'triangle';
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  filterFreq: number;
  filterQ: number;
  distortion: number; // 0 to 1
  reverbMix: number; // 0 to 1
}

export interface SongConfig {
  theme: string;
  text: string;
  mood: string;
  tempo: number; // visual tempo reference
  soundProfile: SoundProfile;
  scale?: ScaleType;
}

export interface TypingStats {
  wpm: number;
  accuracy: number;
  duration: number;
  mistakes: number;
  totalChars: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface AnalysisResult {
  title: string;
  critique: string;
  score: number;
}

export interface Preset {
  id: string;
  name: string;
  config: SongConfig;
  createdAt: number;
}