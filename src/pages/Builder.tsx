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

import { useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Code2, Eye, Settings, Brain, Blocks,
    Cloud, X, Activity,
    Database, Server, Workflow, LayoutDashboard,
    Check, Layers, TrendingUp, Mic, Plug, LineChart, Download, Sliders,
    Upload, Search, Loader2, AlertCircle, CheckCircle
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
import AutonomousAgentsPanel from '../components/agents/AutonomousAgentsPanel';
import DeploymentModal from '../components/deployment/DeploymentModal';
import { PublishButton } from '../components/deployment/PublishButton';
import IntegrationMarketplace from '../components/integrations/IntegrationMarketplace';
import ShareModal from '../components/collaboration/ShareModal';
import CollaborationHeader from '../components/collaboration/CollaborationHeader';
import ActivityFeed from '../components/collaboration/ActivityFeed';
import KeyboardShortcutsPanel from '../components/onboarding/KeyboardShortcutsPanel';
import { KriptikLogo } from '../components/ui/KriptikLogo';
import { MarketFitDashboard } from '../components/market';
import { VoiceArchitectPanel } from '../components/voice';
import { APIAutopilotPanel } from '../components/api-autopilot';
import { AdaptiveUIPanel } from '../components/adaptive';
import { ContextBridgePanel } from '../components/import';
import { useQualityStore } from '../store/useQualityStore';
import { qualityScanner } from '../lib/QualityScanner';
import { useEditorStore } from '../store/useEditorStore';
import { useDeploymentStore } from '../store/useDeploymentStore';
import { useIntegrationStore } from '../store/useIntegrationStore';
import { useParams } from 'react-router-dom';
import { BuilderAgentsToggle, type BuilderMode } from '../components/builder/BuilderAgentsToggle';
import { DeveloperModeView } from '../components/builder/DeveloperModeView';
import { AgentModeSidebar } from '../components/builder/AgentModeSidebar';
import { GhostModePanel } from '../components/builder/GhostModePanel';
import { SoftInterruptInput } from '../components/builder/SoftInterruptInput';
import IntelligenceToggles, { type IntelligenceSettings } from '../components/builder/IntelligenceToggles';
import TournamentPanel from '../components/builder/TournamentPanel';
import { DeveloperBar } from '../components/developer-bar';

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
    icon: React.ComponentType<{ className?: string; color?: string }>;
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
            <Icon className={iconSize} color={isActive ? '#c25a00' : '#1a1a1a'} />

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
    icon?: React.ComponentType<{ className?: string; color?: string }>;
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
            {Icon && <Icon className="w-4 h-4" color={variant === 'deploy' ? '#b45309' : '#1a1a1a'} />}
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

    // Mode state - Builder (default), Agents, or Developer
    const [builderMode, setBuilderMode] = useState<BuilderMode>('builder');
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [showMemory, setShowMemory] = useState(false);
    const [projectName, _setProjectName] = useState('Untitled Project');
    const [showQualityReport, setShowQualityReport] = useState(false);
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
    const [showGhostMode, setShowGhostMode] = useState(false);
    const [showMarketFit, setShowMarketFit] = useState(false);
    const [showVoiceArchitect, setShowVoiceArchitect] = useState(false);
    const [showAPIAutopilot, setShowAPIAutopilot] = useState(false);
    const [showAdaptiveUI, setShowAdaptiveUI] = useState(false);
    const [showContextBridge, setShowContextBridge] = useState(false);
    const [showIntelligencePanel, setShowIntelligencePanel] = useState(false);
    const [intelligenceSettings, setIntelligenceSettings] = useState<IntelligenceSettings>({
        thinkingDepth: 'normal',
        powerLevel: 'balanced',
        speedPriority: 'balanced',
        creativityLevel: 'balanced',
        codeVerbosity: 'standard',
        designDetail: 'standard',
    });
    const [activeTournamentId, setActiveTournamentId] = useState<string | null>(null);
    const [showTournament, setShowTournament] = useState(false);
    // Developer Bar active features state
    const [activeDevBarFeatures, setActiveDevBarFeatures] = useState<string[]>([]);
    const { setIsScanning, setReport } = useQualityStore();
    const { selectedElement, setSelectedElement } = useEditorStore();
    const { setIsOpen: setDeploymentOpen } = useDeploymentStore();
    const { setIsOpen: setIntegrationsOpen } = useIntegrationStore();

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

    // Handler for tournament winner selection
    const handleTournamentWinner = (files: Record<string, string>) => {
        // Merge winning files into project (would integrate with Sandpack/file system)
        console.log('Tournament winner files:', Object.keys(files));
        setShowTournament(false);
        setActiveTournamentId(null);
    };

    // Handler for Developer Bar feature toggle
    const handleDevBarFeatureToggle = useCallback((featureId: string) => {
        // Map feature IDs to their corresponding panel states
        switch (featureId) {
            case 'ghost-mode':
                setShowGhostMode(prev => !prev);
                break;
            case 'market-fit':
                setShowMarketFit(true);
                break;
            case 'voice-first':
                setShowVoiceArchitect(true);
                break;
            case 'api-autopilot':
                setShowAPIAutopilot(true);
                break;
            case 'integrations':
                setIntegrationsOpen(true);
                break;
            case 'deployment':
            case 'cloud-deploy':
                setDeploymentOpen(true);
                break;
            case 'quality-check':
                handleProductionCheck();
                break;
            case 'memory':
                setShowMemory(prev => !prev);
                break;
            case 'agents':
                setShowAgentPanel(prev => !prev);
                break;
            default:
                // Toggle in active features list for Developer Bar panel handling
                setActiveDevBarFeatures(prev =>
                    prev.includes(featureId)
                        ? prev.filter(id => id !== featureId)
                        : [...prev, featureId]
                );
        }
    }, [setIntegrationsOpen, setDeploymentOpen, handleProductionCheck]);

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
                <TournamentPanel
                    tournamentId={activeTournamentId}
                    isVisible={showTournament}
                    onClose={() => {
                        setShowTournament(false);
                        setActiveTournamentId(null);
                    }}
                    onSelectWinner={handleTournamentWinner}
                />

                {/* Market Fit Oracle - Competitor Analysis & Positioning */}
                <MarketFitDashboard
                    isOpen={showMarketFit}
                    onClose={() => setShowMarketFit(false)}
                    projectId={projectId || 'default'}
                    projectDescription="AI-powered application builder"
                />

                {/* Voice Architect - Voice-to-Code */}
                <VoiceArchitectPanel
                    isOpen={showVoiceArchitect}
                    onClose={() => setShowVoiceArchitect(false)}
                    onBuild={(buildPrompt, projectName) => {
                        // Send the voice-derived build prompt to the chat interface
                        console.log('Voice build:', { buildPrompt, projectName });
                        // The chat interface will receive this through context or props
                        setShowVoiceArchitect(false);
                    }}
                    projectId={projectId}
                />

                {/* API Autopilot - API Discovery & Integration */}
                <APIAutopilotPanel
                    isOpen={showAPIAutopilot}
                    onClose={() => setShowAPIAutopilot(false)}
                    projectId={projectId}
                    onIntegrationComplete={(integrationId) => {
                        console.log('API integration complete:', integrationId);
                        setShowAPIAutopilot(false);
                    }}
                />

                {/* Adaptive UI - Behavior Learning */}
                <AdaptiveUIPanel
                    isOpen={showAdaptiveUI}
                    onClose={() => setShowAdaptiveUI(false)}
                    projectId={projectId}
                />

                {/* Context Bridge - Import Existing Code */}
                <ContextBridgePanel
                    isOpen={showContextBridge}
                    onClose={() => setShowContextBridge(false)}
                    projectId={projectId}
                    onImportComplete={(profile) => {
                        console.log('Codebase imported:', profile);
                    }}
                />

                {/* ============================================================ */}
                {/* DEVELOPER BAR - 3D Glass Command Center (Spline-inspired) */}
                {/* ============================================================ */}
                <DeveloperBar
                    activeFeatures={[
                        ...activeDevBarFeatures,
                        ...(showGhostMode ? ['ghost-mode'] : []),
                        ...(showAgentPanel ? ['agents'] : []),
                        ...(showMemory ? ['memory'] : []),
                    ]}
                    onFeatureToggle={handleDevBarFeatureToggle}
                />

                {/* Premium Liquid Glass Header */}
                <header
                    className="h-14 flex items-center justify-between px-4 z-20 shrink-0"
                    style={liquidGlassHeader}
                >
                    <div className="flex items-center gap-4">
                        {/* Dashboard Button */}
                        <GlassIconButton
                            icon={LayoutDashboard}
                            onClick={() => navigate('/dashboard')}
                            title="Dashboard"
                            size="sm"
                        />

                        <div className="h-6 w-px bg-white/10" />

                        {/* Logo */}
                        <div
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate('/dashboard')}
                        >
                            <KriptikLogo size="sm" animated={false} />
                            <span className="font-bold text-lg text-white hidden sm:inline">
                                KripTik<span className="text-zinc-400">AI</span>
                            </span>
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-2" />

                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-sm text-zinc-400">
                                {projectId || 'New Project'}
                            </span>
                        </div>

                        <div className="h-6 w-px bg-white/10 mx-2" />

                        {/* Builder/Agents/Developer Mode Toggle */}
                        <BuilderAgentsToggle
                            mode={builderMode}
                            onModeChange={setBuilderMode}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <CollaborationHeader />

                        <div className="h-4 w-px bg-white/10 mx-2" />

                        {/* Header Buttons */}
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

                        {/* Ghost Mode - Autonomous Building */}
                        <GlassButton
                            onClick={() => setShowGhostMode(!showGhostMode)}
                            isActive={showGhostMode}
                        >
                            👻 Ghost Mode
                        </GlassButton>

                        {/* Market Fit Oracle - Competitor Analysis */}
                        <GlassButton
                            icon={TrendingUp}
                            onClick={() => setShowMarketFit(true)}
                            isActive={showMarketFit}
                        >
                            Market Fit
                        </GlassButton>

                        {/* Voice Architect - Voice-to-Code */}
                        <GlassButton
                            icon={Mic}
                            onClick={() => setShowVoiceArchitect(true)}
                            isActive={showVoiceArchitect}
                        >
                            Voice
                        </GlassButton>

                        {/* API Autopilot - API Integration */}
                        <GlassButton
                            icon={Plug}
                            onClick={() => setShowAPIAutopilot(true)}
                            isActive={showAPIAutopilot}
                        >
                            APIs
                        </GlassButton>

                        {/* Adaptive UI - Behavior Learning */}
                        <GlassButton
                            icon={LineChart}
                            onClick={() => setShowAdaptiveUI(true)}
                            isActive={showAdaptiveUI}
                        >
                            Adaptive
                        </GlassButton>

                        {/* Context Bridge - Import Existing Code */}
                        <GlassButton
                            icon={Download}
                            onClick={() => setShowContextBridge(true)}
                            isActive={showContextBridge}
                        >
                            Import
                        </GlassButton>

                        {/* Intelligence Toggles - AI Capability Settings */}
                        <GlassButton
                            icon={Sliders}
                            onClick={() => setShowIntelligencePanel(!showIntelligencePanel)}
                            isActive={showIntelligencePanel}
                        >
                            Intelligence
                        </GlassButton>

                        <div className="h-4 w-px bg-white/10 mx-2" />

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

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                    {/* Quick Actions Sidebar - Only in Builder mode */}
                    {builderMode === 'builder' && (
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
                    )}

                    {/* ====================================================== */}
                    {/* DEVELOPER MODE - Import & Enhance Existing Projects */}
                    {/* ====================================================== */}
                    {builderMode === 'developer' && (
                        <div className="flex-1 flex min-h-0">
                            {/* Developer Mode View */}
                            <div className="flex-1 m-2 rounded-2xl overflow-hidden">
                                <DeveloperModeView />
                            </div>

                            {/* Soft Interrupt Input - Floating */}
                            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-96">
                                <SoftInterruptInput
                                    sessionId={projectId || 'default-session'}
                                    agentId={projectId || 'default'}
                                />
                            </div>
                        </div>
                    )}

                    {/* ====================================================== */}
                    {/* AGENTS MODE - Multi-Agent Orchestration */}
                    {/* ====================================================== */}
                    {builderMode === 'agents' && (
                        <div className="flex-1 flex min-h-0">
                            {/* Preview on LEFT in Agents mode */}
                            <div className="flex-1 m-2 rounded-2xl overflow-hidden" style={liquidGlassPanel}>
                                <div className="h-full flex flex-col">
                                    {/* Tab bar */}
                                    <div
                                        className="px-4 py-3 flex justify-between items-center shrink-0"
                                        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                                    >
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
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        {activeTab === 'preview' ? (
                                            <SandpackPreviewWindow />
                                        ) : (
                                            <SandpackEditor />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Agent Mode Sidebar on RIGHT */}
                            <div className="w-[420px] shrink-0 m-2 rounded-2xl overflow-hidden">
                                <AgentModeSidebar />
                            </div>
                        </div>
                    )}

                    {/* ====================================================== */}
                    {/* BUILDER MODE - Original Autonomous Building */}
                    {/* ====================================================== */}
                    {builderMode === 'builder' && (
                    <div className="flex-1 min-w-0">
                        <PanelGroup direction="horizontal">
                            {/* Left Panel: Chat */}
                            <Panel defaultSize={activeTab === 'code' ? 25 : 30} minSize={20}>
                                <div
                                    className="h-full flex flex-col m-2 rounded-2xl overflow-hidden"
                                    style={liquidGlassPanel}
                                >
                                    {/* Intelligence Toggles Panel */}
                                    {showIntelligencePanel && (
                                        <div className="border-b border-black/5 p-3">
                                            <IntelligenceToggles
                                                settings={intelligenceSettings}
                                                onSettingsChange={setIntelligenceSettings}
                                                compact={true}
                                            />
                                        </div>
                                    )}
                                    <ChatInterface intelligenceSettings={intelligenceSettings} />
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
                        </PanelGroup>
                    </div>
                    )}
                    {/* End of Builder Mode */}

                    {/* Quick Action Panel - Only in Builder mode */}
                    {builderMode === 'builder' && (
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
                    )}

                    {/* Autonomous Agents Panel - Only in Builder mode */}
                    {builderMode === 'builder' && (
                    <AnimatePresence>
                        {showAgentPanel && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 420, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="shrink-0 overflow-hidden m-2"
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
                    )}

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
    icon: React.ComponentType<{ className?: string }>;
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

// Cloud Deploy Panel Component - Wired to backend services
function CloudDeployPanel() {
    const { setIsOpen: setDeploymentOpen } = useDeploymentStore();
    const { projectId } = useParams<{ projectId: string }>();
    const [isDeploying, setIsDeploying] = useState<string | null>(null);
    const [deployStatus, setDeployStatus] = useState<{ type: 'success' | 'error' | null; message: string; provider?: string }>({ type: null, message: '' });
    const [costEstimate, setCostEstimate] = useState<{ provider: string; hourly: number; monthly: number } | null>(null);

    const providers = [
        { id: 'vercel', name: 'Vercel', icon: <VercelIcon />, available: true, description: 'Edge-first deployment', type: 'serverless' },
        { id: 'netlify', name: 'Netlify', icon: <NetlifyIcon />, available: true, description: 'JAMstack hosting', type: 'serverless' },
        { id: 'runpod', name: 'RunPod GPU', icon: <Layers className="w-5 h-5" />, available: true, description: 'GPU inference', type: 'gpu' },
        { id: 'aws', name: 'AWS', icon: <Cloud className="w-5 h-5" />, available: true, description: 'Lambda, ECS, EC2', type: 'serverless' },
        { id: 'gcp', name: 'Google Cloud', icon: <Server className="w-5 h-5" />, available: true, description: 'Cloud Run, GCE', type: 'serverless' },
    ];

    // Estimate cost for a provider
    const handleEstimateCost = async (providerId: string, _providerType: string) => {
        try {
            const response = await fetch('/api/deploy/providers');
            if (response.ok) {
                const data = await response.json();
                const provider = data.providers?.find((p: any) => p.id === providerId);
                if (provider) {
                    setCostEstimate({
                        provider: providerId,
                        hourly: provider.minCostPerHour || 0,
                        monthly: (provider.minCostPerHour || 0) * 24 * 30,
                    });
                }
            }
        } catch (err) {
            console.error('Failed to estimate cost:', err);
        }
    };

    // Trigger deployment
    const handleDeploy = async (providerId: string) => {
        setIsDeploying(providerId);
        setDeployStatus({ type: null, message: '' });

        try {
            // For static hosting providers, use the deployment modal
            if (providerId === 'vercel' || providerId === 'netlify') {
                setDeploymentOpen(true);
                setIsDeploying(null);
                return;
            }

            // For GPU/cloud providers, call smart deploy API
            const response = await fetch('/api/deploy/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: providerId,
                    projectId: projectId || '',
                    config: {
                        resourceType: providerId === 'runpod' ? 'gpu' : 'serverless',
                        name: `kriptik-deployment-${Date.now()}`,
                    },
                }),
            });

            const data = await response.json();

            if (data.success) {
                setDeployStatus({
                    type: 'success',
                    message: `Deployment initiated! ID: ${data.deployment.id}`,
                    provider: providerId,
                });
            } else if (data.missingCredential) {
                setDeployStatus({
                    type: 'error',
                    message: `Please connect your ${providerId} account in Integrations`,
                    provider: providerId,
                });
            } else {
                setDeployStatus({
                    type: 'error',
                    message: data.error || 'Deployment failed',
                    provider: providerId,
                });
            }
        } catch (err) {
            setDeployStatus({
                type: 'error',
                message: 'Failed to initiate deployment',
                provider: providerId,
            });
        } finally {
            setIsDeploying(null);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: '#666' }}>
                Deploy your app to production with real-time pricing confirmation.
            </p>

            {/* Status message */}
            {deployStatus.type && (
                <div
                    className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{
                        background: deployStatus.type === 'success'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                        color: deployStatus.type === 'success' ? '#10b981' : '#ef4444',
                    }}
                >
                    {deployStatus.type === 'success' ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : (
                        <AlertCircle className="w-4 h-4" />
                    )}
                    {deployStatus.message}
                </div>
            )}

            {/* Cost estimate */}
            {costEstimate && (
                <div
                    className="p-3 rounded-xl text-sm"
                    style={{ background: 'rgba(255,200,170,0.2)' }}
                >
                    <p className="font-medium" style={{ color: '#c25a00' }}>
                        {costEstimate.provider.toUpperCase()} Estimated Cost
                    </p>
                    <p style={{ color: '#666' }}>
                        ${costEstimate.hourly.toFixed(2)}/hr • ${costEstimate.monthly.toFixed(0)}/mo
                    </p>
                </div>
            )}

            {providers.map((provider) => (
                <GlassCard
                    key={provider.id}
                    onClick={() => handleEstimateCost(provider.id, provider.type)}
                >
                    <div className="flex items-center gap-3">
                        <span style={{ color: '#1a1a1a' }}>{provider.icon}</span>
                        <div className="flex-1">
                            <span className="font-medium" style={{ color: '#1a1a1a' }}>{provider.name}</span>
                            <p className="text-xs" style={{ color: '#666' }}>
                                {provider.description}
                            </p>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleDeploy(provider.id); }}
                            disabled={isDeploying === provider.id}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                            style={{
                                background: isDeploying === provider.id ? 'rgba(0,0,0,0.05)' : '#c25a00',
                                color: isDeploying === provider.id ? '#666' : 'white',
                            }}
                        >
                            {isDeploying === provider.id ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Deploying...
                                </>
                            ) : (
                                <>
                                    <Cloud className="w-3 h-3" />
                                    Deploy
                                </>
                            )}
                        </button>
                    </div>
                </GlassCard>
            ))}
        </div>
    );
}

