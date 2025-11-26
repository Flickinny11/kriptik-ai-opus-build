import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, Zap, Code2, Cloud, Brain, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

/**
 * Premium Hero Section
 *
 * Features:
 * - Animated gradient background with floating orbs
 * - Staggered text animations
 * - Floating feature badges
 * - Parallax preview image
 * - Depth through layering
 */

const floatingBadges = [
    { icon: Brain, label: 'AI-Powered', delay: 0.6, x: -200, y: -80 },
    { icon: Cloud, label: 'Cloud Deploy', delay: 0.7, x: 220, y: -60 },
    { icon: Code2, label: 'Production Ready', delay: 0.8, x: -180, y: 120 },
    { icon: Layers, label: 'Full-Stack', delay: 0.9, x: 200, y: 100 },
];

export default function Hero() {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ['start start', 'end start']
    });

    const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <section
            ref={containerRef}
            className="relative min-h-[100vh] pt-24 pb-32 overflow-hidden gradient-bg noise-overlay"
        >
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden -z-10">
                <motion.div
                    className="absolute w-[600px] h-[600px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--glow-primary) 0%, transparent 70%)',
                        left: '10%',
                        top: '-20%',
                    }}
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
                <motion.div
                    className="absolute w-[500px] h-[500px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--glow-accent) 0%, transparent 70%)',
                        right: '5%',
                        top: '30%',
                    }}
                    animate={{
                        x: [0, -40, 0],
                        y: [0, 50, 0],
                    }}
                    transition={{
                        duration: 25,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
                <motion.div
                    className="absolute w-[400px] h-[400px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, var(--glow-primary) 0%, transparent 70%)',
                        left: '40%',
                        bottom: '-10%',
                    }}
                    animate={{
                        x: [0, 30, 0],
                        y: [0, -40, 0],
                    }}
                    transition={{
                        duration: 18,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            </div>

            <motion.div style={{ y, opacity }} className="container mx-auto px-4 relative z-10">
                <div className="text-center max-w-5xl mx-auto">
                    {/* Premium badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Introducing KripTik AI v2.0</span>
                        <Zap className="w-4 h-4" />
                    </motion.div>

                    {/* Main headline */}
                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight"
                        style={{ fontFamily: 'var(--font-display)' }}
                    >
                        <span className="block mb-2">Build Production Apps</span>
                        <span className="text-gradient">With AI Agents</span>
                    </motion.h1>

                    {/* Subheadline */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed"
                    >
                        The first AI-native builder with{' '}
                        <span className="text-foreground font-medium">multi-agent orchestration</span>.
                        Generate full-stack apps, deploy to cloud, and ship to production—all from natural language.
                    </motion.p>

                    {/* CTA Buttons */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                    >
                        <Link to="/signup">
                            <Button variant="premium" size="xl" className="min-w-[200px]">
                                Start Building Free
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                        </Link>
                        <Link to="/demo">
                            <Button variant="glass" size="xl" className="min-w-[200px]">
                                Watch Demo
                            </Button>
                        </Link>
                    </motion.div>

                    {/* Social proof */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="mt-12 flex items-center justify-center gap-8 text-sm text-muted-foreground"
                    >
                        <div className="flex items-center gap-2">
                            <div className="flex -space-x-2">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-background"
                                    />
                                ))}
                            </div>
                            <span>1,000+ builders</span>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                            <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <svg key={i} className="w-4 h-4 text-yellow-500 fill-current" viewBox="0 0 20 20">
                                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                                    </svg>
                                ))}
                            </div>
                            <span>5.0 rating</span>
                    </div>
                </motion.div>
                </div>

                {/* Floating feature badges */}
                <div className="hidden lg:block absolute inset-0 pointer-events-none">
                    {floatingBadges.map((badge, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, delay: badge.delay }}
                            className="absolute left-1/2 top-1/2"
                            style={{
                                transform: `translate(${badge.x}px, ${badge.y}px)`,
                            }}
                        >
                            <motion.div
                                animate={{ y: [0, -8, 0] }}
                                transition={{
                                    duration: 3 + index * 0.5,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                }}
                                className="glass-card px-4 py-2 flex items-center gap-2 shadow-lg"
                            >
                                <badge.icon className="w-4 h-4 text-primary" />
                                <span className="text-sm font-medium whitespace-nowrap">{badge.label}</span>
                            </motion.div>
                        </motion.div>
                    ))}
                </div>

                {/* Preview Window */}
                <motion.div
                    initial={{ opacity: 0, y: 60, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-20 relative max-w-6xl mx-auto"
                >
                    {/* Glow effect behind preview */}
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-accent/10 to-transparent blur-3xl -z-10" />

                    {/* Browser chrome */}
                    <div className="depth-card overflow-hidden">
                        {/* Browser header */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border/50">
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                            </div>
                            <div className="flex-1 flex justify-center">
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-background/50 border border-border/50 text-sm text-muted-foreground max-w-md w-full">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                    </svg>
                                    <span className="truncate">app.kriptik.ai/builder</span>
                                </div>
                            </div>
                        </div>

                        {/* Preview content - showing a mockup of the builder */}
                        <div className="relative aspect-video bg-gradient-to-br from-background via-muted/30 to-background">
                            {/* Simulated IDE layout */}
                            <div className="absolute inset-0 grid grid-cols-12 gap-0.5 p-0.5 opacity-90">
                                {/* Sidebar */}
                                <div className="col-span-3 bg-sidebar/80 rounded-l-lg p-4 space-y-3">
                                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                                    <div className="space-y-2">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <div key={i} className="h-3 bg-muted/60 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                                        ))}
                                    </div>
                                </div>

                                {/* Main content */}
                                <div className="col-span-6 bg-background/80 flex flex-col">
                                    {/* Tab bar */}
                                    <div className="h-8 border-b border-border/30 flex items-center gap-2 px-3">
                                        <div className="h-5 w-20 bg-primary/20 rounded text-xs flex items-center justify-center text-primary">App.tsx</div>
                                        <div className="h-5 w-20 bg-muted/40 rounded" />
                                    </div>
                                    {/* Code area */}
                                    <div className="flex-1 p-4 space-y-2 font-mono text-xs">
                                        <div className="flex gap-2">
                                            <span className="text-primary/60">1</span>
                                            <span className="text-purple-400">import</span>
                                            <span className="text-foreground/80">{'{ useState }'}</span>
                                            <span className="text-purple-400">from</span>
                                            <span className="text-green-400">'react'</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <span className="text-primary/60">2</span>
                                            <span className="text-muted-foreground/60">{'//'} AI generating...</span>
                                            <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
                                        </div>
                                    </div>
                                </div>

                                {/* Preview pane */}
                                <div className="col-span-3 bg-background/60 rounded-r-lg p-4 flex items-center justify-center">
                                    <div className="w-full h-full rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-center">
                                        <div className="text-center">
                                            <div className="w-12 h-12 rounded-xl bg-primary/20 mx-auto mb-2 flex items-center justify-center">
                                                <Zap className="w-6 h-6 text-primary" />
                                            </div>
                                            <div className="h-3 w-20 bg-muted/60 rounded mx-auto" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Agent activity overlay */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 1, duration: 0.5 }}
                                className="absolute bottom-4 right-4 glass-card p-3 text-sm max-w-xs"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="font-medium text-foreground">Agent Working</span>
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    Generating React component with TypeScript types...
                                </p>
                            </motion.div>
                        </div>
                    </div>

                    {/* Bottom fade gradient */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
                </motion.div>
            </motion.div>
        </section>
    );
}
