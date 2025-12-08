/**
 * FinalCTA.tsx - Epic Conclusion Section
 * 
 * Final call-to-action with dramatic visuals,
 * 3D glass spheres, and urgency messaging.
 */

import { useRef, lazy, Suspense } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { MagneticCTA, ArrowIcon } from '../3d';

// Lazy load 3D elements
const Scene3D = lazy(() => import('../3d/Scene').then(m => ({ default: m.Scene3D })));
const GlassSphereCluster = lazy(() => import('../3d/GlassSphere').then(m => ({ default: m.GlassSphereCluster })));

// Animated agent indicators
function AgentWaiting({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
    >
      <motion.div
        className="w-2 h-2 rounded-full bg-kriptik-lime"
        animate={{ 
          scale: [1, 1.3, 1],
          opacity: [1, 0.5, 1],
        }}
        transition={{ duration: 1.5, repeat: Infinity, delay: delay * 0.5 }}
      />
      <span className="text-xs font-mono text-kriptik-silver/60">Ready</span>
    </motion.div>
  );
}

// Email capture form
function EmailCapture() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.6, duration: 0.6 }}
      className="max-w-md mx-auto mt-8"
    >
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="email"
            placeholder="Enter your email"
            className="w-full px-4 py-3 rounded-full bg-kriptik-charcoal/50 border border-kriptik-steel/30 text-kriptik-white placeholder:text-kriptik-silver/40 focus:outline-none focus:border-kriptik-lime/50 transition-colors"
          />
        </div>
        <button className="px-6 py-3 rounded-full bg-kriptik-lime text-kriptik-black font-semibold hover:bg-kriptik-lime/90 transition-colors">
          Notify Me
        </button>
      </div>
      <p className="text-xs text-kriptik-silver/40 mt-3 text-center">
        Get notified when we launch new features. No spam, ever.
      </p>
    </motion.div>
  );
}

export function FinalCTA() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });
  
  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  
  const springY = useSpring(y, { damping: 20, stiffness: 100 });
  const springScale = useSpring(scale, { damping: 20, stiffness: 100 });

  return (
    <section
      ref={containerRef}
      className="relative py-48 md:py-64 overflow-hidden bg-kriptik-black"
    >
      {/* Dramatic gradient background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(circle at 50% 50%, rgba(200,255,100,0.1) 0%, transparent 50%),
              radial-gradient(circle at 30% 70%, rgba(245,158,11,0.08) 0%, transparent 40%),
              radial-gradient(circle at 70% 30%, rgba(6,182,212,0.05) 0%, transparent 40%)
            `,
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        
        {/* Noise overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      {/* 3D Glass spheres */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}>
          <Scene3D camera={{ position: [0, 0, 15], fov: 40 }}>
            <GlassSphereCluster 
              count={5} 
              spread={20} 
              minScale={0.8} 
              maxScale={3} 
            />
          </Scene3D>
        </Suspense>
      </div>
      
      {/* Content */}
      <motion.div
        className="relative z-10 max-w-4xl mx-auto px-6 text-center"
        style={{ y: springY, scale: springScale, opacity }}
      >
        {/* Agents waiting indicator */}
        <motion.div
          className="flex items-center justify-center gap-6 mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          {[...Array(6)].map((_, i) => (
            <AgentWaiting key={i} delay={i * 0.1} />
          ))}
        </motion.div>
        
        <motion.span
          className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-lime block mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          6 Agents Standing By
        </motion.span>
        
        {/* Main headline */}
        <motion.h2
          className="text-display-sm md:text-display-lg font-display font-bold text-kriptik-white mb-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          Your Next App<br />
          <span className="text-kriptik-lime">Is Already Building</span>
        </motion.h2>
        
        {/* Subtext */}
        <motion.p
          className="text-lg md:text-xl text-kriptik-silver/70 max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          Stop babysitting code. Start shipping products. 
          Join thousands of builders who've already made the switch.
        </motion.p>
        
        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <MagneticCTA
            text="Start Building for Free"
            variant="primary"
            size="xl"
            icon={<ArrowIcon />}
            onClick={() => window.location.href = '/signup'}
            magneticStrength={0.4}
          />
        </motion.div>
        
        {/* Secondary option */}
        <motion.div
          className="mt-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <button 
            className="text-sm text-kriptik-silver/60 hover:text-kriptik-lime transition-colors"
            onClick={() => {
              document.getElementById('agents-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            or watch agents work first →
          </button>
        </motion.div>
        
        {/* Email capture alternative */}
        <EmailCapture />
        
        {/* Social proof */}
        <motion.div
          className="mt-16 flex items-center justify-center gap-8 flex-wrap"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-kriptik-black flex items-center justify-center text-xs font-bold"
                  style={{ 
                    backgroundColor: ['#c8ff64', '#f59e0b', '#3b82f6', '#a855f7'][i],
                    color: '#0a0a0a',
                    zIndex: 4 - i,
                  }}
                >
                  {['K', 'A', 'J', 'M'][i]}
                </div>
              ))}
            </div>
            <span className="text-sm text-kriptik-silver/60">
              <span className="text-kriptik-white font-medium">2,000+</span> builders this month
            </span>
          </div>
          
          <div className="h-6 w-px bg-kriptik-steel/30 hidden md:block" />
          
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-4 h-4"
                  initial={{ opacity: 0, scale: 0 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                >
                  <svg viewBox="0 0 20 20" fill="#c8ff64">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </motion.div>
              ))}
            </div>
            <span className="text-sm text-kriptik-silver/60">
              <span className="text-kriptik-white font-medium">4.9</span> average rating
            </span>
          </div>
        </motion.div>
      </motion.div>
      
      {/* Bottom gradient fade into footer */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-kriptik-charcoal to-transparent" />
    </section>
  );
}

export default FinalCTA;

