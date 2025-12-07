/**
 * Agent Mode Sidebar
 *
 * The command center for managing AI agents in Developer Mode.
 * Features:
 * - Agent list with status, progress, and output logs
 * - Model selector (Opus 4.5, Sonnet 4.5, GPT-5 Codex, etc.)
 * - Real-time progress updates via SSE
 * - Agent naming and management
 * - Dark theme with fluorescent yellow accents
 *
 * Connected to backend via useDeveloperModeStore
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Plus, Pause, Play,
    CheckCircle2, XCircle, Loader2, Clock, Send,
    ChevronDown, Pencil, FileEdit, Zap, Trash2, AlertCircle,
    Settings
} from 'lucide-react';
import {
    useDeveloperModeStore,
    selectAgents,
    selectSelectedAgent,
    selectSelectedAgentLogs,
    selectIsLoading,
    selectError,
    selectCreditsUsed,
    type AgentModel,
    type Agent,
    type AgentLog,
} from '../../store/useDeveloperModeStore';
import { useProjectStore } from '../../store/useProjectStore';
import DeployAgentModal, { type DeployConfig } from './DeployAgentModal';
import { DeveloperModeSettings } from '../settings/DeveloperModeSettings';
import { SoftInterruptInput } from './SoftInterruptInput';

// Available models - matches backend + Krip-Toe-Nite
const AVAILABLE_MODELS: Array<{
    id: AgentModel | 'krip-toe-nite';
    name: string;
    description: string;
    tier: 'premium' | 'standard' | 'economy' | 'intelligent';
}> = [
    { id: 'krip-toe-nite', name: '⚡ Krip-Toe-Nite', description: 'Intelligent routing, ultra-fast', tier: 'intelligent' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Best reasoning, complex tasks', tier: 'premium' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Fast & capable', tier: 'standard' },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', description: 'Fastest, simple tasks', tier: 'economy' },
    { id: 'gpt-5-codex', name: 'GPT-5 Codex', description: "OpenAI's latest", tier: 'premium' },
    { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', description: "Google's flagship", tier: 'premium' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', description: 'Open source, cost-effective', tier: 'economy' },
];

// Dark glass panel style for agent mode
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

export interface AgentModeSidebarProps {
    onClose?: () => void;
}

export function AgentModeSidebar({ onClose: _onClose }: AgentModeSidebarProps) {
    // Store state
    const currentSession = useDeveloperModeStore(state => state.currentSession);
    const agents = useDeveloperModeStore(selectAgents);
    const selectedAgent = useDeveloperModeStore(selectSelectedAgent);
    const agentLogs = useDeveloperModeStore(selectSelectedAgentLogs);
    const isLoading = useDeveloperModeStore(selectIsLoading);
    const error = useDeveloperModeStore(selectError);
    const creditsUsed = useDeveloperModeStore(selectCreditsUsed);

    // Store actions
    const startSession = useDeveloperModeStore(state => state.startSession);
    const deployAgent = useDeveloperModeStore(state => state.deployAgent);
    const stopAgent = useDeveloperModeStore(state => state.stopAgent);
    const resumeAgent = useDeveloperModeStore(state => state.resumeAgent);
    const renameAgent = useDeveloperModeStore(state => state.renameAgent);
    const deleteAgent = useDeveloperModeStore(state => state.deleteAgent);
    const selectAgentAction = useDeveloperModeStore(state => state.selectAgent);
    const changeAgentModel = useDeveloperModeStore(state => state.changeAgentModel);
    const setError = useDeveloperModeStore(state => state.setError);
    const loadModels = useDeveloperModeStore(state => state.loadModels);

    // Project store
    const currentProject = useProjectStore(state => state.currentProject);

    // Local state
    const [showDeployModal, setShowDeployModal] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [selectedModel, setSelectedModel] = useState<AgentModel>('claude-sonnet-4-5');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Initialize session if needed
    useEffect(() => {
        if (currentProject && !currentSession) {
            startSession(currentProject.id, {
                defaultModel: selectedModel,
                verificationMode: 'standard',
            }).catch(console.error);
        }
    }, [currentProject, currentSession, startSession, selectedModel]);

    // Load models on mount
    useEffect(() => {
        loadModels();
    }, [loadModels]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
                setShowModelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeployAgent = async () => {
        if (!inputValue.trim() || !currentSession) return;

        try {
            const agentNumber = agents.length + 1;
            await deployAgent({
                name: `Agent #${agentNumber}`,
                taskPrompt: inputValue,
                model: selectedModel,
            });
            setInputValue('');
        } catch (err) {
            console.error('Failed to deploy agent:', err);
        }
    };

    const handleAddIdleAgent = async () => {
        if (!currentSession) return;

        try {
            const agentNumber = agents.length + 1;
            await deployAgent({
                name: `Agent #${agentNumber}`,
                taskPrompt: 'Waiting for task...',
                model: selectedModel,
            });
        } catch (err) {
            console.error('Failed to add agent:', err);
        }
    };

    const handleRenameAgent = async (agentId: string, newName: string) => {
        try {
            await renameAgent(agentId, newName);
            setEditingAgentId(null);
        } catch (err) {
            console.error('Failed to rename agent:', err);
        }
    };

    const handleStopAgent = async (agentId: string) => {
        try {
            await stopAgent(agentId);
        } catch (err) {
            console.error('Failed to stop agent:', err);
        }
    };

    const handleResumeAgent = async (agentId: string) => {
        try {
            await resumeAgent(agentId);
        } catch (err) {
            console.error('Failed to resume agent:', err);
        }
    };

    const handleDeleteAgent = async (agentId: string) => {
        try {
            await deleteAgent(agentId);
        } catch (err) {
            console.error('Failed to delete agent:', err);
        }
    };

    const handleModelChange = async (model: AgentModel) => {
        setSelectedModel(model);
        setShowModelDropdown(false);

        // If an agent is selected and idle, update its model
        if (selectedAgent && selectedAgent.status === 'idle') {
            try {
                await changeAgentModel(selectedAgent.id, model);
            } catch (err) {
                console.error('Failed to change model:', err);
            }
        }
    };

    const handleDeployFromModal = async (config: DeployConfig) => {
        if (!currentSession) return;

        try {
            const agentNumber = agents.length + 1;
            // Map the model ID to our AgentModel type
            const modelMapping: Record<string, AgentModel> = {
                'anthropic/claude-opus-4.5': 'claude-opus-4-5',
                'anthropic/claude-sonnet-4.5': 'claude-sonnet-4-5',
                'anthropic/claude-3.5-haiku': 'claude-haiku-3-5',
                'openai/gpt-4o': 'gpt-5-codex',
                'google/gemini-2.0-flash-thinking-exp': 'gemini-2-5-pro',
                'deepseek/deepseek-chat-v3-0324': 'deepseek-r1',
            };
            const mappedModel = modelMapping[config.model] || 'claude-sonnet-4-5';

            await deployAgent({
                name: `Agent #${agentNumber}`,
                taskPrompt: config.taskDescription,
                model: mappedModel,
                verificationMode: config.verificationMode === 'quick' ? 'quick' :
                    config.verificationMode === 'standard' ? 'standard' :
                    config.verificationMode === 'strict' ? 'thorough' : 'full_swarm',
            });
            setShowDeployModal(false);
        } catch (err) {
            console.error('Failed to deploy agent from modal:', err);
        }
    };

    const getStatusIcon = (status: Agent['status']) => {
        switch (status) {
            case 'running': return <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />;
            case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
            case 'paused': return <Pause className="w-4 h-4 text-amber-400" />;
            case 'waiting': return <Clock className="w-4 h-4 text-blue-400" />;
            default: return <Bot className="w-4 h-4 text-zinc-500" />;
        }
    };

    const getStatusColor = (status: Agent['status']) => {
        switch (status) {
            case 'running': return accentColor;
            case 'completed': return '#34d399';
            case 'failed': return '#f87171';
            case 'paused': return '#fbbf24';
            case 'waiting': return '#60a5fa';
            default: return '#71717a';
        }
    };

    const getLogIcon = (logType: AgentLog['logType']) => {
        switch (logType) {
            case 'action': return <Zap className="w-3 h-3" style={{ color: accentColor }} />;
            case 'verification': return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
            case 'error': return <XCircle className="w-3 h-3 text-red-400" />;
            case 'warning': return <AlertCircle className="w-3 h-3 text-amber-400" />;
            case 'thought': return <Bot className="w-3 h-3 text-purple-400" />;
            case 'code': return <FileEdit className="w-3 h-3" style={{ color: accentColor }} />;
            default: return <Bot className="w-3 h-3 text-blue-400" />;
        }
    };

    return (
        <div className="h-full flex flex-col" style={darkGlassPanel}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ background: `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.05) 100%)` }}
                        >
                            <Bot className="w-4 h-4" style={{ color: accentColor }} />
                        </div>
                        {editingAgentId === selectedAgent?.id ? (
                            <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleRenameAgent(selectedAgent.id, editingName)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameAgent(selectedAgent.id, editingName);
                                    if (e.key === 'Escape') setEditingAgentId(null);
                                }}
                                autoFocus
                                className="bg-transparent border-b border-white/20 text-white font-semibold outline-none px-1"
                                style={{ width: '120px' }}
                            />
                        ) : (
                            <button
                                onClick={() => {
                                    if (selectedAgent) {
                                        setEditingAgentId(selectedAgent.id);
                                        setEditingName(selectedAgent.name);
                                    }
                                }}
                                className="text-white font-semibold hover:text-white/80 flex items-center gap-1 group"
                            >
                                {selectedAgent?.name || 'Developer Mode'}
                                {selectedAgent && <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />}
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Credits used */}
                        <div className="text-xs text-white/40 px-2">
                            {creditsUsed} credits
                        </div>
                        <button
                            onClick={() => setShowDeployModal(true)}
                            disabled={isLoading || agents.length >= 6}
                            className="px-3 py-1.5 rounded-lg transition-all hover:scale-105 disabled:opacity-50 text-xs font-medium"
                            style={{
                                background: `linear-gradient(145deg, ${accentColor}cc 0%, ${accentColor}99 100%)`,
                                color: '#000',
                            }}
                            title={agents.length >= 6 ? 'Maximum 6 agents' : 'Deploy new agent'}
                        >
                            Deploy
                        </button>
                        <button
                            onClick={handleAddIdleAgent}
                            disabled={isLoading || agents.length >= 6}
                            className="p-2 rounded-lg transition-all hover:scale-105 disabled:opacity-50"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            title={agents.length >= 6 ? 'Maximum 6 agents' : 'Add idle agent'}
                        >
                            <Plus className="w-4 h-4 text-white/70" />
                        </button>
                        <button
                            onClick={() => setShowSettings(true)}
                            className="p-2 rounded-lg transition-all hover:scale-105"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            title="Developer Mode Settings"
                        >
                            <Settings className="w-4 h-4 text-white/70" />
                        </button>
                    </div>
                </div>

                {/* Agent tabs */}
                {agents.length > 0 && (
                    <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
                        {agents.map((agent) => (
                            <button
                                key={agent.id}
                                onClick={() => selectAgentAction(agent.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all group"
                                style={{
                                    background: selectedAgent?.id === agent.id
                                        ? `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.05) 100%)`
                                        : 'rgba(255,255,255,0.03)',
                                    border: selectedAgent?.id === agent.id
                                        ? `1px solid ${accentColor}40`
                                        : '1px solid rgba(255,255,255,0.05)',
                                    color: selectedAgent?.id === agent.id ? accentColor : 'rgba(255,255,255,0.6)',
                                }}
                            >
                                {getStatusIcon(agent.status)}
                                <span>{agent.name}</span>
                                {selectedAgent?.id === agent.id && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAgent(agent.id);
                                        }}
                                        className="ml-1 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Error display */}
                {error && (
                    <div className="mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-2 text-xs text-red-400">
                            <XCircle className="w-3 h-3" />
                            <span>{error}</span>
                            <button onClick={() => setError(null)} className="ml-auto hover:text-white">×</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Agent Details */}
            {selectedAgent ? (
                <div className="flex-1 overflow-auto">
                    {/* Status & Progress */}
                    {selectedAgent.status !== 'idle' && (
                        <div className="px-4 py-3 border-b border-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {getStatusIcon(selectedAgent.status)}
                                    <span className="text-sm capitalize" style={{ color: getStatusColor(selectedAgent.status) }}>
                                        {selectedAgent.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-white/40">{selectedAgent.progress.progress}%</span>
                                    {selectedAgent.status === 'running' && (
                                        <button
                                            onClick={() => handleStopAgent(selectedAgent.id)}
                                            className="p-1 rounded hover:bg-white/10 transition-colors"
                                            title="Stop agent"
                                        >
                                            <Pause className="w-3 h-3 text-white/60" />
                                        </button>
                                    )}
                                    {selectedAgent.status === 'paused' && (
                                        <button
                                            onClick={() => handleResumeAgent(selectedAgent.id)}
                                            className="p-1 rounded hover:bg-white/10 transition-colors"
                                            title="Resume agent"
                                        >
                                            <Play className="w-3 h-3 text-white/60" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${selectedAgent.progress.progress}%` }}
                                    transition={{ duration: 0.3 }}
                                    style={{
                                        background: `linear-gradient(90deg, ${accentColor}80 0%, ${accentColor} 100%)`,
                                        boxShadow: `0 0 10px ${accentColor}40`,
                                    }}
                                />
                            </div>
                            {selectedAgent.progress.currentStep && (
                                <p className="text-xs text-white/50 mt-2">
                                    {selectedAgent.progress.currentStep}
                                </p>
                            )}
                            {selectedAgent.taskPrompt && (
                                <p className="text-xs text-white/40 mt-1 line-clamp-2">
                                    Task: {selectedAgent.taskPrompt}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Verification Status */}
                    {selectedAgent.verificationScore !== undefined && (
                        <div className="px-4 py-3 border-b border-white/5">
                            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Verification</h4>
                            <div className="flex items-center gap-2">
                                {selectedAgent.verificationPassed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-400" />
                                )}
                                <span className="text-sm" style={{
                                    color: selectedAgent.verificationPassed ? '#34d399' : '#f87171'
                                }}>
                                    Score: {selectedAgent.verificationScore}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Sandbox URL */}
                    {selectedAgent.sandboxUrl && (
                        <div className="px-4 py-3 border-b border-white/5">
                            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Preview</h4>
                            <a
                                href={selectedAgent.sandboxUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs hover:underline"
                                style={{ color: accentColor }}
                            >
                                {selectedAgent.sandboxUrl}
                            </a>
                        </div>
                    )}

                    {/* Error Display */}
                    {selectedAgent.lastError && (
                        <div className="px-4 py-3 border-b border-white/5">
                            <h4 className="text-xs font-medium text-red-400 uppercase tracking-wider mb-2">Error</h4>
                            <p className="text-xs text-red-300/80">{selectedAgent.lastError}</p>
                        </div>
                    )}

                    {/* Activity Log */}
                    <div className="px-4 py-3">
                        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Activity</h4>
                        <div className="space-y-2">
                            {agentLogs.length === 0 ? (
                                <p className="text-xs text-white/30 italic">No activity yet. Deploy an agent to get started.</p>
                            ) : (
                                agentLogs.slice(0, 50).map((log) => (
                                    <div key={log.id} className="flex items-start gap-2">
                                        <div className="mt-0.5">
                                            {getLogIcon(log.logType)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white/70">{log.message}</p>
                                            {log.details?.code && (
                                                <pre className="text-[10px] text-white/50 bg-white/5 rounded p-1 mt-1 overflow-x-auto">
                                                    {log.details.code.substring(0, 200)}
                                                    {log.details.code.length > 200 && '...'}
                                                </pre>
                                            )}
                                            <p className="text-[10px] text-white/30">
                                                {log.createdAt.toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex items-center justify-center p-4">
                    <div className="text-center">
                        <Bot className="w-12 h-12 mx-auto mb-3 text-white/20" />
                        <p className="text-sm text-white/40">No agent selected</p>
                        <p className="text-xs text-white/30 mt-1">Deploy an agent to get started</p>
                    </div>
                </div>
            )}

            {/* Soft Interrupt Input - Prominent when agents are running */}
            {agents.some(a => a.status === 'running') && currentSession && (
                <div
                    className="p-3 border-t border-white/5"
                    style={{
                        background: `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.02) 100%)`,
                        borderTop: `1px solid ${accentColor}30`,
                    }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: accentColor }} />
                        <span className="text-xs font-medium" style={{ color: accentColor }}>
                            Agent Running - Send Interrupt
                        </span>
                    </div>
                    <SoftInterruptInput
                        sessionId={currentSession.id}
                        agentId={selectedAgent?.id}
                        onInterruptSubmitted={(interrupt) => {
                            console.log('Interrupt sent:', interrupt);
                        }}
                        className="w-full"
                    />
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-white/5">
                {/* Model Selector */}
                <div className="mb-3 relative" ref={modelDropdownRef}>
                    <button
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
                        style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.7)',
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4" style={{ color: accentColor }} />
                            <span>{AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name || 'Select Model'}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {showModelDropdown && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute left-0 right-0 bottom-full mb-1 rounded-lg overflow-hidden z-50"
                                style={{
                                    background: 'rgba(25,25,30,0.98)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                }}
                            >
                                {AVAILABLE_MODELS.map((model) => (
                                    <button
                                        key={model.id}
                                        onClick={() => handleModelChange(model.id)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                                        style={{
                                            background: selectedModel === model.id ? accentGlow : 'transparent',
                                        }}
                                    >
                                        <div className="flex-1">
                                            <div className="text-sm text-white/90">{model.name}</div>
                                            <div className="text-xs text-white/40">{model.description}</div>
                                        </div>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                            model.tier === 'premium' ? 'bg-amber-500/20 text-amber-400' :
                                            model.tier === 'standard' ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-emerald-500/20 text-emerald-400'
                                        }`}>
                                            {model.tier}
                                        </span>
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Task Input */}
                <div
                    className="relative rounded-xl overflow-hidden"
                    style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.08)',
                    }}
                >
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleDeployAgent();
                            }
                        }}
                        disabled={isLoading || !currentSession}
                        placeholder={
                            !currentSession
                                ? 'Initializing session...'
                                : 'Describe what you want this agent to do...'
                        }
                        className="w-full bg-transparent text-white/90 placeholder-white/30 text-sm p-3 pr-12 resize-none outline-none disabled:opacity-50"
                        rows={3}
                        style={{ minHeight: '80px' }}
                    />
                    <button
                        onClick={handleDeployAgent}
                        disabled={!inputValue.trim() || isLoading || !currentSession}
                        className="absolute right-2 bottom-2 p-2 rounded-lg transition-all disabled:opacity-40"
                        style={{
                            background: inputValue.trim() && !isLoading
                                ? `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}cc 100%)`
                                : 'rgba(255,255,255,0.05)',
                            boxShadow: inputValue.trim() && !isLoading ? `0 0 20px ${accentColor}40` : 'none',
                        }}
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'rgba(255,255,255,0.3)' }} />
                        ) : (
                            <Send className="w-4 h-4" style={{ color: inputValue.trim() ? '#000' : 'rgba(255,255,255,0.3)' }} />
                        )}
                    </button>
                </div>
            </div>

            {/* Deploy Agent Modal */}
            <DeployAgentModal
                isOpen={showDeployModal}
                onClose={() => setShowDeployModal(false)}
                onDeploy={handleDeployFromModal}
            />

            {/* Developer Mode Settings Modal */}
            <DeveloperModeSettings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </div>
    );
}

export default AgentModeSidebar;
