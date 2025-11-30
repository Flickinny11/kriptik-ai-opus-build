import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  color: string;
}

interface GenerateButton3DProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const GenerateButton3D = ({ onClick, disabled, className }: GenerateButton3DProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [heatLevel, setHeatLevel] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Heating up animation on hover
  useEffect(() => {
    if (isHovered && !disabled) {
      hoverTimerRef.current = setInterval(() => {
        setHeatLevel(prev => Math.min(prev + 0.1, 1));
      }, 50);
    } else {
      if (hoverTimerRef.current) {
        clearInterval(hoverTimerRef.current);
      }
      setHeatLevel(0);
    }
    return () => {
      if (hoverTimerRef.current) {
        clearInterval(hoverTimerRef.current);
      }
    };
  }, [isHovered, disabled]);

  // Shatter into particles effect
  const createParticles = useCallback(() => {
    if (!buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const colors = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fee2e2', '#991b1b'];
    const newParticles: Particle[] = [];

    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.5;
      const velocity = 3 + Math.random() * 5;
      newParticles.push({
        id: i,
        x: centerX + (Math.random() - 0.5) * 40,
        y: centerY + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 2,
        size: 3 + Math.random() * 6,
        opacity: 1,
        rotation: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    setParticles(newParticles);
    setIsClicked(true);

    // Animate particles
    const animateParticles = () => {
      setParticles(prev => {
        const updated = prev.map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.3, // gravity
          opacity: p.opacity - 0.025,
          rotation: p.rotation + 5,
        })).filter(p => p.opacity > 0);

        if (updated.length === 0) {
          setIsClicked(false);
        }
        return updated;
      });
    };

    const interval = setInterval(animateParticles, 16);
    setTimeout(() => {
      clearInterval(interval);
      setParticles([]);
      setIsClicked(false);
    }, 1500);
  }, []);

  const handleClick = () => {
    if (disabled) return;
    createParticles();
    onClick();
  };

  // Calculate heat glow color
  const heatGlow = `rgba(220, 38, 38, ${heatLevel * 0.6})`;
  const heatBorder = `rgba(239, 68, 68, ${0.3 + heatLevel * 0.4})`;

  return (
    <div className={cn("relative", className)}>
      {/* Particles */}
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute pointer-events-none z-50"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            transform: `rotate(${p.rotation}deg) scale(${p.opacity})`,
            background: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            boxShadow: `0 0 ${p.size}px ${p.color}`,
          }}
        />
      ))}

      <button
        ref={buttonRef}
        onClick={handleClick}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative overflow-hidden",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          isClicked && "scale-95"
        )}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '14px 32px',
          borderRadius: '16px',
          border: `2px solid ${heatBorder}`,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'Syne, sans-serif',
          fontSize: '15px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: '#fff',
          background: `linear-gradient(
            145deg,
            rgba(220, 38, 38, ${0.7 + heatLevel * 0.2}) 0%,
            rgba(185, 28, 28, ${0.8 + heatLevel * 0.15}) 50%,
            rgba(153, 27, 27, ${0.85 + heatLevel * 0.1}) 100%
          )`,
          backdropFilter: 'blur(8px)',
          boxShadow: `
            0 ${6 + heatLevel * 4}px 0 rgba(127, 29, 29, 0.8),
            0 ${12 + heatLevel * 8}px ${24 + heatLevel * 16}px rgba(220, 38, 38, ${0.3 + heatLevel * 0.3}),
            inset 0 1px 0 rgba(255, 255, 255, ${0.2 + heatLevel * 0.1}),
            inset 0 -2px 0 rgba(0, 0, 0, 0.2),
            0 0 ${heatLevel * 30}px ${heatGlow}
          `,
          transform: `
            perspective(800px)
            rotateX(${isHovered ? 0 : 3}deg)
            rotateY(${isHovered ? 0 : -2}deg)
            translateY(${isHovered ? -4 : 0}px)
            scale(${isClicked ? 0.95 : 1})
          `,
          transformStyle: 'preserve-3d',
          transition: isClicked
            ? 'transform 0.1s ease-out'
            : 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        {/* Shine effect */}
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-[14px]"
          style={{
            background: `linear-gradient(
              105deg,
              transparent 20%,
              rgba(255, 255, 255, ${0.15 + heatLevel * 0.1}) 45%,
              rgba(255, 255, 255, ${0.25 + heatLevel * 0.15}) 50%,
              rgba(255, 255, 255, ${0.15 + heatLevel * 0.1}) 55%,
              transparent 80%
            )`,
            transform: `translateX(${isHovered ? '100%' : '-100%'})`,
            transition: 'transform 0.8s ease-in-out',
          }}
        />

        {/* Heat glow overlay */}
        {heatLevel > 0 && (
          <div
            className="absolute inset-0 pointer-events-none rounded-[14px]"
            style={{
              background: `radial-gradient(
                ellipse at center,
                rgba(252, 165, 165, ${heatLevel * 0.2}) 0%,
                transparent 70%
              )`,
              animation: 'pulse 0.5s ease-in-out infinite',
            }}
          />
        )}

        {/* 3D Edge - Top */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[14px] pointer-events-none"
          style={{
            background: `linear-gradient(90deg,
              rgba(255,255,255,0.1) 0%,
              rgba(255,255,255,${0.3 + heatLevel * 0.2}) 50%,
              rgba(255,255,255,0.1) 100%
            )`,
          }}
        />

        {/* 3D Edge - Bottom (depth) */}
        <div
          className="absolute -bottom-[6px] left-[4px] right-[4px] h-[8px] rounded-b-[12px] pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(127, 29, 29, 0.9) 0%, rgba(69, 10, 10, 1) 100%)',
            transform: 'perspective(100px) rotateX(-15deg)',
            transformOrigin: 'top center',
          }}
        />

        {/* Button text */}
        <span className="relative z-10" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
          Generate
        </span>
      </button>

      {/* Keyframes for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default GenerateButton3D;

