/**
 * TrustSection.tsx - Trust & Credibility Section
 * 
 * Showcases integrations, architecture, and real metrics
 * with floating logos and credential displays.
 */

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

// Integration logos (simplified SVG representations)
const INTEGRATIONS = [
  {
    name: 'AWS',
    color: '#FF9900',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 01-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 01-.287-.375 6.18 6.18 0 01-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.296.064-.583.16-.863.279a2.062 2.062 0 01-.263.12.47.47 0 01-.135.024c-.12 0-.176-.086-.176-.255v-.391c0-.128.016-.224.056-.28a.597.597 0 01.224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 011.246-.151c.95 0 1.644.216 2.091.647.44.43.662 1.085.662 1.963v2.586z"/>
      </svg>
    ),
  },
  {
    name: 'Vercel',
    color: '#ffffff',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M24 22.525H0l12-21.05 12 21.05z"/>
      </svg>
    ),
  },
  {
    name: 'GitHub',
    color: '#ffffff',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
  },
  {
    name: 'Claude',
    color: '#D4A574',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M17.304 3.541h-3.677l6.372 16.918h3.677L17.304 3.541zm-10.608 0L.324 20.459h3.677l1.254-3.48h6.012l1.254 3.48h3.677L9.826 3.541H6.696z"/>
      </svg>
    ),
  },
  {
    name: 'GPT-4',
    color: '#10A37F',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0012 .008a6.038 6.038 0 00-5.744 4.225 5.985 5.985 0 00-3.998 2.903 6.075 6.075 0 00.752 7.118 5.985 5.985 0 00.516 4.91 6.046 6.046 0 006.51 2.9A6.065 6.065 0 0012 24a6.038 6.038 0 005.744-4.225 5.985 5.985 0 003.998-2.903 6.075 6.075 0 00-.752-7.118z"/>
      </svg>
    ),
  },
  {
    name: 'HuggingFace',
    color: '#FFD21E',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-2.5 15.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm2.5 2c0 1.38-2.24 2.5-5 2.5s-5-1.12-5-2.5"/>
      </svg>
    ),
  },
  {
    name: 'RunPod',
    color: '#9333EA',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  },
  {
    name: 'Netlify',
    color: '#00C7B7',
    logo: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
        <path d="M16.934 8.519a1.044 1.044 0 01.303.23l2.349-1.045-.927-2.262-2.349 1.048c-.074-.25-.188-.47-.334-.663l1.556-2.067-1.78-1.39-1.555 2.068a1.182 1.182 0 01-.788.268h-.015a.988.988 0 01-.788-.268L11.05 2.37 9.27 3.76l1.556 2.067c-.146.19-.26.413-.334.664l-2.35-1.048-.926 2.262 2.35 1.045c.06.08.166.165.302.23l-.618 1.558-2.31 1.028-.926-2.262-2.35 1.045c.063.08.167.165.303.23l-.618 1.558-1.92.855.926 2.262 1.92-.855v.573c0 .337.097.662.28.942l-1.92.855.927 2.262 1.92-.855c.147.19.32.355.52.482l-.618 1.559 2.309 1.028.618-1.559a1.05 1.05 0 01.393-.066h.573v1.727h2.35v-1.727h.573c.133 0 .266-.024.393.066l.617 1.559 2.31-1.028-.618-1.56c.2-.126.373-.29.52-.48l1.92.855.927-2.262-1.92-.855c.183-.28.28-.605.28-.942v-.572l1.92.854.927-2.261-1.92-.855-.618-1.559zm-4.59 5.13a1.18 1.18 0 11-.001-2.36 1.18 1.18 0 010 2.36z"/>
      </svg>
    ),
  },
];

// Metrics data
const METRICS = [
  { value: '10,000+', label: 'Apps Built', color: '#c8ff64' },
  { value: '99.7%', label: 'Success Rate', color: '#22c55e' },
  { value: '<3min', label: 'Avg Lightning Build', color: '#3b82f6' },
  { value: '6', label: 'Parallel Agents', color: '#a855f7' },
];

