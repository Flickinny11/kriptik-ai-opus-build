/**
 * PricingRedesign.tsx - Premium Pricing Section
 *
 * Visual hierarchy pricing with clear recommendation,
 * interactive credit calculator, and 3D card effects.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
// Direct import to avoid loading Three.js through barrel exports
import { MagneticCTA, ArrowIcon } from '../3d/MagneticButton';

// Pricing tiers
const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Explorer',
    price: 0,
    period: 'forever',
    description: 'Explore KripTik AI capabilities',
    credits: 50,
    features: [
      '50 credits/month',
      'Lightning builds only',
      '2 agents max',
      'Community support',
      'Basic templates',
    ],
    cta: 'Start Free',
    recommended: false,
    color: '#4a4a4a',
  },
  {
    id: 'pro',
    name: 'Builder',
    price: 29,
    period: '/month',
    description: 'For serious builders shipping real products',
    credits: 500,
    features: [
      '500 credits/month',
      'All build modes',
      'Full 6-agent swarm',
      'Priority support',
      'All templates',
      'Ghost Mode',
      'Time Machine (30 days)',
      'Custom domains',
    ],
    cta: 'Start Building',
    recommended: true,
    color: '#c8ff64',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null, // Custom
    period: '',
    description: 'For teams with advanced requirements',
    credits: null, // Unlimited
    features: [
      'Unlimited credits',
      'Tournament Mode',
      'Dedicated infrastructure',
      'SSO & SAML',
      'Custom integrations',
      'SLA guarantee',
      'White-label option',
      'Priority GPU allocation',
    ],
    cta: 'Contact Sales',
    recommended: false,
    color: '#f59e0b',
  },
];

// Credit calculator
function CreditCalculator() {
  const [builds, setBuilds] = useState(10);
  const [mode, setMode] = useState<'lightning' | 'standard' | 'tournament' | 'production'>('standard');

  const creditCosts = {
    lightning: 5,
    standard: 15,
    tournament: 40,
    production: 80,
  };

  const totalCredits = builds * creditCosts[mode];

  const recommendedTier = totalCredits <= 50 ? 'free' : totalCredits <= 500 ? 'pro' : 'enterprise';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="max-w-xl mx-auto mt-16 p-6 rounded-2xl bg-kriptik-charcoal/30 border border-kriptik-steel/20"
    >
      <div className="text-center mb-6">
        <h3 className="text-lg font-display font-bold text-kriptik-white mb-2">
          Credit Calculator
        </h3>
        <p className="text-sm text-kriptik-silver/60">
          Estimate your monthly credit needs
        </p>
      </div>

      <div className="space-y-6">
        {/* Builds per month slider */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-kriptik-silver/70">Builds per month</span>
            <span className="text-sm font-mono text-kriptik-lime">{builds}</span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={builds}
            onChange={(e) => setBuilds(parseInt(e.target.value))}
            className="w-full h-2 bg-kriptik-steel/30 rounded-full appearance-none cursor-pointer accent-kriptik-lime"
          />
        </div>

        {/* Build mode selector */}
        <div>
          <span className="text-sm text-kriptik-silver/70 block mb-3">Primary build mode</span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(['lightning', 'standard', 'tournament', 'production'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`
                  px-3 py-2 rounded-lg text-xs font-mono uppercase transition-all duration-200
                  ${mode === m
                    ? 'bg-kriptik-lime/20 text-kriptik-lime border border-kriptik-lime/30'
                    : 'bg-kriptik-steel/20 text-kriptik-silver/60 border border-transparent hover:border-kriptik-steel/30'
                  }
                `}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Result */}
        <div className="p-4 rounded-xl bg-kriptik-black/50 border border-kriptik-steel/20">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-sm text-kriptik-silver/70">Estimated credits needed</div>
              <div className="text-2xl font-display font-bold text-kriptik-lime mt-1">
                {totalCredits.toLocaleString()}<span className="text-sm text-kriptik-silver/50">/month</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-kriptik-silver/70">Recommended tier</div>
              <div className="text-lg font-display font-bold text-kriptik-amber mt-1 capitalize">
                {recommendedTier === 'free' ? 'Explorer' : recommendedTier === 'pro' ? 'Builder' : 'Enterprise'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Pricing card component
function PricingCard({ tier, index }: { tier: typeof PRICING_TIERS[0]; index: number }) {
  const [isHovered, setIsHovered] = useState(false);

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
        ${tier.recommended
          ? 'bg-gradient-to-br from-kriptik-lime/10 to-kriptik-amber/5 border-2 border-kriptik-lime/30 md:scale-105 md:-my-4'
          : tier.id === 'enterprise'
            ? 'bg-gradient-to-br from-kriptik-amber/5 to-transparent border border-kriptik-amber/20'
            : 'bg-kriptik-charcoal/30 border border-kriptik-steel/20 opacity-80'
        }
        transform-gpu transition-all duration-500
        ${isHovered && tier.recommended ? 'shadow-glow-lime' : ''}
      `}
    >
      {/* Recommended badge */}
      {tier.recommended && (
        <div className="absolute top-0 left-0 right-0">
          <div className="bg-kriptik-lime text-kriptik-black text-xs font-mono uppercase tracking-wider py-2 text-center">
            Most Popular
          </div>
        </div>
      )}

      <div className={`p-8 ${tier.recommended ? 'pt-12' : ''}`}>
        {/* Tier name */}
        <div className="mb-6">
          <h3
            className="text-xl font-display font-bold mb-2"
            style={{ color: tier.color }}
          >
            {tier.name}
          </h3>
          <p className="text-sm text-kriptik-silver/60">
            {tier.description}
          </p>
        </div>

        {/* Price */}
        <div className="mb-8">
          {tier.price !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-display font-bold text-kriptik-white">
                ${tier.price}
              </span>
              <span className="text-kriptik-silver/50">{tier.period}</span>
            </div>
          ) : (
            <div className="text-3xl font-display font-bold text-kriptik-amber">
              Custom
            </div>
          )}

          {/* Credits */}
          {tier.credits && (
            <div className="mt-2 text-sm text-kriptik-silver/70">
              <span className="font-mono text-kriptik-lime">{tier.credits}</span> credits/month
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3 mb-8">
          {tier.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-kriptik-silver/80">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                viewBox="0 0 20 20"
                fill={tier.color}
              >
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA */}
        {tier.recommended ? (
          <MagneticCTA
            text={tier.cta}
            variant="primary"
            size="lg"
            icon={<ArrowIcon />}
            className="w-full justify-center"
          />
        ) : tier.id === 'enterprise' ? (
          <MagneticCTA
            text={tier.cta}
            variant="secondary"
            size="lg"
            className="w-full justify-center"
          />
        ) : (
          <button className="w-full py-3 rounded-full bg-kriptik-steel/30 text-kriptik-silver/80 hover:bg-kriptik-steel/50 transition-colors font-medium">
            {tier.cta}
          </button>
        )}
      </div>

      {/* Shine effect on hover */}
      {tier.recommended && (
        <motion.div
          className="absolute inset-0 opacity-0 pointer-events-none"
          style={{
            background: 'linear-gradient(45deg, transparent 40%, rgba(200,255,100,0.1) 50%, transparent 60%)',
            backgroundSize: '200% 200%',
          }}
          animate={{
            opacity: isHovered ? 1 : 0,
            backgroundPosition: isHovered ? ['200% 200%', '-200% -200%'] : '200% 200%',
          }}
          transition={{ duration: 1.5 }}
        />
      )}
    </motion.div>
  );
}

export function PricingRedesign() {
  return (
    <section className="relative py-32 md:py-48 overflow-hidden bg-kriptik-black">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-kriptik-lime/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-kriptik-amber/5 rounded-full blur-[150px]" />
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
            Simple Pricing
          </span>
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white mb-6">
            Pay for What<br />
            <span className="text-kriptik-lime">You Ship</span>
          </h2>
          <p className="max-w-2xl mx-auto text-lg text-kriptik-silver/70">
            Credits-based pricing that scales with your ambition.
            No hidden fees, no surprises.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 items-center max-w-5xl mx-auto">
          {PRICING_TIERS.map((tier, i) => (
            <PricingCard key={tier.id} tier={tier} index={i} />
          ))}
        </div>

        {/* Credit calculator */}
        <CreditCalculator />

        {/* Additional info */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-sm text-kriptik-silver/50">
            All plans include: Vercel/Netlify deployment • GitHub integration • SSL certificates •
            24/7 monitoring • Automatic scaling
          </p>
        </motion.div>
      </div>
    </section>
  );
}

export default PricingRedesign;

