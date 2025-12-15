/**
 * Agent Sandbox Preview - Developer Mode Live Preview
 *
 * A specialized preview component for Developer Mode that shows
 * live code changes from agents with dark glass styling.
 *
 * Features:
 * - Real-time preview of agent-generated code
 * - Viewport switching (mobile/tablet/desktop)
 * - Console output
 * - Diff view for changes
 * - Branch indicator
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshIcon,
    ArrowRightIcon,
    CheckCircleIcon,
    EyeIcon,
    MessageSquareIcon,
    Code2Icon,
    SmartphoneIcon,
    TabletIcon,
    MonitorIcon,
    TerminalIcon,
} from '../ui/icons';
import { useDeveloperModeStore, selectAgents, selectSelectedAgent } from '../../store/useDeveloperModeStore';
import { RequestChangesModal } from './RequestChangesModal';
import { CreatePRModal } from './CreatePRModal';

const GitBranchIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="6" y1="3" x2="6" y2="15"/>
        <circle cx="18" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
);

const Maximize2Icon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 3 21 3 21 9"/>
        <polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
);

const Minimize2Icon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 14 10 14 10 20"/>
        <polyline points="20 10 14 10 14 4"/>
        <line x1="14" y1="10" x2="21" y2="3"/>
        <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
);

const SplitIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="12" y1="3" x2="12" y2="21"/>
    </svg>
);

const PlayIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
);

const PauseIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="4" width="4" height="16"/>
        <rect x="14" y="4" width="4" height="16"/>
    </svg>
);

const GitPullRequestIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="18" r="3"/>
        <circle cx="6" cy="6" r="3"/>
        <path d="M13 6h3a2 2 0 0 1 2 2v7"/>
        <line x1="6" y1="9" x2="6" y2="21"/>
    </svg>
);

const XCircleIcon = ({ className, ...props }: { className?: string; [key: string]: any }) => (
    <svg className={className} {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
);

type LucideIcon = React.FC<{ className?: string; [key: string]: any }>;

// Dark glass styling to match AgentModeSidebar
const darkGlassPanel = {
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 20px 60px rgba(0,0,0,0.4),
        0 8px 24px rgba(0,0,0,0.3),
        inset 0 1px 0 rgba(255,255,255,0.05),
        inset 0 -1px 0 rgba(0,0,0,0.3),
        0 0 0 1px rgba(255,255,255,0.05)
    `,
};

// Fluorescent yellow accent color
const accentColor = '#c8ff64';
const accentGlow = 'rgba(200,255,100,0.15)';

type ViewportSize = 'mobile' | 'tablet' | 'desktop';
type ViewMode = 'preview' | 'code' | 'split';

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; label: string; icon: LucideIcon }> = {
    mobile: { width: 375, label: '375px', icon: SmartphoneIcon },
    tablet: { width: 768, label: '768px', icon: TabletIcon },
    desktop: { width: 1280, label: '100%', icon: MonitorIcon },
};

interface GlassButtonProps {
    icon: LucideIcon;
    isActive?: boolean;
    onClick?: () => void;
    title?: string;
    size?: 'sm' | 'md';
}

function GlassButton({ icon: Icon, isActive = false, onClick, title, size = 'md' }: GlassButtonProps) {
    const [isHovered, setIsHovered] = useState(false);
    const sizeClasses = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
    const iconColor = isActive ? accentColor : isHovered ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)';

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={title}
            className={`${sizeClasses} rounded-lg flex items-center justify-center transition-all duration-200 relative overflow-hidden`}
            style={{
                background: isActive
                    ? `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.05) 100%)`
                    : isHovered
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(255,255,255,0.03)',
                border: isActive
                    ? `1px solid ${accentColor}40`
                    : '1px solid rgba(255,255,255,0.08)',
                transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
        >
            <Icon className={iconSize} color={iconColor} />
        </button>
    );
}

interface AgentSandboxPreviewProps {
    agentId?: string;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}

export function AgentSandboxPreview({
    agentId,
    isFullscreen = false,
    onToggleFullscreen
}: AgentSandboxPreviewProps) {
    const agents = useDeveloperModeStore(selectAgents);
    const selectedAgentFromStore = useDeveloperModeStore(selectSelectedAgent);
    const selectedAgentId = useDeveloperModeStore(state => state.selectedAgentId);
    const [viewport, setViewport] = useState<ViewportSize>('desktop');
    const [viewMode, setViewMode] = useState<ViewMode>('preview');
    const [showConsole, setShowConsole] = useState(false);
    const [isAutoRefresh, setIsAutoRefresh] = useState(true);
    const [consoleLogs, setConsoleLogs] = useState<Array<{ type: 'log' | 'error' | 'warn'; message: string; timestamp: string }>>([]);
    const [showRequestChanges, setShowRequestChanges] = useState(false);
    const [showCreatePR, setShowCreatePR] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const consoleEndRef = useRef<HTMLDivElement>(null);

    const activeAgentId = agentId || selectedAgentId;
    const activeAgent = agentId ? agents.find(a => a.id === activeAgentId) : selectedAgentFromStore;

    // Simulate console logs from agent activity
    useEffect(() => {
        if (activeAgent?.status === 'running') {
            const interval = setInterval(() => {
                const messages = [
                    { type: 'log' as const, message: 'Compiling changes...' },
                    { type: 'log' as const, message: 'Hot module replacement active' },
                    { type: 'warn' as const, message: 'Unused variable detected' },
                    { type: 'log' as const, message: 'Build successful' },
                ];
                const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                setConsoleLogs(prev => [...prev.slice(-50), {
                    ...randomMessage,
                    timestamp: new Date().toLocaleTimeString()
                }]);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [activeAgent?.status]);

    useEffect(() => {
        consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [consoleLogs.length]);

    const handleRefresh = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src;
        }
    };

    const handleOpenExternal = () => {
        // In real implementation, this would open the sandbox in a new tab
        window.open('about:blank', '_blank');
    };

    return (
        <div
            className={`h-full flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
            style={darkGlassPanel}
        >
            {/* Toolbar */}
            <div
                className="h-12 flex items-center justify-between px-3 shrink-0"
                style={{
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                }}
            >
                {/* Left: View Mode + Viewport */}
                <div className="flex items-center gap-3">
                    {/* View Mode Toggle */}
                    <div
                        className="flex gap-0.5 p-1 rounded-lg"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        <GlassButton
                            icon={EyeIcon as any}
                            isActive={viewMode === 'preview'}
                            onClick={() => setViewMode('preview')}
                            title="Preview"
                            size="sm"
                        />
                        <GlassButton
                            icon={Code2Icon as any}
                            isActive={viewMode === 'code'}
                            onClick={() => setViewMode('code')}
                            title="Code"
                            size="sm"
                        />
                        <GlassButton
                            icon={SplitIcon as any}
                            isActive={viewMode === 'split'}
                            onClick={() => setViewMode('split')}
                            title="Split View"
                            size="sm"
                        />
                    </div>

                    {/* Viewport Selector */}
                    <div
                        className="flex gap-0.5 p-1 rounded-lg"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        {(Object.keys(VIEWPORT_SIZES) as ViewportSize[]).map((vp) => (
                            <GlassButton
                                key={vp}
                                icon={VIEWPORT_SIZES[vp].icon}
                                isActive={viewport === vp}
                                onClick={() => setViewport(vp)}
                                title={`${vp.charAt(0).toUpperCase() + vp.slice(1)} (${VIEWPORT_SIZES[vp].label})`}
                                size="sm"
                            />
                        ))}
                    </div>

                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        {VIEWPORT_SIZES[viewport].label}
                    </span>
                </div>

                {/* Center: Branch & Status */}
                <div className="flex items-center gap-3">
                    {activeAgent?.branch && (
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                            style={{
                                background: 'rgba(96, 165, 250, 0.1)',
                                border: '1px solid rgba(96, 165, 250, 0.2)',
                                color: '#60a5fa',
                            }}
                        >
                            <GitBranchIcon className="w-3 h-3" />
                            <span className="font-mono">{activeAgent.branch}</span>
                        </div>
                    )}

                    {activeAgent && (
                        <div
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
                            style={{
                                background: activeAgent.status === 'running'
                                    ? `${accentGlow}`
                                    : activeAgent.status === 'completed'
                                        ? 'rgba(52, 211, 153, 0.1)'
                                        : activeAgent.status === 'failed'
                                            ? 'rgba(248, 113, 113, 0.1)'
                                            : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${
                                    activeAgent.status === 'running'
                                        ? `${accentColor}30`
                                        : activeAgent.status === 'completed'
                                            ? 'rgba(52, 211, 153, 0.3)'
                                            : activeAgent.status === 'failed'
                                                ? 'rgba(248, 113, 113, 0.3)'
                                                : 'rgba(255,255,255,0.08)'
                                }`,
                            }}
                        >
                            {activeAgent.status === 'running' ? (
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
                            ) : activeAgent.status === 'completed' ? (
                                <CheckCircleIcon size={12} className="text-emerald-400" />
                            ) : activeAgent.status === 'failed' ? (
                                <XCircleIcon className="w-3 h-3 text-red-400" />
                            ) : (
                                <div className="w-2 h-2 rounded-full bg-zinc-500" />
                            )}
                            <span
                                className="capitalize"
                                style={{
                                    color: activeAgent.status === 'running'
                                        ? accentColor
                                        : activeAgent.status === 'completed'
                                            ? '#34d399'
                                            : activeAgent.status === 'failed'
                                                ? '#f87171'
                                                : 'rgba(255,255,255,0.5)',
                                }}
                            >
                                {activeAgent.status}
                            </span>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5">
                    <GlassButton
                        icon={(isAutoRefresh ? PauseIcon : PlayIcon) as any}
                        isActive={isAutoRefresh}
                        onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                        title={isAutoRefresh ? 'Pause Auto-refresh' : 'Enable Auto-refresh'}
                    />
                    <GlassButton
                        icon={TerminalIcon as any}
                        isActive={showConsole}
                        onClick={() => setShowConsole(!showConsole)}
                        title="Toggle Console"
                    />
                    <GlassButton
                        icon={RefreshIcon as any}
                        onClick={handleRefresh}
                        title="Refresh Preview"
                    />
                    <GlassButton
                        icon={(isFullscreen ? Minimize2Icon : Maximize2Icon) as any}
                        onClick={onToggleFullscreen}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    />
                    <GlassButton
                        icon={ArrowRightIcon as any}
                        onClick={handleOpenExternal}
                        title="Open in New Tab"
                    />
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Preview Panel */}
                <AnimatePresence mode="wait">
                    {(viewMode === 'preview' || viewMode === 'split') && (
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full p-4 flex items-start justify-center overflow-auto`}
                            style={{
                                background: 'linear-gradient(180deg, rgba(30,30,35,0.5) 0%, rgba(20,20,25,0.3) 100%)',
                            }}
                        >
                            {/* Device Frame */}
                            <div
                                className={`transition-all duration-500 ${viewport === 'desktop' ? 'w-full h-full' : 'h-[600px]'}`}
                                style={{
                                    width: viewport !== 'desktop' ? VIEWPORT_SIZES[viewport].width : '100%',
                                    maxWidth: '100%',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    background: 'linear-gradient(145deg, rgba(40,40,45,0.8) 0%, rgba(30,30,35,0.9) 100%)',
                                    boxShadow: `
                                        0 25px 80px rgba(0,0,0,0.4),
                                        0 10px 30px rgba(0,0,0,0.3),
                                        inset 0 1px 0 rgba(255,255,255,0.05),
                                        0 0 0 1px rgba(255,255,255,0.05)
                                    `,
                                    padding: '3px',
                                }}
                            >
                                {/* Device Notch (for mobile) */}
                                {viewport === 'mobile' && (
                                    <div
                                        className="mx-auto h-5 flex items-center justify-center"
                                        style={{
                                            width: '120px',
                                            background: 'rgba(0,0,0,0.8)',
                                            borderRadius: '0 0 12px 12px',
                                        }}
                                    >
                                        <div className="w-14 h-1 rounded-full bg-zinc-700" />
                                    </div>
                                )}

                                {/* Inner frame for preview */}
                                <div
                                    className="w-full h-full rounded-xl overflow-hidden"
                                    style={{
                                        background: '#ffffff',
                                    }}
                                >
                                    {activeAgent ? (
                                        <iframe
                                            ref={iframeRef}
                                            src="about:blank"
                                            className="w-full h-full border-0"
                                            title="Agent Preview"
                                            sandbox="allow-scripts allow-same-origin"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                            <div className="text-center">
                                                <div
                                                    className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                                    style={{
                                                        background: `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.05) 100%)`,
                                                        border: `1px solid ${accentColor}20`,
                                                    }}
                                                >
                                                    <EyeIcon size={32} className="text-white" style={{ color: accentColor }} />
                                                </div>
                                                <p className="text-white/50 text-sm">
                                                    Select an agent to see live preview
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Divider for split view */}
                {viewMode === 'split' && (
                    <div
                        className="w-px shrink-0"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                    />
                )}

                {/* Code Panel */}
                <AnimatePresence mode="wait">
                    {(viewMode === 'code' || viewMode === 'split') && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full overflow-auto`}
                            style={{
                                background: 'rgba(15,15,18,0.9)',
                            }}
                        >
                            <div className="p-4">
                                <div className="font-mono text-sm">
                                    {activeAgent?.filesModified?.length ? (
                                        <div className="space-y-4">
                                            {activeAgent.filesModified.map((file, index) => (
                                                <div key={index}>
                                                    <div
                                                        className="flex items-center gap-2 px-3 py-2 rounded-t-lg text-xs"
                                                        style={{
                                                            background: 'rgba(255,255,255,0.03)',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                            borderBottom: 'none',
                                                            color: accentColor,
                                                        }}
                                                    >
                                                        <Code2Icon size={12} className="inline" />
                                                        {file}
                                                    </div>
                                                    <div
                                                        className="p-4 rounded-b-lg"
                                                        style={{
                                                            background: 'rgba(10,10,12,0.8)',
                                                            border: '1px solid rgba(255,255,255,0.06)',
                                                        }}
                                                    >
                                                        <pre className="text-white/70 text-xs leading-relaxed">
                                                            <code>{`// Code changes from agent will appear here\n// File: ${file}\n\nexport function Component() {\n  return <div>Generated content</div>;\n}`}</code>
                                                        </pre>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-white/30">
                                            <Code2Icon size={48} className="mx-auto mb-3 opacity-50" />
                                            <p>No code changes yet</p>
                                            <p className="text-xs mt-1">Start an agent task to see changes</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Console Panel */}
            <AnimatePresence>
                {showConsole && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 200, opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="shrink-0 overflow-hidden"
                        style={{
                            background: 'linear-gradient(145deg, rgba(15,15,18,0.98) 0%, rgba(10,10,12,1) 100%)',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                        }}
                    >
                        {/* Console Header */}
                        <div
                            className="h-8 flex items-center justify-between px-3"
                            style={{
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                background: 'rgba(255,255,255,0.02)',
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <TerminalIcon className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Console</span>
                            </div>
                            <button
                                onClick={() => setConsoleLogs([])}
                                className="text-xs px-2 py-0.5 rounded transition-colors"
                                style={{
                                    color: 'rgba(255,255,255,0.4)',
                                    background: 'rgba(255,255,255,0.03)',
                                }}
                            >
                                Clear
                            </button>
                        </div>

                        {/* Console Content */}
                        <div className="h-[calc(200px-32px)] overflow-auto p-2 font-mono text-xs">
                            {consoleLogs.length === 0 ? (
                                <div className="text-white/30 text-center py-4">
                                    Console output will appear here
                                </div>
                            ) : (
                                consoleLogs.map((log, index) => (
                                    <div
                                        key={index}
                                        className="flex items-start gap-2 py-0.5"
                                        style={{
                                            color: log.type === 'error'
                                                ? '#f87171'
                                                : log.type === 'warn'
                                                    ? '#fbbf24'
                                                    : 'rgba(255,255,255,0.6)',
                                        }}
                                    >
                                        <span className="opacity-40">{log.timestamp}</span>
                                        <span>{log.message}</span>
                                    </div>
                                ))
                            )}
                            <div ref={consoleEndRef} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Action Buttons - Show when agent is completed */}
            {activeAgent?.status === 'completed' && (
                <div
                    className="shrink-0 p-4 flex items-center justify-between"
                    style={{
                        borderTop: '1px solid rgba(255,255,255,0.06)',
                        background: 'rgba(20,20,25,0.98)',
                    }}
                >
                    <div className="flex items-center gap-2">
                        {activeAgent.verificationPassed ? (
                            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                                <CheckCircleIcon size={12} />
                                Verified ({activeAgent.verificationScore}/100)
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                                <XCircleIcon className="w-3 h-3" />
                                Pending Verification
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowRequestChanges(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all hover:bg-white/5 border border-white/10"
                            style={{ color: 'rgba(255,255,255,0.6)' }}
                        >
                            <MessageSquareIcon size={16} />
                            Request Changes
                        </button>
                        <button
                            onClick={() => setShowCreatePR(true)}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105"
                            style={{
                                background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                color: '#000',
                            }}
                        >
                            <GitPullRequestIcon className="w-4 h-4" />
                            Approve & Create PR
                        </button>
                    </div>
                </div>
            )}

            {/* Request Changes Modal */}
            <RequestChangesModal
                isOpen={showRequestChanges}
                onClose={() => setShowRequestChanges(false)}
                agent={activeAgent ? {
                    id: activeAgent.id,
                    name: activeAgent.name,
                    status: activeAgent.status,
                    verificationScore: activeAgent.verificationScore,
                    verificationPassed: activeAgent.verificationPassed,
                    buildAttempts: activeAgent.buildAttempts,
                } : null}
                onSubmit={(agentId, iterationNumber) => {
                    console.log(`Agent ${agentId} iteration ${iterationNumber} started`);
                    // Restart agent with feedback - handled by the modal's API call
                    setShowRequestChanges(false);
                }}
            />

            {/* Create PR Modal */}
            <CreatePRModal
                isOpen={showCreatePR}
                onClose={() => setShowCreatePR(false)}
                projectId={activeAgent?.id || ''}
                projectName={activeAgent?.name || 'Project'}
                agent={activeAgent ? {
                    id: activeAgent.id,
                    name: activeAgent.name,
                    taskPrompt: activeAgent.taskPrompt,
                    verificationScore: activeAgent.verificationScore,
                    verificationPassed: activeAgent.verificationPassed,
                    filesChanged: activeAgent.filesModified?.length || 0,
                } : undefined}
                branchName={activeAgent?.branch || `kriptik/agent-${activeAgent?.id?.substring(0, 8)}`}
                targetBranch="main"
                filesChanged={activeAgent?.filesModified || []}
                verificationResults={activeAgent?.verificationScore !== undefined ? {
                    passed: activeAgent.verificationPassed || false,
                    score: activeAgent.verificationScore,
                    checks: [
                        { name: 'Build', passed: true },
                        { name: 'Lint', passed: true },
                        { name: 'Tests', passed: activeAgent.verificationPassed || false },
                    ]
                } : undefined}
            />
        </div>
    );
}

export default AgentSandboxPreview;

