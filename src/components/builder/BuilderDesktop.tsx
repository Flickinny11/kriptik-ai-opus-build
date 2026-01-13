/**
 * BuilderDesktop - Desktop-optimized Builder layout (>1024px)
 *
 * Features:
 * - Full three-panel layout with sidebar
 * - File explorer in code view
 * - Quick actions sidebar
 * - All existing glass styling preserved
 */

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusIcons } from '../ui/icons';
import { KriptikLogo } from '../ui/KriptikLogo';
import ChatInterface from './ChatInterface';
import SandpackFileExplorer from './SandpackFileExplorer';
import SandpackEditor from './SandpackEditor';
import SandpackPreviewWindow from './SandpackPreview';
import ProjectMemoryPanel from './ProjectMemoryPanel';
import { GhostModePanel } from './GhostModePanel';
import ActivityFeed from '../collaboration/ActivityFeed';
import CollaborationHeader from '../collaboration/CollaborationHeader';
import { PublishButton } from '../deployment/PublishButton';
import AutonomousAgentsPanel from '../agents/AutonomousAgentsPanel';
import { useEditorStore } from '../../store/useEditorStore';
import type { IntelligenceSettings } from './IntelligenceToggles';
import { BuildPhaseInline, type BuildPhase, type PhaseInfo, type PhaseStatus } from './BuildPhaseIndicator';

interface BuilderDesktopProps {
    projectId?: string;
    projectName: string;
    intelligenceSettings: IntelligenceSettings;
    onNavigateDashboard: () => void;
    onDeploy: () => void;
    activeQuickAction: string | null;
    onQuickActionChange: (action: string | null) => void;
    showGhostMode: boolean;
    showMemory: boolean;
}

