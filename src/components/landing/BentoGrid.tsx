/**
 * BentoGrid.tsx - Asymmetric Feature Grid
 *
 * Showcases unique features in a varied-size bento grid
 * with 3D depth and unique animations per card.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

// Feature data
const FEATURES = [
  {
    id: 'tournament',
    title: 'Tournament Mode',
    description: 'Multiple AI implementations compete. Best solution wins.',
    size: 'large', // spans 2 columns
    color: '#a855f7',
    gradient: 'from-purple-500/10 to-purple-900/20',
    content: 'tournament',
  },
  {
    id: 'time-machine',
    title: 'Time Machine',
    description: 'Rollback to any moment. Create branches. Never lose work.',
    size: 'medium',
    color: '#3b82f6',
    gradient: 'from-blue-500/10 to-blue-900/20',
    content: 'timeline',
  },
  {
    id: 'ghost-mode',
    title: 'Ghost Mode',
    description: 'Builds autonomously while you sleep. Wake up to finished apps.',
    size: 'medium',
    color: '#22c55e',
    gradient: 'from-green-500/10 to-green-900/20',
    content: 'ghost',
  },
  {
    id: 'fix-my-app',
    title: 'Fix My App',
    description: 'Import broken apps from competitors. We fix them.',
    size: 'small',
    color: '#ef4444',
    gradient: 'from-red-500/10 to-red-900/20',
    content: 'repair',
  },
  {
    id: 'clone-mode',
    title: 'Clone Mode',
    description: 'Point camera at any app. AI reverse-engineers it.',
    size: 'small',
    color: '#f97316',
    gradient: 'from-orange-500/10 to-orange-900/20',
    content: 'camera',
  },
  {
    id: 'learning-engine',
    title: 'Autonomous Learning',
    description: 'Gets smarter from every build. Learns your patterns.',
    size: 'wide', // full width
    color: '#06b6d4',
    gradient: 'from-cyan-500/10 to-cyan-900/20',
    content: 'brain',
  },
  {
    id: 'voice-architect',
    title: 'Voice Architect',
    description: 'Build apps with voice commands. Hands-free coding.',
    size: 'small',
    color: '#c8ff64',
    gradient: 'from-lime-500/10 to-lime-900/20',
    content: 'voice',
  },
];

// Tournament visualization
function TournamentContent() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="relative w-full max-w-md">
        {/* Three competing implementations */}
        <div className="flex justify-between items-end gap-4">
          {['A', 'B', 'C'].map((impl, i) => (
            <motion.div
              key={impl}
              className="flex-1 flex flex-col items-center"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
            >
              <motion.div
                className={`
                  w-full rounded-lg bg-kriptik-charcoal/50 border border-kriptik-steel/30
                  flex items-center justify-center font-mono
                  ${i === 1 ? 'h-32 border-purple-500/50' : 'h-24'}
                `}
                animate={i === 1 ? {
                  boxShadow: ['0 0 0 rgba(168,85,247,0)', '0 0 30px rgba(168,85,247,0.3)', '0 0 0 rgba(168,85,247,0)'],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-2xl opacity-50">{'</>'}</span>
              </motion.div>
              <div className={`mt-2 text-xs font-mono ${i === 1 ? 'text-purple-400' : 'text-kriptik-silver/50'}`}>
                Impl {impl}
              </div>
              {i === 1 && (
                <motion.div
                  className="mt-1 text-xs text-purple-400"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  Winner
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        {/* AI Judge */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
          <div className="text-xs font-mono text-purple-400/60">AI Judge Selecting...</div>
        </div>
      </div>
    </div>
  );
}

// Timeline visualization
function TimelineContent() {
  return (
    <div className="absolute inset-0 flex items-center p-6">
      <div className="w-full">
        {/* Timeline */}
        <div className="relative h-2 bg-kriptik-steel/30 rounded-full overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
            initial={{ width: '0%' }}
            whileInView={{ width: '70%' }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5 }}
          />

          {/* Checkpoints */}
          {[0, 25, 50, 70].map((pos, i) => (
            <motion.div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-kriptik-black"
              style={{ left: `${pos}%` }}
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.2 }}
            />
          ))}
        </div>

        {/* Labels */}
        <div className="flex justify-between mt-4">
          <span className="text-xs text-kriptik-silver/50">Start</span>
          <span className="text-xs text-blue-400">Now</span>
        </div>

        {/* Branch indicator */}
        <motion.div
          className="mt-4 flex items-center gap-2 text-xs text-kriptik-silver/60"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 1 }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span>3 branches available</span>
        </motion.div>
      </div>
    </div>
  );
}

// Ghost mode visualization
function GhostContent() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="text-center">
        {/* Moon icon */}
        <motion.div
          className="w-16 h-16 mx-auto mb-4 text-green-400"
          animate={{ rotate: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        </motion.div>

        {/* Status */}
        <motion.div
          className="text-sm text-green-400 font-mono"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Building autonomously...
        </motion.div>

        {/* Progress bars */}
        <div className="mt-4 space-y-2">
          {['Auth', 'Dashboard', 'API'].map((item, i) => (
            <div key={item} className="flex items-center gap-2 text-xs">
              <span className="text-kriptik-silver/50 w-16 text-right">{item}</span>
              <div className="flex-1 h-1 bg-kriptik-steel/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-green-500/50 rounded-full"
                  initial={{ width: '0%' }}
                  whileInView={{ width: `${60 + i * 15}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.3 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Brain/Learning visualization
function BrainContent() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="flex items-center gap-8">
        {/* Neural network nodes */}
        <div className="relative">
          {[...Array(12)].map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 40;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            return (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full bg-cyan-500/50"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                }}
                animate={{
                  scale: [1, 1.5, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                }}
              />
            );
          })}

          {/* Center */}
          <motion.div
            className="w-8 h-8 rounded-full bg-cyan-500"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ margin: '36px' }}
          />
        </div>

        {/* Stats */}
        <div className="space-y-3">
          {[
            { label: 'Patterns Learned', value: '12,847' },
            { label: 'Build Optimizations', value: '+34%' },
            { label: 'Your Preferences', value: 'Active' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ x: -20, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
            >
              <div className="text-xs text-kriptik-silver/50">{stat.label}</div>
              <div className="text-lg font-display font-bold text-cyan-400">{stat.value}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Voice visualization
function VoiceContent() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-end gap-1 h-12">
        {[...Array(7)].map((_, i) => (
          <motion.div
            key={i}
            className="w-2 bg-lime-400 rounded-full"
            animate={{
              height: [8, 24 + Math.random() * 24, 8],
            }}
            transition={{
              duration: 0.5 + Math.random() * 0.5,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Feature card component
function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

  // Size classes
  const sizeClasses = {
    large: 'md:col-span-2 md:row-span-2',
    medium: 'md:col-span-1 md:row-span-2',
    small: 'md:col-span-1 md:row-span-1',
    wide: 'md:col-span-2 md:row-span-1',
  };

  // Content renderers
  const contentMap: Record<string, () => JSX.Element> = {
    tournament: TournamentContent,
    timeline: TimelineContent,
    ghost: GhostContent,
    brain: BrainContent,
    voice: VoiceContent,
    repair: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-4xl"
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          🔧
        </motion.div>
      </div>
    ),
    camera: () => (
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-4xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          📸
        </motion.div>
      </div>
    ),
  };

  const ContentComponent = contentMap[feature.content] || (() => null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative rounded-2xl overflow-hidden
        bg-gradient-to-br ${feature.gradient}
        border border-kriptik-steel/20
        backdrop-blur-sm
        ${sizeClasses[feature.size as keyof typeof sizeClasses]}
        min-h-[200px]
        group
      `}
      style={{
        boxShadow: isHovered ? `0 20px 60px ${feature.color}20` : undefined,
      }}
    >
      {/* Animated border on hover */}
      <motion.div
        className="absolute inset-0 rounded-2xl"
        style={{
          border: `1px solid ${feature.color}`,
          opacity: 0,
        }}
        animate={{ opacity: isHovered ? 0.5 : 0 }}
      />

      {/* Content visualization */}
      <div className="absolute inset-0 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
        <ContentComponent />
      </div>

      {/* Text overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-kriptik-black/80 to-transparent">
        <h3
          className="text-lg font-display font-bold mb-1"
          style={{ color: feature.color }}
        >
          {feature.title}
        </h3>
        <p className="text-sm text-kriptik-silver/70">
          {feature.description}
        </p>
      </div>

      {/* Hover shine effect */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, transparent 40%, ${feature.color}10 50%, transparent 60%)`,
        }}
        animate={isHovered ? {
          backgroundPosition: ['200% 200%', '-200% -200%'],
        } : {}}
        transition={{ duration: 1.5 }}
      />
    </motion.div>
  );
}

export function BentoGrid() {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden bg-kriptik-black">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-rose mb-4 block">
            Unique Capabilities
          </span>
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white mb-6">
            Features That<br />
            <span className="text-kriptik-amber">Don't Exist</span> Elsewhere
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-kriptik-silver/70">
            Not incremental improvements. Fundamental innovations that change
            how software gets built.
          </p>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.id} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default BentoGrid;

