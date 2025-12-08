/**
 * Hero3D.tsx - Premium Hero Section
 *
 * Full-viewport hero with CSS-based glass effects,
 * split text animation, and atmospheric particles.
 * Uses pure CSS/Framer Motion for maximum compatibility.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';

// Split text animation component
function SplitText({
  text,
  className = '',
  delay = 0,
  stagger = 0.05,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const words = text.split(' ');

  return (
    <span className={`inline-flex flex-wrap ${className}`}>
      {words.map((word, wordIndex) => (
        <span key={wordIndex} className="inline-block overflow-hidden mr-[0.25em]">
          <motion.span
            className="inline-block"
            initial={{ y: '110%', rotateX: -80 }}
            animate={{ y: 0, rotateX: 0 }}
            transition={{
              duration: 0.8,
              delay: delay + wordIndex * stagger,
              ease: [0.23, 1, 0.32, 1],
            }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

// Animated badge component
function PremiumBadge({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, ease: [0.23, 1, 0.32, 1] }}
      className="relative inline-flex"
    >
      {/* Geometric frame badge - NOT a pill */}
      <div className="relative px-4 py-2 bg-kriptik-night/80 backdrop-blur-sm border border-kriptik-lime/30">
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-kriptik-lime" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-kriptik-lime" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-kriptik-lime" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-kriptik-lime" />

        <span className="text-xs font-mono uppercase tracking-[0.2em] text-kriptik-lime">
          The Autonomous Builder
        </span>
      </div>
    </motion.div>
  );
}

// Scroll indicator
function ScrollIndicator() {
  return (
    <motion.div
      className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 2 }}
    >
      <span className="text-xs font-mono uppercase tracking-widest text-kriptik-silver/60">
        Scroll to see how
      </span>
      <motion.div
        className="w-px h-12 bg-gradient-to-b from-kriptik-lime/50 to-transparent"
        animate={{ scaleY: [1, 0.5, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="w-6 h-10 rounded-full border-2 border-kriptik-silver/30 flex justify-center pt-2"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="w-1.5 h-1.5 rounded-full bg-kriptik-lime"
          animate={{ y: [0, 12, 0], opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  );
}

// Noise texture overlay
function NoiseOverlay() {
  return (
    <div
      className="absolute inset-0 opacity-[0.03] pointer-events-none z-10"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

// Gradient mesh background
function GradientMesh() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Primary gradient */}
      <motion.div
        className="absolute -top-1/2 -right-1/4 w-[80vw] h-[80vw] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, rgba(200,255,100,0.3) 0%, transparent 60%)',
          filter: 'blur(100px)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 10, 0],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Secondary gradient */}
      <motion.div
        className="absolute -bottom-1/4 -left-1/4 w-[60vw] h-[60vw] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.3) 0%, transparent 60%)',
          filter: 'blur(80px)',
        }}
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, -15, 0],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />

      {/* Accent gradient */}
      <motion.div
        className="absolute top-1/4 left-1/3 w-[40vw] h-[40vw] rounded-full opacity-10"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, transparent 60%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

// CSS-based glass sphere (no Three.js)
function CSSGlassSphere({
  size,
  top,
  left,
  delay = 0,
  color = 'lime',
}: {
  size: number;
  top: string;
  left: string;
  delay?: number;
  color?: 'lime' | 'amber' | 'cyan' | 'white';
}) {
  const colorMap = {
    lime: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(200,255,100,0.4), rgba(200,255,100,0.1) 50%, transparent 70%)',
      glow: 'rgba(200,255,100,0.3)',
      highlight: 'rgba(200,255,100,0.8)',
    },
    amber: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(245,158,11,0.4), rgba(245,158,11,0.1) 50%, transparent 70%)',
      glow: 'rgba(245,158,11,0.3)',
      highlight: 'rgba(245,158,11,0.8)',
    },
    cyan: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(6,182,212,0.4), rgba(6,182,212,0.1) 50%, transparent 70%)',
      glow: 'rgba(6,182,212,0.3)',
      highlight: 'rgba(6,182,212,0.8)',
    },
    white: {
      gradient: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), rgba(255,255,255,0.1) 50%, transparent 70%)',
      glow: 'rgba(255,255,255,0.2)',
      highlight: 'rgba(255,255,255,0.9)',
    },
  };

  const colors = colorMap[color];

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        width: size,
        height: size,
        top,
        left,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ 
        opacity: 1, 
        scale: 1,
        y: [0, -20, 0],
        x: [0, 10, 0],
      }}
      transition={{
        opacity: { duration: 1, delay },
        scale: { duration: 1.2, delay },
        y: { duration: 8 + Math.random() * 4, repeat: Infinity, ease: 'easeInOut', delay },
        x: { duration: 10 + Math.random() * 5, repeat: Infinity, ease: 'easeInOut', delay },
      }}
    >
      {/* Outer glow */}
      <div 
        className="absolute inset-0 rounded-full"
        style={{
          background: colors.glow,
          filter: 'blur(40px)',
          transform: 'scale(1.5)',
        }}
      />
      
      {/* Glass sphere */}
      <div 
        className="absolute inset-0 rounded-full backdrop-blur-sm"
        style={{
          background: colors.gradient,
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: `
            inset 0 0 60px rgba(255,255,255,0.05),
            0 0 40px ${colors.glow}
          `,
        }}
      />
      
      {/* Highlight */}
      <div 
        className="absolute rounded-full"
        style={{
          width: size * 0.15,
          height: size * 0.15,
          top: '20%',
          left: '25%',
          background: colors.highlight,
          filter: 'blur(4px)',
        }}
      />
      
      {/* Secondary highlight */}
      <div 
        className="absolute rounded-full"
        style={{
          width: size * 0.08,
          height: size * 0.08,
          top: '35%',
          left: '35%',
          background: 'rgba(255,255,255,0.6)',
          filter: 'blur(2px)',
        }}
      />
    </motion.div>
  );
}

