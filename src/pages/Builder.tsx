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
 */

import { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Code2, Eye, Settings, Brain, Rocket, Blocks,
    Cloud, ChevronRight, X, Bot, Activity,
    Database, Server, Workflow, LayoutDashboard
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
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useQualityStore } from '../store/useQualityStore';
import { qualityScanner } from '../lib/QualityScanner';
import { useEditorStore } from '../store/useEditorStore';
import { useDeploymentStore } from '../store/useDeploymentStore';
import { useIntegrationStore } from '../store/useIntegrationStore';
import { useParams } from 'react-router-dom';

// Initial files for a new project
const INITIAL_FILES = {
    '/App.tsx': {
        code: `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Welcome to <span className="text-purple-400">KripTik AI</span>
        </h1>
        <p className="text-xl text-slate-300 max-w-md mx-auto">
          Start building your app by describing what you want in the chat.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setCount(c => c + 1)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Count: {count}
          </button>
          <button className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors">
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

/* Colors */
.bg-gradient-to-br { background: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
.from-slate-900 { --tw-gradient-from: #0f172a; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to, transparent); }
.via-purple-900 { --tw-gradient-stops: var(--tw-gradient-from), #581c87, var(--tw-gradient-to, transparent); }
.to-slate-900 { --tw-gradient-to: #0f172a; }
.text-white { color: white; }
.text-purple-400 { color: #c084fc; }
.text-slate-300 { color: #cbd5e1; }
.bg-purple-600 { background-color: #9333ea; }
.bg-purple-700 { background-color: #7e22ce; }
.bg-slate-700 { background-color: #334155; }
.bg-slate-600 { background-color: #475569; }

.bg-purple-600:hover { background-color: #7e22ce; }
.bg-slate-700:hover { background-color: #475569; }`,
    },
};

// Quick action items for the sidebar
const quickActions = [
    { icon: Bot, label: 'AI Agents', description: 'View orchestrator status', panel: 'agents' },
    { icon: Cloud, label: 'Cloud Deploy', description: 'Deploy to cloud', panel: 'cloud' },
    { icon: Database, label: 'Database', description: 'Manage schemas', panel: 'database' },
    { icon: Workflow, label: 'Workflows', description: 'ComfyUI & ML', panel: 'workflows' },
];