// Database Panel Component - Wired to backend services
function DatabasePanel() {
    const [isGenerating, setIsGenerating] = useState(false);
    const [dbStatus, setDbStatus] = useState<{ tables: string[]; userCount: number } | null>(null);
    const [schemaStatus, setSchemaStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
    const [showSchemaModal, setShowSchemaModal] = useState(false);
    const [schemaDescription, setSchemaDescription] = useState('');

    // Fetch database status on mount
    useEffect(() => {
        fetchDbStatus();
    }, []);

    const fetchDbStatus = async () => {
        try {
            const response = await fetch('/api/db-migrate/status');
            if (response.ok) {
                const data = await response.json();
                setDbStatus(data);
            }
        } catch (err) {
            console.error('Failed to fetch DB status:', err);
        }
    };

    // Generate schema from natural language
    const handleGenerateSchema = async () => {
        if (!schemaDescription.trim()) return;
        setIsGenerating(true);
        setSchemaStatus({ type: null, message: '' });

        try {
            // Use AI to generate schema
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a PostgreSQL/SQLite database schema for the following requirements. Output only the SQL CREATE TABLE statements with appropriate indexes:\n\n${schemaDescription}`,
                    model: 'claude-sonnet-4-20250514',
                }),
            });

            if (response.ok) {
                const data = await response.json();
                const generatedSchema = data.output || data.message;
                setSchemaStatus({
                    type: 'success',
                    message: generatedSchema ? 'Schema generated successfully!' : 'Generated schema is empty'
                });
                // Store generated schema for review
                localStorage.setItem('kriptik_generated_schema', generatedSchema);
            } else {
                setSchemaStatus({ type: 'error', message: 'Failed to generate schema' });
            }
        } catch (err) {
            setSchemaStatus({ type: 'error', message: 'Failed to connect to AI service' });
        } finally {
            setIsGenerating(false);
        }
    };

    // Initialize database with migrations
    const handleInitDatabase = async () => {
        setIsGenerating(true);
        try {
            const response = await fetch('/api/db-migrate/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-migration-secret': process.env.MIGRATION_SECRET || 'dev-secret'
                },
            });

            if (response.ok) {
                const data = await response.json();
                setSchemaStatus({ type: 'success', message: `Initialized ${data.tables?.length || 0} tables` });
                fetchDbStatus();
            } else {
                setSchemaStatus({ type: 'error', message: 'Failed to initialize database' });
            }
        } catch (err) {
            setSchemaStatus({ type: 'error', message: 'Database initialization failed' });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: '#666' }}>
                Manage your database schemas and migrations.
            </p>

            {/* Status message */}
            {schemaStatus.type && (
                <div
                    className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{
                        background: schemaStatus.type === 'success'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                        color: schemaStatus.type === 'success' ? '#10b981' : '#ef4444',
                    }}
                >
                    {schemaStatus.type === 'success' ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : (
                        <AlertCircle className="w-4 h-4" />
                    )}
                    {schemaStatus.message}
                </div>
            )}

            <GlassCard>
                <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>Database Status</span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span style={{ color: '#666' }}>Tables</span>
                        <span style={{ color: '#1a1a1a' }}>{dbStatus?.tables?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                        <span style={{ color: '#666' }}>Users</span>
                        <span style={{ color: '#1a1a1a' }}>{dbStatus?.userCount || 0}</span>
                    </div>
                    {dbStatus?.tables && dbStatus.tables.length > 0 && (
                        <div className="mt-2 text-xs" style={{ color: '#666' }}>
                            Tables: {dbStatus.tables.slice(0, 3).join(', ')}{dbStatus.tables.length > 3 ? '...' : ''}
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Schema Generation */}
            <GlassCard onClick={() => setShowSchemaModal(true)}>
                <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>Schema Generator</span>
                </div>
                <p className="text-sm" style={{ color: '#666' }}>
                    Describe your data model in plain English.
                </p>
            </GlassCard>

            {/* Schema Generation Modal */}
            {showSchemaModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="w-[520px] p-6 rounded-2xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,248,250,0.95) 100%)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg" style={{ color: '#1a1a1a' }}>Generate Database Schema</h3>
                            <button onClick={() => setShowSchemaModal(false)}>
                                <X className="w-5 h-5" style={{ color: '#666' }} />
                            </button>
                        </div>
                        <textarea
                            value={schemaDescription}
                            onChange={(e) => setSchemaDescription(e.target.value)}
                            placeholder="Describe your data model...&#10;&#10;Example: I need a blog with users, posts, and comments. Users have email and name. Posts have title, content, and author. Comments belong to posts and users."
                            className="w-full h-32 p-3 rounded-xl text-sm resize-none"
                            style={{
                                background: 'rgba(255,255,255,0.8)',
                                border: '1px solid rgba(0,0,0,0.1)',
                                outline: 'none',
                                color: '#1a1a1a',
                            }}
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => setShowSchemaModal(false)}
                                className="px-4 py-2 rounded-xl text-sm"
                                style={{ background: 'rgba(0,0,0,0.05)', color: '#666' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleGenerateSchema}
                                disabled={isGenerating || !schemaDescription.trim()}
                                className="px-4 py-2 rounded-xl text-sm flex items-center gap-2"
                                style={{
                                    background: '#c25a00',
                                    color: 'white',
                                    opacity: isGenerating || !schemaDescription.trim() ? 0.5 : 1
                                }}
                            >
                                {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                                Generate Schema
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-2">
                <GlassButton icon={Layers} onClick={() => setShowSchemaModal(true)}>
                    Generate Schema
                </GlassButton>
                <GlassButton icon={Database} onClick={handleInitDatabase}>
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Init DB'}
                </GlassButton>
            </div>
        </div>
    );
}

// Workflows Panel Component - Wired to backend services
function WorkflowsPanel() {
    const [isImporting, setIsImporting] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showHFSearch, setShowHFSearch] = useState(false);
    const [hfSearchQuery, setHFSearchQuery] = useState('');
    const [hfModels, setHFModels] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedModel, setSelectedModel] = useState<any>(null);
    const [workflowFile, setWorkflowFile] = useState<File | null>(null);
    const [deployStatus, setDeployStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

    // Search HuggingFace models
    const searchHuggingFace = useCallback(async () => {
        if (!hfSearchQuery.trim()) return;
        setIsSearching(true);
        try {
            const response = await fetch('/api/workflows/models/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requirement: hfSearchQuery,
                    sources: ['huggingface'],
                    maxResults: 10,
                }),
            });
            const data = await response.json();
            setHFModels(data.models || []);
        } catch (err) {
            console.error('Failed to search HuggingFace:', err);
            setDeployStatus({ type: 'error', message: 'Failed to search models' });
        } finally {
            setIsSearching(false);
        }
    }, [hfSearchQuery]);

    // Import ComfyUI workflow
    const handleWorkflowUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setWorkflowFile(file);
        setIsImporting(true);

        try {
            const content = await file.text();
            const workflow = JSON.parse(content);

            // Validate workflow format
            const response = await fetch('/api/workflows/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workflow }),
            });

            if (response.ok) {
                setDeployStatus({ type: 'success', message: 'Workflow validated successfully!' });
            } else {
                const error = await response.json();
                setDeployStatus({ type: 'error', message: error.message || 'Invalid workflow' });
            }
        } catch (err) {
            setDeployStatus({ type: 'error', message: 'Failed to parse workflow JSON' });
        } finally {
            setIsImporting(false);
        }
    };

    // Deploy HuggingFace model
    const handleDeployModel = async (model: any) => {
        setIsImporting(true);
        try {
            const response = await fetch('/api/deploy/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    modelId: model.modelId || model.id,
                    provider: 'runpod',
                    gpuType: 'nvidia-rtx-4090',
                }),
            });
            const data = await response.json();
            if (data.success) {
                setDeployStatus({ type: 'success', message: `Deployment initiated! ID: ${data.deployment.id}` });
            } else {
                setDeployStatus({ type: 'error', message: data.error || 'Deployment failed' });
            }
        } catch (err) {
            setDeployStatus({ type: 'error', message: 'Failed to deploy model' });
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm" style={{ color: '#666' }}>
                Deploy ComfyUI workflows and HuggingFace models.
            </p>

            {/* Status message */}
            {deployStatus.type && (
                <div
                    className="flex items-center gap-2 p-3 rounded-xl text-sm"
                    style={{
                        background: deployStatus.type === 'success'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                        color: deployStatus.type === 'success' ? '#10b981' : '#ef4444',
                    }}
                >
                    {deployStatus.type === 'success' ? (
                        <CheckCircle className="w-4 h-4" />
                    ) : (
                        <AlertCircle className="w-4 h-4" />
                    )}
                    {deployStatus.message}
                </div>
            )}

            {/* ComfyUI Section */}
            <GlassCard onClick={() => setShowImportModal(true)}>
                <div className="flex items-center gap-2 mb-3">
                    <Workflow className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>ComfyUI</span>
                </div>
                <p className="text-sm" style={{ color: '#666' }}>
                    Upload workflow JSON to deploy as API endpoint.
                </p>
                {workflowFile && (
                    <p className="text-xs mt-2" style={{ color: '#c25a00' }}>
                        Selected: {workflowFile.name}
                    </p>
                )}
            </GlassCard>

            {/* ComfyUI Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div
                        className="w-[480px] p-6 rounded-2xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,248,250,0.95) 100%)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                        }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg" style={{ color: '#1a1a1a' }}>Import ComfyUI Workflow</h3>
                            <button onClick={() => setShowImportModal(false)}>
                                <X className="w-5 h-5" style={{ color: '#666' }} />
                            </button>
                        </div>
                        <div
                            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-amber-500 transition-colors"
                            style={{ borderColor: '#d1d5db' }}
                        >
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleWorkflowUpload}
                                className="hidden"
                                id="workflow-upload"
                            />
                            <label htmlFor="workflow-upload" className="cursor-pointer">
                                <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: '#c25a00' }} />
                                <p className="font-medium" style={{ color: '#1a1a1a' }}>Drop workflow JSON here</p>
                                <p className="text-sm mt-1" style={{ color: '#666' }}>or click to browse</p>
                            </label>
                        </div>
                        {isImporting && (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#c25a00' }} />
                                <span className="text-sm" style={{ color: '#666' }}>Validating workflow...</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* HuggingFace Section */}
            <GlassCard onClick={() => setShowHFSearch(!showHFSearch)}>
                <div className="flex items-center gap-2 mb-3">
                    <Server className="w-4 h-4" style={{ color: '#c25a00' }} />
                    <span className="font-medium" style={{ color: '#1a1a1a' }}>HuggingFace</span>
                </div>
                <p className="text-sm" style={{ color: '#666' }}>
                    Search and deploy ML models with GPU inference.
                </p>
            </GlassCard>

            {/* HuggingFace Search Panel */}
            {showHFSearch && (
                <div className="space-y-3 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)' }}>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={hfSearchQuery}
                            onChange={(e) => setHFSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && searchHuggingFace()}
                            placeholder="Search models (e.g., 'stable diffusion', 'llama')"
                            className="flex-1 px-3 py-2 rounded-lg text-sm"
                            style={{
                                background: 'rgba(255,255,255,0.8)',
                                border: '1px solid rgba(0,0,0,0.1)',
                                outline: 'none',
                            }}
                        />
                        <button
                            onClick={searchHuggingFace}
                            disabled={isSearching}
                            className="px-3 py-2 rounded-lg"
                            style={{ background: '#c25a00', color: 'white' }}
                        >
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Model Results */}
                    {hfModels.length > 0 && (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {hfModels.map((model, i) => (
                                <div
                                    key={i}
                                    className="p-2 rounded-lg cursor-pointer hover:bg-white/50 transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.6)' }}
                                    onClick={() => setSelectedModel(model)}
                                >
                                    <p className="font-medium text-sm" style={{ color: '#1a1a1a' }}>
                                        {model.name || model.modelId}
                                    </p>
                                    <p className="text-xs" style={{ color: '#666' }}>
                                        {model.taskType || 'AI Model'} • {model.downloads?.toLocaleString() || '?'} downloads
                                    </p>
                                    {selectedModel === model && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeployModel(model); }}
                                            className="mt-2 px-3 py-1 rounded-lg text-xs"
                                            style={{ background: '#c25a00', color: 'white' }}
                                        >
                                            Deploy to RunPod
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <GlassButton icon={Workflow} onClick={() => setShowImportModal(true)}>
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