// CSS-in-JS for liquid glass styling
const liquidGlassPanel = {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 50%, rgba(248,248,250,0.5) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 20px 60px rgba(0,0,0,0.1),
        0 8px 24px rgba(0,0,0,0.08),
        inset 0 2px 4px rgba(255,255,255,0.9),
        inset 0 -1px 2px rgba(0,0,0,0.02),
        0 0 0 1px rgba(255,255,255,0.5)
    `,
};

const liquidGlassHeader = {
    background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: `
        0 4px 30px rgba(0,0,0,0.3),
        0 2px 8px rgba(0,0,0,0.2),
        inset 0 1px 0 rgba(255,255,255,0.1),
        inset 0 -1px 0 rgba(0,0,0,0.3)
    `,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
};

// Quick action items for the sidebar
const quickActions = [
    { icon: StatusIcons.ActivityIcon, label: 'AI Agents', description: 'View orchestrator status', panel: 'agents' },
    { icon: StatusIcons.CloudIcon, label: 'Cloud Deploy', description: 'Deploy to cloud', panel: 'cloud' },
    { icon: StatusIcons.DatabaseIcon, label: 'Database', description: 'Manage schemas', panel: 'database' },
    { icon: StatusIcons.WorkflowIcon, label: 'Workflows', description: 'ComfyUI & ML', panel: 'workflows' },
];

export default function BuilderDesktop({
    projectId,
    projectName,
    intelligenceSettings,
    onNavigateDashboard,
    onDeploy,
    activeQuickAction,
    onQuickActionChange,
    showGhostMode,
    showMemory,
}: BuilderDesktopProps) {
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const { selectedElement, setSelectedElement } = useEditorStore();

    // PHASE C: Build phase tracking state
    const [buildPhases, setBuildPhases] = useState<PhaseInfo[]>([]);
    const [currentBuildPhase, setCurrentBuildPhase] = useState<BuildPhase | null>(null);
    const [isBuilding, setIsBuilding] = useState(false);

    // PHASE C: Listen for build phase events from ChatInterface/WebSocket
    useEffect(() => {
        // Handler for phase completion events
        const handlePhaseComplete = (event: CustomEvent<{
            phase: string;
            status: PhaseStatus;
            progress?: number;
            message?: string;
        }>) => {
            const { phase, status, progress, message } = event.detail;
            console.log('[BuilderDesktop] Phase complete event:', phase, status);

            // Map backend phase names to BuildPhase type
            const phaseMapping: Record<string, BuildPhase> = {
                'intent_lock': 'intent_lock',
                'initialization': 'initialization',
                'parallel_build': 'parallel_build',
                'integration_check': 'integration',
                'functional_test': 'testing',
                'intent_satisfaction': 'intent_satisfaction',
                'browser_demo': 'demo',
            };

            const mappedPhase = phaseMapping[phase] || phase as BuildPhase;

            setBuildPhases(prev => {
                const existing = prev.find(p => p.phase === mappedPhase);
                if (existing) {
                    return prev.map(p =>
                        p.phase === mappedPhase
                            ? { ...p, status, progress, message }
                            : p
                    );
                }
                return [...prev, { phase: mappedPhase, status, progress, message }];
            });

            // Update current phase if this is an active phase
            if (status === 'active') {
                setCurrentBuildPhase(mappedPhase);
                setIsBuilding(true);
            } else if (status === 'complete' && mappedPhase === 'demo') {
                // Build complete
                setIsBuilding(false);
            }
        };

        // Handler for build start event
        const handleBuildStart = () => {
            console.log('[BuilderDesktop] Build started');
            setIsBuilding(true);
            setBuildPhases([]);
            setCurrentBuildPhase('intent_lock');
        };

        // Handler for intent contract locked
        const handleIntentLocked = (event: CustomEvent<{
            intentId: string;
            lockedAt: string;
        }>) => {
            console.log('[BuilderDesktop] Intent contract locked:', event.detail.intentId);
            setBuildPhases(prev => {
                const existing = prev.find(p => p.phase === 'intent_lock');
                if (existing) {
                    return prev.map(p =>
                        p.phase === 'intent_lock'
                            ? { ...p, status: 'complete' as PhaseStatus }
                            : p
                    );
                }
                return [...prev, { phase: 'intent_lock' as BuildPhase, status: 'complete' as PhaseStatus }];
            });
        };

        // Handler for build demo ready (final phase)
        const handleBuildDemoReady = (event: CustomEvent<{
            url: string;
            takeControlAvailable: boolean;
            visualScore: number;
        }>) => {
            console.log('[BuilderDesktop] Build demo ready:', event.detail.url);
            setBuildPhases(prev => {
                const existing = prev.find(p => p.phase === 'demo');
                if (existing) {
                    return prev.map(p =>
                        p.phase === 'demo'
                            ? { ...p, status: 'complete' as PhaseStatus, progress: 100 }
                            : p
                    );
                }
                return [...prev, { phase: 'demo' as BuildPhase, status: 'complete' as PhaseStatus }];
            });
            setCurrentBuildPhase('demo');
            setIsBuilding(false);
        };

        window.addEventListener('build-phase-complete', handlePhaseComplete as unknown as EventListener);
        window.addEventListener('build-start', handleBuildStart as EventListener);
        window.addEventListener('intent-contract-locked', handleIntentLocked as unknown as EventListener);
        window.addEventListener('build-demo-ready', handleBuildDemoReady as unknown as EventListener);

        return () => {
            window.removeEventListener('build-phase-complete', handlePhaseComplete as unknown as EventListener);
            window.removeEventListener('build-start', handleBuildStart as EventListener);
            window.removeEventListener('intent-contract-locked', handleIntentLocked as unknown as EventListener);
            window.removeEventListener('build-demo-ready', handleBuildDemoReady as unknown as EventListener);
        };
    }, []);

    // Automatically switch to code view when an element is selected
    useEffect(() => {
        if (selectedElement) {
            setActiveTab('code');
            setTimeout(() => setSelectedElement(null), 1000);
        }
    }, [selectedElement, setSelectedElement]);

    const handleQuickAction = useCallback((panel: string) => {
        if (activeQuickAction === panel) {
            onQuickActionChange(null);
        } else {
            onQuickActionChange(panel);
        }
    }, [activeQuickAction, onQuickActionChange]);

    return (
        <div className="h-full flex flex-col">
            {/* Desktop Header */}
            <header
                className="h-14 flex items-center justify-between px-4 z-20 shrink-0"
                style={liquidGlassHeader}
            >
                <div className="flex items-center gap-4">
                    {/* Dashboard Button */}
                    <GlassIconButton
                        icon={StatusIcons.LayoutDashboardIcon}
                        onClick={onNavigateDashboard}
                        title="Dashboard"
                        size="sm"
                    />

                    <div className="h-6 w-px bg-white/10" />

                    {/* Logo */}
                    <div
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={onNavigateDashboard}
                    >
                        <KriptikLogo size="sm" animated={false} />
                        <span className="font-bold text-lg text-white">
                            KripTik<span className="text-zinc-400">AI</span>
                        </span>
                    </div>

                    <div className="h-6 w-px bg-white/10 mx-2" />

                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isBuilding ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
                        <span className="text-sm text-zinc-400">
                            {projectId || 'New Project'}
                        </span>
                    </div>

                    {/* PHASE C: Build Phase Indicator - Shows during builds */}
                    {isBuilding && buildPhases.length > 0 && (
                        <>
                            <div className="h-6 w-px bg-white/10 mx-2" />
                            <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5">
                                <BuildPhaseInline
                                    phases={buildPhases}
                                    currentPhase={currentBuildPhase || undefined}
                                />
                            </div>
                        </>
                    )}

                    <div className="h-6 w-px bg-white/10 mx-2" />
                </div>

                <div className="flex items-center gap-2">
                    <CollaborationHeader />

                    <div className="h-4 w-px bg-white/10 mx-2" />

                    <GlassIconButton
                        icon={StatusIcons.SettingsIcon}
                        title="Settings"
                        size="sm"
                    />

                    <GlassButton
                        icon={StatusIcons.CloudIcon}
                        onClick={onDeploy}
                        variant="deploy"
                    >
                        Deploy
                    </GlassButton>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden flex min-h-0">
                {/* Quick Actions Sidebar */}
                <div
                    className="w-16 flex flex-col items-center py-4 gap-3 shrink-0"
                    style={{
                        ...liquidGlassPanel,
                        borderRight: '1px solid rgba(255,255,255,0.3)',
                        borderRadius: 0,
                    }}
                >
                    {quickActions.map((action) => (
                        <div key={action.panel} className="relative group">
                            <GlassIconButton
                                icon={action.icon}
                                onClick={() => handleQuickAction(action.panel)}
                                isActive={activeQuickAction === action.panel}
                                title={action.label}
                            />

                            {/* Tooltip */}
                            <div
                                className="absolute left-full ml-3 px-3 py-2 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50"
                                style={{
                                    ...liquidGlassPanel,
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.5)',
                                }}
                            >
                                <div className="text-sm font-medium" style={{ color: '#1a1a1a' }}>{action.label}</div>
                                <div className="text-xs" style={{ color: '#666' }}>{action.description}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Builder Main Area */}
                <div className="flex-1 min-w-0">
                    <PanelGroup direction="horizontal">
                        {/* Left Panel: Chat */}
                        <Panel defaultSize={activeTab === 'code' ? 25 : 30} minSize={20}>
                            <div
                                className="h-full flex flex-col m-2 rounded-2xl overflow-hidden"
                                style={liquidGlassPanel}
                            >
                                <ChatInterface intelligenceSettings={intelligenceSettings} projectId={projectId} />
                                {activeTab === 'preview' && <ActivityFeed />}
                            </div>
                        </Panel>

                        <PanelResizeHandle className="w-2 hover:bg-amber-500/30 transition-colors mx-1" />

                        {/* Middle Panel: File Explorer (only in code view) */}
                        {activeTab === 'code' && (
                            <>
                                <Panel defaultSize={15} minSize={10} maxSize={25}>
                                    <div
                                        className="h-full flex flex-col my-2 rounded-2xl overflow-hidden"
                                        style={liquidGlassPanel}
                                    >
                                        <SandpackFileExplorer />
                                    </div>
                                </Panel>
                                <PanelResizeHandle className="w-2 hover:bg-amber-500/30 transition-colors mx-1" />
                            </>
                        )}

                        {/* Right Panel: Preview or Code */}
                        <Panel defaultSize={activeTab === 'code' ? 60 : 70} minSize={40}>
                            <div
                                className="h-full flex flex-col relative m-2 rounded-2xl overflow-hidden"
                                style={liquidGlassPanel}
                            >
                                {/* Tab bar */}
                                <div
                                    className="px-4 py-3 flex justify-between items-center shrink-0"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                >
                                    <div className="flex gap-2">
                                        <TabButton
                                            active={activeTab === 'preview'}
                                            onClick={() => setActiveTab('preview')}
                                            icon={StatusIcons.EyeIcon}
                                        >
                                            Preview
                                        </TabButton>
                                        <TabButton
                                            active={activeTab === 'code'}
                                            onClick={() => setActiveTab('code')}
                                            icon={StatusIcons.Code2Icon}
                                        >
                                            Code
                                        </TabButton>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="text-xs flex items-center gap-2" style={{ color: '#666' }}>
                                            <kbd
                                                className="px-2 py-1 rounded-lg text-[10px] font-mono"
                                                style={{
                                                    background: 'rgba(0,0,0,0.05)',
                                                    border: '1px solid rgba(0,0,0,0.1)',
                                                    color: '#1a1a1a',
                                                }}
                                            >
                                                Cmd+K
                                            </kbd>
                                            <span>Quick actions</span>
                                        </div>
                                        <PublishButton
                                            projectId={projectId || 'new-project'}
                                            projectName={projectName}
                                        />
                                    </div>
                                </div>

                                {/* Content area */}
                                <div className="flex-1 overflow-hidden relative min-h-0">
                                    <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'preview'
                                        ? 'opacity-100 z-10'
                                        : 'opacity-0 z-0 pointer-events-none'
                                        }`}>
                                        <SandpackPreviewWindow />
                                    </div>
                                    <div className={`absolute inset-0 transition-opacity duration-300 ${activeTab === 'code'
                                        ? 'opacity-100 z-10'
                                        : 'opacity-0 z-0 pointer-events-none'
                                        }`}>
                                        <SandpackEditor />
                                    </div>
                                </div>
                            </div>
                        </Panel>
                    </PanelGroup>
                </div>

                {/* Quick Action Panel */}
                <AnimatePresence>
                    {activeQuickAction && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 340, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="shrink-0 overflow-hidden m-2"
                        >
                            <div
                                className="w-[324px] h-full flex flex-col rounded-2xl overflow-hidden"
                                style={liquidGlassPanel}
                            >
                                <div
                                    className="flex items-center justify-between p-4"
                                    style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                >
                                    <h3 className="font-semibold flex items-center gap-2" style={{ color: '#1a1a1a' }}>
                                        {activeQuickAction === 'agents' && <><StatusIcons.ActivityIcon size={16} /> AI Agents</>}
                                        {activeQuickAction === 'cloud' && <><StatusIcons.CloudIcon size={16} /> Cloud Deploy</>}
                                        {activeQuickAction === 'database' && <><StatusIcons.DatabaseIcon size={16} /> Database</>}
                                        {activeQuickAction === 'workflows' && <><StatusIcons.WorkflowIcon size={16} /> Workflows</>}
                                    </h3>
                                    <GlassIconButton
                                        icon={StatusIcons.XIcon}
                                        onClick={() => onQuickActionChange(null)}
                                        size="sm"
                                    />
                                </div>
                                <div className="flex-1 overflow-auto p-4">
                                    {activeQuickAction === 'agents' && <AutonomousAgentsPanel />}
                                    {activeQuickAction === 'cloud' && <CloudDeployPlaceholder />}
                                    {activeQuickAction === 'database' && <DatabasePlaceholder />}
                                    {activeQuickAction === 'workflows' && <WorkflowsPlaceholder />}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Ghost Mode Panel */}
                <AnimatePresence>
                    {showGhostMode && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 400, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="shrink-0 overflow-hidden m-2"
                        >
                            <div className="w-[384px] h-full rounded-2xl overflow-hidden">
                                <GhostModePanel projectId={projectId || 'new-project'} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Memory Panel */}
                <AnimatePresence>
                    {showMemory && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                            className="shrink-0 m-2"
                        >
                            <div
                                className="w-[304px] h-full rounded-2xl overflow-hidden"
                                style={liquidGlassPanel}
                            >
                                <ProjectMemoryPanel />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Glass Icon Button Component
function GlassIconButton({
    icon: Icon,
    onClick,
    isActive = false,
    title,
    size = 'md'
}: {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    onClick?: () => void;
    isActive?: boolean;
    title?: string;
    size?: 'sm' | 'md';
}) {
    const [isHovered, setIsHovered] = useState(false);
    const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    const iconSizeNum = size === 'sm' ? 16 : 20;

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            title={title}
            className={`${sizeClasses} rounded-xl flex items-center justify-center transition-all duration-300`}
            style={{
                background: isActive
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)'
                    : isHovered
                        ? 'linear-gradient(145deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.4) 100%)'
                        : 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
                backdropFilter: 'blur(16px)',
                boxShadow: isActive
                    ? `inset 0 0 15px rgba(255, 160, 120, 0.2), 0 4px 12px rgba(255, 140, 100, 0.15), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                    : isHovered
                        ? `0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`
                        : `0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.3)`,
                transform: isHovered ? 'translateY(-1px) scale(1.02)' : 'translateY(0)',
            }}
        >
            <Icon size={iconSizeNum} />
        </button>
    );
}

// Glass Text Button Component
function GlassButton({
    children,
    onClick,
    variant = 'default',
    icon: Icon,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: 'default' | 'primary' | 'deploy';
    icon?: React.ComponentType<{ size?: number; className?: string }>;
}) {
    const [isHovered, setIsHovered] = useState(false);

    const getStyles = () => {
        if (variant === 'deploy') {
            return {
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.7) 0%, rgba(255,180,150,0.55) 100%)'
                    : 'linear-gradient(145deg, rgba(255,220,200,0.6) 0%, rgba(255,200,170,0.45) 100%)',
                boxShadow: isHovered
                    ? `0 8px 24px rgba(255, 140, 100, 0.2), inset 0 0 20px rgba(255, 160, 120, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.6)`
                    : `0 4px 16px rgba(255, 140, 100, 0.15), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255, 200, 170, 0.4)`,
            };
        }
        return {
            background: isHovered
                ? 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)'
                : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
            boxShadow: isHovered
                ? `0 6px 20px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.5)`
                : `0 2px 10px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.35)`,
        };
    };

    const styles = getStyles();

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 relative overflow-hidden"
            style={{
                ...styles,
                backdropFilter: 'blur(16px)',
                color: '#1a1a1a',
                fontWeight: 500,
                fontSize: '13px',
                transform: isHovered ? 'translateY(-1px)' : 'translateY(0)',
            }}
        >
            {Icon && <Icon size={16} />}
            <span>{children}</span>
        </button>
    );
}

// Tab Button Component
function TabButton({
    active,
    onClick,
    icon: Icon,
    children
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    children: React.ReactNode;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300"
            style={{
                background: active
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)'
                    : isHovered
                        ? 'rgba(0,0,0,0.04)'
                        : 'transparent',
                boxShadow: active
                    ? `inset 0 0 15px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(255, 200, 170, 0.3)`
                    : 'none',
                color: active ? '#c25a00' : '#666',
            }}
        >
            <Icon size={14} />
            {children}
        </button>
    );
}

// Placeholder components for quick action panels
function CloudDeployPlaceholder() {
    return (
        <div className="text-sm text-stone-500">
            Cloud deployment panel content will be loaded here.
        </div>
    );
}

function DatabasePlaceholder() {
    return (
        <div className="text-sm text-stone-500">
            Database management panel content will be loaded here.
        </div>
    );
}

function WorkflowsPlaceholder() {
    return (
        <div className="text-sm text-stone-500">
            Workflows panel content will be loaded here.
        </div>
    );
}
