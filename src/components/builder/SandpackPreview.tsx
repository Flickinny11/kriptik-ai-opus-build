/**
 * Sandpack Preview Component - Liquid Glass Design
 *
 * Live preview of the generated code using Sandpack
 * with premium liquid glass styling.
 * Includes "Show Me" demo button for AI voice narration.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    SandpackPreview as SandpackPreviewBase,
    SandpackConsole,
    useSandpack,
} from '@codesandbox/sandpack-react';
import { RefreshIcon, type IconProps } from '../ui/icons';
import { useEditorStore } from '../../store/useEditorStore';
import { AgentDemoOverlay, type NarrationPlaybackSegment } from './AgentDemoOverlay';
import { AIInteractionOverlay, type AgentPhase, type AgentEvent } from './AIInteractionOverlay';
import { apiClient } from '@/lib/api-client';

// API URL for backend requests
const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';

// Storage key for external sandbox URL (set by build orchestration)
const SANDBOX_URL_KEY = 'kriptik_external_sandbox_url';

// Temporary icon components for icons not in custom icon set
const SmartphoneIcon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
);

const TabletIcon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
        <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
);

const MonitorIcon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
);

const TerminalIcon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="4 17 10 11 4 5"/>
        <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
);

const ExternalLinkIcon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
);

const MousePointer2Icon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>
    </svg>
);

const Maximize2Icon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
);

const PlayCircleIcon: React.FC<IconProps> = ({ size = 24, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10"/>
        <polygon points="10 8 16 12 10 16" fill="currentColor"/>
    </svg>
);

type ViewportSize = 'mobile' | 'tablet' | 'desktop';

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; label: string }> = {
    mobile: { width: 375, label: '375px' },
    tablet: { width: 768, label: '768px' },
    desktop: { width: 1280, label: '100%' },
};

// Liquid Glass 3D Device Button
function DeviceButton({
    icon: Icon,
    isActive,
    onClick,
    title
}: {
    icon: React.FC<IconProps>;
    isActive: boolean;
    onClick: () => void;
    title: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={title}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden active:scale-95"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(250,250,252,0.85) 50%, rgba(248,250,252,0.9) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(250,250,252,0.5) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
                boxShadow: isActive
                    ? `
                        0 6px 20px rgba(0,0,0,0.1),
                        0 3px 10px rgba(0,0,0,0.06),
                        0 1px 3px rgba(0,0,0,0.03),
                        inset 0 2px 4px rgba(255,255,255,1),
                        inset 0 -1px 2px rgba(0,0,0,0.02),
                        0 0 0 1px rgba(255,255,255,0.8),
                        0 0 12px rgba(251,191,36,0.15)
                    `
                    : isHovered
                        ? `
                            0 4px 12px rgba(0,0,0,0.08),
                            0 2px 6px rgba(0,0,0,0.04),
                            inset 0 1px 2px rgba(255,255,255,0.9),
                            0 0 0 1px rgba(255,255,255,0.5)
                        `
                        : `
                            0 2px 6px rgba(0,0,0,0.04),
                            inset 0 1px 2px rgba(255,255,255,0.7),
                            0 0 0 1px rgba(255,255,255,0.3)
                        `,
                transform: `perspective(400px) ${isActive ? 'translateZ(2px) rotateX(-2deg)' : isHovered ? 'translateZ(1px) rotateX(-1deg)' : 'translateZ(0)'}`,
            }}
        >
            {/* Inner glow for active state */}
            {isActive && (
                <div
                    className="absolute inset-1 rounded-lg"
                    style={{
                        background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.08) 100%)',
                        filter: 'blur(1px)',
                    }}
                />
            )}
            <Icon
                size={16}
                className={`relative z-10 ${isActive ? 'text-[#92400e]' : isHovered ? 'text-[#1a1a1a]' : 'text-[#666]'}`}
            />

            {/* Shine sweep effect */}
            {(isActive || isHovered) && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: isHovered ? '150%' : '-100%',
                        width: '50%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                        transform: 'skewX(-20deg)',
                        transition: 'left 0.5s ease',
                        pointerEvents: 'none',
                    }}
                />
            )}
        </button>
    );
}

