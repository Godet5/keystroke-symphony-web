import React, { useEffect, useRef } from 'react';
import { Particle } from '../types';

interface VisualizerProps {
  active: boolean;
  trigger: number; // Increment to trigger effect
  cursorPosition: { x: number, y: number } | null;
  theme: string;
  intensity: number; // 0.1 to 2.0
}

const Visualizer: React.FC<VisualizerProps> = ({ active, trigger, cursorPosition, theme, intensity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const frameRef = useRef<number>(0);

  const getThemeColors = (themeStr: string): string[] => {
    const t = themeStr.toLowerCase();
    if (t.includes('cyber') || t.includes('neon') || t.includes('future') || t.includes('tokyo')) {
        return ['#00f3ff', '#bc13fe', '#ffffff', '#00ff9d']; // Neon
    }
    if (t.includes('nature') || t.includes('forest') || t.includes('garden') || t.includes('earth')) {
        return ['#4ade80', '#facc15', '#a3e635', '#166534']; // Nature
    }
    if (t.includes('ocean') || t.includes('sea') || t.includes('water') || t.includes('ice') || t.includes('rain')) {
        return ['#60a5fa', '#2dd4bf', '#bae6fd', '#1e3a8a']; // Water
    }
    if (t.includes('fire') || t.includes('dark') || t.includes('metal') || t.includes('hell') || t.includes('rage')) {
        return ['#ef4444', '#f97316', '#b91c1c', '#feb2b2']; // Fire/Dark
    }
    if (t.includes('space') || t.includes('cosmos') || t.includes('star') || t.includes('void')) {
        return ['#e879f9', '#818cf8', '#c084fc', '#ffffff']; // Space
    }
    if (t.includes('love') || t.includes('romance') || t.includes('pink')) {
        return ['#f472b6', '#fb7185', '#fda4af', '#fff1f2']; // Love
    }
    return []; // Default random
  };

  // Spawn particles on trigger
  useEffect(() => {
    if (!cursorPosition) return;
    
    const palette = getThemeColors(theme);
    // Scale particle count by intensity
    const baseCount = 8;
    const count = Math.floor(baseCount * intensity);
    
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = (Math.random() * 2 + 1) * Math.sqrt(intensity);
      
      let color;
      if (palette.length > 0) {
          color = palette[Math.floor(Math.random() * palette.length)];
      } else {
          color = `hsl(${Math.random() * 60 + 180}, 100%, 70%)`;
      }

      particlesRef.current.push({
        id: Math.random(),
        x: cursorPosition.x,
        y: cursorPosition.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color,
        size: (Math.random() * 3 + 1) * intensity
      });
    }
  }, [trigger, cursorPosition, theme, intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
      // Fade out trail - Higher intensity means longer trails (lower alpha fill)
      const fadeAlpha = Math.max(0.05, 0.3 - (intensity * 0.1));
      ctx.fillStyle = `rgba(5, 5, 5, ${fadeAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.size *= 0.95;

        if (p.life <= 0) {
          particlesRef.current.splice(index, 1);
          return;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Ambient floating particles
      // Probability scales with intensity
      if (active && Math.random() > (0.99 - (intensity * 0.08))) {
         const palette = getThemeColors(theme);
         const ambientColor = palette.length > 0 
            ? palette[Math.floor(Math.random() * palette.length)] 
            : 'rgba(255, 255, 255, 0.1)';

         particlesRef.current.push({
            id: Math.random(),
            x: Math.random() * canvas.width,
            y: canvas.height + 10,
            vx: (Math.random() - 0.5) * 0.5 * intensity,
            vy: (-Math.random() * 1 - 0.5) * intensity,
            life: 1.0,
            color: ambientColor,
            size: Math.random() * 2 * intensity
         });
      }

      frameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [active, theme, intensity]);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};

export default Visualizer;