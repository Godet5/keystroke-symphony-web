import { GoogleGenAI, Type } from "@google/genai";
import { SongConfig, AnalysisResult, TypingStats, AppMode } from '../types';

const apiKey = process.env.API_KEY || ''; 

const ai = new GoogleGenAI({ apiKey });

export const generateSongConfig = async (theme: string, mode: AppMode): Promise<SongConfig> => {
  try {
    const model = 'gemini-2.5-flash';
    
    let prompt = '';
    let systemInstruction = '';
    
    if (mode === AppMode.CHALLENGE) {
        systemInstruction = 'You are a sound designer and creative writer.';
        prompt = `Create a configuration for a musical typing game based on the theme: "${theme}". 
        1. Create a text passage that is rhythmic, evocative, and pleasant to type (40-60 words).
        2. Define a sound synthesizer profile that matches the theme (e.g., Cyberpunk = Sawtooth/Distortion, Nature = Sine/Reverb).
        
        Return JSON with:
        - text: string
        - mood: string
        - tempo: number (60-140)
        - soundProfile: object
        `;
    } else {
        systemInstruction = 'You are an expert avant-garde synthesizer sound designer.';
        prompt = `Create a unique, highly stylized, and specific sound synthesizer configuration for a free-typing musical experience based on the theme: "${theme}".
        
        The user will type freely to create music. The sound should be distinct, avoiding generic presets.
        Be bold with the ADSR settings and filter Q to create texture.
        
        Return JSON with:
        - text: (Empty string)
        - mood: string
        - tempo: number (60-140)
        - soundProfile: object
        `;
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 1.2, // Higher temperature for more variety in Free Play
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            mood: { type: Type.STRING },
            tempo: { type: Type.NUMBER },
            soundProfile: {
                type: Type.OBJECT,
                properties: {
                    oscillatorType: { type: Type.STRING, enum: ["sine", "square", "sawtooth", "triangle"] },
                    attack: { type: Type.NUMBER, description: "Attack time in seconds (0.01 - 2.0)" },
                    decay: { type: Type.NUMBER, description: "Decay time in seconds (0.1 - 2.0)" },
                    sustain: { type: Type.NUMBER, description: "Sustain level (0.1 - 1.0)" },
                    release: { type: Type.NUMBER, description: "Release time in seconds (0.1 - 4.0)" },
                    filterFreq: { type: Type.NUMBER, description: "Filter cutoff in Hz (200 - 8000)" },
                    filterQ: { type: Type.NUMBER, description: "Filter resonance (0.1 - 20)" },
                    distortion: { type: Type.NUMBER, description: "Distortion amount (0.0 - 1.0)" },
                    reverbMix: { type: Type.NUMBER, description: "Reverb mix (0.0 - 1.0)" },
                },
                required: ["oscillatorType", "attack", "decay", "sustain", "release", "filterFreq", "filterQ", "distortion", "reverbMix"]
            }
          },
          required: ["text", "mood", "tempo", "soundProfile"],
        },
      },
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
        theme,
        text: data.text || "",
        mood: data.mood,
        tempo: data.tempo,
        soundProfile: data.soundProfile
      };
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Gemini generation error:", error);
    // Fallback
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
        const model = 'gemini-2.5-flash';
        const prompt = `Analyze this typing performance for the text theme "${song.theme}".
        Stats: ${stats.wpm} WPM, ${stats.accuracy}% accuracy, ${stats.mistakes} mistakes.
        
        Act as a witty, mystical music conductor. 
        Give a creative title to their performance.
        Write a short critique (2 sentences max).
        Give a score out of 100.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        critique: { type: Type.STRING },
                        score: { type: Type.NUMBER }
                    },
                    required: ["title", "critique", "score"]
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text) as AnalysisResult;
        }
        throw new Error("No analysis text");
    } catch (error) {
        console.error("Gemini analysis error:", error);
        return {
            title: "Unheard Melody",
            critique: "The conductor is taking a coffee break, but your rhythm speaks for itself.",
            score: Math.min(100, Math.round(stats.accuracy * (stats.wpm / 40) * 10) / 10)
        };
    }
}