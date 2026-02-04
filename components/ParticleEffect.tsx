
import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  glow: boolean;
}

interface ParticleEffectProps {
  trigger: boolean;
}

const ParticleEffect: React.FC<ParticleEffectProps> = ({ trigger }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationRef = useRef<number>(null);

  const colors = ['#22d3ee', '#6366f1', '#ffffff', '#a855f7'];

  const createExplosion = (width: number, height: number) => {
    const count = 150;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 2;
      const life = Math.random() * 60 + 40;
      
      particles.current.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        size: Math.random() * 4 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        glow: Math.random() > 0.5
      });
    }
  };

  const update = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // Gravity
      p.vx *= 0.98; // Friction
      p.life--;

      if (p.life <= 0) {
        particles.current.splice(i, 1);
        continue;
      }

      const opacity = p.life / p.maxLife;
      ctx.globalAlpha = opacity;
      
      if (p.glow) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
      } else {
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    if (particles.current.length > 0) {
      animationRef.current = requestAnimationFrame(update);
    }
  };

  useEffect(() => {
    if (trigger) {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        createExplosion(canvas.width, canvas.height);
        if (!animationRef.current || particles.current.length === 0) {
          update();
        }
      }
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[60]"
      style={{ mixBlendMode: 'screen' }}
    />
  );
};

export default ParticleEffect;
