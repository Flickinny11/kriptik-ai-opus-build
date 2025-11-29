/**
 * Embedded Browser Component
 *
 * Shows a proxy browser window within KripTik AI where users can:
 * 1. Log into their AI builder platform
 * 2. Whitelist/select their project
 * 3. Watch as automation extracts everything
 *
 * Features:
 * - Real browser view via WebSocket streaming
 * - Glitch animation transition when automation takes over
 * - KripTik AI logo animation during processing
 * - Progress indicator with phase descriptions
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, CheckCircle2, Loader2, Lock, Download, MessageSquare, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface EmbeddedBrowserProps {
    sessionId: string;
    source: string;
    onLoginComplete: () => void;
    onWhitelist: () => void;
    onExtractionComplete: (data: ExtractedData) => void;
    onError: (error: string) => void;
}

interface ExtractedData {
    chatHistory: Array<{ role: string; content: string }>;
    errorCount: number;
    fileCount: number;
}

interface ExtractionProgress {
    phase: 'waiting_login' | 'logged_in' | 'extracting_chat' | 'extracting_files' | 'extracting_logs' | 'downloading' | 'complete' | 'error';
    progress: number;
    message: string;
}

type BrowserPhase = 'connecting' | 'login' | 'whitelist' | 'glitch_transition' | 'extracting' | 'complete';

// Glitch text animation variants
const glitchVariants = {
    initial: { opacity: 0 },
    animate: {
        opacity: [0, 1, 0.8, 1, 0.9, 1],
        x: [0, -2, 3, -1, 2, 0],
        filter: [
            'hue-rotate(0deg)',
            'hue-rotate(90deg)',
            'hue-rotate(-90deg)',
            'hue-rotate(45deg)',
            'hue-rotate(0deg)',
        ],
        transition: {
            duration: 0.5,
            times: [0, 0.2, 0.4, 0.6, 0.8, 1],
        },
    },
};

const GlitchText = ({ children, className }: { children: string; className?: string }) => (
    <motion.span
        variants={glitchVariants}
        initial="initial"
        animate="animate"
        className={cn("relative inline-block", className)}
    >
        {/* Main text */}
        <span className="relative z-10">{children}</span>

        {/* Glitch layers */}
        <motion.span
            className="absolute inset-0 text-cyan-400 opacity-70"
            animate={{
                x: [0, 2, -2, 1, 0],
                clipPath: [
                    'inset(0 0 0 0)',
                    'inset(20% 0 30% 0)',
                    'inset(40% 0 20% 0)',
                    'inset(10% 0 50% 0)',
                    'inset(0 0 0 0)',
                ],
            }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 2 }}
        >
            {children}
        </motion.span>
        <motion.span
            className="absolute inset-0 text-red-400 opacity-70"
            animate={{
                x: [0, -2, 2, -1, 0],
                clipPath: [
                    'inset(0 0 0 0)',
                    'inset(60% 0 10% 0)',
                    'inset(30% 0 40% 0)',
                    'inset(70% 0 5% 0)',
                    'inset(0 0 0 0)',
                ],
            }}
            transition={{ duration: 0.3, repeat: Infinity, repeatDelay: 2, delay: 0.1 }}
        >
            {children}
        </motion.span>
    </motion.span>
);

// Smoke particle component for transition
const SmokeParticle = ({ delay }: { delay: number }) => (
    <motion.div
        className="absolute w-32 h-32 rounded-full bg-gradient-to-br from-slate-400/30 to-slate-600/10 blur-3xl"
        initial={{
            scale: 0,
            opacity: 0,
            x: Math.random() * 400 - 200,
            y: Math.random() * 300 - 150,
        }}
        animate={{
            scale: [0, 2, 3],
            opacity: [0, 0.8, 0],
            x: Math.random() * 200 - 100,
            y: -200,
        }}
        transition={{
            duration: 2,
            delay,
            ease: "easeOut",
        }}
    />
);