// CSS Particle system
function CSSParticles() {
  const particles = Array.from({ length: 50 }).map((_, i) => ({
    id: i,
    size: 2 + Math.random() * 4,
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    delay: Math.random() * 5,
    duration: 10 + Math.random() * 10,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-kriptik-lime/40"
          style={{
            width: p.size,
            height: p.size,
            top: p.top,
            left: p.left,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.6, 0],
            y: [0, -100],
            x: [0, Math.random() * 40 - 20],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}

// Magnetic button effect (CSS only)
interface MagneticButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

function MagneticButton({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setPosition({ x: x * 0.3, y: y * 0.3 });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const baseClasses = `
    relative overflow-hidden font-medium transition-all duration-300
    ${sizeClasses[size]}
  `;

  const variantClasses = {
    primary: `
      bg-kriptik-lime text-kriptik-black
      hover:bg-kriptik-lime/90
      shadow-[0_0_30px_rgba(200,255,100,0.3)]
      hover:shadow-[0_0_50px_rgba(200,255,100,0.5)]
    `,
    outline: `
      bg-transparent text-kriptik-white
      border border-kriptik-silver/30
      hover:border-kriptik-lime/50 hover:text-kriptik-lime
    `,
  };

  return (
    <motion.button
      ref={buttonRef}
      className={`${baseClasses} ${variantClasses[variant]}`}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ x: position.x, y: position.y }}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
    >
      <span className="relative z-10 flex items-center gap-2">
        {children}
      </span>
    </motion.button>
  );
}

function ArrowIcon() {
  return (
    <svg 
      width="20" 
      height="20" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

export function Hero3D() {
  const containerRef = useRef<HTMLDivElement>(null);
  useInView(containerRef, { once: true });
  const [isLoaded, setIsLoaded] = useState(false);

  // Parallax effect on scroll
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  const springY = useSpring(y, { damping: 20, stiffness: 100 });

  useEffect(() => {
    // Simulate load completion
    const timer = setTimeout(() => setIsLoaded(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Glass sphere configurations
  const spheres = [
    { size: 200, top: '10%', left: '80%', delay: 0.2, color: 'lime' as const },
    { size: 120, top: '60%', left: '5%', delay: 0.4, color: 'amber' as const },
    { size: 80, top: '20%', left: '15%', delay: 0.6, color: 'cyan' as const },
    { size: 150, top: '70%', left: '85%', delay: 0.3, color: 'white' as const },
    { size: 60, top: '40%', left: '90%', delay: 0.5, color: 'lime' as const },
    { size: 100, top: '80%', left: '40%', delay: 0.7, color: 'amber' as const },
    { size: 40, top: '15%', left: '60%', delay: 0.8, color: 'cyan' as const },
  ];

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-kriptik-black"
    >
      {/* Background layers */}
      <GradientMesh />
      <NoiseOverlay />
      <CSSParticles />

      {/* CSS Glass spheres */}
      <div className="absolute inset-0 z-0">
        {spheres.map((sphere, i) => (
          <CSSGlassSphere key={i} {...sphere} />
        ))}
      </div>

      {/* Main content */}
      <motion.div
        className="relative z-20 max-w-7xl mx-auto px-6 text-center"
        style={{ y: springY, opacity, scale }}
      >
        {/* Badge */}
        <div className="mb-8">
          <PremiumBadge delay={0.3} />
        </div>

        {/* Main headline */}
        <h1 className="font-display font-bold text-kriptik-white mb-6">
          {/* Mobile */}
          <span className="block md:hidden text-display-sm">
            <SplitText text="SHIP APPS" delay={0.6} />
            <br />
            <SplitText text="WHILE YOU" delay={0.8} />
            <br />
            <span className="text-kriptik-lime">
              <SplitText text="SLEEP" delay={1} />
            </span>
          </span>

          {/* Desktop */}
          <span className="hidden md:block lg:hidden text-display-md">
            <SplitText text="SHIP APPS" delay={0.6} />
            <br />
            <SplitText text="WHILE YOU " delay={0.8} />
            <span className="text-kriptik-lime">
              <SplitText text="SLEEP" delay={1} />
            </span>
          </span>

          {/* Large desktop */}
          <span className="hidden lg:block text-display-lg xl:text-display-xl">
            <SplitText text="SHIP APPS" delay={0.6} />
            <br />
            <SplitText text="WHILE YOU " delay={0.8} />
            <span className="text-kriptik-lime">
              <SplitText text="SLEEP" delay={1} />
            </span>
          </span>
        </h1>

        {/* Subheadline */}
        <motion.p
          className="max-w-2xl mx-auto text-lg md:text-xl lg:text-2xl text-kriptik-silver/80 font-light mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={isLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.3, ease: [0.23, 1, 0.32, 1] }}
        >
          6 AI agents work in parallel. They plan, code, test, and deploy
          production apps—while you do literally anything else.
        </motion.p>

        {/* CTAs */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isLoaded ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 1.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <MagneticButton
            variant="primary"
            size="lg"
            onClick={() => window.location.href = '/signup'}
          >
            Start Building
            <ArrowIcon />
          </MagneticButton>

          <MagneticButton
            variant="outline"
            size="lg"
            onClick={() => {
              document.getElementById('agents-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            See Agents Work
          </MagneticButton>
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-16"
          initial={{ opacity: 0 }}
          animate={isLoaded ? { opacity: 1 } : {}}
          transition={{ duration: 0.8, delay: 2 }}
        >
          {[
            { value: '6', label: 'Parallel Agents' },
            { value: '<3min', label: 'Lightning Builds' },
            { value: '0', label: 'Error Tolerance' },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl md:text-3xl font-display font-bold text-kriptik-lime">
                {stat.value}
              </div>
              <div className="text-xs uppercase tracking-widest text-kriptik-silver/60 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <ScrollIndicator />

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-kriptik-black to-transparent z-10" />
    </section>
  );
}

export default Hero3D;
