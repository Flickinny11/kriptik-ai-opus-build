/**
 * Deploy Agent Modal - Developer Mode Agent Configuration
 *
 * A modal for configuring and deploying a new agent task with:
 * - Task description input
 * - Model selection
 * - Cost estimation before execution
 * - Verification mode selection
 * - Git branch configuration
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CloseIcon,
    ZapIcon,
    ShieldIcon,
    ClockIcon,
    ChevronDownIcon,
    WarningIcon,
    CheckCircleIcon,
    LoadingIcon,
    BrainIcon,
} from '../ui/icons';
import { useDeveloperModeStore, selectAvailableModels, type ModelInfo } from '../../store/useDeveloperModeStore';

// Custom icons for Deploy Modal
type IconProps = { className?: string; size?: number; style?: React.CSSProperties };

const BotIcon = ({ className, size = 24, style }: IconProps) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="3" y="11" width="18" height="10" rx="2"/>
        <circle cx="12" cy="5" r="2"/>
        <path d="M12 7v4"/>
        <line x1="8" y1="16" x2="8" y2="16"/>
        <line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
);

const GitBranchIcon = ({ className, size = 24, style }: IconProps) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <line x1="6" y1="3" x2="6" y2="15"/>
        <circle cx="18" cy="6" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
);

const DollarSignIcon = ({ className, size = 24, style }: IconProps) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
);

const SparklesIcon = ({ className, size = 24, style }: IconProps) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        <path d="M5 3v4"/>
        <path d="M19 17v4"/>
        <path d="M3 5h4"/>
        <path d="M17 19h4"/>
    </svg>
);

const TargetIcon = ({ className, size = 24, style }: IconProps) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="6"/>
        <circle cx="12" cy="12" r="2"/>
    </svg>
);

const CpuIcon = ({ className, size = 24, style }: IconProps) => (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
        <rect x="4" y="4" width="16" height="16" rx="2" ry="2"/>
        <rect x="9" y="9" width="6" height="6"/>
        <line x1="9" y1="1" x2="9" y2="4"/>
        <line x1="15" y1="1" x2="15" y2="4"/>
        <line x1="9" y1="20" x2="9" y2="23"/>
        <line x1="15" y1="20" x2="15" y2="23"/>
        <line x1="20" y1="9" x2="23" y2="9"/>
        <line x1="20" y1="14" x2="23" y2="14"/>
        <line x1="1" y1="9" x2="4" y2="9"/>
        <line x1="1" y1="14" x2="4" y2="14"/>
    </svg>
);

type LucideIcon = React.FC<IconProps>;

// Dark glass styling
const darkGlassPanel = {
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 30px 80px rgba(0,0,0,0.5),
        0 15px 40px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 0 0 1px rgba(255,255,255,0.05)
    `,
};

const accentColor = '#c8ff64';
const accentGlow = 'rgba(200,255,100,0.15)';

type VerificationMode = 'quick' | 'standard' | 'strict' | 'production';
type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'very_complex';

interface CostEstimate {
    minTokens: number;
    maxTokens: number;
    minCost: number;
    maxCost: number;
    estimatedTimeMs: number;
}

const VERIFICATION_MODES: Record<VerificationMode, { name: string; description: string; icon: LucideIcon; color: string }> = {
    quick: { name: 'Quick', description: 'Fast checks, critical only', icon: ZapIcon as any, color: '#fbbf24' },
    standard: { name: 'Standard', description: 'Balanced verification', icon: ShieldIcon as any, color: '#60a5fa' },
    strict: { name: 'Strict', description: 'Thorough pre-production', icon: TargetIcon as any, color: '#a78bfa' },
    production: { name: 'Production', description: 'Maximum verification', icon: CheckCircleIcon as any, color: '#34d399' },
};

const COMPLEXITY_ESTIMATES: Record<ComplexityLevel, CostEstimate> = {
    trivial: { minTokens: 10, maxTokens: 50, minCost: 0.00001, maxCost: 0.00005, estimatedTimeMs: 5000 },
    simple: { minTokens: 50, maxTokens: 200, minCost: 0.00005, maxCost: 0.0002, estimatedTimeMs: 30000 },
    moderate: { minTokens: 200, maxTokens: 1000, minCost: 0.0002, maxCost: 0.001, estimatedTimeMs: 120000 },
    complex: { minTokens: 1000, maxTokens: 4000, minCost: 0.001, maxCost: 0.004, estimatedTimeMs: 600000 },
    very_complex: { minTokens: 4000, maxTokens: 16000, minCost: 0.004, maxCost: 0.016, estimatedTimeMs: 1800000 },
};

interface DeployAgentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDeploy: (config: DeployConfig) => void;
    existingAgentId?: string;
}

export interface DeployConfig {
    taskDescription: string;
    model: string;
    verificationMode: VerificationMode;
    branchName?: string;
    createNewBranch: boolean;
    estimatedComplexity: ComplexityLevel;
}

// Default available models (used if store doesn't have any loaded)
const DEFAULT_MODELS: ModelInfo[] = [
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', provider: 'Anthropic', description: 'Best reasoning, complex tasks', creditsPerTask: 50, recommended: ['complex architecture'] },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', provider: 'Anthropic', description: 'Fast & capable', creditsPerTask: 20, recommended: ['feature implementation'] },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', provider: 'Anthropic', description: 'Fastest, simple tasks', creditsPerTask: 5, recommended: ['simple fixes'] },
    { id: 'gpt-5-codex', name: 'GPT-5 Codex', provider: 'OpenAI', description: "OpenAI's latest", creditsPerTask: 25, recommended: ['code generation'] },
    { id: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', description: "Google's flagship", creditsPerTask: 15, recommended: ['visual analysis'] },
    { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', description: 'Open source, cost-effective', creditsPerTask: 8, recommended: ['analysis'] },
];

export function DeployAgentModal({
    isOpen,
    onClose,
    onDeploy,
    existingAgentId
}: DeployAgentModalProps) {
    const storeModels = useDeveloperModeStore(selectAvailableModels);
    const agents = useDeveloperModeStore(state => state.currentSession?.agents || []);
    const loadModels = useDeveloperModeStore(state => state.loadModels);

    // Use store models if available, otherwise use defaults
    const AVAILABLE_MODELS = storeModels.length > 0 ? storeModels : DEFAULT_MODELS;

    // Load models on mount if not already loaded
    useEffect(() => {
        if (storeModels.length === 0) {
            loadModels();
        }
    }, [storeModels.length, loadModels]);

    const [taskDescription, setTaskDescription] = useState('');
    const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[1]?.id || 'anthropic/claude-sonnet-4.5');
    const [verificationMode, setVerificationMode] = useState<VerificationMode>('standard');
    const [createNewBranch, setCreateNewBranch] = useState(true);
    const [branchName, setBranchName] = useState('');
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [showVerificationDropdown, setShowVerificationDropdown] = useState(false);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimatedComplexity, setEstimatedComplexity] = useState<ComplexityLevel>('moderate');

    const existingAgent = existingAgentId ? agents.find(a => a.id === existingAgentId) : null;

    // Auto-generate branch name from task description
    useEffect(() => {
        if (taskDescription && createNewBranch) {
            const sanitized = taskDescription
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 40);
            setBranchName(`agent/${sanitized}-${Date.now().toString(36).slice(-4)}`);
        }
    }, [taskDescription, createNewBranch]);

    // Estimate complexity based on task description
    useEffect(() => {
        if (taskDescription.length > 10) {
            setIsEstimating(true);
            const timer = setTimeout(() => {
                // Simple heuristic for complexity estimation
                const words = taskDescription.split(/\s+/).length;
                const hasMultipleFiles = /files?|components?|pages?|multiple|several/i.test(taskDescription);
                const hasIntegration = /integrate|api|database|auth|connect/i.test(taskDescription);
                const hasRefactor = /refactor|rewrite|restructure|overhaul/i.test(taskDescription);

                if (words < 5 && !hasMultipleFiles) {
                    setEstimatedComplexity('trivial');
                } else if (words < 15 && !hasIntegration && !hasRefactor) {
                    setEstimatedComplexity('simple');
                } else if (hasMultipleFiles || hasIntegration) {
                    setEstimatedComplexity('complex');
                } else if (hasRefactor || words > 50) {
                    setEstimatedComplexity('very_complex');
                } else {
                    setEstimatedComplexity('moderate');
                }
                setIsEstimating(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [taskDescription]);

    const costEstimate = COMPLEXITY_ESTIMATES[estimatedComplexity];
    const selectedModelInfo = AVAILABLE_MODELS.find(m => m.id === selectedModel);

    const handleDeploy = () => {
        onDeploy({
            taskDescription,
            model: selectedModel,
            verificationMode,
            branchName: createNewBranch ? branchName : undefined,
            createNewBranch,
            estimatedComplexity,
        });
        onClose();
    };

    const formatTime = (ms: number) => {
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
        return `${Math.round(ms / 3600000)}h`;
    };

    const formatCost = (cost: number) => {
        if (cost < 0.01) return `$${(cost * 100).toFixed(2)}¢`;
        return `$${cost.toFixed(4)}`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.7)' }}
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="w-full max-w-lg rounded-2xl overflow-hidden"
                    style={darkGlassPanel}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div
                        className="px-6 py-4 flex items-center justify-between"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{
                                    background: `linear-gradient(145deg, ${accentGlow} 0%, rgba(200,255,100,0.05) 100%)`,
                                    border: `1px solid ${accentColor}30`,
                                }}
                            >
                                <BotIcon size={20} style={{ color: accentColor }} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {existingAgent ? `Deploy Task to ${existingAgent.name}` : 'Deploy New Agent'}
                                </h2>
                                <p className="text-xs text-white/40">Configure and launch an AI agent</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg transition-colors hover:bg-white/5"
                        >
                            <CloseIcon size={20} className="text-white/50" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                        {/* Task Description */}
                        <div>
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Task Description
                            </label>
                            <textarea
                                value={taskDescription}
                                onChange={(e) => setTaskDescription(e.target.value)}
                                placeholder="Describe what you want the agent to do..."
                                className="w-full h-24 px-4 py-3 rounded-xl text-sm text-white placeholder-white/30 resize-none"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    outline: 'none',
                                }}
                            />
                        </div>

                        {/* Model Selection */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                AI Model
                            </label>
                            <button
                                onClick={() => setShowModelDropdown(!showModelDropdown)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <BrainIcon size={16} style={{ color: accentColor }} />
                                    <div className="text-left">
                                        <div className="text-white">{selectedModelInfo?.name || 'Select model'}</div>
                                        <div className="text-xs text-white/40">{selectedModelInfo?.description}</div>
                                    </div>
                                </div>
                                <ChevronDownIcon size={16} className={`text-white/50 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showModelDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-10"
                                        style={{
                                            background: 'rgba(25,25,30,0.98)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                        }}
                                    >
                                        {AVAILABLE_MODELS.map((model: ModelInfo) => (
                                            <button
                                                key={model.id}
                                                onClick={() => {
                                                    setSelectedModel(model.id);
                                                    setShowModelDropdown(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                                                style={{
                                                    background: selectedModel === model.id ? accentGlow : 'transparent',
                                                }}
                                            >
                                                <div className="flex-1">
                                                    <div className="text-sm text-white">{model.name}</div>
                                                    <div className="text-xs text-white/40">{model.description}</div>
                                                </div>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                    model.creditsPerTask >= 40 ? 'bg-amber-500/20 text-amber-400' :
                                                    model.creditsPerTask >= 15 ? 'bg-blue-500/20 text-blue-400' :
                                                    'bg-emerald-500/20 text-emerald-400'
                                                }`}>
                                                    {model.creditsPerTask >= 40 ? 'premium' : model.creditsPerTask >= 15 ? 'standard' : 'economy'}
                                                </span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Verification Mode */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-white/70 mb-2">
                                Verification Mode
                            </label>
                            <button
                                onClick={() => setShowVerificationDropdown(!showVerificationDropdown)}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const mode = VERIFICATION_MODES[verificationMode];
                                        const Icon = mode.icon;
                                        return (
                                            <>
                                                <Icon className="w-4 h-4" style={{ color: mode.color }} />
                                                <div className="text-left">
                                                    <div className="text-white">{mode.name}</div>
                                                    <div className="text-xs text-white/40">{mode.description}</div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                                <ChevronDownIcon size={16} className={`text-white/50 transition-transform ${showVerificationDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {showVerificationDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute left-0 right-0 mt-2 rounded-xl overflow-hidden z-10"
                                        style={{
                                            background: 'rgba(25,25,30,0.98)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                                        }}
                                    >
                                        {(Object.keys(VERIFICATION_MODES) as VerificationMode[]).map((mode) => {
                                            const modeInfo = VERIFICATION_MODES[mode];
                                            const Icon = modeInfo.icon;
                                            return (
                                                <button
                                                    key={mode}
                                                    onClick={() => {
                                                        setVerificationMode(mode);
                                                        setShowVerificationDropdown(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                                                    style={{
                                                        background: verificationMode === mode ? accentGlow : 'transparent',
                                                    }}
                                                >
                                                    <Icon size={16} style={{ color: modeInfo.color }} />
                                                    <div className="flex-1">
                                                        <div className="text-sm text-white">{modeInfo.name}</div>
                                                        <div className="text-xs text-white/40">{modeInfo.description}</div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Git Branch */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-white/70">Git Branch</label>
                                <button
                                    onClick={() => setCreateNewBranch(!createNewBranch)}
                                    className="text-xs px-2 py-1 rounded-lg transition-colors"
                                    style={{
                                        background: createNewBranch ? accentGlow : 'rgba(255,255,255,0.03)',
                                        color: createNewBranch ? accentColor : 'rgba(255,255,255,0.5)',
                                        border: `1px solid ${createNewBranch ? `${accentColor}30` : 'rgba(255,255,255,0.08)'}`,
                                    }}
                                >
                                    {createNewBranch ? 'New Branch' : 'Current Branch'}
                                </button>
                            </div>
                            {createNewBranch && (
                                <div className="relative">
                                    <GitBranchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" size={16} />
                                    <input
                                        type="text"
                                        value={branchName}
                                        onChange={(e) => setBranchName(e.target.value)}
                                        placeholder="feature/agent-task"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder-white/30 font-mono"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Cost Estimate */}
                        {taskDescription.length > 10 && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="rounded-xl overflow-hidden"
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                }}
                            >
                                <div
                                    className="px-4 py-2 flex items-center gap-2"
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                >
                                    <SparklesIcon size={16} style={{ color: accentColor }} />
                                    <span className="text-sm text-white/70">Cost Estimate</span>
                                    {isEstimating && (
                                        <LoadingIcon size={12} className="animate-spin text-white/40 ml-auto" />
                                    )}
                                </div>
                                <div className="p-4 grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-white/40 text-xs mb-1">
                                            <CpuIcon size={12} />
                                            Tokens
                                        </div>
                                        <div className="text-sm text-white font-medium">
                                            {costEstimate.minTokens.toLocaleString()} - {costEstimate.maxTokens.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-white/40 text-xs mb-1">
                                            <DollarSignIcon size={12} />
                                            Cost
                                        </div>
                                        <div className="text-sm font-medium" style={{ color: accentColor }}>
                                            {formatCost(costEstimate.minCost)} - {formatCost(costEstimate.maxCost)}
                                        </div>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center gap-1 text-white/40 text-xs mb-1">
                                            <ClockIcon size={12} />
                                            Time
                                        </div>
                                        <div className="text-sm text-white font-medium">
                                            ~{formatTime(costEstimate.estimatedTimeMs)}
                                        </div>
                                    </div>
                                </div>

                                {/* Complexity indicator */}
                                <div
                                    className="px-4 py-2 flex items-center justify-between text-xs"
                                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                                >
                                    <span className="text-white/40">Estimated Complexity</span>
                                    <span
                                        className="capitalize px-2 py-0.5 rounded-full"
                                        style={{
                                            background: estimatedComplexity === 'trivial' ? 'rgba(52, 211, 153, 0.1)' :
                                                estimatedComplexity === 'simple' ? 'rgba(96, 165, 250, 0.1)' :
                                                estimatedComplexity === 'moderate' ? 'rgba(251, 191, 36, 0.1)' :
                                                estimatedComplexity === 'complex' ? 'rgba(251, 146, 60, 0.1)' :
                                                'rgba(248, 113, 113, 0.1)',
                                            color: estimatedComplexity === 'trivial' ? '#34d399' :
                                                estimatedComplexity === 'simple' ? '#60a5fa' :
                                                estimatedComplexity === 'moderate' ? '#fbbf24' :
                                                estimatedComplexity === 'complex' ? '#fb923c' :
                                                '#f87171',
                                        }}
                                    >
                                        {estimatedComplexity.replace('_', ' ')}
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* Warning for complex tasks */}
                        {(estimatedComplexity === 'complex' || estimatedComplexity === 'very_complex') && (
                            <div
                                className="flex items-start gap-3 px-4 py-3 rounded-xl"
                                style={{
                                    background: 'rgba(251, 191, 36, 0.1)',
                                    border: '1px solid rgba(251, 191, 36, 0.2)',
                                }}
                            >
                                <WarningIcon size={16} className="text-amber-400 mt-0.5" />
                                <div>
                                    <div className="text-sm text-amber-400 font-medium">Complex Task Detected</div>
                                    <div className="text-xs text-amber-400/70 mt-0.5">
                                        Consider breaking this into smaller tasks for better results and easier rollback.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div
                        className="px-6 py-4 flex items-center justify-between"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                    >
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-sm text-white/60 transition-colors hover:text-white hover:bg-white/5"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeploy}
                            disabled={!taskDescription.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
                            style={{
                                background: taskDescription.trim()
                                    ? `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}cc 100%)`
                                    : 'rgba(255,255,255,0.05)',
                                color: taskDescription.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                                boxShadow: taskDescription.trim() ? `0 4px 20px ${accentColor}40` : 'none',
                            }}
                        >
                            <ZapIcon size={16} />
                            Deploy Agent
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default DeployAgentModal;

