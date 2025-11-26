/**
 * Atmospheric Background Component
 *
 * Creates immersive, premium background effects
 * - Gradient orbs with animation
 * - Noise texture overlay
 * - Grid patterns
 * - Particle effects (optional)
 */

import React from 'react';
import { cn } from '@/lib/utils';

interface AtmosphericBackgroundProps {
  variant?: 'default' | 'subtle' | 'dramatic' | 'grid' | 'mesh';
  className?: string;
  children?: React.ReactNode;
  animated?: boolean;
}

export const AtmosphericBackground: React.FC<AtmosphericBackgroundProps> = ({
  variant = 'default',
  className,
  children,
  animated = true,
}) => {
  return (
    <div className={cn('relative min-h-screen overflow-hidden', className)}>
      {/* Base background */}
      <div className="absolute inset-0 bg-background" />

      {/* Variant-specific effects */}
      {variant === 'default' && <DefaultEffect animated={animated} />}
      {variant === 'subtle' && <SubtleEffect animated={animated} />}
      {variant === 'dramatic' && <DramaticEffect animated={animated} />}
      {variant === 'grid' && <GridEffect animated={animated} />}
      {variant === 'mesh' && <MeshEffect animated={animated} />}

      {/* Noise overlay */}
      <div
        className="absolute inset-0 opacity-[var(--noise-opacity)] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: 'overlay',
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

const DefaultEffect: React.FC<{ animated: boolean }> = ({ animated }) => (
  <>
    {/* Primary gradient orb - top left */}
    <div
      className={cn(
        "absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full",
        "bg-gradient-to-br from-primary/20 via-primary/10 to-transparent",
        "blur-3xl",
        animated && "animate-pulse"
      )}
      style={{ animationDuration: '8s' }}
    />

    {/* Accent gradient orb - bottom right */}
    <div
      className={cn(
        "absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full",
        "bg-gradient-to-tl from-accent/15 via-accent/5 to-transparent",
        "blur-3xl",
        animated && "animate-pulse"
      )}
      style={{ animationDuration: '10s', animationDelay: '2s' }}
    />

    {/* Subtle center glow */}
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50%] h-[50%] rounded-full
        bg-gradient-to-r from-primary/5 via-transparent to-accent/5 blur-3xl"
    />
  </>
);

const SubtleEffect: React.FC<{ animated: boolean }> = ({ animated }) => (
  <>
    {/* Very soft gradient at top */}
    <div
      className={cn(
        "absolute -top-[50%] left-1/2 -translate-x-1/2 w-[120%] h-[60%] rounded-full",
        "bg-gradient-to-b from-primary/8 via-primary/3 to-transparent",
        "blur-[100px]",
        animated && "animate-pulse"
      )}
      style={{ animationDuration: '12s' }}
    />

    {/* Soft vignette effect */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 0%, var(--background) 100%)',
        opacity: 0.4,
      }}
    />
  </>
);

const DramaticEffect: React.FC<{ animated: boolean }> = ({ animated }) => (
  <>
    {/* Large primary orb */}
    <div
      className={cn(
        "absolute -top-[40%] -left-[30%] w-[90%] h-[90%] rounded-full",
        "bg-gradient-to-br from-primary/30 via-primary/15 to-transparent",
        "blur-[80px]",
        animated && "animate-float-slow"
      )}
    />

    {/* Accent orb */}
    <div
      className={cn(
        "absolute -bottom-[40%] -right-[30%] w-[80%] h-[80%] rounded-full",
        "bg-gradient-to-tl from-accent/25 via-accent/10 to-transparent",
        "blur-[80px]",
        animated && "animate-float-slow"
      )}
      style={{ animationDelay: '-3s' }}
    />

    {/* Central highlight */}
    <div
      className={cn(
        "absolute top-[20%] left-1/2 -translate-x-1/2 w-[40%] h-[30%] rounded-full",
        "bg-gradient-to-b from-white/5 via-white/2 to-transparent",
        "blur-[60px]"
      )}
    />

    {/* Rays effect */}
    <div
      className="absolute inset-0 opacity-10"
      style={{
        background: `conic-gradient(from 0deg at 50% 0%, transparent 0deg, var(--primary) 20deg, transparent 40deg, transparent 140deg, var(--accent) 160deg, transparent 180deg, transparent 320deg, var(--primary) 340deg, transparent 360deg)`,
        filter: 'blur(60px)',
      }}
    />
  </>
);

const GridEffect: React.FC<{ animated: boolean }> = ({ animated }) => (
  <>
    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
      style={{
        backgroundImage: `
          linear-gradient(var(--foreground) 1px, transparent 1px),
          linear-gradient(90deg, var(--foreground) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }}
    />

    {/* Fading radial overlay */}
    <div
      className="absolute inset-0"
      style={{
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, transparent 0%, var(--background) 100%)',
      }}
    />

    {/* Soft glow at top */}
    <div
      className={cn(
        "absolute -top-[30%] left-1/2 -translate-x-1/2 w-[80%] h-[50%] rounded-full",
        "bg-gradient-to-b from-primary/15 to-transparent",
        "blur-[80px]",
        animated && "animate-pulse"
      )}
      style={{ animationDuration: '6s' }}
    />
  </>
);

const MeshEffect: React.FC<{ animated: boolean }> = ({ animated }) => (
  <>
    {/* Mesh gradient background */}
    <div
      className={cn(
        "absolute inset-0",
        animated && "animate-mesh"
      )}
      style={{
        backgroundImage: `
          radial-gradient(at 40% 20%, oklch(75% 0.18 70 / 15%) 0px, transparent 50%),
          radial-gradient(at 80% 0%, oklch(70% 0.14 175 / 12%) 0px, transparent 50%),
          radial-gradient(at 0% 50%, oklch(75% 0.18 70 / 10%) 0px, transparent 50%),
          radial-gradient(at 80% 50%, oklch(65% 0.18 25 / 8%) 0px, transparent 50%),
          radial-gradient(at 0% 100%, oklch(70% 0.14 175 / 10%) 0px, transparent 50%),
          radial-gradient(at 80% 100%, oklch(75% 0.18 70 / 12%) 0px, transparent 50%),
          radial-gradient(at 0% 0%, oklch(65% 0.18 25 / 8%) 0px, transparent 50%)
        `,
        backgroundSize: '200% 200%',
      }}
    />

    {/* Subtle noise for texture */}
    <div
      className="absolute inset-0 opacity-30"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        mixBlendMode: 'soft-light',
      }}
    />
  </>
);

// Add keyframes via style injection
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes float-slow {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(2%, -2%) scale(1.02); }
    50% { transform: translate(-1%, 1%) scale(0.98); }
    75% { transform: translate(1%, 2%) scale(1.01); }
  }

  @keyframes mesh {
    0%, 100% { background-position: 0% 0%; }
    25% { background-position: 100% 0%; }
    50% { background-position: 100% 100%; }
    75% { background-position: 0% 100%; }
  }

  .animate-float-slow {
    animation: float-slow 20s ease-in-out infinite;
  }

  .animate-mesh {
    animation: mesh 30s ease infinite;
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('atmospheric-styles')) {
  styleSheet.id = 'atmospheric-styles';
  document.head.appendChild(styleSheet);
}

export default AtmosphericBackground;

