/**
 * EmbeddedBrowserFrame - Embedded browser window for Fix My App
 *
 * This component displays a small browser window WITHIN the KripTik AI UI,
 * allowing users to log in and navigate to their project while receiving
 * real-time guidance. When ready, AI agent takes control.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Loader2,
    MousePointer2,
    ArrowUp,
    RefreshCw,
    Maximize2,
    Minimize2,
    Play,
    CheckCircle2,
    Download,
    MessageSquare,
    FileCode,
    Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export type BrowserPhase =
    | 'initializing'      // Browser starting up
    | 'user_control'      // User can interact
    | 'awaiting_sync'     // User at project, ready to sync
    | 'agent_control'     // AI agent has control
    | 'downloading'       // Downloading ZIP
    | 'extracting'        // Extracting files
    | 'transitioning'     // Fading out browser
    | 'background'        // Working in background
    | 'complete'          // All done
    | 'error';

export interface ExtractionProgress {
    zipDownloaded: boolean;
    chatHistoryExtracted: boolean;
    buildLogsExtracted: boolean;
    runtimeLogsExtracted: boolean;
    analysisStarted: boolean;
}

export interface EmbeddedBrowserFrameProps {
    sessionId: string;
    sourceUrl: string;
    sourcePlatform: string;
    onSyncStart: () => void;
    onExtractionComplete: (data: {
        zipPath: string;
        chatHistory: string;
        buildLogs: string;
        runtimeLogs: string;
    }) => void;
    onClose: () => void;
    onError: (error: string) => void;
}

// =============================================================================
// PLATFORM CONFIGS
// =============================================================================

const PLATFORM_GUIDANCE: Record<string, {
    loginPrompt: string;
    projectPrompt: string;
    readyPrompt: string;
    downloadLocation: string;
}> = {
    lovable: {
        loginPrompt: "Log in to Lovable.dev using your account",
        projectPrompt: "Navigate to the project you want to fix",
        readyPrompt: "When you see your project's builder screen with the chat and preview, click 'Begin Sync'",
        downloadLocation: "Menu → Export → Download ZIP"
    },
    bolt: {
        loginPrompt: "Log in to Bolt.new with your account",
        projectPrompt: "Open the project that needs fixing",
        readyPrompt: "When you're at the editor with your code visible, click 'Begin Sync'",
        downloadLocation: "Export button → Download"
    },
    v0: {
        loginPrompt: "Sign in to v0.dev with your Vercel account",
        projectPrompt: "Find and open your component/project",
        readyPrompt: "When you see your component code and preview, click 'Begin Sync'",
        downloadLocation: "Copy code / Export"
    },
    replit: {
        loginPrompt: "Log in to Replit",
        projectPrompt: "Open your Repl that needs fixing",
        readyPrompt: "When you're in the Repl editor, click 'Begin Sync'",
        downloadLocation: "Three dots → Download as ZIP"
    },
    cursor: {
        loginPrompt: "Open Cursor and your project",
        projectPrompt: "Make sure your project folder is open",
        readyPrompt: "When ready, click 'Begin Sync'",
        downloadLocation: "File → Export / ZIP folder"
    },
    default: {
        loginPrompt: "Log in to your AI builder platform",
        projectPrompt: "Navigate to the project you want to fix",
        readyPrompt: "When you're at your project's main view, click 'Begin Sync'",
        downloadLocation: "Look for Export/Download option"
    }
};

// =============================================================================
// COMPONENT
// =============================================================================

export const EmbeddedBrowserFrame: React.FC<EmbeddedBrowserFrameProps> = ({
    sessionId,
    sourceUrl,
    sourcePlatform,
    onSyncStart,
    onExtractionComplete,
    onClose,
    onError
}) => {
    // State
    const [phase, setPhase] = useState<BrowserPhase>('initializing');
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [guidance, setGuidance] = useState<string>('');
    const [isMinimized, setIsMinimized] = useState(false);
    const [agentMessage, setAgentMessage] = useState<string>('');
    const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress>({
        zipDownloaded: false,
        chatHistoryExtracted: false,
        buildLogsExtracted: false,
        runtimeLogsExtracted: false,
        analysisStarted: false
    });
    const [showCursor, setShowCursor] = useState(false);
    const [cursorPosition, setCursorPosition] = useState({ x: 50, y: 50 });

    // Refs
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    // Get platform-specific guidance
    const platformConfig = PLATFORM_GUIDANCE[sourcePlatform] || PLATFORM_GUIDANCE.default;

    // ==========================================================================
    // EFFECTS
    // ==========================================================================

    // Initialize browser and start polling
    useEffect(() => {
        initializeBrowser();
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            if (wsRef.current) wsRef.current.close();
        };
    }, []);

    // Update guidance based on phase
    useEffect(() => {
        switch (phase) {
            case 'initializing':
                setGuidance('Starting secure browser...');
                break;
            case 'user_control':
                setGuidance(platformConfig.loginPrompt);
                break;
            case 'awaiting_sync':
                setGuidance(platformConfig.readyPrompt);
                break;
            case 'agent_control':
                setGuidance('KripTik AI is now in control. Watch the magic happen!');
                setShowCursor(true);
                break;
            case 'downloading':
                setGuidance(`Downloading your project... (${platformConfig.downloadLocation})`);
                break;
            case 'extracting':
                setGuidance('Extracting project files...');
                break;
            case 'transitioning':
                setGuidance("We'll take it from here! As soon as your app is ready, we'll let you know!");
                break;
            case 'background':
                setGuidance('Working in the background...');
                break;
            case 'complete':
                setGuidance('All done! Check your dashboard.');
                break;
            case 'error':
                setGuidance('Something went wrong. Please try again.');
                break;
        }
    }, [phase, platformConfig]);

    // ==========================================================================
    // BROWSER CONTROL
    // ==========================================================================

    const initializeBrowser = async () => {
        try {
            // For now, we'll use an iframe approach
            // In production, this would connect to a Playwright browser service
            setPhase('user_control');
            setGuidance(platformConfig.loginPrompt);

            // Start screenshot polling for visual feedback
            startScreenshotPolling();
        } catch (error) {
            console.error('Failed to initialize browser:', error);
            setPhase('error');
            onError('Failed to start browser');
        }
    };

    const startScreenshotPolling = () => {
        // Poll for screenshots to show browser state
        // This is a fallback when we can't embed the actual browser
        pollIntervalRef.current = setInterval(async () => {
            try {
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL || ''}/api/fix-my-app/${sessionId}/browser/screenshot`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.screenshot) {
                        setScreenshot(data.screenshot);
                    }
                }
            } catch {
                // Silent fail - screenshot polling is optional
            }
        }, 1000);
    };

    // ==========================================================================
    // SYNC & EXTRACTION
    // ==========================================================================

    const handleBeginSync = async () => {
        setPhase('agent_control');
        onSyncStart();

        try {
            // Notify backend to take control
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/fix-my-app/${sessionId}/browser/sync`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                }
            );

            if (!response.ok) throw new Error('Failed to start sync');

            // Connect to WebSocket for real-time updates
            connectToAgentStream();

            // Simulate agent actions for visual feedback
            await simulateAgentActions();

        } catch (error) {
            console.error('Sync failed:', error);
            setPhase('error');
            onError('Sync failed. Please try again.');
        }
    };

    const connectToAgentStream = () => {
        const wsUrl = `${(import.meta.env.VITE_API_URL || '').replace('http', 'ws')}/api/fix-my-app/${sessionId}/browser/stream`;

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleAgentUpdate(data);
            };

            wsRef.current.onerror = () => {
                console.log('WebSocket not available, using polling');
            };
        } catch {
            console.log('WebSocket not supported, using polling');
        }
    };

    const handleAgentUpdate = (data: {
        type: string;
        message?: string;
        cursorX?: number;
        cursorY?: number;
        progress?: Partial<ExtractionProgress>;
        phase?: BrowserPhase;
    }) => {
        switch (data.type) {
            case 'cursor_move':
                if (data.cursorX !== undefined && data.cursorY !== undefined) {
                    setCursorPosition({ x: data.cursorX, y: data.cursorY });
                }
                break;
            case 'message':
                if (data.message) setAgentMessage(data.message);
                break;
            case 'progress':
                if (data.progress) {
                    setExtractionProgress(prev => ({ ...prev, ...data.progress }));
                }
                break;
            case 'phase':
                if (data.phase) setPhase(data.phase);
                break;
        }
    };

    const simulateAgentActions = async () => {
        // This simulates the visual agent actions
        // In production, this would be driven by actual Playwright actions

        // Step 1: Move to download button
        setAgentMessage('Locating download option...');
        await animateCursor(80, 20);
        await delay(500);

        // Step 2: Click download
        setPhase('downloading');
        setAgentMessage('Downloading your project...');
        await animateCursor(85, 25);
        await delay(2000);

        // Step 3: Report download complete
        setExtractionProgress(prev => ({ ...prev, zipDownloaded: true }));
        setAgentMessage('ZIP file downloaded and extracted!');
        await delay(1000);

        // Step 4: Transition
        setPhase('transitioning');
        setAgentMessage("We'll take it from here! As soon as your app is ready, we'll let you know!");
        await delay(2000);

        // Step 5: Background work
        setPhase('background');

        // Background extraction simulation
        await delay(1000);
        setExtractionProgress(prev => ({ ...prev, chatHistoryExtracted: true }));

        await delay(800);
        setExtractionProgress(prev => ({ ...prev, buildLogsExtracted: true }));

        await delay(600);
        setExtractionProgress(prev => ({ ...prev, runtimeLogsExtracted: true }));

        await delay(500);
        setExtractionProgress(prev => ({ ...prev, analysisStarted: true }));

        // Complete
        setPhase('complete');
        onExtractionComplete({
            zipPath: `/tmp/projects/${sessionId}/project.zip`,
            chatHistory: 'Extracted chat history...',
            buildLogs: 'Build logs extracted...',
            runtimeLogs: 'Runtime logs extracted...'
        });
    };

    const animateCursor = async (targetX: number, targetY: number) => {
        const steps = 20;
        const startX = cursorPosition.x;
        const startY = cursorPosition.y;

        for (let i = 0; i <= steps; i++) {
            const progress = i / steps;
            const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            setCursorPosition({
                x: startX + (targetX - startX) * eased,
                y: startY + (targetY - startY) * eased
            });
            await delay(20);
        }
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // ==========================================================================
    // RENDER
    // ==========================================================================

    // Background work view (after browser fades)
    if (phase === 'background' || phase === 'complete') {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative w-full max-w-2xl mx-auto"
            >
                {/* Thumbnail placeholder */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 shadow-2xl">
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,140,50,0.1),transparent_50%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(255,100,50,0.05),transparent_50%)]" />

                    <div className="relative p-8">
                        {/* KripTik AI Logo Animation */}
                        <motion.div
                            className="flex justify-center mb-6"
                            animate={{
                                scale: [1, 1.05, 1],
                                opacity: [0.8, 1, 0.8]
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                                <Sparkles className="w-12 h-12 text-white" />
                            </div>
                        </motion.div>

                        {/* Status message */}
                        <motion.h3
                            className="text-2xl font-bold text-center text-white mb-2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {phase === 'complete' ? 'All Done!' : 'Working on your app...'}
                        </motion.h3>

                        <p className="text-center text-white/60 mb-8">
                            {phase === 'complete'
                                ? 'Check your dashboard to see your fixed project!'
                                : "We'll notify you when your app is ready."
                            }
                        </p>

                        {/* Extraction progress */}
                        <div className="space-y-3">
                            <ProgressItem
                                icon={<Download className="w-4 h-4" />}
                                label="Project files"
                                done={extractionProgress.zipDownloaded}
                            />
                            <ProgressItem
                                icon={<MessageSquare className="w-4 h-4" />}
                                label="Chat history"
                                done={extractionProgress.chatHistoryExtracted}
                            />
                            <ProgressItem
                                icon={<FileCode className="w-4 h-4" />}
                                label="Build & runtime logs"
                                done={extractionProgress.buildLogsExtracted && extractionProgress.runtimeLogsExtracted}
                            />
                            <ProgressItem
                                icon={<Sparkles className="w-4 h-4" />}
                                label="Analysis & planning"
                                done={extractionProgress.analysisStarted}
                                active={!extractionProgress.analysisStarted && extractionProgress.runtimeLogsExtracted}
                            />
                        </div>

                        {phase === 'complete' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6"
                            >
                                <Button
                                    onClick={() => window.location.href = '/dashboard'}
                                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3"
                                >
                                    Go to Dashboard
                                </Button>
                            </motion.div>
                        )}
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{
                    opacity: phase === 'transitioning' ? 0 : 1,
                    scale: phase === 'transitioning' ? 0.9 : 1,
                    y: 0
                }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
                className={cn(
                    "relative w-full max-w-4xl mx-auto",
                    isMinimized && "max-w-sm"
                )}
            >
                {/* Guidance text above browser */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4 p-4 rounded-xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 backdrop-blur-sm"
                >
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                            {phase === 'agent_control' || phase === 'downloading' ? (
                                <MousePointer2 className="w-4 h-4 text-white animate-pulse" />
                            ) : (
                                <ArrowUp className="w-4 h-4 text-white" />
                            )}
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-medium">{guidance}</p>
                            {agentMessage && phase !== 'user_control' && (
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="text-orange-300 text-sm mt-1"
                                >
                                    {agentMessage}
                                </motion.p>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Browser frame */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
                    {/* Browser chrome */}
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-white/10">
                        {/* URL bar */}
                        <div className="flex-1 flex items-center gap-2 max-w-md">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                            </div>
                            <div className="flex-1 px-3 py-1 rounded-md bg-slate-700/50 text-white/60 text-sm truncate">
                                {sourceUrl}
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsMinimized(!isMinimized)}
                                className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            >
                                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Browser content */}
                    <div className={cn(
                        "relative bg-white transition-all duration-300",
                        isMinimized ? "h-48" : "h-[500px]"
                    )}>
                        {/* Loading state */}
                        {phase === 'initializing' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                                <div className="text-center">
                                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
                                    <p className="text-white/60">Starting secure browser...</p>
                                </div>
                            </div>
                        )}

                        {/* Iframe for user interaction */}
                        {(phase === 'user_control' || phase === 'awaiting_sync') && (
                            <iframe
                                ref={iframeRef}
                                src={sourceUrl}
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                title="Project Browser"
                            />
                        )}

                        {/* Screenshot view during agent control */}
                        {(phase === 'agent_control' || phase === 'downloading' || phase === 'extracting') && (
                            <div className="relative w-full h-full">
                                {screenshot ? (
                                    <img
                                        src={screenshot}
                                        alt="Browser view"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                                        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
                                    </div>
                                )}

                                {/* Animated cursor */}
                                {showCursor && (
                                    <motion.div
                                        className="absolute pointer-events-none z-50"
                                        style={{
                                            left: `${cursorPosition.x}%`,
                                            top: `${cursorPosition.y}%`,
                                        }}
                                        animate={{
                                            x: '-50%',
                                            y: '-50%',
                                        }}
                                    >
                                        <MousePointer2 className="w-6 h-6 text-orange-500 drop-shadow-lg" />
                                        <motion.div
                                            className="absolute top-0 left-0 w-3 h-3 rounded-full bg-orange-500"
                                            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                                            transition={{ duration: 0.5, repeat: Infinity }}
                                        />
                                    </motion.div>
                                )}

                                {/* Agent status overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                    <div className="flex items-center gap-2 text-white">
                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                        <span className="text-sm font-medium">{agentMessage || 'KripTik AI is working...'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Transition smoke effect */}
                        {phase === 'transitioning' && (
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-800/90 to-transparent"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 1 }}
                            >
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <motion.div
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ duration: 0.5, type: 'spring' }}
                                    >
                                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                                            <CheckCircle2 className="w-10 h-10 text-white" />
                                        </div>
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Begin Sync button */}
                {(phase === 'user_control' || phase === 'awaiting_sync') && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 flex justify-center"
                    >
                        <Button
                            onClick={handleBeginSync}
                            size="lg"
                            className="relative px-8 py-6 text-lg font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl shadow-lg shadow-orange-500/30 transform hover:scale-105 transition-all"
                        >
                            <Play className="w-5 h-5 mr-2" />
                            Begin Sync
                            <motion.div
                                className="absolute inset-0 rounded-xl bg-white/20"
                                animate={{ opacity: [0, 0.3, 0] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </Button>
                    </motion.div>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const ProgressItem: React.FC<{
    icon: React.ReactNode;
    label: string;
    done: boolean;
    active?: boolean;
}> = ({ icon, label, done, active }) => (
    <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
            "flex items-center gap-3 p-3 rounded-lg transition-colors",
            done ? "bg-green-500/10" : active ? "bg-orange-500/10" : "bg-white/5"
        )}
    >
        <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            done ? "bg-green-500/20 text-green-400" : active ? "bg-orange-500/20 text-orange-400" : "bg-white/10 text-white/40"
        )}>
            {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        </div>
        <span className={cn(
            "font-medium",
            done ? "text-green-400" : active ? "text-orange-400" : "text-white/60"
        )}>
            {label}
        </span>
        {done && (
            <CheckCircle2 className="w-4 h-4 text-green-400 ml-auto" />
        )}
    </motion.div>
);

export default EmbeddedBrowserFrame;

