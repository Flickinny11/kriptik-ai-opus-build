/**
 * Sandpack Preview Component - Liquid Glass Design
 *
 * Live preview of the generated code using Sandpack
 * with premium liquid glass styling.
 * Includes "Show Me" demo button for AI voice narration.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
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

// Liquid Glass Device Button
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
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 relative overflow-hidden"
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                        : 'transparent',
                boxShadow: isActive
                    ? `inset 0 0 12px rgba(255, 160, 120, 0.2), 0 2px 8px rgba(255, 140, 100, 0.15), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : isHovered
                        ? `0 4px 12px rgba(0,0,0,0.08), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.4)`
                        : 'none',
                transform: isHovered && !isActive ? 'scale(1.05)' : 'scale(1)',
            }}
        >
            <Icon
                size={16}
                className={isActive ? 'text-[#92400e]' : isHovered ? 'text-[#1a1a1a]' : 'text-[#666]'}
            />

            {/* Shine effect */}
            {(isActive || isHovered) && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: isHovered ? '150%' : '-100%',
                        width: '60%',
                        height: '100%',
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                        transform: 'skewX(-15deg)',
                        transition: 'left 0.4s ease',
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

    // AI Interaction Overlay state
    const [isAIActive, setIsAIActive] = useState(false);
    const [agentPhase, setAgentPhase] = useState<AgentPhase>('idle');
    const [currentFile, setCurrentFile] = useState<string | undefined>();
    const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | undefined>();

    const { isSelectionMode, toggleSelectionMode, isBuilding } = useEditorStore();
    const { sandpack } = useSandpack();
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

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
                const eventSource = new EventSource('/api/agent/activity-stream');

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

    const handleRefresh = () => {
        sandpack.runSandpack();
    };

    const handleOpenExternal = () => {
        window.open('about:blank', '_blank');
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

    // Handle demo take control
    const handleDemoTakeControl = () => {
        setIsDemoActive(false);
    };

    // Handle demo complete
    const handleDemoComplete = () => {
        setIsDemoActive(false);
    };

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
                    {/* Show Me Demo Button */}
                    <button
                        onClick={handleShowMeDemo}
                        disabled={isLoadingDemo || isDemoActive}
                        title="Start AI Voice Demo"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-300"
                        style={{
                            background: isDemoActive
                                ? 'linear-gradient(145deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)'
                                : 'linear-gradient(145deg, rgba(255,180,150,0.5) 0%, rgba(255,160,130,0.4) 100%)',
                            boxShadow: `0 2px 8px ${isDemoActive ? 'rgba(16,185,129,0.2)' : 'rgba(255,140,100,0.2)'}`,
                            border: `1px solid ${isDemoActive ? 'rgba(16,185,129,0.3)' : 'rgba(255,200,170,0.5)'}`,
                            color: isDemoActive ? '#059669' : '#c25a00',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: isLoadingDemo ? 'wait' : 'pointer',
                            opacity: isLoadingDemo ? 0.7 : 1,
                        }}
                    >
                        <PlayCircleIcon size={16} />
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
                        <SandpackPreviewBase
                            showNavigator={false}
                            showRefreshButton={false}
                            showOpenInCodeSandbox={false}
                            style={{ height: '100%' }}
                        />
                    </div>
                </div>
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
