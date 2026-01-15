/**
 * Fix My App Intro Animation
 *
 * Immersive 3D cinematic intro with:
 * - Multiple angled code screens
 * - Frustration visualization
 * - Smoke transition effect
 * - High-tech photorealistic aesthetics
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FixMyAppIntroProps {
    onComplete: () => void;
}

// Simulated code that scrolls down the screens
const CODE_SNIPPETS = [
    `import React from 'react';
function App() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .catch(err => {
        // ERROR: Unhandled Promise Rejection
        console.error("Failed to fetch:", err);
      });
  }, []);
  return (
    <div className="app">
      {/* Error: data is undefined */}
      {data.map(item => (
        <Component key={item.id} {...item} />
      ))}
    </div>
  );
}`,
    `export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ERROR: Missing authentication
    const user = await db.user.findFirst({
      where: { id: body.userId }
    });
    // TypeError: Cannot read property 'email' of undefined
    return Response.json({ email: user.email });
  } catch (error) {
    // Uncaught exception - server crash
    throw new Error("Internal Server Error");
  }
}`,
    `const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  // BUG: Never sets loading to false
  const response = await api.submit(formData);
  if (response.error) {
    // ERROR: setError is not a function
    setError(response.error);
  }
  // Missing: success handling
  // Missing: redirect logic
  // Missing: validation
};

// Component unmounts before async completes
// Memory leak warning`,
];

// Floating error messages
const ERROR_MESSAGES = [
    'TypeError: Cannot read property of undefined',
    'Error: Module not found',
    'Failed to compile',
    'Unhandled Promise Rejection',
    '500 Internal Server Error',
    'CORS error: Access blocked',
    'Maximum call stack exceeded',
    'Build failed with exit code 1',
];

// 3D Screen Component
function CodeScreen({
    code,
    style,
    delay,
    className,
}: {
    code: string;
    style?: React.CSSProperties;
    delay: number;
    className?: string;
}) {
    const [scrollOffset, setScrollOffset] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setScrollOffset((prev) => (prev + 1) % 100);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    return (
        <motion.div
            initial={{ opacity: 0, y: 100, rotateX: -30 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ delay, duration: 0.8, ease: 'easeOut' }}
            className={cn(
                'absolute rounded-2xl overflow-hidden',
                className
            )}
            style={{
                ...style,
                transformStyle: 'preserve-3d',
                boxShadow: `
                    0 0 0 1px rgba(255,255,255,0.1),
                    0 20px 60px -10px rgba(0,0,0,0.8),
                    inset 0 1px 0 rgba(255,255,255,0.1)
                `,
            }}
        >
            {/* 3D Edge - Top */}
            <div
                className="absolute -top-2 left-0 right-0 h-2 bg-gradient-to-b from-slate-600 to-slate-800"
                style={{ transform: 'rotateX(-90deg) translateZ(1px)' }}
            />
            {/* 3D Edge - Left */}
            <div
                className="absolute -left-2 top-0 bottom-0 w-2 bg-gradient-to-r from-slate-700 to-slate-800"
                style={{ transform: 'rotateY(90deg) translateZ(1px)' }}
            />

            {/* Screen content */}
            <div className="relative w-full h-full bg-[#0d1117] p-4 overflow-hidden">
                {/* Fake browser chrome */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 mx-4 h-4 bg-slate-800 rounded-full" />
                </div>

                {/* Code */}
                <pre
                    className="font-mono text-[10px] leading-tight text-slate-400 overflow-hidden"
                    style={{ transform: `translateY(-${scrollOffset}px)` }}
                >
                    {code}
                    {'\n\n'}
                    {code}
                </pre>

                {/* Red error glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-red-500/20 to-transparent pointer-events-none" />

                {/* Scan line effect */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `repeating-linear-gradient(
                            0deg,
                            transparent,
                            transparent 2px,
                            rgba(0,0,0,0.1) 2px,
                            rgba(0,0,0,0.1) 4px
                        )`,
                    }}
                />
            </div>
        </motion.div>
    );
}

// Floating error badge
function ErrorBadge({ message, delay, x, y }: { message: string; delay: number; x: string; y: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1, 1, 0.8],
                y: [0, -10, -10, -20],
            }}
            transition={{
                delay,
                duration: 4,
                repeat: Infinity,
                repeatDelay: Math.random() * 3,
            }}
            className={cn(
                'absolute px-3 py-1.5 rounded-lg',
                'bg-red-500/90 text-white text-xs font-mono',
                'shadow-lg shadow-red-500/30',
                'whitespace-nowrap'
            )}
            style={{ left: x, top: y }}
        >
            {message}
        </motion.div>
    );
}

// Smoke particle
function SmokeParticle({ delay, x }: { delay: number; x: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 0, scale: 0 }}
            animate={{
                opacity: [0, 0.6, 0],
                y: [-50, -200],
                scale: [0, 2, 3],
                x: [0, (Math.random() - 0.5) * 100],
            }}
            transition={{ delay, duration: 2, ease: 'easeOut' }}
            className="absolute rounded-full"
            style={{
                left: `${x}%`,
                bottom: '20%',
                width: 80,
                height: 80,
                background: 'radial-gradient(circle, rgba(100,100,100,0.4) 0%, transparent 70%)',
                filter: 'blur(20px)',
            }}
        />
    );
}