// Floating logo component
function FloatingLogo({ 
  integration, 
  index,
  total,
}: { 
  integration: typeof INTEGRATIONS[0]; 
  index: number;
  total: number;
}) {
  const angle = (index / total) * Math.PI * 2;
  const radius = 120;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  
  return (
    <motion.div
      className="absolute w-16 h-16 rounded-xl bg-kriptik-charcoal/50 border border-kriptik-steel/30 flex items-center justify-center backdrop-blur-sm"
      style={{
        left: `calc(50% + ${x}px - 32px)`,
        top: `calc(50% + ${y}px - 32px)`,
        color: integration.color,
      }}
      initial={{ opacity: 0, scale: 0 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ 
        scale: 1.15, 
        boxShadow: `0 0 30px ${integration.color}40`,
      }}
    >
      {integration.logo}
      
      {/* Tooltip */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-mono text-kriptik-silver/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
        {integration.name}
      </div>
    </motion.div>
  );
}

// Intent Lock Contract preview
function IntentLockPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="relative max-w-lg mx-auto"
    >
      <div className="rounded-xl bg-kriptik-night border border-kriptik-steel/30 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-kriptik-charcoal/30 border-b border-kriptik-steel/20">
          <div className="w-3 h-3 rounded bg-kriptik-lime/20" />
          <span className="text-xs font-mono text-kriptik-silver/50">intent.lock.json</span>
          <div className="ml-auto flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-500/70">Immutable</span>
          </div>
        </div>
        
        {/* Code content */}
        <div className="p-4 font-mono text-xs leading-relaxed">
          <div className="text-kriptik-silver/50">{'{'}</div>
          <div className="pl-4">
            <span className="text-purple-400">"intent"</span>
            <span className="text-kriptik-silver/50">: </span>
            <span className="text-green-400">"Build a SaaS dashboard"</span>
            <span className="text-kriptik-silver/50">,</span>
          </div>
          <div className="pl-4">
            <span className="text-purple-400">"locked_at"</span>
            <span className="text-kriptik-silver/50">: </span>
            <span className="text-kriptik-amber">"2024-01-15T10:30:00Z"</span>
            <span className="text-kriptik-silver/50">,</span>
          </div>
          <div className="pl-4">
            <span className="text-purple-400">"features"</span>
            <span className="text-kriptik-silver/50">: [</span>
          </div>
          <div className="pl-8 text-green-400">
            "user_auth",<br />
            "analytics",<br />
            "billing"
          </div>
          <div className="pl-4 text-kriptik-silver/50">],</div>
          <div className="pl-4">
            <span className="text-purple-400">"verified"</span>
            <span className="text-kriptik-silver/50">: </span>
            <span className="text-kriptik-lime">true</span>
          </div>
          <div className="text-kriptik-silver/50">{'}'}</div>
        </div>
      </div>
      
      {/* Decoration */}
      <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-kriptik-lime/5 rounded-full blur-3xl" />
    </motion.div>
  );
}

export function TrustSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });
  
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 360]);

  return (
    <section ref={containerRef} className="relative py-32 md:py-48 overflow-hidden bg-kriptik-black">
      {/* Background pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(200,255,100,0.3) 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />
      
      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center mb-20"
        >
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-silver/60 mb-4 block">
            Built on Proven Infrastructure
          </span>
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white mb-6">
            Enterprise<br />
            <span className="text-kriptik-lime">Architecture</span>
          </h2>
        </motion.div>
        
        {/* Integration orbit */}
        <div className="relative h-[400px] mb-20">
          {/* Center element */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-kriptik-lime/20 to-kriptik-amber/20 flex items-center justify-center"
            style={{ rotate }}
          >
            <div className="w-16 h-16 rounded-full bg-kriptik-black border border-kriptik-lime/30 flex items-center justify-center">
              <span className="text-2xl font-display font-bold text-kriptik-lime">K</span>
            </div>
          </motion.div>
          
          {/* Floating logos */}
          {INTEGRATIONS.map((integration, i) => (
            <FloatingLogo
              key={integration.name}
              integration={integration}
              index={i}
              total={INTEGRATIONS.length}
            />
          ))}
          
          {/* Orbital rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full border border-kriptik-steel/10" />
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full border border-dashed border-kriptik-steel/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
          />
        </div>
        
        {/* Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20"
        >
          {METRICS.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center p-6 rounded-xl bg-kriptik-charcoal/30 border border-kriptik-steel/20"
            >
              <div 
                className="text-3xl md:text-4xl font-display font-bold mb-2"
                style={{ color: metric.color }}
              >
                {metric.value}
              </div>
              <div className="text-sm text-kriptik-silver/60">
                {metric.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
        
        {/* Intent Lock showcase */}
        <div className="text-center mb-8">
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-kriptik-amber mb-4 block">
            Intent Lock Technology
          </span>
          <p className="text-kriptik-silver/60 max-w-md mx-auto mb-8">
            Every build starts with an immutable Intent Lock contract—ensuring 
            the AI never deviates from your original vision.
          </p>
        </div>
        
        <IntentLockPreview />
      </div>
    </section>
  );
}

export default TrustSection;

