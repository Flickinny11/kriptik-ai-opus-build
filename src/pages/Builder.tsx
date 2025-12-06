/**
 * Builder Page - Main AI-powered development environment
 *
 * Features:
 * - Real-time AI code generation with streaming
 * - Multi-agent orchestration panel
 * - Live code preview via Sandpack
 * - Cloud provisioning interface
 * - Integrated file explorer
 * - Monaco code editor
 * - Collaboration tools
 *
 * Design: Liquid Glass 3D aesthetic with warm internal glow
 */

import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Code2, Eye, Settings, Brain, Blocks,
    Cloud, ChevronRight, X, Activity,
    Database, Server, Workflow, LayoutDashboard,
    Check, Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SandpackProvider } from '../lib/sandpack-provider';
import ChatInterface from '../components/builder/ChatInterface';
import SandpackFileExplorer from '../components/builder/SandpackFileExplorer';
import SandpackEditor from '../components/builder/SandpackEditor';
import SandpackPreviewWindow from '../components/builder/SandpackPreview';
import ProjectMemoryPanel from '../components/builder/ProjectMemoryPanel';
import QualityReportModal from '../components/builder/QualityReportModal';
import CommandPalette from '../components/builder/CommandPalette';
import MobileViewToggle, { useMobileView } from '../components/builder/MobileViewToggle';
import AutonomousAgentsPanel from '../components/agents/AutonomousAgentsPanel';
import DeploymentModal from '../components/deployment/DeploymentModal';
import { PublishButton } from '../components/deployment/PublishButton';
import IntegrationMarketplace from '../components/integrations/IntegrationMarketplace';
import ShareModal from '../components/collaboration/ShareModal';
import CollaborationHeader from '../components/collaboration/CollaborationHeader';
import ActivityFeed from '../components/collaboration/ActivityFeed';
import KeyboardShortcutsPanel from '../components/onboarding/KeyboardShortcutsPanel';
import { KriptikLogo } from '../components/ui/KriptikLogo';
// Builder/Agents Mode Components
import { BuilderAgentsToggle } from '../components/builder/BuilderAgentsToggle';
import { AgentModeSidebar } from '../components/builder/AgentModeSidebar';
// Ultimate AI-First Builder Architecture Components
import { SpeedDialSelector } from '../components/builder/SpeedDialSelector';
import { IntelligenceToggles } from '../components/builder/IntelligenceToggles';
import { BuildPhaseIndicator } from '../components/builder/BuildPhaseIndicator';
import { VerificationSwarmStatus } from '../components/builder/VerificationSwarmStatus';
import { useQualityStore } from '../store/useQualityStore';
import { qualityScanner } from '../lib/QualityScanner';
import { useEditorStore } from '../store/useEditorStore';
import { useDeploymentStore } from '../store/useDeploymentStore';
import { useIntegrationStore } from '../store/useIntegrationStore';
import { useParams } from 'react-router-dom';

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

// Initial files for a new project - No purple, using warm neutral tones
const INITIAL_FILES = {
    '/App.tsx': {
        code: `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-900 via-neutral-900 to-stone-950 flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Welcome to <span className="text-amber-400">KripTik AI</span>
        </h1>
        <p className="text-xl text-stone-300 max-w-md mx-auto">
          Start building your app by describing what you want in the chat.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setCount(c => c + 1)}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
          >
            Count: {count}
          </button>
          <button className="px-6 py-3 bg-stone-700 hover:bg-stone-600 text-white rounded-lg font-medium transition-colors">
            Learn More
          </button>
        </div>
      </div>
    </div>
  );
}`,
        active: true,
    },
    '/index.tsx': {
        code: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    },
    '/styles.css': {
        code: `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Tailwind-like utilities */
.min-h-screen { min-height: 100vh; }
.flex { display: flex; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.text-center { text-align: center; }
.space-y-6 > * + * { margin-top: 1.5rem; }
.gap-4 { gap: 1rem; }
.text-5xl { font-size: 3rem; line-height: 1; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.font-bold { font-weight: 700; }
.font-medium { font-weight: 500; }
.tracking-tight { letter-spacing: -0.025em; }
.max-w-md { max-width: 28rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.rounded-lg { border-radius: 0.5rem; }
.transition-colors { transition: color 0.15s, background-color 0.15s; }

/* Colors - Warm neutrals */
.bg-gradient-to-br { background: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
.from-stone-900 { --tw-gradient-from: #1c1917; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, transparent); }
.via-neutral-900 { --tw-gradient-stops: var(--tw-gradient-from), #171717, var(--tw-gradient-to, transparent); }
.to-stone-950 { --tw-gradient-to: #0c0a09; }
.text-white { color: white; }
.text-amber-400 { color: #fbbf24; }
.text-stone-300 { color: #d6d3d1; }
.bg-amber-600 { background-color: #d97706; }
.bg-amber-700 { background-color: #b45309; }
.bg-stone-700 { background-color: #44403c; }
.bg-stone-600 { background-color: #57534e; }

.bg-amber-600:hover { background-color: #b45309; }
.bg-stone-700:hover { background-color: #57534e; }`,
    },
};

