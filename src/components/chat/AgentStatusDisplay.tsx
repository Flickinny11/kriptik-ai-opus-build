/**
 * Agent Status Display Component
 * 
 * Shows real-time status of active AI agents in the chat interface.
 * Displays what each agent is working on and their progress.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
    Brain, 
    Code, 
    TestTube, 
    Rocket, 
    Search, 
    Plug, 
    Eye, 
    Bug,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Agent {
    id: string;
    type: 'planning' | 'coding' | 'testing' | 'deployment' | 'research' | 'integration' | 'review' | 'debug';
    name: string;
    status: 'idle' | 'working' | 'waiting' | 'blocked' | 'error' | 'completed';
    currentTask?: {
        title: string;
        progress?: number;
    };
    tokensUsed: number;
}

interface AgentStatusDisplayProps {
    agents: Agent[];
    totalTokensUsed: number;
    className?: string;
}

const AGENT_ICONS: Record<Agent['type'], React.ComponentType<{ className?: string }>> = {
    planning: Brain,
    coding: Code,
    testing: TestTube,
    deployment: Rocket,
    research: Search,
    integration: Plug,
    review: Eye,
    debug: Bug,
};

const AGENT_COLORS: Record<Agent['type'], string> = {
    planning: 'text-purple-400 bg-purple-500/10',
    coding: 'text-blue-400 bg-blue-500/10',
    testing: 'text-green-400 bg-green-500/10',
    deployment: 'text-amber-400 bg-amber-500/10',
    research: 'text-cyan-400 bg-cyan-500/10',
    integration: 'text-pink-400 bg-pink-500/10',
    review: 'text-indigo-400 bg-indigo-500/10',
    debug: 'text-red-400 bg-red-500/10',
};

export function AgentStatusDisplay({
    agents,
    totalTokensUsed,
    className,
}: AgentStatusDisplayProps) {
    const workingAgents = agents.filter(a => a.status === 'working');
    const idleAgents = agents.filter(a => a.status === 'idle');
    
    if (agents.length === 0) {
        return null;
    }
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'bg-gradient-to-br from-slate-900/80 to-slate-800/80',
                'border border-slate-700/50 rounded-xl backdrop-blur-sm',
                'overflow-hidden',
                className
            )}
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Brain className="w-5 h-5 text-amber-400" />
                        {workingAgents.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        )}
                    </div>
                    <span className="text-sm font-medium text-white">
                        Agent Orchestration
                    </span>
                </div>
                
                <div className="text-xs text-slate-400">
                    {totalTokensUsed.toLocaleString()} tokens used
                </div>
            </div>
            
            {/* Working agents */}
            <AnimatePresence>
                {workingAgents.map(agent => {
                    const Icon = AGENT_ICONS[agent.type];
                    const colors = AGENT_COLORS[agent.type];
                    
                    return (
                        <motion.div
                            key={agent.id}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-b border-slate-700/50"
                        >
                            <div className="p-3 flex items-center gap-3">
                                <div className={cn('p-2 rounded-lg', colors as string)}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-white">
                                            {agent.name}
                                        </span>
                                        <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                    </div>
                                    
                                    {agent.currentTask && (
                                        <div className="mt-1">
                                            <p className="text-xs text-slate-400 truncate">
                                                {agent.currentTask.title}
                                            </p>
                                            
                                            {agent.currentTask.progress !== undefined && (
                                                <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
                                                    <motion.div
                                                        className={cn(
                                                            'h-full rounded-full',
                                                            colors.replace('bg-', 'bg-').replace('/10', '')
                                                        )}
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${agent.currentTask.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
            
            {/* Idle agents (collapsed) */}
            {idleAgents.length > 0 && (
                <div className="px-4 py-2.5 flex items-center gap-2">
                    <span className="text-xs text-slate-500">
                        {idleAgents.length} agent{idleAgents.length !== 1 ? 's' : ''} idle:
                    </span>
                    <div className="flex items-center gap-1">
                        {idleAgents.map(agent => {
                            const Icon = AGENT_ICONS[agent.type];
                            return (
                                <div
                                    key={agent.id}
                                    className={cn(
                                        'p-1 rounded',
                                        AGENT_COLORS[agent.type] as string
                                    )}
                                    title={agent.name}
                                >
                                    <Icon className="w-3 h-3" />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.div>
    );
}

