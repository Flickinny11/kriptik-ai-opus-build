/**
 * Orchestration Plan View
 *
 * Visualizes multi-agent task decomposition before execution.
 * Shows wave-based execution plan with task dependencies.
 *
 * B4: Orchestration Plan View from integration analysis
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CloseIcon,
    ZapIcon,
    LoadingIcon,
    ClockIcon,
    ChevronDownIcon,
    WorkflowIcon,
    BrainIcon,
    AlertCircleIcon,
    TrashIcon,
    PlusIcon,
    ArrowRightIcon,
} from '../ui/icons';
import { cn } from '@/lib/utils';

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

interface Task {
    id: string;
    description: string;
    model: string;
    estimatedTime: number;
    estimatedCredits: number;
    dependencies: string[];
    wave: number;
}

interface OrchestrationPlan {
    userPrompt: string;
    totalAgents: number;
    totalEstimatedTime: number;
    totalEstimatedCredits: number;
    waves: {
        wave: number;
        tasks: Task[];
    }[];
}

const AVAILABLE_MODELS = [
    { id: 'krip-toe-nite', name: '⚡ Krip-Toe-Nite', description: 'Intelligent routing' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', description: 'Best reasoning' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', description: 'Fast & capable' },
    { id: 'claude-haiku-3-5', name: 'Claude Haiku 3.5', description: 'Fastest' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', description: 'Cost-effective' },
];

interface OrchestrationPlanViewProps {
    isOpen: boolean;
    onClose: () => void;
    plan: OrchestrationPlan;
    onExecute: (plan: OrchestrationPlan) => Promise<void>;
}

export function OrchestrationPlanView({
    isOpen,
    onClose,
    plan: initialPlan,
    onExecute
}: OrchestrationPlanViewProps) {
    const [plan, setPlan] = useState<OrchestrationPlan>(initialPlan);
    const [executing, setExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingTask, setEditingTask] = useState<string | null>(null);
    const [showModelDropdown, setShowModelDropdown] = useState<string | null>(null);

    useEffect(() => {
        setPlan(initialPlan);
    }, [initialPlan]);

    const handleExecute = async (parallel: boolean = false) => {
        setExecuting(true);
        setError(null);

        try {
            const executionPlan = parallel
                ? { ...plan, waves: [{ wave: 1, tasks: plan.waves.flatMap(w => w.tasks) }] }
                : plan;

            await onExecute(executionPlan);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Execution failed');
        }

        setExecuting(false);
    };

    const updateTaskModel = (taskId: string, model: string) => {
        setPlan(prev => ({
            ...prev,
            waves: prev.waves.map(wave => ({
                ...wave,
                tasks: wave.tasks.map(task =>
                    task.id === taskId ? { ...task, model } : task
                )
            }))
        }));
        setShowModelDropdown(null);
    };

    const updateTaskDescription = (taskId: string, description: string) => {
        setPlan(prev => ({
            ...prev,
            waves: prev.waves.map(wave => ({
                ...wave,
                tasks: wave.tasks.map(task =>
                    task.id === taskId ? { ...task, description } : task
                )
            }))
        }));
    };

    const removeTask = (taskId: string) => {
        setPlan(prev => ({
            ...prev,
            waves: prev.waves.map(wave => ({
                ...wave,
                tasks: wave.tasks.filter(task => task.id !== taskId)
            })).filter(wave => wave.tasks.length > 0),
            totalAgents: prev.totalAgents - 1
        }));
    };

    const addTask = (waveNumber: number) => {
        const newTask: Task = {
            id: `task-${Date.now()}`,
            description: 'New task',
            model: 'krip-toe-nite',
            estimatedTime: 60,
            estimatedCredits: 5,
            dependencies: [],
            wave: waveNumber
        };

        setPlan(prev => ({
            ...prev,
            waves: prev.waves.map(wave =>
                wave.wave === waveNumber
                    ? { ...wave, tasks: [...wave.tasks, newTask] }
                    : wave
            ),
            totalAgents: prev.totalAgents + 1,
            totalEstimatedTime: prev.totalEstimatedTime + 60,
            totalEstimatedCredits: prev.totalEstimatedCredits + 5
        }));

        setEditingTask(newTask.id);
    };

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl"
                    style={darkGlassPanel}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: `${accentColor}20` }}
                            >
                                <WorkflowIcon size={20} className="text-[#c8ff64]" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Orchestration Plan</h2>
                                <p className="text-xs text-white/40">
                                    {plan.totalAgents} agents • {formatTime(plan.totalEstimatedTime)} • ~${(plan.totalEstimatedCredits * 0.01).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <CloseIcon size={20} className="text-white/40" />
                        </button>
                    </div>

                    {/* User Prompt */}
                    <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
                        <p className="text-sm text-white/60 mb-1">Your request:</p>
                        <p className="text-white">{plan.userPrompt}</p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-6 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <div className="flex items-center gap-2 text-sm text-red-400">
                                <AlertCircleIcon size={16} />
                                {error}
                            </div>
                        </div>
                    )}

                    {/* Waves */}
                    <div className="p-6 overflow-auto max-h-[50vh] space-y-6">
                        {plan.waves.map((wave, waveIndex) => (
                            <div key={wave.wave} className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="text-xs font-semibold px-2 py-1 rounded"
                                            style={{ background: `${accentColor}20`, color: accentColor }}
                                        >
                                            Wave {wave.wave}
                                        </span>
                                        <span className="text-xs text-white/40">
                                            {wave.tasks.length} tasks
                                            {waveIndex > 0 && ' • Waits for Wave ' + (wave.wave - 1)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => addTask(wave.wave)}
                                        className="flex items-center gap-1 px-2 py-1 text-xs text-white/60 hover:text-white/80 hover:bg-white/5 rounded transition-colors"
                                    >
                                        <PlusIcon size={12} />
                                        Add Task
                                    </button>
                                </div>

                                <div className="grid gap-3">
                                    {wave.tasks.map((task, taskIndex) => (
                                        <motion.div
                                            key={task.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: taskIndex * 0.05 }}
                                            className="p-4 rounded-xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <BrainIcon size={16} className="text-cyan-400" />
                                                        {editingTask === task.id ? (
                                                            <input
                                                                type="text"
                                                                value={task.description}
                                                                onChange={(e) => updateTaskDescription(task.id, e.target.value)}
                                                                onBlur={() => setEditingTask(null)}
                                                                onKeyDown={(e) => e.key === 'Enter' && setEditingTask(null)}
                                                                autoFocus
                                                                className="flex-1 bg-transparent border-b border-white/20 text-white outline-none px-1"
                                                            />
                                                        ) : (
                                                            <span
                                                                className="text-white font-medium cursor-pointer hover:text-white/80"
                                                                onClick={() => setEditingTask(task.id)}
                                                            >
                                                                {task.description}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={() => setEditingTask(task.id)}
                                                            className="p-1 text-white/30 hover:text-white/60"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="w-3 h-3">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center gap-4 text-xs text-white/50">
                                                        {/* Model Selector */}
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => setShowModelDropdown(
                                                                    showModelDropdown === task.id ? null : task.id
                                                                )}
                                                                className="flex items-center gap-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                                                            >
                                                                <ZapIcon size={12} className="text-cyan-400" />
                                                                {AVAILABLE_MODELS.find(m => m.id === task.model)?.name || task.model}
                                                                <ChevronDownIcon size={12} />
                                                            </button>

                                                            {showModelDropdown === task.id && (
                                                                <div className="absolute left-0 top-full mt-1 py-1 rounded-lg bg-slate-800 border border-white/10 z-10 min-w-[180px]">
                                                                    {AVAILABLE_MODELS.map(model => (
                                                                        <button
                                                                            key={model.id}
                                                                            onClick={() => updateTaskModel(task.id, model.id)}
                                                                            className={cn(
                                                                                'w-full px-3 py-2 text-left text-xs hover:bg-white/5',
                                                                                task.model === model.id ? 'text-cyan-400' : 'text-white/70'
                                                                            )}
                                                                        >
                                                                            <div className="font-medium">{model.name}</div>
                                                                            <div className="text-white/40">{model.description}</div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>

                                                        <span className="flex items-center gap-1">
                                                            <ClockIcon size={12} />
                                                            {formatTime(task.estimatedTime)}
                                                        </span>

                                                        <span className="flex items-center gap-1">
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="w-3 h-3">
                                                                <line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                            </svg>
                                                            ~${(task.estimatedCredits * 0.01).toFixed(2)}
                                                        </span>

                                                        {task.dependencies.length > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <ArrowRightIcon size={12} />
                                                                Depends: {task.dependencies.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => removeTask(task.id)}
                                                    className="p-2 text-white/30 hover:text-red-400 transition-colors"
                                                >
                                                    <TrashIcon size={16} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-6">
                                <div>
                                    <span className="text-white/40">Total Agents:</span>{' '}
                                    <span className="text-white font-medium">{plan.totalAgents}</span>
                                </div>
                                <div>
                                    <span className="text-white/40">Estimated Time:</span>{' '}
                                    <span className="text-white font-medium">{formatTime(plan.totalEstimatedTime)}</span>
                                </div>
                                <div>
                                    <span className="text-white/40">Estimated Cost:</span>{' '}
                                    <span className="font-medium" style={{ color: accentColor }}>
                                        ~${(plan.totalEstimatedCredits * 0.01).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-white/5">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white/80 hover:bg-white/5 transition-all"
                        >
                            Cancel
                        </button>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handleExecute(true)}
                                disabled={executing}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/5 text-white/80 hover:bg-white/10 border border-white/10 transition-all disabled:opacity-50"
                            >
                                <ZapIcon size={16} />
                                Run All Parallel ⚡
                            </button>
                            <button
                                onClick={() => handleExecute(false)}
                                disabled={executing}
                                className="flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                                style={{
                                    background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                                    color: '#000',
                                }}
                            >
                                {executing ? (
                                    <LoadingIcon size={16} className="animate-spin" />
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="w-4 h-4">
                                        <path d="M5 3l14 9-14 9V3z" fill="currentColor"/>
                                    </svg>
                                )}
                                Execute Plan
                            </button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default OrchestrationPlanView;

