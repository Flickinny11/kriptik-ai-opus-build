/**
 * ProductShowcase.tsx - Product Screenshots in 3D Browser Mockups
 *
 * Showcases actual product screenshots with 3D perspective
 * and interactive zoom features.
 */

import { useState, useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';

// Feature highlights to show on the screenshots
const SHOWCASE_FEATURES = [
  {
    id: 'agent-sidebar',
    title: '6-Agent Sidebar',
    description: 'Real-time progress from all agents working in parallel',
    position: { x: 5, y: 20 },
    color: '#c8ff64',
  },
  {
    id: 'chat-interface',
    title: 'Natural Language',
    description: 'Just describe what you want to build',
    position: { x: 25, y: 40 },
    color: '#3b82f6',
  },
  {
    id: 'live-preview',
    title: 'Live Preview',
    description: 'Watch your app build in real-time',
    position: { x: 65, y: 30 },
    color: '#a855f7',
  },
  {
    id: 'verification',
    title: 'Verification Status',
    description: 'All 6 agents must pass before deploy',
    position: { x: 80, y: 70 },
    color: '#22c55e',
  },
];

// Browser chrome component
function BrowserChrome({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-kriptik-night border border-kriptik-steel/20 shadow-card-3d">
      {/* Browser header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-kriptik-charcoal/50 border-b border-kriptik-steel/20">
        {/* Traffic lights */}
        <div className="flex gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>

        {/* URL bar */}
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1.5 rounded-md bg-kriptik-black/50 text-xs font-mono text-kriptik-silver/50 flex items-center gap-2">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="currentColor" strokeWidth="2" />
            </svg>
            {title || 'kriptik.ai/builder'}
          </div>
        </div>

        {/* Window controls placeholder */}
        <div className="w-16" />
      </div>

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

// Feature hotspot component
function FeatureHotspot({
  feature,
  isActive,
  onClick,
}: {
  feature: typeof SHOWCASE_FEATURES[0];
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      className="absolute z-20"
      style={{ left: `${feature.position.x}%`, top: `${feature.position.y}%` }}
      onClick={onClick}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.9 }}
    >
      {/* Pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: feature.color }}
        animate={{
          scale: [1, 2, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Center dot */}
      <div
        className="relative w-4 h-4 rounded-full border-2 border-kriptik-black"
        style={{ backgroundColor: feature.color }}
      />

      {/* Tooltip */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="absolute left-6 top-0 w-48 p-3 rounded-lg bg-kriptik-black/95 border border-kriptik-steel/30 backdrop-blur-xl"
            style={{ boxShadow: `0 0 20px ${feature.color}20` }}
          >
            <div
              className="text-sm font-display font-bold mb-1"
              style={{ color: feature.color }}
            >
              {feature.title}
            </div>
            <div className="text-xs text-kriptik-silver/70">
              {feature.description}
            </div>

            {/* Arrow */}
            <div
              className="absolute left-0 top-3 w-0 h-0 -translate-x-full border-t-[6px] border-b-[6px] border-r-[8px] border-t-transparent border-b-transparent"
              style={{ borderRightColor: 'rgba(45,45,45,0.95)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// Mock screenshot - In production, replace with actual screenshots
function MockScreenshot() {
  return (
    <div className="aspect-[16/10] bg-kriptik-black relative overflow-hidden">
      {/* Grid background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(200,255,100,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(200,255,100,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Sidebar */}
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-kriptik-charcoal/50 border-r border-kriptik-steel/20 p-4">
        <div className="text-sm font-display font-bold text-kriptik-white mb-4">Agents</div>
        {['Error Checker', 'Code Quality', 'Visual Verifier', 'Security', 'Placeholder', 'Design Style'].map((agent, i) => (
          <div key={agent} className="flex items-center gap-3 mb-3">
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
            />
            <span className="text-xs text-kriptik-silver/70">{agent}</span>
            <div className="ml-auto text-xs text-green-500">100%</div>
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div className="ml-64 p-6">
        {/* Chat messages */}
        <div className="space-y-4 mb-8">
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-kriptik-lime/20 flex items-center justify-center">
              <span className="text-xs">You</span>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-kriptik-steel/20">
              <div className="text-sm text-kriptik-white/80">
                Build a SaaS dashboard with user authentication, real-time analytics, and Stripe billing
              </div>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-kriptik-lime flex items-center justify-center">
              <span className="text-xs text-kriptik-black font-bold">K</span>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-kriptik-lime/10 border border-kriptik-lime/30">
              <div className="text-sm text-kriptik-white/80">
                Building your SaaS dashboard... 6 agents deployed.
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {['Planning', 'Building', 'Testing'].map((phase, i) => (
                  <div key={phase} className="text-xs text-center">
                    <motion.div
                      className="h-1 bg-kriptik-lime rounded-full mb-1"
                      initial={{ width: '0%' }}
                      animate={{ width: i === 1 ? '60%' : i === 0 ? '100%' : '0%' }}
                      transition={{ duration: 1 }}
                    />
                    <span className="text-kriptik-silver/50">{phase}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Code preview */}
        <div className="rounded-lg bg-kriptik-night border border-kriptik-steel/20 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-kriptik-charcoal/30 border-b border-kriptik-steel/20">
            <div className="w-3 h-3 rounded bg-kriptik-lime/20" />
            <span className="text-xs font-mono text-kriptik-silver/50">src/components/Dashboard.tsx</span>
          </div>
          <div className="p-4 font-mono text-xs leading-relaxed">
            <motion.div
              className="text-kriptik-lime/70"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              // Building authentication flow...
            </motion.div>
            <div className="text-purple-400">import</div>
            <span className="text-kriptik-white/70"> {'{'} useState {'}'} </span>
            <span className="text-purple-400">from</span>
            <span className="text-green-400"> 'react'</span>
          </div>
        </div>
      </div>

      {/* Right panel - Live preview */}
      <div className="absolute right-0 top-0 bottom-0 w-72 bg-kriptik-charcoal/30 border-l border-kriptik-steel/20 p-4">
        <div className="text-sm font-display font-bold text-kriptik-white mb-4">Live Preview</div>
        <div className="aspect-[4/3] rounded-lg bg-kriptik-black border border-kriptik-steel/20 overflow-hidden">
          {/* Mini preview content */}
          <div className="h-8 bg-kriptik-charcoal/50 flex items-center px-3">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
              <div className="w-2 h-2 rounded-full bg-green-500/50" />
            </div>
          </div>
          <div className="p-3">
            <motion.div
              className="w-full h-4 rounded bg-kriptik-lime/20 mb-2"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <div className="w-2/3 h-2 rounded bg-kriptik-steel/30 mb-4" />
            <div className="grid grid-cols-2 gap-2">
              <div className="h-16 rounded bg-kriptik-steel/20" />
              <div className="h-16 rounded bg-kriptik-steel/20" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeFeature, setActiveFeature] = useState<string | null>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -10]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1, 0.9]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);

  const springRotateX = useSpring(rotateX, { damping: 20, stiffness: 100 });
  const springScale = useSpring(scale, { damping: 20, stiffness: 100 });

  return (
    <section ref={containerRef} className="relative py-32 md:py-48 overflow-hidden bg-kriptik-black">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-cyan mb-4 block">
            Developer Mode
          </span>
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white mb-6">
            Watch It<br />
            <span className="text-kriptik-lime">Build</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-kriptik-silver/70">
            Not a black box. See every agent work in real-time, every line of code generated,
            every test passed. Full transparency, full control.
          </p>
        </motion.div>

        {/* 3D Browser mockup */}
        <motion.div
          className="relative max-w-5xl mx-auto"
          style={{
            rotateX: springRotateX,
            scale: springScale,
            opacity,
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          <BrowserChrome title="kriptik.ai/builder">
            <MockScreenshot />

            {/* Feature hotspots */}
            {SHOWCASE_FEATURES.map((feature) => (
              <FeatureHotspot
                key={feature.id}
                feature={feature}
                isActive={activeFeature === feature.id}
                onClick={() => setActiveFeature(
                  activeFeature === feature.id ? null : feature.id
                )}
              />
            ))}
          </BrowserChrome>

          {/* Reflection */}
          <div
            className="absolute -bottom-32 left-0 right-0 h-32 opacity-20"
            style={{
              background: 'linear-gradient(to bottom, rgba(200,255,100,0.1) 0%, transparent 100%)',
              transform: 'scaleY(-1) translateY(-100%)',
              filter: 'blur(20px)',
            }}
          />
        </motion.div>

        {/* Feature list below */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
        >
          {SHOWCASE_FEATURES.map((feature) => (
            <motion.button
              key={feature.id}
              onClick={() => setActiveFeature(
                activeFeature === feature.id ? null : feature.id
              )}
              className={`
                p-4 rounded-xl text-left transition-all duration-300
                ${activeFeature === feature.id
                  ? 'bg-kriptik-night border-2'
                  : 'bg-kriptik-charcoal/30 border border-kriptik-steel/20 hover:border-kriptik-steel/40'
                }
              `}
              style={{
                borderColor: activeFeature === feature.id ? feature.color : undefined,
              }}
              whileHover={{ y: -4 }}
            >
              <div
                className="w-2 h-2 rounded-full mb-3"
                style={{ backgroundColor: feature.color }}
              />
              <div className="text-sm font-display font-bold text-kriptik-white mb-1">
                {feature.title}
              </div>
              <div className="text-xs text-kriptik-silver/60">
                {feature.description}
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

export default ProductShowcase;