// Liquid Glass Icon Button
function GlassIconButton({
    icon: Icon,
    onClick,
    isActive = false,
    title
}: {
    icon: React.FC<IconProps>;
    onClick?: () => void;
    isActive?: boolean;
    title?: string;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={title}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 relative overflow-hidden"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.55) 0%, rgba(255,180,150,0.4) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
                backdropFilter: 'blur(12px)',
                boxShadow: isActive
                    ? `inset 0 0 12px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(255, 140, 100, 0.12), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : isHovered
                        ? `0 4px 14px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`
                        : `0 2px 6px rgba(0,0,0,0.04), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.3)`,
                transform: isHovered ? 'translateY(-1px) scale(1.02)' : 'translateY(0) scale(1)',
            }}
        >
            <Icon
                size={16}
                className={isActive ? 'text-[#c25a00]' : 'text-[#1a1a1a]'}
            />

            {/* Shine effect */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.4s ease',
                    pointerEvents: 'none',
                }}
            />
        </button>
    );
}

export default function SandpackPreviewWindow() {
    const [viewport, setViewport] = useState<ViewportSize>('desktop');
    const [showConsole, setShowConsole] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDemoActive, setIsDemoActive] = useState(false);
    const [demoSegments, setDemoSegments] = useState<NarrationPlaybackSegment[]>([]);
    const [isLoadingDemo, setIsLoadingDemo] = useState(false);

    // External sandbox URL from build orchestration (real dev server)
    const [externalSandboxUrl, setExternalSandboxUrl] = useState<string | null>(null);
    const [iframeKey, setIframeKey] = useState(0);

    // AI Interaction Overlay state
    const [isAIActive, setIsAIActive] = useState(false);
    const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
    const [currentFile, setCurrentFile] = useState<string | undefined>();
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | undefined>();

    const { isSelectionMode, toggleSelectionMode, isBuilding } = useEditorStore();
    const { sandpack } = useSandpack();
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // PHASE 1: HMR indicator state
    const [showHmrIndicator, setShowHmrIndicator] = useState(false);
    const hmrTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // PHASE D: Take Control state for Phase 6 Browser Demo
    const [takeControlAvailable, setTakeControlAvailable] = useState(false);
    const [demoVisualScore, setDemoVisualScore] = useState<number | null>(null);

    // Check for external sandbox URL on mount and listen for updates
    useEffect(() => {
        // Check localStorage for persisted sandbox URL
        const savedUrl = localStorage.getItem(SANDBOX_URL_KEY);
        if (savedUrl) {
            setExternalSandboxUrl(savedUrl);
        }

        // Listen for sandbox-ready events via custom event
        const handleSandboxReady = (event: CustomEvent<{ sandboxUrl: string }>) => {
            if (event.detail?.sandboxUrl) {
                setExternalSandboxUrl(event.detail.sandboxUrl);
                localStorage.setItem(SANDBOX_URL_KEY, event.detail.sandboxUrl);
                console.log('[SandpackPreview] External sandbox ready:', event.detail.sandboxUrl);
            }
        };

        // PHASE 1: Listen for HMR trigger events for auto-refresh
        const handleHmrTrigger = (event: CustomEvent<{ filePath: string; timestamp: number }>) => {
            console.log('[SandpackPreview] HMR trigger received:', event.detail.filePath);
            
            // Show HMR indicator
            setShowHmrIndicator(true);
            
            // Clear any existing timeout
            if (hmrTimeoutRef.current) {
                clearTimeout(hmrTimeoutRef.current);
            }
            
            // Refresh external sandbox iframe
            if (externalSandboxUrl) {
                setIframeKey(prev => prev + 1);
            }
            
            // Hide HMR indicator after animation
            hmrTimeoutRef.current = setTimeout(() => {
                setShowHmrIndicator(false);
            }, 1500);
        };

        window.addEventListener('sandbox-ready' as any, handleSandboxReady);
        window.addEventListener('hmr-trigger' as any, handleHmrTrigger);

        return () => {
            window.removeEventListener('sandbox-ready' as any, handleSandboxReady);
            window.removeEventListener('hmr-trigger' as any, handleHmrTrigger);
            if (hmrTimeoutRef.current) {
                clearTimeout(hmrTimeoutRef.current);
            }
        };
    }, [externalSandboxUrl]);

    // Refresh external sandbox
    const handleExternalRefresh = useCallback(() => {
        setIframeKey(prev => prev + 1);
    }, []);

    // Subscribe to build events for AI overlay
    useEffect(() => {
        // Activate overlay when building
        if (isBuilding) {
            setIsAIActive(true);
            setAgentPhase('building');
        } else if (isAIActive && agentPhase === 'building') {
            // Build complete
            setAgentPhase('complete');
            // Clear after 2 seconds
            const timeout = setTimeout(() => {
                setIsAIActive(false);
                setAgentPhase('idle');
                setCurrentFile(undefined);
                setCursorPosition(undefined);
            }, 2000);
            return () => clearTimeout(timeout);
        }
    }, [isBuilding, isAIActive, agentPhase]);

    // Handle AI agent events (from SSE or message bus)
    const handleAgentEvent = useCallback((event: AgentEvent) => {
        switch (event.type) {
            case 'status_change':
                if (event.data?.status) {
                    setAgentPhase(event.data.status);
                    setIsAIActive(event.data.status !== 'idle' && event.data.status !== 'complete');
                }
                break;

            case 'file_read':
            case 'file_write':
                if (event.data?.filePath) {
                    setCurrentFile(event.data.filePath);
                    setAgentPhase(event.type === 'file_write' ? 'coding' : 'thinking');
                    setIsAIActive(true);
                }
                break;

            case 'cursor_move':
                if (event.data?.cursorX !== undefined && event.data?.cursorY !== undefined) {
                    setCursorPosition({ x: event.data.cursorX, y: event.data.cursorY });
                }
                break;

            case 'verification':
                setAgentPhase('verifying');
                setIsAIActive(true);
                break;

            case 'build_start':
                setAgentPhase('building');
                setIsAIActive(true);
                break;

            case 'build_complete':
                setAgentPhase(event.data?.success ? 'complete' : 'error');
                // Auto-hide after completion
                setTimeout(() => {
                    setIsAIActive(false);
                    setAgentPhase('idle');
                }, 2500);
                break;
        }
    }, []);

    // Connect to agent event stream (if available)
    useEffect(() => {
        // Try to connect to the agent activity stream
        const connectToAgentStream = () => {
            try {
                const match = window.location.pathname.match(/^\/builder\/([^/]+)/);
                const projectId = match?.[1];
                const url = `${API_URL}/api/agent/activity-stream${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`;
                const eventSource = new EventSource(url, { withCredentials: true });

                eventSource.onmessage = (event) => {
                    try {
                        const agentEvent: AgentEvent = JSON.parse(event.data);
                        handleAgentEvent(agentEvent);
                    } catch (e) {
                        console.debug('[AIOverlay] Failed to parse event:', e);
                    }
                };

                eventSource.onerror = () => {
                    // Silent error - stream may not be available
                    eventSource.close();
                };

                eventSourceRef.current = eventSource;
            } catch (e) {
                // SSE not available, overlay will rely on manual triggers
            }
        };

        connectToAgentStream();

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [handleAgentEvent]);

    // PHASE B: Listen for build-demo-ready event from Phase 6 Browser Demo completion
    // This auto-triggers the Show Me demo when BuildLoopOrchestrator completes browser_demo phase
    useEffect(() => {
        const handleBuildDemoReady = async (event: CustomEvent<{
            url: string;
            takeControlAvailable: boolean;
            visualScore: number;
            screenshot?: string;
        }>) => {
            console.log('[SandpackPreview] Build demo ready event received:', event.detail);

            const { url, takeControlAvailable: canTakeControl, visualScore } = event.detail;

            // Update external sandbox URL if provided
            if (url) {
                setExternalSandboxUrl(url);
                localStorage.setItem(SANDBOX_URL_KEY, url);
            }

            // PHASE D: Set Take Control state when Phase 6 complete
            if (canTakeControl) {
                setTakeControlAvailable(true);
                setDemoVisualScore(visualScore);
                console.log('[SandpackPreview] Take Control is now available. Visual score:', visualScore);
            }

            // Auto-trigger demo when take control is available (Phase 6 complete)
            if (canTakeControl) {
                console.log('[SandpackPreview] Auto-triggering Show Me demo. Visual score:', visualScore);

                // Set loading state
                setIsLoadingDemo(true);

                try {
                    interface DemoResponse {
                        success: boolean;
                        segments?: NarrationPlaybackSegment[];
                    }

                    // Fetch demo narration segments from backend
                    const response = await apiClient.post<DemoResponse>('/api/preview/demo', {
                        type: 'build_complete_demo',
                        viewport,
                        sandboxUrl: url,
                        visualScore,
                    });

                    if (response.data.success && response.data.segments) {
                        setDemoSegments(response.data.segments);
                        setIsDemoActive(true);
                    } else {
                        // If no segments returned, still show the live preview
                        console.log('[SandpackPreview] No demo segments, showing live preview');
                    }
                } catch (error) {
                    // Demo fetch failed, but preview is still available
                    console.error('[SandpackPreview] Failed to fetch demo segments:', error);
                } finally {
                    setIsLoadingDemo(false);
                }
            }
        };

        window.addEventListener('build-demo-ready', handleBuildDemoReady as unknown as EventListener);

        return () => {
            window.removeEventListener('build-demo-ready', handleBuildDemoReady as unknown as EventListener);
        };
    }, [viewport]);

    const handleRefresh = () => {
        if (externalSandboxUrl) {
            // Refresh external sandbox iframe
            handleExternalRefresh();
        } else {
            // Refresh Sandpack
            sandpack.runSandpack();
        }
    };

    const handleOpenExternal = () => {
        if (externalSandboxUrl) {
            window.open(externalSandboxUrl, '_blank');
        } else {
            // Sandpack doesn't have a direct external URL, open about:blank
            window.open('about:blank', '_blank');
        }
    };

    // Start "Show Me" demo with voice narration
    const handleShowMeDemo = async () => {
        setIsLoadingDemo(true);
        try {
            interface DemoResponse {
                success: boolean;
                segments?: NarrationPlaybackSegment[];
            }
            const response = await apiClient.post<DemoResponse>('/api/preview/demo', {
                type: 'sandbox_demo',
                viewport,
            });

            if (response.data.success && response.data.segments) {
                setDemoSegments(response.data.segments);
                setIsDemoActive(true);
            }
        } catch (error) {
            console.error('Failed to start demo:', error);
        } finally {
            setIsLoadingDemo(false);
        }
    };

    // Handle demo take control - user is taking over from the AI agent demo
    const handleDemoTakeControl = () => {
        setIsDemoActive(false);
        // Keep takeControlAvailable true so the button remains visible
    };

    // Handle demo complete
    const handleDemoComplete = () => {
        setIsDemoActive(false);
        // Keep takeControlAvailable true so user can still take control
    };

    // PHASE D: Handle Take Control button click - user takes control of the sandbox
    const handleTakeControlClick = useCallback(() => {
        console.log('[SandpackPreview] User taking control of sandbox:', externalSandboxUrl);

        // Dispatch event for other components (ChatInterface, BuilderDesktop)
        window.dispatchEvent(new CustomEvent('demo-take-control', {
            detail: {
                url: externalSandboxUrl,
                visualScore: demoVisualScore,
            }
        }));

        // Hide the Take Control button
        setTakeControlAvailable(false);
        setIsDemoActive(false);

        // Open sandbox in new tab for full control
        if (externalSandboxUrl) {
            window.open(externalSandboxUrl, '_blank');
        }
    }, [externalSandboxUrl, demoVisualScore]);

    return (
        <div
            className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            style={{ background: 'transparent' }}
        >
            {/* Toolbar - Liquid Glass */}
            <div
                className="h-14 flex items-center justify-between px-4 shrink-0"
                style={{
                    background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                    backdropFilter: 'blur(16px)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                <div className="flex items-center gap-3">
                    {/* Viewport Selector - Liquid Glass Pill */}
                    <div
                        className="flex gap-1 p-1.5 rounded-xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                            boxShadow: `
                                0 2px 8px rgba(0,0,0,0.04),
                                inset 0 1px 2px rgba(255,255,255,0.9),
                                0 0 0 1px rgba(255,255,255,0.4)
                            `,
                        }}
                    >
                        <DeviceButton
                            icon={SmartphoneIcon}
                            isActive={viewport === 'mobile'}
                            onClick={() => setViewport('mobile')}
                            title="Mobile (375px)"
                        />
                        <DeviceButton
                            icon={TabletIcon}
                            isActive={viewport === 'tablet'}
                            onClick={() => setViewport('tablet')}
                            title="Tablet (768px)"
                        />
                        <DeviceButton
                            icon={MonitorIcon}
                            isActive={viewport === 'desktop'}
                            onClick={() => setViewport('desktop')}
                            title="Desktop (100%)"
                        />
                    </div>

                    <span className="text-xs font-medium" style={{ color: '#666' }}>
                        {VIEWPORT_SIZES[viewport].label}
                    </span>

                    {/* Status indicator */}
                    <div
                        className="flex items-center gap-2 ml-2 px-3 py-1.5 rounded-lg"
                        style={{
                            background: sandpack.status === 'running'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : sandpack.status === 'idle'
                                    ? 'rgba(234, 179, 8, 0.1)'
                                    : 'rgba(239, 68, 68, 0.1)',
                            border: `1px solid ${
                                sandpack.status === 'running'
                                    ? 'rgba(16, 185, 129, 0.2)'
                                    : sandpack.status === 'idle'
                                        ? 'rgba(234, 179, 8, 0.2)'
                                        : 'rgba(239, 68, 68, 0.2)'
                            }`,
                        }}
                    >
                        <div
                            className="w-2 h-2 rounded-full animate-pulse"
                            style={{
                                background: sandpack.status === 'running'
                                    ? '#10b981'
                                    : sandpack.status === 'idle'
                                        ? '#eab308'
                                        : '#ef4444',
                            }}
                        />
                        <span
                            className="text-xs font-medium capitalize"
                            style={{
                                color: sandpack.status === 'running'
                                    ? '#059669'
                                    : sandpack.status === 'idle'
                                        ? '#ca8a04'
                                        : '#dc2626',
                            }}
                        >
                            {sandpack.status}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Show Me Demo Button - Liquid Glass 3D */}
                    <button
                        onClick={handleShowMeDemo}
                        disabled={isLoadingDemo || isDemoActive}
                        title="Start AI Voice Demo"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 active:scale-95"
                        style={{
                            background: isDemoActive
                                ? 'linear-gradient(145deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.08) 50%, rgba(16,185,129,0.12) 100%)'
                                : 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(250,250,252,0.75) 50%, rgba(248,250,252,0.85) 100%)',
                            boxShadow: isDemoActive
                                ? `
                                    0 6px 20px rgba(16,185,129,0.2),
                                    0 3px 10px rgba(16,185,129,0.15),
                                    inset 0 1px 3px rgba(255,255,255,0.5),
                                    inset 0 -1px 2px rgba(0,0,0,0.02),
                                    0 0 0 1px rgba(16,185,129,0.3),
                                    0 0 15px rgba(16,185,129,0.2)
                                `
                                : `
                                    0 8px 24px rgba(0,0,0,0.1),
                                    0 4px 12px rgba(0,0,0,0.06),
                                    0 2px 4px rgba(0,0,0,0.03),
                                    inset 0 2px 4px rgba(255,255,255,1),
                                    inset 0 -1px 2px rgba(0,0,0,0.02),
                                    0 0 0 1px rgba(255,255,255,0.7),
                                    0 0 16px rgba(251,191,36,0.12)
                                `,
                            color: isDemoActive ? '#059669' : '#92400e',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: isLoadingDemo ? 'wait' : 'pointer',
                            opacity: isLoadingDemo ? 0.7 : 1,
                            transform: `perspective(500px) translateZ(${isDemoActive ? '1px' : '2px'}) rotateX(-1deg)`,
                        }}
                    >
                        {/* 3D Icon */}
                        <div
                            className="relative flex items-center justify-center"
                            style={{ width: 20, height: 20 }}
                        >
                            <div
                                className="absolute inset-0 rounded-md"
                                style={{
                                    background: isDemoActive
                                        ? 'linear-gradient(145deg, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0.15) 100%)'
                                        : 'linear-gradient(145deg, rgba(251,191,36,0.2) 0%, rgba(245,158,11,0.12) 100%)',
                                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), 0 1px 3px rgba(0,0,0,0.05)',
                                    transform: 'perspective(200px) rotateX(2deg)',
                                }}
                            />
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="relative z-10">
                                <defs>
                                    <linearGradient id="playGrad" x1="8" y1="5" x2="19" y2="19">
                                        <stop offset="0%" stopColor={isDemoActive ? '#10b981' : '#f59e0b'} />
                                        <stop offset="100%" stopColor={isDemoActive ? '#059669' : '#d97706'} />
                                    </linearGradient>
                                </defs>
                                <circle cx="12" cy="12" r="9" stroke="url(#playGrad)" strokeWidth="1.5" />
                                <polygon points="10,8 17,12 10,16" fill="url(#playGrad)" />
                            </svg>
                        </div>
                        <span>{isLoadingDemo ? 'Loading...' : isDemoActive ? 'Demo Active' : 'Show Me'}</span>
                    </button>

                    <GlassIconButton
                        icon={MousePointer2Icon}
                        isActive={isSelectionMode}
                        onClick={toggleSelectionMode}
                        title="Select Element"
                    />
                    <GlassIconButton
                        icon={TerminalIcon}
                        isActive={showConsole}
                        onClick={() => setShowConsole(!showConsole)}
                        title="Toggle Console"
                    />
                    <GlassIconButton
                        icon={RefreshIcon}
                        onClick={handleRefresh}
                        title="Refresh Preview"
                    />
                    <GlassIconButton
                        icon={Maximize2Icon}
                        isActive={isFullscreen}
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title="Toggle Fullscreen"
                    />
                    <GlassIconButton
                        icon={ExternalLinkIcon}
                        onClick={handleOpenExternal}
                        title="Open in New Tab"
                    />
                </div>
            </div>

            {/* Preview Container - Liquid Glass Frame */}
            <div
                ref={previewContainerRef}
                className="flex-1 p-4 flex items-start justify-center overflow-auto relative"
                style={{
                    background: 'linear-gradient(180deg, rgba(200,195,190,0.3) 0%, rgba(180,175,170,0.2) 100%)',
                }}
            >
                {/* AI Interaction Overlay */}
                <AIInteractionOverlay
                    isActive={isAIActive}
                    agentPhase={agentPhase}
                    currentFile={currentFile}
                    cursorPosition={cursorPosition}
                    showCursor={agentPhase === 'coding' || agentPhase === 'thinking'}
                    showStatus={true}
                    showFileIndicator={!!currentFile}
                />

                {/* Voice Narration Demo Overlay */}
                {isDemoActive && demoSegments.length > 0 && (
                    <AgentDemoOverlay
                        isActive={isDemoActive}
                        segments={demoSegments}
                        onTakeControl={handleDemoTakeControl}
                        onComplete={handleDemoComplete}
                        containerRef={previewContainerRef}
                        showTranscript={true}
                    />
                )}
                {/* Device Frame */}
                <div
                    className={`transition-all duration-500 ${viewport === 'desktop' ? 'w-full h-full' : 'h-[600px]'}`}
                    style={{
                        width: viewport !== 'desktop' ? VIEWPORT_SIZES[viewport].width : '100%',
                        maxWidth: '100%',
                        borderRadius: '20px',
                        overflow: 'hidden',
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: `
                            0 25px 80px rgba(0,0,0,0.15),
                            0 10px 30px rgba(0,0,0,0.1),
                            inset 0 2px 4px rgba(255,255,255,0.95),
                            0 0 0 1px rgba(255,255,255,0.5)
                        `,
                        padding: '4px',
                    }}
                >
                    {/* Inner frame for preview */}
                    <div
                        className="w-full h-full rounded-2xl overflow-hidden"
                        style={{
                            background: '#ffffff',
                            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)',
                        }}
                    >
                        {externalSandboxUrl ? (
                            /* External Sandbox Preview - Real dev server from build orchestration */
                            <div className="relative w-full h-full">
                                <iframe
                                    key={iframeKey}
                                    src={externalSandboxUrl}
                                    className="w-full h-full border-0"
                                    title="Live Build Preview"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                                />
                                {/* Live indicator */}
                                <div
                                    className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 rounded-full"
                                    style={{
                                        background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.85) 100%)',
                                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)',
                                    }}
                                >
                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                    <span className="text-xs font-semibold text-white">LIVE</span>
                                </div>

                                {/* PHASE 1: HMR indicator overlay with amber/copper accent */}
                                {showHmrIndicator && (
                                    <div
                                        className="absolute inset-0 pointer-events-none rounded-2xl animate-pulse"
                                        style={{
                                            boxShadow: 'inset 0 0 25px rgba(245, 158, 11, 0.4)',
                                            border: '2px solid rgba(245, 158, 11, 0.6)',
                                        }}
                                    >
                                        <div
                                            className="absolute top-3 left-3 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(217, 119, 6, 0.95) 100%)',
                                                color: '#0a0a0f',
                                                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                                            }}
                                        >
                                            Hot Reload
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Sandpack Preview - In-browser bundling */
                            <SandpackPreviewBase
                                showNavigator={false}
                                showRefreshButton={false}
                                showOpenInCodeSandbox={false}
                                style={{ height: '100%' }}
                            />
                        )}
                    </div>
                </div>

                {/* PHASE D: Floating Take Control Button - appears when Phase 6 Browser Demo is ready */}
                {takeControlAvailable && (
                    <motion.button
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.9 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        onClick={handleTakeControlClick}
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 rounded-2xl z-20"
                        style={{
                            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.95) 0%, rgba(5, 150, 105, 0.9) 100%)',
                            boxShadow: `
                                0 8px 32px rgba(16, 185, 129, 0.4),
                                0 4px 16px rgba(0, 0, 0, 0.15),
                                inset 0 1px 2px rgba(255, 255, 255, 0.3),
                                0 0 0 1px rgba(255, 255, 255, 0.2)
                            `,
                            cursor: 'pointer',
                        }}
                    >
                        <MousePointer2Icon size={20} className="text-white" />
                        <div className="flex flex-col items-start">
                            <span className="text-white font-semibold text-sm">Take Control</span>
                            <span className="text-white/70 text-xs">Your app is ready</span>
                        </div>
                        {demoVisualScore !== null && (
                            <div
                                className="ml-2 px-2 py-1 rounded-lg bg-white/20"
                            >
                                <span className="text-white text-xs font-medium">{demoVisualScore}%</span>
                            </div>
                        )}
                    </motion.button>
                )}
            </div>

            {/* Console Panel - Dark Glass */}
            {showConsole && (
                <div
                    className="h-48 shrink-0"
                    style={{
                        background: 'linear-gradient(145deg, rgba(30,30,35,0.98) 0%, rgba(20,20,25,1) 100%)',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        className="h-9 flex items-center px-4"
                        style={{
                            borderBottom: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.03)',
                        }}
                    >
                        <TerminalIcon size={14} className="mr-2 text-[#666]" />
                        <span className="text-xs font-medium" style={{ color: '#888' }}>Console</span>
                    </div>
                    <div className="h-[calc(100%-2.25rem)] overflow-auto">
                        <SandpackConsole
                            showHeader={false}
                            style={{ height: '100%' }}
                        />
                    </div>
                </div>
            )}

            {/* Selection Mode Indicator */}
            {isSelectionMode && (
                <div
                    className="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full shadow-xl text-sm font-medium z-10"
                    style={{
                        background: 'linear-gradient(145deg, rgba(255,200,170,0.9) 0%, rgba(255,180,150,0.8) 100%)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: `
                            0 8px 32px rgba(255, 140, 100, 0.3),
                            inset 0 1px 2px rgba(255,255,255,0.9),
                            0 0 0 1px rgba(255, 200, 170, 0.6)
                        `,
                        color: '#92400e',
                        animation: 'fadeSlideIn 0.3s ease-out',
                    }}
                >
                    Click an element to view its source code
                </div>
            )}

            <style>{`
                @keyframes fadeSlideIn {
                    from {
                        opacity: 0;
                        transform: translate(-50%, -10px);
                    }
                    to {
                        opacity: 1;
                        transform: translate(-50%, 0);
                    }
                }
            `}</style>
        </div>
    );
}
