/**
 * BuilderTablet - Tablet-optimized Builder layout (768-1024px)
 *
 * Features:
 * - 40%/60% split view using react-resizable-panels
 * - Touch-friendly resize handles (6px wide)
 * - Collapsible quick actions sidebar
 * - Tab switcher for preview/code
 */

import { useState, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';
import { StatusIcons, FolderIcon } from '../ui/icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import ChatInterface from './ChatInterface';
import SandpackPreviewWindow from './SandpackPreview';
import SandpackEditor from './SandpackEditor';
import SandpackFileExplorer from './SandpackFileExplorer';
import { KriptikLogo } from '../ui/KriptikLogo';
import type { IntelligenceSettings } from './IntelligenceToggles';

interface BuilderTabletProps {
    projectId?: string;
    projectName: string;
    intelligenceSettings: IntelligenceSettings;
    onNavigateDashboard: () => void;
    onDeploy: () => void;
    onShowQualityReport: () => void;
    onShowMemory: () => void;
    onShowIntegrations: () => void;
    onShowGhostMode: () => void;
    onShowAgentPanel: () => void;
}

type TabletTab = 'preview' | 'code';

// Liquid glass panel style
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

// Tablet header style
const tabletHeaderStyle = {
    background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    boxShadow: `
        0 4px 30px rgba(0,0,0,0.3),
        0 2px 8px rgba(0,0,0,0.2),
        inset 0 1px 0 rgba(255,255,255,0.1)
    `,
};

// Quick action items for tablet sidebar
const quickActions = [
    { id: 'agents', icon: StatusIcons.BotIcon, label: 'Agents' },
    { id: 'quality', icon: StatusIcons.ShieldIcon, label: 'Quality' },
    { id: 'memory', icon: StatusIcons.BrainIcon, label: 'Memory' },
    { id: 'integrations', icon: StatusIcons.PlugIcon, label: 'Connect' },
    { id: 'ghost-mode', icon: StatusIcons.GhostIcon, label: 'Ghost' },
];

export default function BuilderTablet({
    projectId,
    projectName,
    intelligenceSettings,
    onNavigateDashboard,
    onDeploy,
    onShowQualityReport,
    onShowMemory,
    onShowIntegrations,
    onShowGhostMode,
    onShowAgentPanel,
}: BuilderTabletProps) {
    const [activeTab, setActiveTab] = useState<TabletTab>('preview');
    const [showFileExplorer, setShowFileExplorer] = useState(false);
    const [showQuickBar, setShowQuickBar] = useState(true);

    const { getDuration } = useReducedMotion();

    // Handle quick action click
    const handleQuickAction = useCallback((actionId: string) => {
        switch (actionId) {
            case 'quality':
                onShowQualityReport();
                break;
            case 'memory':
                onShowMemory();
                break;
            case 'integrations':
                onShowIntegrations();
                break;
            case 'ghost-mode':
                onShowGhostMode();
                break;
            case 'agents':
                onShowAgentPanel();
                break;
        }
    }, [onShowQualityReport, onShowMemory, onShowIntegrations, onShowGhostMode, onShowAgentPanel]);

    return (
        <div
            className="h-full flex flex-col"
            style={{ background: 'linear-gradient(180deg, #e8e4df 0%, #d8d4cf 50%, #ccc8c3 100%)' }}
        >
            {/* Tablet Header */}
            <header
                className="h-14 flex items-center justify-between px-4 shrink-0"
                style={tabletHeaderStyle}
            >
                {/* Left: Logo and project info */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onNavigateDashboard}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                        <KriptikLogo size="sm" animated={false} />
                        <span className="font-bold text-white">
                            KripTik<span className="text-zinc-400">AI</span>
                        </span>
                    </button>

                    <div className="h-6 w-px bg-white/10" />

                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-sm text-zinc-400 truncate max-w-[150px]">
                            {projectName || projectId || 'New Project'}
                        </span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowQuickBar(!showQuickBar)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: showQuickBar ? 'rgba(255,200,170,0.3)' : 'rgba(255,255,255,0.1)',
                        }}
                    >
                        <StatusIcons.MenuIcon size={18} className="text-white" />
                    </button>

                    <button
                        onClick={onDeploy}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl"
                        style={{
                            background: 'linear-gradient(145deg, rgba(255,200,170,0.6) 0%, rgba(255,180,150,0.45) 100%)',
                            boxShadow: '0 4px 12px rgba(255, 140, 100, 0.2)',
                        }}
                    >
                        <StatusIcons.CloudIcon size={16} className="text-stone-900" />
                        <span className="text-sm font-medium text-stone-900">Deploy</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Quick Actions Bar (Collapsible) */}
                <AnimatePresence>
                    {showQuickBar && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 64, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: getDuration(0.2) }}
                            className="shrink-0 overflow-hidden"
                        >
                            <div
                                className="w-16 h-full flex flex-col items-center py-4 gap-3"
                                style={{
                                    ...liquidGlassPanel,
                                    borderRadius: 0,
                                    borderRight: '1px solid rgba(255,255,255,0.3)',
                                }}
                            >
                                {quickActions.map((action) => {
                                    const Icon = action.icon;
                                    return (
                                        <button
                                            key={action.id}
                                            onClick={() => handleQuickAction(action.id)}
                                            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95"
                                            style={{
                                                background: 'linear-gradient(145deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.25) 100%)',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.06), inset 0 1px 2px rgba(255,255,255,0.8)',
                                            }}
                                        >
                                            <Icon size={18} className="text-stone-600" />
                                            <span className="text-[9px] text-stone-500">{action.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Split Panel Layout */}
                <div className="flex-1 min-w-0">
                    <PanelGroup direction="horizontal">
                        {/* Left Panel: Chat (40%) */}
                        <Panel defaultSize={40} minSize={30} maxSize={50}>
                            <div
                                className="h-full flex flex-col m-2 mr-1 rounded-2xl overflow-hidden"
                                style={liquidGlassPanel}
                            >
                                <ChatInterface intelligenceSettings={intelligenceSettings} />
                            </div>
                        </Panel>

                        {/* Resize Handle - Touch-friendly (6px) */}
                        <PanelResizeHandle className="w-2 hover:bg-amber-500/30 active:bg-amber-500/50 transition-colors mx-1 touch-none" />

                        {/* Right Panel: Preview/Code (60%) */}
                        <Panel defaultSize={60} minSize={40}>
                            <div
                                className="h-full flex flex-col m-2 ml-1 rounded-2xl overflow-hidden"
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
                                            icon={StatusIcons.EyeIcon}
                                        >
                                            Preview
                                        </TabButton>
                                        <TabButton
                                            active={activeTab === 'code'}
                                            onClick={() => {
                                                setActiveTab('code');
                                                setShowFileExplorer(true);
                                            }}
                                            icon={StatusIcons.Code2Icon}
                                        >
                                            Code
                                        </TabButton>
                                    </div>

                                    {/* File explorer toggle (only in code view) */}
                                    {activeTab === 'code' && (
                                        <button
                                            onClick={() => setShowFileExplorer(!showFileExplorer)}
                                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                                            style={{
                                                background: showFileExplorer
                                                    ? 'rgba(255,200,170,0.3)'
                                                    : 'rgba(0,0,0,0.04)',
                                            }}
                                        >
                                            <FolderIcon size={18} className="text-stone-600" />
                                        </button>
                                    )}
                                </div>

                                {/* Content area */}
                                {activeTab === 'preview' ? (
                                    <div className="flex-1 overflow-hidden">
                                        <SandpackPreviewWindow />
                                    </div>
                                ) : (
                                    <PanelGroup direction="horizontal" className="flex-1">
                                        {/* File Explorer (collapsible) */}
                                        {showFileExplorer && (
                                            <>
                                                <Panel defaultSize={30} minSize={20} maxSize={40}>
                                                    <SandpackFileExplorer />
                                                </Panel>
                                                <PanelResizeHandle className="w-1.5 hover:bg-amber-500/30 transition-colors" />
                                            </>
                                        )}
                                        {/* Code Editor */}
                                        <Panel defaultSize={showFileExplorer ? 70 : 100}>
                                            <SandpackEditor />
                                        </Panel>
                                    </PanelGroup>
                                )}
                            </div>
                        </Panel>
                    </PanelGroup>
                </div>
            </div>
        </div>
    );
}

// Tab Button Component
function TabButton({
    active,
    onClick,
    icon: Icon,
    children,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95"
            style={{
                background: active
                    ? 'linear-gradient(145deg, rgba(255,200,170,0.5) 0%, rgba(255,180,150,0.35) 100%)'
                    : 'transparent',
                boxShadow: active
                    ? 'inset 0 0 15px rgba(255, 160, 120, 0.15), 0 2px 8px rgba(0,0,0,0.05)'
                    : 'none',
                color: active ? '#c25a00' : '#666',
            }}
        >
            <Icon size={16} />
            {children}
        </button>
    );
}
