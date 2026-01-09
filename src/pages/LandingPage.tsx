/**
 * LandingPage.tsx - Premium KripTik AI Landing Page
 *
 * Full-featured landing page with:
 * - Lenis smooth scrolling
 * - 3D glass sphere hero
 * - Horizontal scroll agent showcase
 * - Interactive speed dial
 * - Product screenshots
 * - Bento grid features
 * - Trust & credibility
 * - Premium pricing
 * - Epic CTA
 * - Animated footer
 */

import { useEffect, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Lenis from 'lenis';
import { ComparisonCheckIcon, ComparisonXIcon } from '@/components/icons';

// Lazy load heavy sections for performance
const Hero3D = lazy(() => import('../components/landing/Hero3D'));
const AgentVisualization = lazy(() => import('../components/landing/AgentVisualization'));
const SpeedDial3D = lazy(() => import('../components/landing/SpeedDial3D'));
const ProductShowcase = lazy(() => import('../components/landing/ProductShowcase'));
const BentoGrid = lazy(() => import('../components/landing/BentoGrid'));
const TrustSection = lazy(() => import('../components/landing/TrustSection'));
const PricingRedesign = lazy(() => import('../components/landing/PricingRedesign'));
const FinalCTA = lazy(() => import('../components/landing/FinalCTA'));
const Footer3D = lazy(() => import('../components/landing/Footer3D'));

// Section loading fallback
function SectionLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-kriptik-black">
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="relative w-16 h-16">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-kriptik-lime/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-kriptik-lime"
            animate={{
              rotate: 360,
            }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '0 32px' }}
          />
        </div>
        <span className="text-xs font-mono text-kriptik-silver/50 uppercase tracking-widest">
          Loading
        </span>
      </motion.div>
    </div>
  );
}

// Problem section (The comparison section between old way vs KripTik)
function ProblemSection() {
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
          <h2 className="text-display-sm md:text-display-md font-display font-bold text-kriptik-white mb-6">
            Every Other AI Tool<br />
            <span className="text-kriptik-rose">Makes You Babysit Code</span>
          </h2>
        </motion.div>

        {/* Comparison grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Problems with other tools */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/5 to-transparent border border-red-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-sm font-mono uppercase tracking-wider text-red-400/60">
                  Other Tools
                </span>
              </div>

              <ul className="space-y-4">
                {[
                  { tool: 'Cursor', problem: "You're still fixing errors manually" },
                  { tool: 'ChatGPT', problem: 'Copy-paste hell into your IDE' },
                  { tool: 'Bolt', problem: 'Great prototype, broken in production' },
                  { tool: 'Replit', problem: "Where's the deployment button?" },
                  { tool: 'Lovable', problem: 'AI slop aesthetic, no customization' },
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <ComparisonXIcon size={18} className="flex-shrink-0" />
                    <div>
                      <span className="text-kriptik-white font-medium">{item.tool}:</span>
                      <span className="text-kriptik-silver/60 ml-2">{item.problem}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>
          </motion.div>

          {/* KripTik solution */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="p-6 rounded-2xl bg-gradient-to-br from-kriptik-lime/5 to-transparent border border-kriptik-lime/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-kriptik-lime" />
                <span className="text-sm font-mono uppercase tracking-wider text-kriptik-lime/60">
                  KripTik AI
                </span>
              </div>

              <ul className="space-y-4">
                {[
                  { feature: '6-Agent Verification', benefit: 'Zero errors reach production' },
                  { feature: 'Autonomous Building', benefit: 'Ship while you sleep' },
                  { feature: 'Speed Dial', benefit: 'From seconds to enterprise-ready' },
                  { feature: 'One-Click Deploy', benefit: 'Vercel, Netlify, any platform' },
                  { feature: 'Anti-Slop Detection', benefit: 'Unique, premium UX guaranteed' },
                ].map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <ComparisonCheckIcon size={18} className="flex-shrink-0" />
                    <div>
                      <span className="text-kriptik-white font-medium">{item.feature}:</span>
                      <span className="text-kriptik-silver/60 ml-2">{item.benefit}</span>
                    </div>
                  </motion.li>
                ))}
              </ul>
            </div>

            {/* Glow effect */}
            <div className="absolute -inset-4 bg-kriptik-lime/5 rounded-3xl blur-3xl -z-10" />
          </motion.div>
        </div>

        {/* Transition text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mt-16"
        >
          <span className="text-2xl md:text-3xl font-display font-bold text-kriptik-lime">
            KripTik is Different.
          </span>
        </motion.div>
      </div>
    </section>
  );
}

// Main Landing Page Component
export function LandingPage() {
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    lenisRef.current = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenisRef.current?.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenisRef.current?.destroy();
    };
  }, []);

  // Handle reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (mediaQuery.matches) {
      lenisRef.current?.stop();
    }

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        lenisRef.current?.stop();
      } else {
        lenisRef.current?.start();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="min-h-screen bg-kriptik-black text-kriptik-white overflow-x-hidden"
      >
        {/* Hero Section */}
        <Suspense fallback={<SectionLoader />}>
          <Hero3D />
        </Suspense>

        {/* Problem/Solution Section */}
        <ProblemSection />

        {/* Agent Visualization - Horizontal Scroll */}
        <Suspense fallback={<SectionLoader />}>
          <AgentVisualization />
        </Suspense>

        {/* Speed Dial */}
        <Suspense fallback={<SectionLoader />}>
          <SpeedDial3D />
        </Suspense>

        {/* Product Showcase */}
        <Suspense fallback={<SectionLoader />}>
          <ProductShowcase />
        </Suspense>

        {/* Bento Grid Features */}
        <Suspense fallback={<SectionLoader />}>
          <BentoGrid />
        </Suspense>

        {/* Trust & Credibility */}
        <Suspense fallback={<SectionLoader />}>
          <TrustSection />
        </Suspense>

        {/* Pricing */}
        <Suspense fallback={<SectionLoader />}>
          <PricingRedesign />
        </Suspense>

        {/* Final CTA */}
        <Suspense fallback={<SectionLoader />}>
          <FinalCTA />
        </Suspense>

        {/* Footer */}
        <Suspense fallback={<SectionLoader />}>
          <Footer3D />
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}

export default LandingPage;
