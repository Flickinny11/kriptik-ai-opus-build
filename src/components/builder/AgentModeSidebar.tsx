/**
 * Agent Mode Sidebar
 * 
 * The command center for managing AI agents in Developer Mode.
 * Features:
 * - Agent list with status, progress, and output logs
 * - Model selector (Opus 4.5, Sonnet 4.5, GPT-5 Codex, etc.)
 * - Real-time progress updates
 * - Agent naming and management
 * - Dark theme with fluorescent yellow accents
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, Plus, Pause,
    CheckCircle2, XCircle, Loader2, Clock, Send,
    ChevronDown, Pencil, FileEdit, Zap
} from 'lucide-react';

// Agent types
interface Agent {
    id: string;
    name: string;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'paused' | 'waiting';
    progress: number;
    currentTask?: string;
    model: string;
    logs: AgentLog[];
    plan?: string[];
    branch?: string;
    filesModified?: string[];
    tokensUsed?: number;
    createdAt: Date;
}

interface AgentLog {
    id: string;
    timestamp: Date;
    type: 'info' | 'action' | 'success' | 'error' | 'warning';
    message: string;
}

// Available models
const AVAILABLE_MODELS = [
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Best reasoning, complex tasks', tier: 'premium' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Fast & capable', tier: 'standard' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', description: 'Fastest, simple tasks', tier: 'economy' },
    { id: 'gpt-5-codex', name: 'GPT-5 Codex', description: "OpenAI's latest", tier: 'premium' },
    { id: 'gpt-4-1', name: 'GPT-4.1', description: 'Reliable, well-tested', tier: 'standard' },
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
    const [agents, setAgents] = useState<Agent[]>([
        {
            id: '1',
            name: 'Agent #1',
            status: 'idle',
            progress: 0,
            model: 'claude-sonnet-4-5',
            logs: [],
            createdAt: new Date(),
        }
    ]);
    const [selectedAgentId, setSelectedAgentId] = useState<string | null>('1');
    const [inputValue, setInputValue] = useState('');
    const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

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

    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    const handleDeployAgent = () => {
        if (!inputValue.trim()) return;

        const newAgentId = String(agents.length + 1);
        const newAgent: Agent = {
            id: newAgentId,
            name: `Agent #${newAgentId}`,
            status: 'running',
            progress: 0,
            currentTask: inputValue,
            model: selectedModel,
            logs: [
                { id: '1', timestamp: new Date(), type: 'info', message: 'Agent initialized' },
                { id: '2', timestamp: new Date(), type: 'action', message: 'Analyzing task...' },
            ],
            plan: [
                'Analyze requirements',
                'Search codebase for relevant files',
                'Create implementation plan',
                'Generate code changes',
                'Run verification',
            ],
            branch: `kriptik/agent-${newAgentId}`,
            createdAt: new Date(),
        };

        setAgents(prev => [...prev.map(a => a.id === '1' && a.status === 'idle' ? { ...a, status: 'idle' as const, currentTask: inputValue } : a), 
            ...(agents.some(a => a.id === '1' && a.status === 'idle') ? [] : [newAgent])
        ]);

        // Update first idle agent or create new
        if (agents.some(a => a.id === selectedAgentId && a.status === 'idle')) {
            setAgents(prev => prev.map(a => 
                a.id === selectedAgentId ? {
                    ...a,
                    status: 'running' as const,
                    currentTask: inputValue,
                    progress: 0,
                    logs: [
                        { id: '1', timestamp: new Date(), type: 'info', message: 'Agent initialized' },
                        { id: '2', timestamp: new Date(), type: 'action', message: 'Analyzing task...' },
                    ],
                    plan: [
                        'Analyze requirements',
                        'Search codebase for relevant files',
                        'Create implementation plan',
                        'Generate code changes',
                        'Run verification',
                    ],
                    branch: `kriptik/agent-${a.id}`,
                } : a
            ));
        } else {
            setAgents(prev => [...prev, newAgent]);
            setSelectedAgentId(newAgentId);
        }

        setInputValue('');

        // Simulate progress
        simulateAgentProgress(selectedAgentId || newAgentId);
    };

    const simulateAgentProgress = (agentId: string) => {
        const progressSteps = [
            { progress: 15, log: { type: 'action' as const, message: 'Searching codebase...' } },
            { progress: 30, log: { type: 'info' as const, message: 'Found 3 relevant files' } },
            { progress: 45, log: { type: 'action' as const, message: 'Creating implementation plan...' } },
            { progress: 60, log: { type: 'action' as const, message: 'Generating code changes...' } },
            { progress: 80, log: { type: 'success' as const, message: 'Code changes generated' } },
            { progress: 90, log: { type: 'action' as const, message: 'Running verification...' } },
            { progress: 100, log: { type: 'success' as const, message: 'Verification passed ✓' } },
        ];

        progressSteps.forEach((step, index) => {
            setTimeout(() => {
                setAgents(prev => prev.map(a => {
                    if (a.id === agentId) {
                        return {
                            ...a,
                            progress: step.progress,
                            status: step.progress === 100 ? 'completed' as const : 'running' as const,
                            logs: [...a.logs, { id: String(a.logs.length + 1), timestamp: new Date(), ...step.log }],
                            filesModified: step.progress >= 60 ? ['src/components/Example.tsx', 'src/utils/helpers.ts'] : undefined,
                        };
                    }
                    return a;
                }));
            }, (index + 1) * 1500);
        });
    };

    const handleAddAgent = () => {
        const newId = String(agents.length + 1);
        setAgents(prev => [...prev, {
            id: newId,
            name: `Agent #${newId}`,
            status: 'idle',
            progress: 0,
            model: selectedModel,
            logs: [],
            createdAt: new Date(),
        }]);
        setSelectedAgentId(newId);
    };

    const handleRenameAgent = (agentId: string, newName: string) => {
        setAgents(prev => prev.map(a => a.id === agentId ? { ...a, name: newName } : a));
        setEditingAgentId(null);
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
                                {selectedAgent?.name || 'Agent'}
                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAddAgent}
                            className="p-2 rounded-lg transition-all hover:scale-105"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                            }}
                            title="Add new agent"
                        >
                            <Plus className="w-4 h-4 text-white/70" />
                        </button>
                    </div>
                </div>

                {/* Agent tabs */}
                {agents.length > 1 && (
                    <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
                        {agents.map((agent) => (
                            <button
                                key={agent.id}
                                onClick={() => setSelectedAgentId(agent.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
                                style={{
                                    background: selectedAgentId === agent.id 
                                        ? `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.05) 100%)`
                                        : 'rgba(255,255,255,0.03)',
                                    border: selectedAgentId === agent.id 
                                        ? `1px solid ${accentColor}40`
                                        : '1px solid rgba(255,255,255,0.05)',
                                    color: selectedAgentId === agent.id ? accentColor : 'rgba(255,255,255,0.6)',
                                }}
                            >
                                {getStatusIcon(agent.status)}
                                <span>{agent.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Agent Details */}
            {selectedAgent && (
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
                                <span className="text-xs text-white/40">{selectedAgent.progress}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${selectedAgent.progress}%` }}
                                    transition={{ duration: 0.3 }}
                                    style={{
                                        background: `linear-gradient(90deg, ${accentColor}80 0%, ${accentColor} 100%)`,
                                        boxShadow: `0 0 10px ${accentColor}40`,
                                    }}
                                />
                            </div>
                            {selectedAgent.currentTask && (
                                <p className="text-xs text-white/50 mt-2 line-clamp-2">
                                    Task: {selectedAgent.currentTask}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Agent Plan */}
                    {selectedAgent.plan && selectedAgent.plan.length > 0 && (
                        <div className="px-4 py-3 border-b border-white/5">
                            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Plan</h4>
                            <div className="space-y-1">
                                {selectedAgent.plan.map((step, index) => {
                                    const isComplete = (selectedAgent.progress / 100) * selectedAgent.plan!.length > index;
                                    const isCurrent = Math.floor((selectedAgent.progress / 100) * selectedAgent.plan!.length) === index;
                                    return (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 text-xs"
                                            style={{
                                                color: isComplete ? '#34d399' : isCurrent ? accentColor : 'rgba(255,255,255,0.4)',
                                            }}
                                        >
                                            {isComplete ? (
                                                <CheckCircle2 className="w-3 h-3" />
                                            ) : isCurrent ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <div className="w-3 h-3 rounded-full border border-current opacity-40" />
                                            )}
                                            <span>{step}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Files Modified */}
                    {selectedAgent.filesModified && selectedAgent.filesModified.length > 0 && (
                        <div className="px-4 py-3 border-b border-white/5">
                            <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Files Modified</h4>
                            <div className="space-y-1">
                                {selectedAgent.filesModified.map((file, index) => (
                                    <div key={index} className="flex items-center gap-2 text-xs text-white/60">
                                        <FileEdit className="w-3 h-3" style={{ color: accentColor }} />
                                        <span className="font-mono">{file}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Activity Log */}
                    <div className="px-4 py-3">
                        <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Activity</h4>
                        <div className="space-y-2">
                            {selectedAgent.logs.length === 0 ? (
                                <p className="text-xs text-white/30 italic">No activity yet. Deploy an agent to get started.</p>
                            ) : (
                                selectedAgent.logs.map((log) => (
                                    <div key={log.id} className="flex items-start gap-2">
                                        <div className="mt-0.5">
                                            {log.type === 'action' && <Zap className="w-3 h-3" style={{ color: accentColor }} />}
                                            {log.type === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                            {log.type === 'error' && <XCircle className="w-3 h-3 text-red-400" />}
                                            {log.type === 'warning' && <Clock className="w-3 h-3 text-amber-400" />}
                                            {log.type === 'info' && <Bot className="w-3 h-3 text-blue-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-white/70">{log.message}</p>
                                            <p className="text-[10px] text-white/30">
                                                {log.timestamp.toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-white/5">
                {/* Model Selector */}
                <div className="mb-3" ref={modelDropdownRef}>
                    <button
                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all"
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
                                className="absolute left-4 right-4 mt-1 rounded-lg overflow-hidden z-50"
                                style={{
                                    background: 'rgba(25,25,30,0.98)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                }}
                            >
                                {AVAILABLE_MODELS.map((model) => (
                                    <button
                                        key={model.id}
                                        onClick={() => {
                                            setSelectedModel(model.id);
                                            setShowModelDropdown(false);
                                        }}
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
                        placeholder="Describe what you want this agent to do..."
                        className="w-full bg-transparent text-white/90 placeholder-white/30 text-sm p-3 pr-12 resize-none outline-none"
                        rows={3}
                        style={{ minHeight: '80px' }}
                    />
                    <button
                        onClick={handleDeployAgent}
                        disabled={!inputValue.trim()}
                        className="absolute right-2 bottom-2 p-2 rounded-lg transition-all disabled:opacity-40"
                        style={{
                            background: inputValue.trim() 
                                ? `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}cc 100%)`
                                : 'rgba(255,255,255,0.05)',
                            boxShadow: inputValue.trim() ? `0 0 20px ${accentColor}40` : 'none',
                        }}
                    >
                        <Send className="w-4 h-4" style={{ color: inputValue.trim() ? '#000' : 'rgba(255,255,255,0.3)' }} />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AgentModeSidebar;

