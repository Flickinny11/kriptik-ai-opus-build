/**
 * AgentVisualization.tsx - Horizontal Scroll Agent Showcase
 * 
 * Showcases the 6 Verification Swarm agents with
 * horizontal scrolling and 3D card reveals.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';

// Agent data
const AGENTS = [
  {
    id: 'error-checker',
    name: 'Error Checker',
    role: 'Zero Tolerance Guardian',
    description: 'Blocks on TypeScript/ESLint/runtime errors. 5-second polling. Catches what humans miss.',
    color: '#ef4444',
    gradient: 'from-red-500/20 to-red-900/20',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-[0_0_40px_rgba(239,68,68,0.3)]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: [
      { label: 'Response', value: '5s polling' },
      { label: 'Accuracy', value: '99.7%' },
    ],
  },
  {
    id: 'code-quality',
    name: 'Code Quality',
    role: 'Standards Enforcer',
    description: 'DRY principles, naming conventions, organization. 80% quality threshold minimum.',
    color: '#3b82f6',
    gradient: 'from-blue-500/20 to-blue-900/20',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-[0_0_40px_rgba(59,130,246,0.3)]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: [
      { label: 'Threshold', value: '80%+' },
      { label: 'Checks', value: '47 rules' },
    ],
  },
  {
    id: 'visual-verifier',
    name: 'Visual Verifier',
    role: 'Pixel Perfect Auditor',
    description: 'Screenshot AI analysis. Catches UI bugs, layout shifts, and visual regressions.',
    color: '#a855f7',
    gradient: 'from-purple-500/20 to-purple-900/20',
    borderColor: 'border-purple-500/30',
    glowColor: 'shadow-[0_0_40px_rgba(168,85,247,0.3)]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke="currentColor" strokeWidth="2" />
        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
    stats: [
      { label: 'Screenshots', value: 'Real-time' },
      { label: 'Detection', value: 'AI Vision' },
    ],
  },
  {
    id: 'security-scanner',
    name: 'Security Scanner',
    role: 'Vulnerability Hunter',
    description: 'Blocks on critical vulnerabilities. IAM policies, dependency audit, secret detection.',
    color: '#22c55e',
    gradient: 'from-green-500/20 to-green-900/20',
    borderColor: 'border-green-500/30',
    glowColor: 'shadow-[0_0_40px_rgba(34,197,94,0.3)]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: [
      { label: 'Scans', value: 'Continuous' },
      { label: 'Coverage', value: 'Full stack' },
    ],
  },
  {
    id: 'placeholder-eliminator',
    name: 'Placeholder Eliminator',
    role: 'Production Guardian',
    description: 'ZERO TOLERANCE for TODOs, mock data, lorem ipsum, console.logs. Production only.',
    color: '#f97316',
    gradient: 'from-orange-500/20 to-orange-900/20',
    borderColor: 'border-orange-500/30',
    glowColor: 'shadow-[0_0_40px_rgba(249,115,22,0.3)]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: [
      { label: 'Tolerance', value: 'ZERO' },
      { label: 'Patterns', value: '12 types' },
    ],
  },
  {
    id: 'design-style',
    name: 'Design Style',
    role: 'Anti-Slop Defender',
    description: 'Ensures your app has soul, not slop. Prevents generic AI-looking output.',
    color: '#06b6d4',
    gradient: 'from-cyan-500/20 to-cyan-900/20',
    borderColor: 'border-cyan-500/30',
    glowColor: 'shadow-[0_0_40px_rgba(6,182,212,0.3)]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8">
        <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    stats: [
      { label: 'Detection', value: 'AI Slop' },
      { label: 'Ensures', value: 'Unique UX' },
    ],
  },
];

// Agent card component
function AgentCard({ agent, index }: { agent: typeof AGENTS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 50, rotateY: -15 }}
      whileInView={{ opacity: 1, y: 0, rotateY: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ 
        duration: 0.8, 
        delay: index * 0.1,
        ease: [0.23, 1, 0.32, 1],
      }}
      className={`
        relative flex-shrink-0 w-[320px] md:w-[380px] h-[480px]
        rounded-2xl overflow-hidden
        bg-gradient-to-br ${agent.gradient}
        border ${agent.borderColor}
        backdrop-blur-xl
        ${agent.glowColor}
        transform-gpu
        hover:scale-[1.02] hover:-translate-y-2
        transition-all duration-500 ease-premium
        group
      `}
      style={{ perspective: '1000px' }}
    >
      {/* Animated border glow */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(45deg, transparent 30%, ${agent.color}40 50%, transparent 70%)`,
          backgroundSize: '200% 200%',
          animation: 'shimmer 2s linear infinite',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6">
        {/* Icon and status */}
        <div className="flex items-start justify-between mb-6">
          <div 
            className="p-3 rounded-xl"
            style={{ 
              backgroundColor: `${agent.color}20`,
              color: agent.color,
            }}
          >
            {agent.icon}
          </div>
          
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: agent.color }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-mono uppercase tracking-wider text-kriptik-silver/60">
              Active
            </span>
          </div>
        </div>
        
        {/* Title */}
        <h3 className="text-2xl font-display font-bold text-kriptik-white mb-1">
          {agent.name}
        </h3>
        <p 
          className="text-sm font-medium mb-4"
          style={{ color: agent.color }}
        >
          {agent.role}
        </p>
        
        {/* Description */}
        <p className="text-kriptik-silver/80 text-sm leading-relaxed flex-grow">
          {agent.description}
        </p>
        
        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {agent.stats.map((stat, i) => (
            <div 
              key={i}
              className="p-3 rounded-lg bg-kriptik-black/40"
            >
              <div 
                className="text-lg font-display font-bold"
                style={{ color: agent.color }}
              >
                {stat.value}
              </div>
              <div className="text-xs uppercase tracking-wider text-kriptik-silver/50 mt-0.5">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
        
        {/* Connection line animation */}
        <motion.div
          className="absolute bottom-0 left-1/2 w-px h-12 -translate-x-1/2 translate-y-full"
          style={{ backgroundColor: agent.color }}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5, duration: 0.5 }}
        />
      </div>
    </motion.div>
  );
}

// Orchestration visualization
function OrchestrationHub() {
  return (
    <div className="relative w-40 h-40 flex-shrink-0">
      {/* Central hub */}
      <motion.div
        className="absolute inset-4 rounded-full bg-gradient-to-br from-kriptik-lime/20 to-kriptik-amber/20 border border-kriptik-lime/30"
        animate={{ 
          scale: [1, 1.05, 1],
          rotate: [0, 360],
        }}
        transition={{ 
          scale: { duration: 2, repeat: Infinity },
          rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
        }}
      />
      
      {/* Inner core */}
      <motion.div
        className="absolute inset-8 rounded-full bg-kriptik-lime/30"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      {/* Center dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-kriptik-lime shadow-glow-lime" />
      </div>
      
      {/* Label */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="text-xs font-mono uppercase tracking-widest text-kriptik-lime">
          Orchestrator
        </span>
      </div>
    </div>
  );
}

export function AgentVisualization() {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });
  
  // Horizontal scroll based on vertical scroll
  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-50%']);
  const springX = useSpring(x, { damping: 30, stiffness: 100 });

  return (
    <section
      id="agents-section"
      ref={containerRef}
      className="relative py-32 md:py-48 overflow-hidden bg-kriptik-black"
    >
      {/* Section header */}
      <div className="max-w-7xl mx-auto px-6 mb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-amber mb-4 block">
            Verification Swarm
          </span>
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white mb-6">
            6 Agents.<br />
            <span className="text-kriptik-lime">Zero Errors.</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-kriptik-silver/70">
            Every build passes through our Verification Swarm—6 specialized AI agents 
            that run in parallel, catching what humans and other AI tools miss.
          </p>
        </motion.div>
      </div>
      
      {/* Horizontal scroll container */}
      <div className="relative">
        <motion.div
          ref={scrollRef}
          className="flex items-center gap-8 px-6"
          style={{ x: springX }}
        >
          {/* Left spacer */}
          <div className="flex-shrink-0 w-[10vw]" />
          
          {/* Agents */}
          {AGENTS.slice(0, 3).map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i} />
          ))}
          
          {/* Orchestration hub */}
          <OrchestrationHub />
          
          {/* More agents */}
          {AGENTS.slice(3).map((agent, i) => (
            <AgentCard key={agent.id} agent={agent} index={i + 3} />
          ))}
          
          {/* Right spacer */}
          <div className="flex-shrink-0 w-[10vw]" />
        </motion.div>
        
        {/* Gradient fades */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-kriptik-black to-transparent pointer-events-none z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-kriptik-black to-transparent pointer-events-none z-10" />
      </div>
      
      {/* Connection lines background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <svg className="w-full h-full opacity-10">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#c8ff64" stopOpacity="0" />
              <stop offset="50%" stopColor="#c8ff64" stopOpacity="1" />
              <stop offset="100%" stopColor="#c8ff64" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[...Array(5)].map((_, i) => (
            <motion.line
              key={i}
              x1="0%"
              y1={`${20 + i * 15}%`}
              x2="100%"
              y2={`${20 + i * 15}%`}
              stroke="url(#lineGradient)"
              strokeWidth="1"
              initial={{ pathLength: 0 }}
              whileInView={{ pathLength: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: i * 0.2 }}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}

export default AgentVisualization;

