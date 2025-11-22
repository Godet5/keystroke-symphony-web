import React, { useState } from 'react';
import Landing from './components/Landing';
import TypingInterface from './components/TypingInterface';
import Results from './components/Results';
import { AppState, SongConfig, TypingStats, AppMode } from './types';
import { generateSongConfig } from './services/geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.LANDING);
  const [mode, setMode] = useState<AppMode>(AppMode.CHALLENGE);
  const [config, setConfig] = useState<SongConfig | null>(null);
  const [stats, setStats] = useState<TypingStats | null>(null);

  const handleStart = async (theme: string, selectedMode: AppMode) => {
    setState(AppState.GENERATING);
    setMode(selectedMode);
    try {
      const songConfig = await generateSongConfig(theme, selectedMode);
      setConfig(songConfig);
      setState(AppState.PLAYING);
    } catch (error) {
      console.error(error);
      setState(AppState.ERROR); // In a real app, handle error UI
      setState(AppState.LANDING);
    }
  };

  const handleLoadPreset = (presetConfig: SongConfig, selectedMode: AppMode) => {
      setConfig(presetConfig);
      setMode(selectedMode);
      setState(AppState.PLAYING);
  };

  const handleComplete = (resultStats: TypingStats) => {
    setStats(resultStats);
    setState(AppState.RESULTS);
  };

  const handleRestart = () => {
    setState(AppState.LANDING);
    setConfig(null);
    setStats(null);
  };

  return (
    <div className="w-full h-full text-white">
      {state === AppState.LANDING && (
        <Landing onStart={handleStart} onLoadPreset={handleLoadPreset} isLoading={false} />
      )}
      
      {state === AppState.GENERATING && (
        <Landing onStart={() => {}} isLoading={true} />
      )}

      {state === AppState.PLAYING && config && (
        <TypingInterface 
          config={config} 
          mode={mode}
          onComplete={handleComplete} 
          onRestart={handleRestart}
        />
      )}

      {state === AppState.RESULTS && stats && config && (
        <Results 
          stats={stats} 
          config={config} 
          onRestart={handleRestart} 
        />
      )}
    </div>
  );
};

export default App;