// Quick action items for the sidebar
const quickActions = [
    { icon: Activity, label: 'AI Agents', description: 'View orchestrator status', panel: 'agents' },
    { icon: Layers, label: 'Build Mode', description: 'Speed Dial settings', panel: 'buildconfig' },
    { icon: Cloud, label: 'Cloud Deploy', description: 'Deploy to cloud', panel: 'cloud' },
    { icon: Database, label: 'Database', description: 'Manage schemas', panel: 'database' },
    { icon: Workflow, label: 'Workflows', description: 'ComfyUI & ML', panel: 'workflows' },
];

// Liquid Glass Icon Button Component
function GlassIconButton({
    icon: Icon,
    onClick,
    isActive = false,
    title,
    size = 'md'
}: {
    icon: React.ElementType;
    onClick?: () => void;
    isActive?: boolean;
    title?: string;
    size?: 'sm' | 'md';
}) {
    const [isHovered, setIsHovered] = useState(false);
    const sizeClasses = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
    const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

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
            <Icon className={iconSize} style={{ color: isActive ? '#c25a00' : '#1a1a1a' }} />

            {/* Shine effect */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.5s ease',
                    pointerEvents: 'none',
                }}
            />
        </button>
    );
}

// Liquid Glass Text Button Component
function GlassButton({
    children,
    onClick,
    isActive = false,
    variant = 'default',
    icon: Icon,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    isActive?: boolean;
    variant?: 'default' | 'primary' | 'deploy';
    icon?: React.ElementType;
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
            background: isActive
                ? 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)'
                : isHovered
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0.45) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
            boxShadow: isActive
                ? `inset 0 0 15px rgba(255, 160, 120, 0.15), 0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(255, 200, 170, 0.4)`
                : isHovered
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
            {Icon && <Icon className="w-4 h-4" style={{ color: variant === 'deploy' ? '#b45309' : '#1a1a1a' }} />}
            <span className="hidden sm:inline">{children}</span>

            {/* Shine animation */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: isHovered ? '150%' : '-100%',
                    width: '60%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    transform: 'skewX(-15deg)',
                    transition: 'left 0.5s ease',
                    pointerEvents: 'none',
                }}
            />
        </button>
    );
}

