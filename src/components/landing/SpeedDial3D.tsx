/**
 * SpeedDial3D.tsx - Interactive 3D Speed Dial
 *
 * An interactive dial that showcases the 4 build modes:
 * Lightning, Standard, Tournament, Production
 */

import { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';

// Build modes data - icons stored as descriptors, rendered via SVG
const BUILD_MODES = [
  {
    id: 'lightning',
    name: 'Lightning',
    time: '<3 minutes',
    description: 'Prototype in seconds. Basic structure, rapid ideation. Perfect for quick concepts.',
    color: '#c8ff64',
    features: ['Rapid scaffolding', 'Basic structure', 'Quick iteration', 'Instant preview'],
    agents: 2,
    icon: 'zap',
  },
  {
    id: 'standard',
    name: 'Standard',
    time: '~15 minutes',
    description: 'MVP in minutes. Working features, real functionality. Ship something real.',
    color: '#3b82f6',
    features: ['Full functionality', 'Error checking', 'Basic testing', 'Deployment ready'],
    agents: 4,
    icon: 'target',
  },
  {
    id: 'tournament',
    name: 'Tournament',
    time: '~30 minutes',
    description: 'Best-of-breed. Competing implementations battle. AI judges select winner.',
    color: '#f59e0b',
    features: ['3 competing builds', 'AI judge selection', 'Best patterns', 'Optimal solution'],
    agents: 6,
    icon: 'trophy',
  },
  {
    id: 'production',
    name: 'Production',
    time: '~60 minutes',
    description: 'Enterprise-ready. Full verification swarm. Security scanning. Zero compromises.',
    color: '#10b981',
    features: ['Full swarm verification', 'Security audit', 'Performance optimization', 'Zero tolerance'],
    agents: 6,
    icon: 'rocket',
  },
];

// Dial segment component
function DialSegment({
  mode,
  index,
  total,
  isActive,
  onClick,
}: {
  mode: typeof BUILD_MODES[0];
  index: number;
  total: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const angle = (360 / total) * index - 90; // Start from top

  return (
    <motion.div
      className="absolute inset-0"
      style={{
        transform: `rotate(${angle}deg)`,
      }}
    >
      <motion.button
        onClick={onClick}
        className={`
          absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2
          w-20 h-20 rounded-full
          flex items-center justify-center
          font-display font-bold text-lg
          transition-all duration-500
          ${isActive
            ? 'scale-125 shadow-[0_0_60px_var(--glow-color)]'
            : 'scale-100 opacity-60 hover:opacity-100 hover:scale-110'
          }
        `}
        style={{
          backgroundColor: isActive ? mode.color : `${mode.color}30`,
          color: isActive ? '#0a0a0a' : mode.color,
          '--glow-color': `${mode.color}60`,
        } as React.CSSProperties}
        whileHover={{ scale: isActive ? 1.25 : 1.15 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-2xl">{mode.icon}</span>
      </motion.button>
    </motion.div>
  );
}

// Mode details panel
function ModeDetails({ mode }: { mode: typeof BUILD_MODES[0] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="text-center"
    >
      {/* Mode name with glow */}
      <motion.h3
        className="text-4xl md:text-5xl font-display font-bold mb-2"
        style={{ color: mode.color }}
        animate={{
          textShadow: [
            `0 0 20px ${mode.color}60`,
            `0 0 40px ${mode.color}80`,
            `0 0 20px ${mode.color}60`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {mode.name}
      </motion.h3>

      {/* Time */}
      <div className="text-2xl font-mono text-kriptik-white/90 mb-4">
        {mode.time}
      </div>

      {/* Description */}
      <p className="text-kriptik-silver/70 max-w-md mx-auto mb-8">
        {mode.description}
      </p>

      {/* Features grid */}
      <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
        {mode.features.map((feature, i) => (
          <motion.div
            key={feature}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-2 text-sm text-kriptik-silver/80"
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: mode.color }}
            />
            {feature}
          </motion.div>
        ))}
      </div>

      {/* Agent count */}
      <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-kriptik-night/50 border border-kriptik-steel/30">
        <span className="text-kriptik-silver/60 text-sm">Active Agents:</span>
        <span
          className="font-display font-bold text-lg"
          style={{ color: mode.color }}
        >
          {mode.agents}
        </span>
      </div>
    </motion.div>
  );
}

export function SpeedDial3D() {
  const [activeMode, setActiveMode] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rotation tracking for drag gesture
  const rotation = useMotionValue(0);
  const springRotation = useSpring(rotation, { damping: 30, stiffness: 200 });

  const handleModeChange = (index: number) => {
    setActiveMode(index);
    // Rotate to align with selected mode
    const targetRotation = -(360 / BUILD_MODES.length) * index;
    rotation.set(targetRotation);
  };

  return (
    <section className="relative py-32 md:py-48 overflow-hidden bg-kriptik-black">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background: `radial-gradient(circle, ${BUILD_MODES[activeMode].color}15 0%, transparent 60%)`,
          }}
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-lime mb-4 block">
            Speed Dial Architecture
          </span>
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white">
            Choose Your<br />
            <span className="text-kriptik-amber">Build Speed</span>
          </h2>
        </motion.div>

        {/* Dial and content layout */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* 3D Dial */}
          <div className="relative">
            <div
              ref={containerRef}
              className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] mx-auto"
              style={{ perspective: '1000px' }}
            >
              {/* Outer ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-kriptik-steel/30"
                style={{ rotateY: 15, rotateX: -15 }}
              />

              {/* Dial segments */}
              <motion.div
                className="absolute inset-8"
                style={{ rotate: springRotation }}
              >
                {BUILD_MODES.map((mode, i) => (
                  <DialSegment
                    key={mode.id}
                    mode={mode}
                    index={i}
                    total={BUILD_MODES.length}
                    isActive={i === activeMode}
                    onClick={() => handleModeChange(i)}
                  />
                ))}
              </motion.div>

              {/* Center dial */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-kriptik-charcoal to-kriptik-black border border-kriptik-steel/30 flex items-center justify-center"
                  style={{
                    boxShadow: `
                      inset 0 2px 10px rgba(255,255,255,0.05),
                      0 10px 40px rgba(0,0,0,0.5)
                    `,
                  }}
                  animate={{
                    borderColor: `${BUILD_MODES[activeMode].color}40`,
                  }}
                >
                  <div className="text-center">
                    <div className="text-xs font-mono uppercase tracking-wider text-kriptik-silver/50 mb-1">
                      Mode
                    </div>
                    <div
                      className="text-2xl font-display font-bold"
                      style={{ color: BUILD_MODES[activeMode].color }}
                    >
                      {activeMode + 1}/4
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Indicator arrow */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2">
                <motion.div
                  className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[16px] border-l-transparent border-r-transparent"
                  style={{ borderBottomColor: BUILD_MODES[activeMode].color }}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </div>
            </div>

            {/* Mode selector buttons (mobile) */}
            <div className="flex justify-center gap-2 mt-8 lg:hidden">
              {BUILD_MODES.map((mode, i) => (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(i)}
                  className={`
                    w-3 h-3 rounded-full transition-all duration-300
                    ${i === activeMode ? 'scale-125' : 'opacity-40 hover:opacity-70'}
                  `}
                  style={{ backgroundColor: mode.color }}
                />
              ))}
            </div>
          </div>

          {/* Mode details */}
          <div className="min-h-[400px] flex items-center justify-center">
            <AnimatePresence mode="wait">
              <ModeDetails key={activeMode} mode={BUILD_MODES[activeMode]} />
            </AnimatePresence>
          </div>
        </div>

        {/* Mode timeline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-20"
        >
          <div className="relative max-w-4xl mx-auto">
            {/* Timeline bar */}
            <div className="h-1 bg-kriptik-steel/30 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: BUILD_MODES[activeMode].color }}
                animate={{ width: `${((activeMode + 1) / BUILD_MODES.length) * 100}%` }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
              />
            </div>

            {/* Timeline markers */}
            <div className="flex justify-between mt-4">
              {BUILD_MODES.map((mode, i) => (
                <button
                  key={mode.id}
                  onClick={() => handleModeChange(i)}
                  className={`
                    text-center transition-all duration-300
                    ${i === activeMode ? 'opacity-100' : 'opacity-40 hover:opacity-70'}
                  `}
                >
                  <div
                    className={`
                      w-4 h-4 rounded-full mx-auto mb-2
                      ${i <= activeMode ? '' : 'bg-kriptik-steel/30'}
                    `}
                    style={{
                      backgroundColor: i <= activeMode ? mode.color : undefined,
                      boxShadow: i === activeMode ? `0 0 20px ${mode.color}60` : undefined,
                    }}
                  />
                  <div className="text-xs font-mono uppercase tracking-wider text-kriptik-silver/60">
                    {mode.name}
                  </div>
                  <div
                    className="text-sm font-display font-bold mt-0.5"
                    style={{ color: i === activeMode ? mode.color : 'inherit' }}
                  >
                    {mode.time}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default SpeedDial3D;

