
import { useAgentStore } from '../../store/useAgentStore';
import { AGENTS, AgentType } from '../../lib/agent-types';
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Progress } from '../ui/progress';

export default function AgentProgress() {
    const { agents, activeAgent, globalStatus } = useAgentStore();
    const agentTypes = Object.keys(AGENTS) as AgentType[];

    const getIcon = (type: AgentType) => {
        const status = agents[type].status;

        if (status === 'completed') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        if (status === 'working') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
        if (status === 'failed') return <AlertCircle className="h-5 w-5 text-destructive" />;
        return <Circle className="h-5 w-5 text-muted-foreground" />;
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
