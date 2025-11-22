import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SongConfig, TypingStats, AppMode, ScaleType, SoundProfile } from '../types';
import { audioEngine } from '../utils/audioEngine';
import Visualizer from './Visualizer';
import SynthControls from './SynthControls';
import { RotateCcw, ArrowLeft } from 'lucide-react';

interface Props {
  config: SongConfig;
  mode: AppMode;
  onComplete: (stats: TypingStats) => void;
  onRestart: () => void;
}

const TypingInterface: React.FC<Props> = ({ config, mode, onComplete, onRestart }) => {
  const [input, setInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [triggerVisual, setTriggerVisual] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number, y: number } | null>(null);
  const [isFocused, setIsFocused] = useState(true);

  // Customization State
  const [soundProfile, setSoundProfile] = useState<SoundProfile>(config.soundProfile);
  const [currentScale, setCurrentScale] = useState<ScaleType>('pentatonic');
  const [visualIntensity, setVisualIntensity] = useState(1.0);
  const [harmonizerActive, setHarmonizerActive] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const charRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const freeInputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Audio Engine with specific profile
  useEffect(() => {
    if (config.soundProfile) {
        setSoundProfile(config.soundProfile);
        audioEngine.setProfile(config.soundProfile);
    }
  }, [config.soundProfile]);

  // Initialize refs array for challenge mode
  useEffect(() => {
    if (mode === AppMode.CHALLENGE) {
        charRefs.current = charRefs.current.slice(0, config.text.length);
    }
  }, [config.text, mode]);

  // Handle Parameter Updates
  const handleProfileUpdate = (key: keyof SoundProfile, value: any) => {
    const newProfile = { ...soundProfile, [key]: value };
    setSoundProfile(newProfile);
    audioEngine.updateParam(key, value);
  };

  const handleScaleUpdate = (scale: ScaleType) => {
      setCurrentScale(scale);
      audioEngine.setScale(scale);
  };

  const handleHarmonizerToggle = (active: boolean) => {
      setHarmonizerActive(active);
      audioEngine.setHarmonizer(active);
  };

  const handleSavePreset = () => {
      const preset = {
          id: Date.now().toString(),
          name: `${config.theme} (${new Date().toLocaleTimeString()})`,
          createdAt: Date.now(),
          config: {
              ...config,
              soundProfile: soundProfile,
              scale: currentScale
          }
      };

      const existing = localStorage.getItem('symphony_presets');
      const presets = existing ? JSON.parse(existing) : [];
      presets.push(preset);
      localStorage.setItem('symphony_presets', JSON.stringify(presets));
      alert('Preset saved!');
  };

  const handleChallengeKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isFocused || mode !== AppMode.CHALLENGE) return;
    
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    
    if (e.key === 'Backspace') {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (e.key.length === 1) {
      if (startTime === null) setStartTime(Date.now());

      const targetChar = config.text[input.length];
      const typedChar = e.key;
      
      if (typedChar === targetChar) {
        audioEngine.playKey(typedChar);
        setTriggerVisual(prev => prev + 1);
        
        const currentCharEl = charRefs.current[input.length];
        if (currentCharEl) {
          const rect = currentCharEl.getBoundingClientRect();
          setCursorPos({ 
            x: rect.left + rect.width / 2, 
            y: rect.top + rect.height / 2 
          });
        }
        setInput(prev => prev + typedChar);
      } else {
        audioEngine.playError();
        setMistakes(prev => prev + 1);
      }
    }
  }, [input, config.text, startTime, isFocused, mode]);

  const handleFreePlayChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
     const val = e.target.value;
     const diff = val.length - input.length;
     
     if (diff > 0) {
         // Characters added
         const char = val.slice(-1);
         audioEngine.playKey(char);
         setTriggerVisual(prev => prev + 1);
         
         const centerX = window.innerWidth / 2;
         const centerY = window.innerHeight / 2;
         const spread = 300;
         
         setCursorPos({
             x: centerX + (Math.random() * spread - spread/2),
             y: centerY + (Math.random() * spread/2 - spread/4)
         });
     }

     setInput(val);
  };

  useEffect(() => {
    if (mode === AppMode.CHALLENGE) {
        window.addEventListener('keydown', handleChallengeKeyDown);
        return () => window.removeEventListener('keydown', handleChallengeKeyDown);
    }
  }, [handleChallengeKeyDown, mode]);

  // Check completion for Challenge Mode
  useEffect(() => {
    if (mode === AppMode.CHALLENGE && input.length === config.text.length && startTime) {
      const endTime = Date.now();
      const durationMin = (endTime - startTime) / 60000;
      const wpm = Math.round((config.text.split(' ').length) / durationMin);
      const accuracy = Math.round(((config.text.length - mistakes) / config.text.length) * 100);
      
      setTimeout(() => {
        onComplete({
            wpm,
            accuracy: Math.max(0, accuracy),
            duration: (endTime - startTime) / 1000,
            mistakes,
            totalChars: config.text.length
        });
      }, 800);
    }
  }, [input, config.text, startTime, mistakes, onComplete, mode]);

  const handleBlur = () => setIsFocused(false);
  const handleFocus = () => setIsFocused(true);

  useEffect(() => {
      window.addEventListener('blur', handleBlur);
      window.addEventListener('focus', handleFocus);
      
      if (mode === AppMode.FREE_PLAY && freeInputRef.current) {
          freeInputRef.current.focus();
      }

      return () => {
          window.removeEventListener('blur', handleBlur);
          window.removeEventListener('focus', handleFocus);
      }
  }, [mode]);

  const renderChallengeText = () => {
    return config.text.split('').map((char, index) => {
      let className = "transition-colors duration-100 text-3xl font-mono ";
      if (index < input.length) {
        className += "text-neon-blue drop-shadow-[0_0_8px_rgba(0,243,255,0.5)]";
      } else if (index === input.length) {
        className += "text-white bg-white/20 rounded animate-pulse";
      } else {
        className += "text-gray-600";
      }

      return (
        <span 
          key={index} 
          ref={el => { charRefs.current[index] = el }}
          className={className}
        >
          {char}
        </span>
      );
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center min-h-screen bg-symphony-dark overflow-hidden">
      <Visualizer 
        active={true} 
        trigger={triggerVisual} 
        cursorPosition={cursorPos} 
        theme={config.theme}
        intensity={visualIntensity}
      />

      <SynthControls 
        profile={soundProfile}
        scale={currentScale}
        intensity={visualIntensity}
        harmonizerActive={harmonizerActive}
        onUpdateProfile={handleProfileUpdate}
        onUpdateScale={handleScaleUpdate}
        onUpdateIntensity={setVisualIntensity}
        onToggleHarmonizer={handleHarmonizerToggle}
        onSave={handleSavePreset}
      />
      
      {/* HUD */}
      <div className="absolute top-8 left-8 flex flex-col gap-2 z-10 pointer-events-none">
        <h2 className="text-neon-purple text-sm font-bold tracking-widest uppercase mb-1">Theme</h2>
        <p className="text-xl text-white font-sans">{config.theme}</p>
      </div>

      <div className="absolute top-8 right-20 flex flex-col gap-2 z-10 text-right pointer-events-none">
        <h2 className="text-neon-gold text-sm font-bold tracking-widest uppercase mb-1">Mood</h2>
        <p className="text-xl text-white font-sans">{config.mood}</p>
        {soundProfile && (
             <p className="text-xs text-gray-500 font-mono uppercase mt-1">
                 {currentScale} • {soundProfile.oscillatorType}
             </p>
        )}
      </div>

      {/* Main Area */}
      <div 
        ref={containerRef}
        className={`relative z-10 w-full max-w-4xl p-12 bg-symphony-card/50 backdrop-blur-md rounded-2xl border border-white/5 shadow-2xl flex flex-col transition-all duration-500 ${mode === AppMode.FREE_PLAY ? 'h-[80vh]' : 'min-h-[400px]'}`}
      >
        {!isFocused && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl cursor-pointer" onClick={() => {
                setIsFocused(true);
                if (mode === AppMode.FREE_PLAY) freeInputRef.current?.focus();
            }}>
                <p className="text-white font-mono text-lg animate-pulse">Click to Focus</p>
            </div>
        )}
        
        {mode === AppMode.CHALLENGE ? (
            <>
                <div className="leading-relaxed tracking-wide mb-8 select-none">
                {renderChallengeText()}
                </div>
                <div className="flex justify-between items-center text-gray-400 text-sm font-mono mt-auto border-t border-white/10 pt-6">
                    <span>{input.length} / {config.text.length} chars</span>
                    <span>Mistakes: <span className={mistakes > 0 ? "text-red-400" : "text-green-400"}>{mistakes}</span></span>
                </div>
            </>
        ) : (
            <div className="w-full h-full flex-grow flex flex-col relative">
                <textarea
                    ref={freeInputRef}
                    value={input}
                    onChange={handleFreePlayChange}
                    placeholder="Type freely to compose..."
                    className="w-full h-full bg-transparent text-neon-blue font-mono text-2xl outline-none resize-none placeholder-gray-700 drop-shadow-[0_0_5px_rgba(0,243,255,0.3)] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
                    autoFocus
                    spellCheck={false}
                />
                <div className="absolute bottom-0 right-0 text-gray-600 font-mono text-xs bg-symphony-card/80 px-2 py-1 rounded">
                    Free Play Mode • {input.length} chars
                </div>
            </div>
        )}
      </div>

      <div className="fixed bottom-8 flex gap-4 z-20">
        <button onClick={onRestart} className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 group">
             <ArrowLeft size={18} />
             <span className="text-sm font-mono uppercase">Exit</span>
        </button>
      </div>
    </div>
  );
};

export default TypingInterface;