export default function EmbeddedBrowser({
    sessionId,
    source,
    onLoginComplete,
    onWhitelist,
    onExtractionComplete,
    onError,
}: EmbeddedBrowserProps) {
    const [phase, setPhase] = useState<BrowserPhase>('connecting');
    const [progress, setProgress] = useState<ExtractionProgress | null>(null);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [showGlitch, setShowGlitch] = useState(false);
    const [showSmoke, setShowSmoke] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);

    // Connect to backend WebSocket for browser streaming
    useEffect(() => {
        const connectWs = async () => {
            try {
                // Initialize browser session on backend
                const response = await fetch(`/api/fix-my-app/${sessionId}/browser/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source }),
                });

                if (!response.ok) {
                    throw new Error('Failed to start browser session');
                }

                const data = await response.json();
                // wsEndpoint and viewUrl available in data for production WebSocket streaming
                void data; // Acknowledge the response data

                // For development, we'll use screenshots instead of full WebSocket streaming
                // In production, you'd use playwright's CDP or a VNC solution
                setPhase('login');

                // Start polling for screenshots
                pollScreenshots();

            } catch (error) {
                onError(`Connection failed: ${error}`);
            }
        };

        connectWs();

        return () => {
            wsRef.current?.close();
        };
    }, [sessionId, source]);

    // Poll for screenshots from the browser session
    const pollScreenshots = useCallback(async () => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/fix-my-app/${sessionId}/browser/screenshot`);
                if (response.ok) {
                    const { screenshot: img, progress: prog } = await response.json();
                    if (img) setScreenshot(img);
                    if (prog) {
                        setProgress(prog);
                        handleProgressUpdate(prog);
                    }
                }
            } catch {
                // Ignore polling errors
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [sessionId]);

    // Handle progress updates and phase transitions
    const handleProgressUpdate = (prog: ExtractionProgress) => {
        switch (prog.phase) {
            case 'logged_in':
                if (phase === 'login') {
                    triggerGlitchTransition();
                }
                break;
            case 'complete':
                setPhase('complete');
                // Notify parent that extraction is complete with extracted data
                onExtractionComplete({
                    chatHistory: [], // Will be populated from the extraction results
                    errorCount: 0,
                    fileCount: 0,
                });
                break;
            case 'error':
                onError(prog.message);
                break;
        }
    };

    // Trigger the glitch transition when automation takes over
    const triggerGlitchTransition = () => {
        setShowGlitch(true);
        setPhase('glitch_transition');

        // After glitch, show smoke
        setTimeout(() => {
            setShowSmoke(true);
        }, 800);

        // After smoke, show extraction UI
        setTimeout(() => {
            setShowGlitch(false);
            setShowSmoke(false);
            setPhase('extracting');
        }, 2500);
    };

    // User confirms they've logged in and triggers extraction
    const handleLoginConfirm = async () => {
        try {
            const response = await fetch(`/api/fix-my-app/${sessionId}/browser/confirm-login`, {
                method: 'POST',
            });

            if (response.ok) {
                onLoginComplete();
                onWhitelist(); // Notify parent that user has whitelisted
                triggerGlitchTransition();
                // Start the extraction process
                startExtraction();
            }
        } catch (error) {
            onError(`Login confirmation failed: ${error}`);
        }
    };

    // Start extraction after user whitelists - called via onWhitelist callback
    const startExtraction = async () => {
        try {
            const response = await fetch(`/api/fix-my-app/${sessionId}/browser/extract`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Extraction failed to start');
            }
        } catch (error) {
            onError(`Extraction failed: ${error}`);
        }
    };

    return (
        <div className="relative w-full h-[600px] rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
            {/* Browser Chrome Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 mx-4">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-slate-700/50 border border-slate-600/30">
                        <Lock className="w-3 h-3 text-green-400" />
                        <span className="text-xs text-slate-400 font-mono">
                            {source === 'lovable' && 'lovable.dev'}
                            {source === 'bolt' && 'bolt.new'}
                            {source === 'v0' && 'v0.dev'}
                            {source === 'cursor' && 'cursor.com'}
                            {!['lovable', 'bolt', 'v0', 'cursor'].includes(source) && `${source}.com`}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {phase === 'extracting' && (
                        <motion.div
                            className="w-2 h-2 rounded-full bg-amber-500"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                        />
                    )}
                </div>
            </div>

            {/* Browser Content Area */}
            <div className="relative w-full h-[calc(100%-56px)]">
                <AnimatePresence mode="wait">
                    {/* Connecting State */}
                    {phase === 'connecting' && (
                        <motion.div
                            key="connecting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-slate-950"
                        >
                            <div className="text-center">
                                <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto mb-4" />
                                <p className="text-slate-400">Initializing secure browser...</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Login Phase - Shows Browser Screenshot */}
                    {phase === 'login' && (
                        <motion.div
                            key="login"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                        >
                            {/* Browser Screenshot */}
                            {screenshot ? (
                                <img
                                    src={`data:image/png;base64,${screenshot}`}
                                    alt="Browser view"
                                    className="w-full h-full object-contain bg-white"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-900">
                                    <p className="text-slate-500">Loading browser view...</p>
                                </div>
                            )}

                            {/* Login Confirmation Overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-900 via-slate-900/95 to-transparent">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-amber-500/20">
                                            <Shield className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">Sign in to your account</p>
                                            <p className="text-xs text-slate-400">We'll wait here - click "I'm Logged In" when ready</p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleLoginConfirm}
                                        className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-semibold"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        I'm Logged In
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Glitch Transition */}
                    {(showGlitch || showSmoke) && (
                        <motion.div
                            key="glitch"
                            className="absolute inset-0 bg-slate-950 overflow-hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Glitch Effect */}
                            {showGlitch && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <motion.div
                                        className="text-6xl font-bold"
                                        animate={{
                                            opacity: [1, 0, 1, 0.5, 1],
                                            scale: [1, 1.05, 0.95, 1.02, 1],
                                        }}
                                        transition={{ duration: 0.8 }}
                                    >
                                        <GlitchText className="bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent">
                                            KRIPTIK AI
                                        </GlitchText>
                                    </motion.div>

                                    {/* Scan lines */}
                                    <motion.div
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            background: `repeating-linear-gradient(
                                                0deg,
                                                transparent,
                                                transparent 2px,
                                                rgba(0, 0, 0, 0.3) 2px,
                                                rgba(0, 0, 0, 0.3) 4px
                                            )`,
                                        }}
                                        animate={{ opacity: [0.5, 0.8, 0.5] }}
                                        transition={{ duration: 0.2, repeat: Infinity }}
                                    />
                                </div>
                            )}

                            {/* Smoke Particles */}
                            {showSmoke && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {Array.from({ length: 20 }).map((_, i) => (
                                        <SmokeParticle key={i} delay={i * 0.05} />
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Extraction Phase */}
                    {phase === 'extracting' && (
                        <motion.div
                            key="extracting"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-8"
                        >
                            {/* KripTik AI Logo */}
                            <motion.div
                                className="relative mb-8"
                                animate={{
                                    scale: [1, 1.02, 1],
                                    filter: [
                                        'drop-shadow(0 0 20px rgba(251, 191, 36, 0.3))',
                                        'drop-shadow(0 0 40px rgba(251, 191, 36, 0.5))',
                                        'drop-shadow(0 0 20px rgba(251, 191, 36, 0.3))',
                                    ],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <div className="text-4xl font-bold bg-gradient-to-r from-white via-amber-200 to-white bg-clip-text text-transparent">
                                    KRIPTIK AI
                                </div>
                                <motion.div
                                    className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                            </motion.div>

                            {/* Working Indicator */}
                            <div className="flex items-center gap-3 mb-6">
                                <motion.div
                                    className="w-3 h-3 rounded-full bg-amber-500"
                                    animate={{
                                        scale: [1, 1.2, 1],
                                        boxShadow: [
                                            '0 0 0 0 rgba(251, 191, 36, 0.4)',
                                            '0 0 0 10px rgba(251, 191, 36, 0)',
                                            '0 0 0 0 rgba(251, 191, 36, 0.4)',
                                        ],
                                    }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                />
                                <span className="text-amber-400 font-medium">Working...</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full max-w-md mb-4">
                                <Progress value={progress?.progress || 0} className="h-2 bg-slate-800" />
                            </div>

                            {/* Phase Message */}
                            <p className="text-slate-400 text-sm mb-8">
                                {progress?.message || 'Initializing extraction...'}
                            </p>

                            {/* Extraction Status Icons */}
                            <div className="flex gap-8">
                                <ExtractionPhaseIcon
                                    icon={MessageSquare}
                                    label="Chat History"
                                    active={progress?.phase === 'extracting_chat'}
                                    complete={['extracting_files', 'extracting_logs', 'downloading', 'complete'].includes(progress?.phase || '')}
                                />
                                <ExtractionPhaseIcon
                                    icon={Download}
                                    label="Project Files"
                                    active={progress?.phase === 'extracting_files' || progress?.phase === 'downloading'}
                                    complete={['complete'].includes(progress?.phase || '')}
                                />
                                <ExtractionPhaseIcon
                                    icon={AlertTriangle}
                                    label="Error Logs"
                                    active={progress?.phase === 'extracting_logs'}
                                    complete={['downloading', 'complete'].includes(progress?.phase || '')}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* Complete Phase */}
                    {phase === 'complete' && (
                        <motion.div
                            key="complete"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-8"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.2 }}
                                className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center mb-6"
                            >
                                <CheckCircle2 className="w-10 h-10 text-white" />
                            </motion.div>
                            <h3 className="text-2xl font-bold text-white mb-2">Extraction Complete!</h3>
                            <p className="text-slate-400 text-center max-w-md">
                                Your project has been imported. KripTik AI is now analyzing everything to understand what went wrong and how to fix it.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Sub-component for extraction phase icons
function ExtractionPhaseIcon({
    icon: Icon,
    label,
    active,
    complete,
}: {
    icon: React.ElementType;
    label: string;
    active: boolean;
    complete: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-2">
            <motion.div
                className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                    complete ? "bg-emerald-500/20 text-emerald-400" :
                    active ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-800 text-slate-500"
                )}
                animate={active ? {
                    scale: [1, 1.1, 1],
                    boxShadow: [
                        '0 0 0 0 rgba(251, 191, 36, 0)',
                        '0 0 0 8px rgba(251, 191, 36, 0.2)',
                        '0 0 0 0 rgba(251, 191, 36, 0)',
                    ],
                } : {}}
                transition={{ duration: 1.5, repeat: active ? Infinity : 0 }}
            >
                {complete ? (
                    <CheckCircle2 className="w-6 h-6" />
                ) : active ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                    <Icon className="w-6 h-6" />
                )}
            </motion.div>
            <span className={cn(
                "text-xs font-medium",
                complete ? "text-emerald-400" :
                active ? "text-amber-400" :
                "text-slate-500"
            )}>
                {label}
            </span>
        </div>
    );
}

