import React, { useEffect, useState } from 'react';
import { TypingStats, SongConfig, AnalysisResult } from '../types';
import { analyzePerformance } from '../services/geminiService';
import { ArrowLeft, RefreshCw, Share2, Star } from 'lucide-react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';

interface Props {
  stats: TypingStats;
  config: SongConfig;
  onRestart: () => void;
}

const Results: React.FC<Props> = ({ stats, config, onRestart }) => {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    analyzePerformance(stats, config).then(setAnalysis);
  }, [stats, config]);

  const chartData = [
    { name: 'Accuracy', value: stats.accuracy, fill: '#00f3ff' },
    { name: 'WPM', value: Math.min(100, stats.wpm) * 1.5, fill: '#bc13fe' } // Scale WPM for visual balance
  ];

  return (
    <div className="min-h-screen bg-symphony-dark text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Col: Stats */}
        <div className="space-y-8 animate-float">
          <div className="bg-symphony-card border border-white/10 rounded-3xl p-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Star size={120} />
             </div>
             
             <h2 className="text-3xl font-bold font-sans mb-6">Performance</h2>
             
             <div className="grid grid-cols-2 gap-8">
                 <div>
                     <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">Speed</p>
                     <p className="text-5xl font-bold text-neon-blue mt-2">{stats.wpm}</p>
                     <p className="text-sm text-gray-400">WPM</p>
                 </div>
                 <div>
                     <p className="text-gray-500 font-mono text-sm uppercase tracking-wider">Precision</p>
                     <p className="text-5xl font-bold text-neon-purple mt-2">{stats.accuracy}%</p>
                     <p className="text-sm text-gray-400">Accuracy</p>
                 </div>
             </div>
             
             <div className="h-48 mt-8 -ml-4">
               <ResponsiveContainer width="100%" height="100%">
                 <RadialBarChart innerRadius="60%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                   <RadialBar background dataKey="value" cornerRadius={10} />
                 </RadialBarChart>
               </ResponsiveContainer>
             </div>
          </div>
        </div>

        {/* Right Col: AI Analysis */}
        <div className="flex flex-col justify-center space-y-6">
            {!analysis ? (
                <div className="h-64 flex items-center justify-center bg-symphony-card/30 rounded-3xl border border-white/5 animate-pulse">
                    <p className="text-gray-400 font-mono">The Conductor is reviewing your score...</p>
                </div>
            ) : (
                <div className="bg-gradient-to-br from-symphony-card to-[#1a1a1a] border border-white/10 rounded-3xl p-8 shadow-2xl transform transition-all duration-500 hover:scale-[1.02]">
                    <div className="flex items-center justify-between mb-4">
                        <span className="bg-neon-gold/10 text-neon-gold px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-neon-gold/20">
                            Maestro's Verdict
                        </span>
                        <span className="text-2xl font-bold text-white">{analysis.score}/100</span>
                    </div>
                    <h3 className="text-2xl font-serif text-white mb-4 italic">"{analysis.title}"</h3>
                    <p className="text-gray-300 leading-relaxed font-sans text-lg border-l-2 border-neon-blue pl-4">
                        {analysis.critique}
                    </p>
                </div>
            )}

            <div className="flex gap-4">
                <button 
                    onClick={onRestart}
                    className="flex-1 bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    <RefreshCw size={20} />
                    New Performance
                </button>
                <button className="px-6 bg-white/5 text-white border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                    <Share2 size={20} />
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Results;