export default function Builder() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [showMemory, setShowMemory] = useState(false);
    const [projectName, _setProjectName] = useState('Untitled Project');
    const [showQualityReport, setShowQualityReport] = useState(false);
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
    // Builder/Agents Mode Toggle - swaps layout positions
    const [builderMode, setBuilderMode] = useState<'builder' | 'agents'>('builder');
    // Ultimate AI-First Builder Architecture State
    const [showBuildConfig, setShowBuildConfig] = useState(false);
    const [selectedBuildMode, setSelectedBuildMode] = useState<'lightning' | 'standard' | 'tournament' | 'production'>('standard');
    const [buildPhases] = useState<Array<{
        phase: 'intent_lock' | 'initialization' | 'parallel_build' | 'integration' | 'testing' | 'intent_satisfaction' | 'demo';
        status: 'pending' | 'active' | 'complete' | 'failed' | 'skipped';
        progress?: number;
    }>>([
        { phase: 'intent_lock', status: 'pending' },
        { phase: 'initialization', status: 'pending' },
        { phase: 'parallel_build', status: 'pending' },
        { phase: 'integration', status: 'pending' },
        { phase: 'testing', status: 'pending' },
        { phase: 'intent_satisfaction', status: 'pending' },
        { phase: 'demo', status: 'pending' },
    ]);
    const [verificationAgents, setVerificationAgents] = useState<Array<{
        type: 'error_checker' | 'code_quality' | 'visual_verifier' | 'security_scanner' | 'placeholder_eliminator' | 'design_style';
        status: 'idle' | 'running' | 'passed' | 'failed' | 'warning';
        score?: number;
        lastRun?: Date;
        issues?: number;
    }>>([
        { type: 'error_checker', status: 'idle' },
        { type: 'code_quality', status: 'idle' },
        { type: 'visual_verifier', status: 'idle' },
        { type: 'security_scanner', status: 'idle' },
        { type: 'placeholder_eliminator', status: 'idle' },
        { type: 'design_style', status: 'idle' },
    ]);
    const [intelligenceSettings, setIntelligenceSettings] = useState<{
        thinkingDepth: 'shallow' | 'normal' | 'deep' | 'maximum';
        powerLevel: 'economy' | 'balanced' | 'performance' | 'maximum';
        speedPriority: 'fastest' | 'fast' | 'balanced' | 'quality' | 'maximum-quality';
        creativityLevel: 'conservative' | 'balanced' | 'creative' | 'experimental';
        codeVerbosity: 'minimal' | 'standard' | 'verbose';
        designDetail: 'minimal' | 'standard' | 'polished' | 'premium';
    }>({
        thinkingDepth: 'normal',
        powerLevel: 'balanced',
        speedPriority: 'balanced',
        creativityLevel: 'balanced',
        codeVerbosity: 'standard',
        designDetail: 'standard',
    });
    const { setIsScanning, setReport } = useQualityStore();
    const { selectedElement, setSelectedElement } = useEditorStore();
    const { setIsOpen: setDeploymentOpen } = useDeploymentStore();
    const { setIsOpen: setIntegrationsOpen } = useIntegrationStore();

    // Mobile/tablet responsive view state with swipe gesture support
    const { activeView, setActiveView, isMobile, swipeHandlers } = useMobileView('chat');

    // Automatically switch to code view when an element is selected
    useEffect(() => {
        if (selectedElement) {
            setActiveTab('code');
            setTimeout(() => setSelectedElement(null), 1000);
        }
    }, [selectedElement, setSelectedElement]);

    const handleProductionCheck = async () => {
        setShowQualityReport(true);
        setIsScanning(true);

        if (projectId) {
            qualityScanner.setContext(projectId);
        }

        const report = await qualityScanner.scan();
        setReport(report);
        setIsScanning(false);
    };

    const handleQuickAction = (panel: string) => {
        if (activeQuickAction === panel) {
            setActiveQuickAction(null);
        } else {
            setActiveQuickAction(panel);
        }
    };

    return (
        <SandpackProvider initialFiles={INITIAL_FILES}>
            <div
                className="h-screen flex flex-col relative overflow-hidden"
                style={{ background: 'linear-gradient(180deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
            >
                <QualityReportModal open={showQualityReport} onOpenChange={setShowQualityReport} />
                <DeploymentModal />
                <IntegrationMarketplace />
                <ShareModal />
                <CommandPalette />
                <KeyboardShortcutsPanel />

                {/* Premium Liquid Glass Header */}
                <header
                    className="h-12 sm:h-14 flex items-center justify-between px-2 sm:px-4 z-20 shrink-0"
                    style={liquidGlassHeader}
                >
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Dashboard Button */}
                        <GlassIconButton
                            icon={LayoutDashboard}
                            onClick={() => navigate('/dashboard')}
                            title="Dashboard"
                            size="sm"
                        />

                        <div className="h-6 w-px bg-white/10 hidden sm:block" />

                        {/* Logo */}
                        <div
                            className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate('/dashboard')}
                        >
                            <KriptikLogo size="sm" animated={false} />
                            <span className="font-bold text-base sm:text-lg text-white hidden md:inline">
                                KripTik<span className="text-zinc-400">AI</span>
                            </span>
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-1 sm:mx-2 hidden sm:block" />

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs sm:text-sm text-zinc-400 truncate max-w-[80px] sm:max-w-none">
                                {projectId || 'New Project'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Collaboration header - hidden on mobile */}
                        <div className="hidden lg:block">
                            <CollaborationHeader />
                        </div>

                        <div className="h-4 w-px bg-white/10 mx-1 sm:mx-2 hidden lg:block" />

                        {/* Header Buttons - Hidden on mobile/tablet */}
                        <div className="hidden lg:flex items-center gap-2">
                            <GlassButton
                                icon={Activity}
                                onClick={() => setShowAgentPanel(!showAgentPanel)}
                                isActive={showAgentPanel}
                            >
                                Agents
                            </GlassButton>

                            <GlassButton
                                icon={Brain}
                                onClick={() => setShowMemory(!showMemory)}
                                isActive={showMemory}
                            >
                                Memory
                            </GlassButton>

                            <GlassButton
                                icon={Check}
                                onClick={handleProductionCheck}
                            >
                                Quality Check
                            </GlassButton>

                            <GlassButton
                                icon={Blocks}
                                onClick={() => setIntegrationsOpen(true)}
                            >
                                Integrations
                            </GlassButton>

                            <div className="h-4 w-px bg-white/10 mx-2" />
                        </div>

                        <GlassIconButton
                            icon={Settings}
                            title="Settings"
                            size="sm"
                        />

                        <GlassButton
                            icon={Cloud}
                            onClick={() => setDeploymentOpen(true)}
                            variant="deploy"
                        >
                            Deploy
                        </GlassButton>
                    </div>
                </header>

                {/* Mobile View Toggle */}
                <MobileViewToggle activeView={activeView} onViewChange={setActiveView} />

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                    {/* Quick Actions Sidebar - Liquid Glass (Hidden on mobile) */}
                    <div
                        className="w-16 flex-col items-center py-4 gap-3 shrink-0 hidden lg:flex"
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
                                <div className="absolute left-full ml-3 px-3 py-2 rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50"
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

                    {/* Desktop Layout (1024px+) - Swaps when in Agents mode */}
                    <div className="flex-1 min-w-0 hidden lg:block">
                        <PanelGroup direction="horizontal" key={builderMode}>
                            {/* Builder Mode: Chat on LEFT, Preview on RIGHT */}
                            {/* Agents Mode: Preview on LEFT, Agent Sidebar on RIGHT */}
                            
                            {builderMode === 'builder' ? (
                                <>
                                    {/* Left Panel: Chat (Builder Mode) */}
                                    <Panel defaultSize={activeTab === 'code' ? 25 : 30} minSize={20}>
                                        <div
                                            className="h-full flex flex-col m-2 rounded-2xl overflow-hidden"
                                            style={liquidGlassPanel}
                                        >
                                            {/* Mode Toggle at top of chat */}
                                            <div className="px-4 py-3 flex items-center justify-between shrink-0"
                                                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                            >
                                                <BuilderAgentsToggle mode={builderMode} onModeChange={setBuilderMode} />
                                            </div>
                                            <ChatInterface />
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
                                                {/* Tabs */}
                                                <div className="flex gap-2">
                                                    <TabButton
                                                        active={activeTab === 'preview'}
                                                        onClick={() => setActiveTab('preview')}
                                                        icon={Eye}
                                                    >
                                                        Preview
                                                    </TabButton>
                                                    <TabButton
                                                        active={activeTab === 'code'}
                                                        onClick={() => setActiveTab('code')}
                                                        icon={Code2}
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
                                                            ⌘K
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
                                                <div className={`absolute inset-0 transition-opacity duration-300 ${
                                                    activeTab === 'preview'
                                                        ? 'opacity-100 z-10'
                                                        : 'opacity-0 z-0 pointer-events-none'
                                                }`}>
                                                    <SandpackPreviewWindow />
                                                </div>
                                                <div className={`absolute inset-0 transition-opacity duration-300 ${
                                                    activeTab === 'code'
                                                        ? 'opacity-100 z-10'
                                                        : 'opacity-0 z-0 pointer-events-none'
                                                }`}>
                                                    <SandpackEditor />
                                                </div>
                                            </div>
                                        </div>
                                    </Panel>
                                </>
                            ) : (
                                <>
                                    {/* Left Panel: Preview/Code (Agents Mode) */}
                                    <Panel defaultSize={activeTab === 'code' ? 55 : 65} minSize={40}>
                                        <div
                                            className="h-full flex flex-col relative m-2 rounded-2xl overflow-hidden"
                                            style={liquidGlassPanel}
                                        >
                                            {/* Tab bar */}
                                            <div
                                                className="px-4 py-3 flex justify-between items-center shrink-0"
                                                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                            >
                                                {/* Tabs */}
                                                <div className="flex gap-2">
                                                    <TabButton
                                                        active={activeTab === 'preview'}
                                                        onClick={() => setActiveTab('preview')}
                                                        icon={Eye}
                                                    >
                                                        Preview
                                                    </TabButton>
                                                    <TabButton
                                                        active={activeTab === 'code'}
                                                        onClick={() => setActiveTab('code')}
                                                        icon={Code2}
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
                                                            ⌘K
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
                                                <div className={`absolute inset-0 transition-opacity duration-300 ${
                                                    activeTab === 'preview'
                                                        ? 'opacity-100 z-10'
                                                        : 'opacity-0 z-0 pointer-events-none'
                                                }`}>
                                                    <SandpackPreviewWindow />
                                                </div>
                                                <div className={`absolute inset-0 transition-opacity duration-300 ${
                                                    activeTab === 'code'
                                                        ? 'opacity-100 z-10'
                                                        : 'opacity-0 z-0 pointer-events-none'
                                                }`}>
                                                    <SandpackEditor />
                                                </div>
                                            </div>
                                        </div>
                                    </Panel>

                                    {/* Middle Panel: File Explorer (only in code view, Agents Mode) */}
                                    {activeTab === 'code' && (
                                        <>
                                            <PanelResizeHandle className="w-2 hover:bg-amber-500/30 transition-colors mx-1" />
                                            <Panel defaultSize={15} minSize={10} maxSize={25}>
                                                <div
                                                    className="h-full flex flex-col my-2 rounded-2xl overflow-hidden"
                                                    style={liquidGlassPanel}
                                                >
                                                    <SandpackFileExplorer />
                                                </div>
                                            </Panel>
                                        </>
                                    )}

                                    <PanelResizeHandle className="w-2 hover:bg-lime-400/30 transition-colors mx-1" />

                                    {/* Right Panel: Agent Sidebar (Agents Mode) */}
                                    <Panel defaultSize={activeTab === 'code' ? 30 : 35} minSize={25} maxSize={45}>
                                        <div className="h-full m-2 rounded-2xl overflow-hidden">
                                            {/* Mode Toggle at top */}
                                            <div 
                                                className="px-4 py-3 flex items-center justify-between shrink-0"
                                                style={{ 
                                                    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
                                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                    borderTopLeftRadius: '16px',
                                                    borderTopRightRadius: '16px',
                                                }}
                                            >
                                                <BuilderAgentsToggle mode={builderMode} onModeChange={setBuilderMode} />
                                            </div>
                                            <AgentModeSidebar />
                                        </div>
                                    </Panel>
                                </>
                            )}
                        </PanelGroup>
                    </div>

                    {/* Mobile/Tablet Layout (< 1024px) with swipe gestures */}
                    <div
                        className="flex-1 min-w-0 lg:hidden relative touch-pan-y"
                        onTouchStart={(e) => swipeHandlers.onTouchStart(e.nativeEvent)}
                        onTouchMove={(e) => swipeHandlers.onTouchMove(e.nativeEvent)}
                        onTouchEnd={() => swipeHandlers.onTouchEnd()}
                    >
                        {/* Mobile Chat View - 250ms transition with scale 0.98 -> 1 */}
                        <motion.div
                            initial={false}
                            animate={{
                                opacity: activeView === 'chat' ? 1 : 0,
                                x: activeView === 'chat' ? 0 : -20,
                                scale: activeView === 'chat' ? 1 : 0.98,
                            }}
                            transition={{
                                duration: 0.25,
                                ease: [0.25, 0.1, 0.25, 1], // ease-out
                            }}
                            className={`absolute inset-0 flex flex-col ${
                                activeView === 'chat' ? 'z-10' : 'z-0 pointer-events-none'
                            }`}
                            style={{
                                paddingTop: '72px', // Space for MobileViewToggle + swipe hint
                                willChange: 'transform, opacity', // GPU acceleration
                            }}
                        >
                            <div
                                className="flex-1 flex flex-col mx-2 mb-2 rounded-2xl overflow-hidden"
                                style={{
                                    ...liquidGlassPanel,
                                    // Maintain blur during transitions
                                    backfaceVisibility: 'hidden',
                                    transform: 'translateZ(0)',
                                }}
                            >
                                <ChatInterface />
                            </div>
                        </motion.div>

                        {/* Mobile Preview View - 250ms transition with scale 0.98 -> 1 */}
                        <motion.div
                            initial={false}
                            animate={{
                                opacity: activeView === 'preview' ? 1 : 0,
                                x: activeView === 'preview' ? 0 : 20,
                                scale: activeView === 'preview' ? 1 : 0.98,
                            }}
                            transition={{
                                duration: 0.25,
                                ease: [0.25, 0.1, 0.25, 1], // ease-out
                            }}
                            className={`absolute inset-0 flex flex-col ${
                                activeView === 'preview' ? 'z-10' : 'z-0 pointer-events-none'
                            }`}
                            style={{
                                paddingTop: '72px', // Space for MobileViewToggle + swipe hint
                                willChange: 'transform, opacity', // GPU acceleration
                            }}
                        >
                            <div
                                className="flex-1 flex flex-col mx-2 mb-2 rounded-2xl overflow-hidden"
                                style={{
                                    ...liquidGlassPanel,
                                    // Maintain blur during transitions
                                    backfaceVisibility: 'hidden',
                                    transform: 'translateZ(0)',
                                }}
                            >
                                <SandpackPreviewWindow isMobileView={true} />
                            </div>
                        </motion.div>
                    </div>

                    {/* Quick Action Panel - Hidden on mobile/tablet */}
                    <AnimatePresence>
                        {activeQuickAction && !isMobile && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 340, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="shrink-0 overflow-hidden m-2 hidden lg:block"
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
                                            {activeQuickAction === 'agents' && <><Activity className="w-4 h-4" /> AI Agents</>}
                                            {activeQuickAction === 'cloud' && <><Cloud className="w-4 h-4" /> Cloud Deploy</>}
                                            {activeQuickAction === 'database' && <><Database className="w-4 h-4" /> Database</>}
                                            {activeQuickAction === 'workflows' && <><Workflow className="w-4 h-4" /> Workflows</>}
                                        </h3>
                                        <GlassIconButton
                                            icon={X}
                                            onClick={() => setActiveQuickAction(null)}
                                            size="sm"
                                        />
                                    </div>
                                    <div className="flex-1 overflow-auto p-4">
                                        {activeQuickAction === 'agents' && <AgentStatusPanel />}
                                        {activeQuickAction === 'cloud' && <CloudDeployPanel />}
                                        {activeQuickAction === 'database' && <DatabasePanel />}
                                        {activeQuickAction === 'workflows' && <WorkflowsPanel />}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Autonomous Agents Panel - Hidden on mobile/tablet */}
                    <AnimatePresence>
                        {showAgentPanel && !isMobile && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 420, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="shrink-0 overflow-hidden m-2 hidden lg:block"
                            >
                                <div
                                    className="w-[404px] h-full rounded-2xl overflow-hidden"
                                    style={liquidGlassPanel}
                                >
                                    <AutonomousAgentsPanel />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Memory Panel - Hidden on mobile/tablet */}
                    <AnimatePresence>
                        {showMemory && !isMobile && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 320, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="shrink-0 m-2 hidden lg:block"
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

                    {/* Build Configuration Panel - Ultimate AI-First Builder */}
                    <AnimatePresence>
                        {(activeQuickAction === 'buildconfig' || showBuildConfig) && !isMobile && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 420, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="shrink-0 overflow-hidden m-2 hidden lg:block"
                            >
                                <div
                                    className="w-[404px] h-full rounded-2xl overflow-auto"
                                    style={liquidGlassPanel}
                                >
                                    <div className="p-4 space-y-4">
                                        {/* Header */}
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold text-zinc-800">
                                                Build Configuration
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setShowBuildConfig(false);
                                                    setActiveQuickAction(null);
                                                }}
                                                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors"
                                            >
                                                <X className="w-4 h-4 text-zinc-500" />
                                            </button>
                                        </div>

                                        {/* Build Phase Indicator */}
                                        <div className="bg-white/50 rounded-xl p-3">
                                            <BuildPhaseIndicator
                                                phases={buildPhases}
                                                compact={true}
                                            />
                                        </div>

                                        {/* Speed Dial Selector */}
                                        <SpeedDialSelector
                                            selectedMode={selectedBuildMode}
                                            onModeChange={setSelectedBuildMode}
                                        />

                                        {/* Intelligence Toggles */}
                                        <IntelligenceToggles
                                            settings={intelligenceSettings}
                                            onSettingsChange={setIntelligenceSettings}
                                            compact={true}
                                        />

                                        {/* Verification Swarm Status */}
                                        <div className="pt-2">
                                            <VerificationSwarmStatus
                                                agents={verificationAgents}
                                                compact={true}
                                                onRerun={() => {
                                                    // Trigger verification rerun
                                                    console.log('Rerunning verification swarm...');
                                                    setVerificationAgents(agents =>
                                                        agents.map(a => ({ ...a, status: 'running' as const }))
                                                    );
                                                    // Simulate completion after 2 seconds
                                                    setTimeout(() => {
                                                        setVerificationAgents(agents =>
                                                            agents.map(a => ({
                                                                ...a,
                                                                status: Math.random() > 0.2 ? 'passed' as const : 'warning' as const,
                                                                score: Math.floor(Math.random() * 20) + 80,
                                                                lastRun: new Date(),
                                                            }))
                                                        );
                                                    }, 2000);
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </SandpackProvider>
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
    icon: React.ElementType;
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
            <Icon className="w-3.5 h-3.5" />
            {children}
        </button>
    );
}

// Agent Status Panel Component
function AgentStatusPanel() {
    return <AutonomousAgentsPanel />;
}

// Liquid Glass Card Component
function GlassCard({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`rounded-xl p-4 cursor-pointer transition-all duration-300 ${className}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={onClick}
            style={{
                background: isHovered
                    ? 'linear-gradient(145deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.3) 100%)',
                boxShadow: isHovered
                    ? `0 8px 24px rgba(0,0,0,0.1), inset 0 1px 2px rgba(255,255,255,0.9), 0 0 0 1px rgba(255,255,255,0.6)`
                    : `0 2px 10px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.8), 0 0 0 1px rgba(255,255,255,0.4)`,
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
            }}
        >
            {children}
        </div>
    );
}

// Cloud Deploy Panel Component
function CloudDeployPanel() {
    const providers = [
        { name: 'Vercel', icon: <VercelIcon />, available: true },
        { name: 'Netlify', icon: <NetlifyIcon />, available: true },
        { name: 'RunPod GPU', icon: <Layers className="w-5 h-5" />, available: true },
        { name: 'AWS', icon: <Cloud className="w-5 h-5" />, available: true },
        { name: 'Google Cloud', icon: <Server className="w-5 h-5" />, available: true },
    ];

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: '#666' }}>
                Deploy your app to production with real-time pricing confirmation.
            </p>
            {providers.map((provider, i) => (
                <GlassCard key={i}>
                    <div className="flex items-center gap-3">
                        <span style={{ color: '#1a1a1a' }}>{provider.icon}</span>
                        <div className="flex-1">
                            <span className="font-medium" style={{ color: '#1a1a1a' }}>{provider.name}</span>
                            <p className="text-xs" style={{ color: '#666' }}>
                                {provider.available ? 'Ready to deploy' : 'Coming soon'}
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4" style={{ color: '#999' }} />
                    </div>
                </GlassCard>
            ))}
        </div>
    );
}

// Database Panel Component
function DatabasePanel() {
    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: '#666' }}>
                Manage your database schemas and migrations.
            </p>
            <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>PostgreSQL</span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span style={{ color: '#666' }}>Tables</span>
                        <span style={{ color: '#1a1a1a' }}>0</span>
                    </div>
                    <div className="flex justify-between">
                        <span style={{ color: '#666' }}>Migrations</span>
                        <span style={{ color: '#1a1a1a' }}>0</span>
                    </div>
                </div>
            </GlassCard>
            <GlassButton icon={Layers}>
                Generate Schema
            </GlassButton>
        </div>
    );
}

// Workflows Panel Component
function WorkflowsPanel() {
    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: '#666' }}>
                Deploy ComfyUI workflows and HuggingFace models.
            </p>
            <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                    <Workflow className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>ComfyUI</span>
                </div>
                <p className="text-sm" style={{ color: '#666' }}>
                    Upload workflow JSON to deploy as API endpoint.
                </p>
            </GlassCard>
            <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                    <Server className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>HuggingFace</span>
                </div>
                <p className="text-sm" style={{ color: '#666' }}>
                    Search and deploy ML models with GPU inference.
                </p>
            </GlassCard>
            <GlassButton icon={Workflow}>
                Import Workflow
            </GlassButton>
        </div>
    );
}

// Simple provider icons
function VercelIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 22h20L12 2z"/>
        </svg>
    );
}

function NetlifyIcon() {
    return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.5l6.5 3.25L12 11 5.5 7.75 12 4.5z"/>
        </svg>
    );
}
