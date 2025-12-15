
import { useAgentStore } from '../../store/useAgentStore';
import { AGENTS, AgentType } from '../../lib/agent-types';
import { CheckIcon, LoadingIcon, ErrorIcon } from '../ui/icons';
import { cn } from '../../lib/utils';
import { Progress } from '../ui/progress';

export default function AgentProgress() {
    const { agents, activeAgent, globalStatus } = useAgentStore();
    const agentTypes = Object.keys(AGENTS) as AgentType[];

    const getIcon = (type: AgentType) => {
        const status = agents[type].status;

        if (status === 'completed') return <CheckIcon size={20} className="text-green-500" />;
        if (status === 'working') return <LoadingIcon size={20} className="text-primary" />;
        if (status === 'failed') return <ErrorIcon size={20} className="text-destructive" />;
        return (
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
        );
    };

    return (
        <div className="space-y-6 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                    Generation Progress
                </h3>
                <span className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium",
                    globalStatus === 'running' && "bg-primary/10 text-primary",
                    globalStatus === 'completed' && "bg-green-500/10 text-green-500",
                    globalStatus === 'failed' && "bg-destructive/10 text-destructive",
                    globalStatus === 'idle' && "bg-muted text-muted-foreground"
                )}>
                    {globalStatus.toUpperCase()}
                </span>
            </div>

            <div className="space-y-4">
                {agentTypes.map((type, index) => {
                    const agent = agents[type];
                    const isActive = activeAgent === type;
                    const isCompleted = agent.status === 'completed';

                    return (
                        <div key={type} className={cn(
                            "relative pl-8 transition-all duration-300",
                            isActive ? "opacity-100 scale-105" : "opacity-70"
                        )}>
                            {/* Connector Line */}
                            {index !== agentTypes.length - 1 && (
                                <div className={cn(
                                    "absolute left-[19px] top-8 w-0.5 h-8 transition-colors duration-500",
                                    isCompleted ? "bg-green-500" : "bg-border"
                                )} />
                            )}

                            <div className="absolute left-2 top-1">
                                {getIcon(type)}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className={cn(
                                        "font-medium text-sm",
                                        isActive && "text-primary",
                                        isCompleted && "text-green-500"
                                    )}>
                                        {AGENTS[type].name}
                                    </span>
                                    {isActive && (
                                        <span className="text-xs text-muted-foreground animate-pulse">
                                            {agent.progress}%
                                        </span>
                                    )}
                                </div>

                                {isActive && (
                                    <Progress value={agent.progress} className="h-1.5" />
                                )}

                                <p className="text-xs text-muted-foreground line-clamp-1">
                                    {AGENTS[type].description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