export default function Builder() {
    const { projectId } = useParams<{ projectId: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
    const [showMemory, setShowMemory] = useState(false);
    const [projectName, _setProjectName] = useState('Untitled Project');
    const [showQualityReport, setShowQualityReport] = useState(false);
    const [showAgentPanel, setShowAgentPanel] = useState(false);
    // Cloud panel state - prepared for future integration
    const [_showCloudPanel, _setShowCloudPanel] = useState(false);
    const [activeQuickAction, setActiveQuickAction] = useState<string | null>(null);
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

        // Set project context for the scanner
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
            <div className="h-screen flex flex-col bg-background relative overflow-hidden">
                <QualityReportModal open={showQualityReport} onOpenChange={setShowQualityReport} />
                <DeploymentModal />
                <IntegrationMarketplace />
                <ShareModal />
                <CommandPalette />
                <KeyboardShortcutsPanel />

                {/* Premium Header */}
                <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-card/80 backdrop-blur-md z-20 shrink-0">
                    <div className="flex items-center gap-4">
                        {/* Dashboard Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/dashboard')}
                            className="gap-2 hover:bg-primary/10"
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            <span className="hidden sm:inline">Dashboard</span>
                        </Button>

                        <div className="h-6 w-px bg-border/50" />

                        <div
                            className="font-bold text-xl text-gradient cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ fontFamily: 'var(--font-display)' }}
                            onClick={() => navigate('/dashboard')}
                        >
                            KripTik AI
                        </div>
                        <div className="h-6 w-px bg-border/50 mx-2" />
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-sm text-muted-foreground">
                                {projectId || 'New Project'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <CollaborationHeader />

                        <div className="h-4 w-px bg-border/50 mx-2" />

                        {/* Agent Status Button */}
                        <Button
                            variant={showAgentPanel ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setShowAgentPanel(!showAgentPanel)}
                            className="gap-2"
                        >
                            <Activity className="h-4 w-4" />
                            <span className="hidden sm:inline">Agents</span>
                        </Button>

                        <Button
                            variant={showMemory ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setShowMemory(!showMemory)}
                            className="gap-2"
                        >
                            <Brain className="h-4 w-4" />
                            <span className="hidden sm:inline">Memory</span>
                        </Button>

                        <Button
                            variant="glass"
                            size="sm"
                            onClick={handleProductionCheck}
                            className="gap-2"
                        >
                            <Rocket className="h-4 w-4" />
                            <span className="hidden sm:inline">Quality Check</span>
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIntegrationsOpen(true)}
                            className="gap-2"
                        >
                            <Blocks className="h-4 w-4" />
                            <span className="hidden sm:inline">Integrations</span>
                        </Button>

                        <div className="h-4 w-px bg-border/50 mx-2" />

                        <Button variant="ghost" size="icon-sm">
                            <Settings className="h-4 w-4" />
                        </Button>

                        <Button
                            variant="gradient"
                            size="sm"
                            onClick={() => setDeploymentOpen(true)}
                            className="gap-2"
                        >
                            <Cloud className="h-4 w-4" />
                            Deploy
                        </Button>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 overflow-hidden flex min-h-0">
                    {/* Quick Actions Sidebar */}
                    <div className="w-14 border-r border-border/50 bg-card/50 flex flex-col items-center py-4 gap-2 shrink-0">
                        {quickActions.map((action) => (
                            <button
                                key={action.panel}
                                onClick={() => handleQuickAction(action.panel)}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group relative ${
                                    activeQuickAction === action.panel
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <action.icon className="w-5 h-5" />

                                {/* Tooltip */}
                                <div className="absolute left-full ml-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                                    <div className="text-sm font-medium">{action.label}</div>
                                    <div className="text-xs text-muted-foreground">{action.description}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Main Builder Area */}
                    <div className="flex-1 min-w-0">
                        <PanelGroup direction="horizontal">
                            {/* Left Panel: Chat */}
                            <Panel defaultSize={activeTab === 'code' ? 25 : 30} minSize={20}>
                                <div className="h-full flex flex-col">
                                    <ChatInterface />
                                    {activeTab === 'preview' && <ActivityFeed />}
                                </div>
                            </Panel>

                            <PanelResizeHandle className="w-1 bg-border/50 hover:bg-primary/50 transition-colors" />

                            {/* Middle Panel: File Explorer (only in code view) */}
                            {activeTab === 'code' && (
                                <>
                                    <Panel defaultSize={15} minSize={10} maxSize={25}>
                                        <div className="h-full flex flex-col border-r border-border/50">
                                            <SandpackFileExplorer />
                                        </div>
                                    </Panel>
                                    <PanelResizeHandle className="w-1 bg-border/50 hover:bg-primary/50 transition-colors" />
                                </>
                            )}

                            {/* Right Panel: Preview or Code */}
                            <Panel defaultSize={activeTab === 'code' ? 60 : 70} minSize={40}>
                                <div className="h-full flex flex-col relative">
                                    {/* Tab bar */}
                                    <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm px-4 py-2 flex justify-between items-center shrink-0">
                                        <Tabs
                                            value={activeTab}
                                            onValueChange={(v) => setActiveTab(v as 'preview' | 'code')}
                                            className="w-[200px]"
                                        >
                                            <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/50">
                                                <TabsTrigger value="preview" className="text-xs gap-1.5">
                                                    <Eye className="h-3 w-3" /> Preview
                                                </TabsTrigger>
                                                <TabsTrigger value="code" className="text-xs gap-1.5">
                                                    <Code2 className="h-3 w-3" /> Code
                                                </TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                        <div className="flex items-center gap-3">
                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                <kbd className="px-2 py-1 bg-muted rounded border border-border text-[10px] font-mono">⌘K</kbd>
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

                    {/* Quick Action Panel */}
                    <AnimatePresence>
                        {activeQuickAction && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 320, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-l border-border/50 bg-card/80 backdrop-blur-md shrink-0 overflow-hidden"
                            >
                                <div className="w-[320px] h-full flex flex-col">
                                    <div className="flex items-center justify-between p-4 border-b border-border/50">
                                        <h3 className="font-semibold flex items-center gap-2">
                                            {activeQuickAction === 'agents' && <><Activity className="w-4 h-4" /> AI Agents</>}
                                            {activeQuickAction === 'cloud' && <><Cloud className="w-4 h-4" /> Cloud Deploy</>}
                                            {activeQuickAction === 'database' && <><Database className="w-4 h-4" /> Database</>}
                                            {activeQuickAction === 'workflows' && <><Workflow className="w-4 h-4" /> Workflows</>}
                                        </h3>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => setActiveQuickAction(null)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
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

                    {/* Autonomous Agents Panel - with "Fix it Free" */}
                    <AnimatePresence>
                        {showAgentPanel && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 400, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-l border-border/50 shrink-0 overflow-hidden"
                            >
                                <div className="w-[400px] h-full">
                                    <AutonomousAgentsPanel />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Memory Panel */}
                    <AnimatePresence>
                        {showMemory && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 300, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="border-l border-border/50 shrink-0"
                            >
                                <ProjectMemoryPanel />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </SandpackProvider>
    );
}

// Agent Status Panel Component - Now using Autonomous Agents
function AgentStatusPanel() {
    return <AutonomousAgentsPanel />;
}

// Cloud Deploy Panel Component
function CloudDeployPanel() {
    const providers = [
        { name: 'Vercel', icon: '▲', available: true },
        { name: 'Netlify', icon: '◆', available: true },
        { name: 'RunPod GPU', icon: '⚡', available: true },
        { name: 'AWS', icon: '☁', available: true },
        { name: 'Google Cloud', icon: '◉', available: true },
    ];

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Deploy your app to production with real-time pricing confirmation.
            </p>
            {providers.map((provider, i) => (
                <Card key={i} variant="interactive" className="p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{provider.icon}</span>
                        <div>
                            <span className="font-medium">{provider.name}</span>
                            <p className="text-xs text-muted-foreground">
                                {provider.available ? 'Ready to deploy' : 'Coming soon'}
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                    </div>
                </Card>
            ))}
        </div>
    );
}

// Database Panel Component
function DatabasePanel() {
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Manage your database schemas and migrations.
            </p>
            <Card variant="depth" className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-primary" />
                    <span className="font-medium">PostgreSQL</span>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Tables</span>
                        <span>0</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Migrations</span>
                        <span>0</span>
                    </div>
                </div>
            </Card>
            <Button variant="outline" className="w-full">
                Generate Schema
            </Button>
        </div>
    );
}

// Workflows Panel Component
function WorkflowsPanel() {
    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                Deploy ComfyUI workflows and HuggingFace models.
            </p>
            <Card variant="depth" className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Workflow className="w-4 h-4 text-accent" />
                    <span className="font-medium">ComfyUI</span>
                </div>
                <p className="text-sm text-muted-foreground">
                    Upload workflow JSON to deploy as API endpoint.
                </p>
            </Card>
            <Card variant="depth" className="p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Server className="w-4 h-4 text-primary" />
                    <span className="font-medium">HuggingFace</span>
                </div>
                <p className="text-sm text-muted-foreground">
                    Search and deploy ML models with GPU inference.
                </p>
            </Card>
            <Button variant="outline" className="w-full">
                Import Workflow
            </Button>
        </div>
    );
}
