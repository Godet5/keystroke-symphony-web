import React, { useState, useEffect } from 'react';
import { Keyboard, Music, Sparkles, Feather, Target, Play, Trash2, Save } from 'lucide-react';
import { audioEngine } from '../utils/audioEngine';
import { AppMode, Preset, SongConfig } from '../types';

interface Props {
  onStart: (theme: string, mode: AppMode) => void;
  onLoadPreset?: (config: SongConfig, mode: AppMode) => void;
  isLoading: boolean;
}

const Landing: React.FC<Props> = ({ onStart, onLoadPreset, isLoading }) => {
  const [theme, setTheme] = useState('');
  const [mode, setMode] = useState<AppMode>(AppMode.CHALLENGE);
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('symphony_presets');
    if (stored) {
        try {
            setPresets(JSON.parse(stored));
        } catch (e) {
            console.error("Failed to load presets");
        }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.trim()) return;
    
    audioEngine.start();
    onStart(theme, mode);
  };

  const handleDeletePreset = (id: string) => {
      const updated = presets.filter(p => p.id !== id);
      setPresets(updated);
      localStorage.setItem('symphony_presets', JSON.stringify(updated));
  };

  const handlePlayPreset = (preset: Preset) => {
      audioEngine.start();
      // Pass a simplified handler if parent supports it, otherwise restart flow
      // We cheat slightly by calling onStart but with a special flag, 
      // or better, we modify App to accept config directly.
      // For now, let's assume the parent component needs an update to handle direct config loading
      // or we just ignore it.
      // BUT, to make it work within constraints, we will bubble up the config.
      // The interface didn't have onLoadPreset before, I added it to props above.
      if (onLoadPreset) {
        onLoadPreset(preset.config, AppMode.FREE_PLAY);
      }
  };

  const suggestions = [
    "Cyberpunk Rainy Night",
    "Victorian Garden Party",
    "Deep Space Voyage",
    "Jazz Club 1920s"
  ];

  return (
    <div className="min-h-screen bg-symphony-dark flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-neon-purple/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neon-blue/10 rounded-full blur-[100px] animate-pulse-slow delay-1000"></div>
      </div>

      <div className="z-10 max-w-5xl w-full grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-12 items-start">
        
        {/* Left Col: Generator */}
        <div className="space-y-10 text-center md:text-left">
            <div className="space-y-4 animate-float">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-6">
                <Keyboard className="text-neon-blue w-8 h-8" />
                <Music className="text-neon-purple w-8 h-8" />
            </div>
            <h1 className="text-6xl font-bold font-sans text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 tracking-tight leading-tight">
                Keystroke<br/>Symphony
            </h1>
            <p className="text-gray-400 text-lg font-mono leading-relaxed">
                Type to compose. Let AI craft the instrument based on your theme.
            </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6 mx-auto md:mx-0">
            
            {/* Mode Selection */}
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                <button
                    type="button"
                    onClick={() => setMode(AppMode.CHALLENGE)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono transition-all duration-200 ${mode === AppMode.CHALLENGE ? 'bg-neon-blue/20 text-neon-blue shadow-[0_0_15px_rgba(0,243,255,0.2)] border border-neon-blue/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Target size={16} /> Challenge
                </button>
                <button
                    type="button"
                    onClick={() => setMode(AppMode.FREE_PLAY)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono transition-all duration-200 ${mode === AppMode.FREE_PLAY ? 'bg-neon-purple/20 text-neon-purple shadow-[0_0_15px_rgba(188,19,254,0.2)] border border-neon-purple/30' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    <Feather size={16} /> Free Play
                </button>
            </div>

            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-blue to-neon-purple rounded-lg blur opacity-30 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder={mode === AppMode.CHALLENGE ? "Enter a theme (e.g., 'Neon Tokyo')..." : "Enter a mood (e.g., 'Dreamy Ocean')..."}
                className="relative w-full bg-symphony-card text-white px-6 py-4 rounded-lg border border-white/10 focus:outline-none focus:border-white/30 font-mono text-lg placeholder-gray-600 shadow-xl"
                disabled={isLoading}
                autoFocus
                />
            </div>

            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                {suggestions.map(s => (
                    <button 
                        key={s}
                        type="button" 
                        onClick={() => setTheme(s)}
                        className="text-xs border border-white/10 px-3 py-1 rounded-full text-gray-500 hover:text-white hover:border-white/30 transition-colors"
                    >
                        {s}
                    </button>
                ))}
            </div>

            <button
                type="submit"
                disabled={isLoading || !theme.trim()}
                className="w-full group relative inline-flex items-center justify-center px-8 py-3 font-semibold text-white transition-all duration-200 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-neon-blue disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? (
                    <span className="flex items-center gap-2">
                        <Sparkles className="animate-spin w-4 h-4" /> Tuning Instruments...
                    </span>
                ) : (
                    <span className="flex items-center gap-2">
                        {mode === AppMode.CHALLENGE ? 'Start Challenge' : 'Open Blank Slate'} <Sparkles className="w-4 h-4" />
                    </span>
                )}
            </button>
            </form>
        </div>

        {/* Right Col: Saved Presets */}
        {presets.length > 0 && (
            <div className="bg-symphony-card/50 border border-white/10 rounded-2xl p-6 h-full max-h-[500px] flex flex-col backdrop-blur-sm">
                <h3 className="text-white font-bold font-sans text-xl mb-4 flex items-center gap-2">
                    <Save size={20} className="text-neon-gold" /> Saved Symphonies
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {presets.slice().reverse().map(p => (
                        <div key={p.id} className="group flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl p-4 transition-all">
                            <div className="overflow-hidden">
                                <p className="text-white font-medium truncate">{p.name}</p>
                                <p className="text-xs text-gray-500 font-mono mt-1">
                                    {p.config.soundProfile.oscillatorType} • {p.config.scale || 'pentatonic'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                    onClick={() => handlePlayPreset(p)}
                                    className="p-2 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30"
                                    title="Play in Free Mode"
                                >
                                    <Play size={16} fill="currentColor" />
                                </button>
                                <button 
                                    onClick={() => handleDeletePreset(p.id)}
                                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <footer className="absolute bottom-6 text-gray-600 text-sm font-mono w-full text-center">
         Powered by Gemini 2.5 • Web Audio API • Tailwind
      </footer>
    </div>
  );
};

export default Landing;