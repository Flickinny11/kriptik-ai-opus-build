/**
 * Hero3D.tsx - Premium 3D Hero Section
 * 
 * Full-viewport hero with floating glass spheres,
 * split text animation, and atmospheric particles.
 */

import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { MagneticButton, MagneticCTA, ArrowIcon } from '../3d';

// Lazy load 3D scene for performance
const Scene3D = lazy(() => import('../3d/Scene').then(m => ({ default: m.Scene3D })));
const GlassSphereCluster = lazy(() => import('../3d/GlassSphere').then(m => ({ default: m.GlassSphereCluster })));
const ParticleField = lazy(() => import('../3d/ParticleField').then(m => ({ default: m.ParticleField })));

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

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-kriptik-black"
    >
      {/* Background layers */}
      <GradientMesh />
      <NoiseOverlay />
      
      {/* 3D Scene - Glass spheres and particles */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <Scene3D camera={{ position: [0, 0, 12], fov: 50 }}>
            <GlassSphereCluster 
              count={7} 
              spread={12} 
              minScale={0.4} 
              maxScale={2} 
            />
            <ParticleField 
              count={300} 
              spread={25} 
              opacity={0.4}
              color="#c8ff64"
            />
          </Scene3D>
        </Suspense>
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
          <MagneticCTA
            text="Start Building"
            variant="primary"
            size="lg"
            icon={<ArrowIcon />}
            onClick={() => window.location.href = '/signup'}
          />
          
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

