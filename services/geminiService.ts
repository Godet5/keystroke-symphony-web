/**
 * Production Gemini Service
 * Routes all Gemini API calls through Cloudflare Worker for security
 */

import { SongConfig, AnalysisResult, TypingStats, AppMode } from '../types';

// Use environment variable for API endpoint (defaults to same origin for Cloudflare Pages)
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api/gemini';

export const generateSongConfig = async (theme: string, mode: AppMode): Promise<SongConfig> => {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'generate',
        payload: { theme, mode }
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const { success, data, error } = await response.json();

    if (!success || !data) {
      throw new Error(error || 'No data returned from API');
    }

    return {
      theme,
      text: data.text || "",
      mood: data.mood,
      tempo: data.tempo,
      soundProfile: data.soundProfile
    };

  } catch (error) {
    console.error("Gemini generation error:", error);
    // Fallback configuration
    return {
      theme: "Fallback",
      text: mode === AppMode.CHALLENGE ? "The system is offline, but the music remains." : "",
      mood: "Static",
      tempo: 90,
      soundProfile: {
        oscillatorType: 'sine',
        attack: 0.01,
        decay: 0.2,
        sustain: 0.2,
        release: 0.5,
        filterFreq: 1000,
        filterQ: 1,
        distortion: 0,
        reverbMix: 0.2
      }
    };
  }
};

export const analyzePerformance = async (stats: TypingStats, song: SongConfig): Promise<AnalysisResult> => {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'analyze',
        payload: { stats, song }
      }),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const { success, data, error } = await response.json();

    if (!success || !data) {
      throw new Error(error || 'No data returned from API');
    }

    return data as AnalysisResult;

  } catch (error) {
    console.error("Gemini analysis error:", error);
    // Fallback analysis
    return {
      title: "Unheard Melody",
      critique: "The conductor is taking a coffee break, but your rhythm speaks for itself.",
      score: Math.min(100, Math.round(stats.accuracy * (stats.wpm / 40) * 10) / 10)
    };
  }
};