export function FixMyAppIntro({ onComplete }: FixMyAppIntroProps) {
    const [phase, setPhase] = useState<'frustration' | 'smoke' | 'ready'>('frustration');

    // Progress through phases
    useEffect(() => {
        const timer1 = setTimeout(() => setPhase('smoke'), 5000);
        const timer2 = setTimeout(() => setPhase('ready'), 6500);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-[#050507] overflow-hidden">
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-[#050507] to-slate-950/30" />

            {/* Grid pattern */}
            <div
                className="absolute inset-0 opacity-20"
                style={{
                    backgroundImage: `
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px',
                }}
            />

            <AnimatePresence mode="wait">
                {phase === 'frustration' && (
                    <motion.div
                        key="frustration"
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                        style={{ perspective: '1500px' }}
                    >
                        {/* 3D Code Screens */}
                        <CodeScreen
                            code={CODE_SNIPPETS[0]}
                            delay={0.2}
                            className="w-80 h-64"
                            style={{
                                left: '5%',
                                top: '15%',
                                transform: 'rotateY(25deg) rotateX(-5deg)',
                            }}
                        />
                        <CodeScreen
                            code={CODE_SNIPPETS[1]}
                            delay={0.4}
                            className="w-96 h-72"
                            style={{
                                left: '35%',
                                top: '10%',
                                transform: 'rotateY(-5deg) rotateX(3deg)',
                            }}
                        />
                        <CodeScreen
                            code={CODE_SNIPPETS[2]}
                            delay={0.6}
                            className="w-80 h-64"
                            style={{
                                right: '5%',
                                top: '20%',
                                transform: 'rotateY(-25deg) rotateX(-5deg)',
                            }}
                        />

                        {/* Floating error messages */}
                        {ERROR_MESSAGES.map((msg, i) => (
                            <ErrorBadge
                                key={i}
                                message={msg}
                                delay={0.8 + i * 0.3}
                                x={`${10 + (i % 4) * 25}%`}
                                y={`${30 + Math.floor(i / 4) * 30}%`}
                            />
                        ))}

                        {/* Frustration message box */}
                        <motion.div
                            initial={{ opacity: 0, y: 50, rotateX: 20 }}
                            animate={{ opacity: 1, y: 0, rotateX: 0 }}
                            transition={{ delay: 1.5, duration: 0.8 }}
                            className="absolute left-1/2 bottom-[15%] -translate-x-1/2 w-[500px]"
                            style={{ transformStyle: 'preserve-3d' }}
                        >
                            <div
                                className="relative p-8 rounded-2xl bg-white/95 text-center"
                                style={{
                                    boxShadow: `
                                        0 30px 60px -10px rgba(0,0,0,0.5),
                                        0 0 0 1px rgba(255,255,255,0.5),
                                        inset 0 2px 0 rgba(255,255,255,0.8)
                                    `,
                                    transform: 'rotateX(-5deg)',
                                }}
                            >
                                {/* 3D depth edges */}
                                <div className="absolute -bottom-3 left-4 right-4 h-3 bg-slate-300 rounded-b-lg" style={{ transform: 'translateZ(-10px)' }} />

                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 2 }}
                                    className="text-slate-600 text-sm mb-2"
                                >
                                    Working for hours on an app...
                                </motion.p>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 2.5 }}
                                    className="text-slate-600 text-sm mb-2"
                                >
                                    On another platform...
                                </motion.p>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 3 }}
                                    className="text-red-500 font-semibold mb-1"
                                >
                                    Wasting your time...
                                </motion.p>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 3.5 }}
                                    className="text-red-500 font-semibold mb-4"
                                >
                                    Wasting your money...
                                </motion.p>
                                <motion.h2
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 4, duration: 0.5 }}
                                    className="text-3xl font-black text-slate-900"
                                >
                                    FIX YOUR APP NOW!
                                </motion.h2>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {phase === 'smoke' && (
                    <motion.div
                        key="smoke"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                    >
                        {/* Smoke particles */}
                        {Array.from({ length: 30 }).map((_, i) => (
                            <SmokeParticle
                                key={i}
                                delay={i * 0.05}
                                x={Math.random() * 100}
                            />
                        ))}

                        {/* Flash effect */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 0.5 }}
                            className="absolute inset-0 bg-white/30"
                        />
                    </motion.div>
                )}

                {phase === 'ready' && (
                    <motion.div
                        key="ready"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        <motion.div
                            initial={{ scale: 0.8, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            transition={{ type: 'spring', bounce: 0.4 }}
                            className="text-center"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: 'spring', bounce: 0.5 }}
                                className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-2xl shadow-amber-500/30"
                            >
                                <span className="text-5xl">🔧</span>
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="text-4xl font-black text-white mb-4"
                            >
                                Let's Fix This
                            </motion.h1>

                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="text-slate-400 mb-8"
                            >
                                Import your broken app and watch KripTik AI make it work
                            </motion.p>

                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.8 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={onComplete}
                                className={cn(
                                    'px-8 py-4 rounded-2xl font-bold text-lg',
                                    'bg-gradient-to-r from-amber-500 to-orange-500 text-black',
                                    'shadow-2xl shadow-amber-500/30',
                                    'hover:shadow-amber-500/50',
                                    'transition-shadow duration-300'
                                )}
                            >
                                Start Fixing →
                            </motion.button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skip button */}
            {phase === 'frustration' && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                    onClick={onComplete}
                    className="absolute bottom-8 right-8 text-slate-500 hover:text-white text-sm transition-colors"
                >
                    Skip intro →
                </motion.button>
            )}
        </div>
    );
}

export default FixMyAppIntro;

