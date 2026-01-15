/**
 * Autonomous Agents Panel
 *
 * Visual representation of all AI agents working on the project.
 * Key features:
 * - Real-time agent status
 * - Deploy agents on demand
 * - "Fix it for free" badge
 * - Cost tracking
 */

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    BrainIcon,
    PlayIcon,
    PauseIcon,
    StopIcon,
    LoadingIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    DollarSignIcon,
    GiftIcon,
    SparklesIcon,
} from '@/components/ui/icons';
import {
    useAgentStore,
    AgentType,
    AgentStatus,
    Agent,
    estimateTaskCost,
} from '@/lib/agents/autonomous-agent';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';

export default function AutonomousAgentsPanel() {
    const {
        agents,
        logs,
        totalCost,
        totalSaved,
        initializeAgents,
        deployAgent,
        pauseAgent,
        resumeAgent,
        cancelTask,
    } = useAgentStore();

    useEffect(() => {
        if (agents.length === 0) {
            initializeAgents();
        }
    }, [agents.length, initializeAgents]);

    const activeAgents = agents.filter(a => a.status !== 'idle');
    const recentLogs = logs.slice(-20).reverse();

    const handleQuickDeploy = async (type: AgentType, description: string) => {
        const isFixer = type === 'fixer';
        await deployAgent(type, {
            type: type === 'fixer' ? 'fix' : 'generate',
            description,
            cost: estimateTaskCost('generate', 'medium'),
            isFree: isFixer, // Fixer is always free
        });
    };

    return (
        <TooltipProvider>
            <div className="flex flex-col h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
                {/* Header */}
                <div className="p-4 border-b border-gray-800/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                                <BrainIcon size={20} className="text-purple-400" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-white">Autonomous Agents</h2>
                                <p className="text-xs text-gray-400">
                                    {activeAgents.length} active • {agents.length} total
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4">
                            <Tooltip>
                                <TooltipTrigger>
                                    <div className="flex items-center gap-1 text-sm">
                                        <DollarSignIcon size={16} className="text-gray-400" />
                                        <span className="text-gray-300">${totalCost.toFixed(2)}</span>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>Total cost</TooltipContent>
                            </Tooltip>

                            {totalSaved > 0 && (
                                <Tooltip>
                                    <TooltipTrigger>
                                        <div className="flex items-center gap-1 text-sm bg-green-500/10 px-2 py-1 rounded">
                                            <GiftIcon size={16} className="text-green-400" />
                                            <span className="text-green-400">${totalSaved.toFixed(2)} saved</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>Saved with "Fix it Free"</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {/* Fix it Free Banner */}
                    <div className="mt-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                            <GiftIcon size={20} className="text-green-400" />
                            <div>
                                <p className="text-sm font-medium text-green-300">Fix It For Free™</p>
                                <p className="text-xs text-green-400/60">
                                    All error corrections are free. We only charge for new features.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Agent Grid */}
                <ScrollArea className="flex-1 p-4">
                    <div className="grid grid-cols-2 gap-3">
                        {agents.map(agent => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                onPause={() => pauseAgent(agent.id)}
                                onResume={() => resumeAgent(agent.id)}
                                onCancel={() => cancelTask(agent.id)}
                                onDeploy={() => handleQuickDeploy(agent.type, `Quick ${agent.name} task`)}
                            />
                        ))}
                    </div>

                    {/* Activity Log */}
                    {recentLogs.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                                <ClockIcon size={16} />
                                Recent Activity
                            </h3>
                            <div className="space-y-2">
                                {recentLogs.map(log => (
                                    <LogEntry key={log.id} log={log} agents={agents} />
                                ))}
                            </div>
                        </div>
                    )}
                </ScrollArea>

                {/* Quick Actions */}
                <div className="p-4 border-t border-gray-800/50">
                    <p className="text-xs text-gray-500 mb-2">Quick Deploy</p>
                    <div className="flex gap-2 flex-wrap">
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => handleQuickDeploy('fixer', 'Auto-fix all errors')}
                        >
                            <GiftIcon size={12} className="mr-1 text-green-400" />
                            Fix Errors (Free)
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => handleQuickDeploy('tester', 'Generate tests')}
                        >
                            🧪 Generate Tests
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => handleQuickDeploy('security', 'Security scan')}
                        >
                            Security Scan
                        </Button>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function AgentCard({
    agent,
    onPause,
    onResume,
    onCancel,
    onDeploy,
}: {
    agent: Agent;
    onPause: () => void;
    onResume: () => void;
    onCancel: () => void;
    onDeploy: () => void;
}) {
    const isActive = agent.status !== 'idle';
    const isFixer = agent.type === 'fixer';

    return (
        <motion.div
            layout
            className={`
                relative p-3 rounded-xl border transition-all
                ${isActive
                    ? 'bg-gray-800/50 border-purple-500/30'
                    : 'bg-gray-800/20 border-gray-700/30 hover:border-gray-600/50'
                }
            `}
        >
            {/* Free Badge for Fixer */}
            {isFixer && (
                <div className="absolute -top-2 -right-2">
                    <Badge className="bg-green-500 text-white text-[10px] px-1.5">
                        FREE
                    </Badge>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                    <StatusBadge status={agent.status} />
                </div>
            </div>

            {/* Task Progress */}
            {agent.currentTask && (
                <div className="mb-3">
                    <p className="text-xs text-gray-400 truncate mb-1">
                        {agent.currentTask.description}
                    </p>
                    <div className="flex items-center gap-2">
                        <Progress value={agent.currentTask.progress} className="h-1 flex-1" />
                        <span className="text-xs text-gray-500">{agent.currentTask.progress}%</span>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-1">
                {agent.status === 'idle' && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs"
                        onClick={onDeploy}
                    >
                        <PlayIcon size={12} className="mr-1" />
                        Deploy
                    </Button>
                )}

                {agent.status === 'working' && (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-7 text-xs"
                            onClick={onPause}
                        >
                            <PauseIcon size={12} className="mr-1" />
                            Pause
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400 hover:text-red-300"
                            onClick={onCancel}
                        >
                            <StopIcon size={12} />
                        </Button>
                    </>
                )}

                {agent.status === 'paused' && (
                    <>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1 h-7 text-xs"
                            onClick={onResume}
                        >
                            <PlayIcon size={12} className="mr-1" />
                            Resume
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-red-400 hover:text-red-300"
                            onClick={onCancel}
                        >
                            <StopIcon size={12} />
                        </Button>
                    </>
                )}

                {(agent.status === 'success' || agent.status === 'error') && (
                    <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 h-7 text-xs"
                        onClick={onDeploy}
                    >
                        <PlayIcon size={12} className="mr-1" />
                        Run Again
                    </Button>
                )}
            </div>
        </motion.div>
    );
}

function StatusBadge({ status }: { status: AgentStatus }) {
    const configs: Record<AgentStatus, { color: string; icon: React.ReactNode; label: string }> = {
        idle: {
            color: 'text-gray-400',
            icon: null,
            label: 'Idle'
        },
        thinking: {
            color: 'text-blue-400',
            icon: <SparklesIcon size={12} className="animate-pulse" />,
            label: 'Thinking...'
        },
        working: {
            color: 'text-purple-400',
            icon: <LoadingIcon size={12} className="animate-spin" />,
            label: 'Working'
        },
        waiting: {
            color: 'text-yellow-400',
            icon: <ClockIcon size={12} />,
            label: 'Waiting'
        },
        success: {
            color: 'text-green-400',
            icon: <CheckCircleIcon size={12} />,
            label: 'Done'
        },
        error: {
            color: 'text-red-400',
            icon: <XCircleIcon size={12} />,
            label: 'Error'
        },
        paused: {
            color: 'text-orange-400',
            icon: <PauseIcon size={12} />,
            label: 'Paused'
        },
    };

    const config = configs[status];

    return (
        <span className={`flex items-center gap-1 text-xs ${config.color}`}>
            {config.icon}
            {config.label}
        </span>
    );
}

function LogEntry({ log, agents }: { log: any; agents: Agent[] }) {
    const agent = agents.find(a => a.id === log.agentId);

    const typeColors: Record<string, string> = {
        info: 'text-gray-400',
        success: 'text-green-400',
        error: 'text-red-400',
        warning: 'text-yellow-400',
        thought: 'text-blue-400',
    };

    return (
        <div className="flex items-start gap-2 text-xs">
            <span className="text-gray-600 w-16 shrink-0">
                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span>{agent?.icon || 'AI'}</span>
            <span className={typeColors[log.type] || 'text-gray-400'}>
                {log.message}
            </span>
        </div>
    );
}

