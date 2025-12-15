import { useEffect, useRef } from 'react';
import { useAgentStore } from '../../store/useAgentStore';
import { ScrollArea } from '../ui/scroll-area';
import { CodeIcon, BrainIcon, CheckIcon, InfoIcon, WarningIcon, XCircleIcon } from '../ui/icons';
import { cn } from '../../lib/utils';

export default function AgentTerminal() {
    const { logs } = useAgentStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const getLogIcon = (type: string) => {
        switch (type) {
            case 'thought': return <BrainIcon size={12} className="text-purple-400" />;
            case 'success': return <CheckIcon size={12} className="text-green-400" />;
            case 'error': return <XCircleIcon size={12} className="text-red-400" />;
            case 'warning': return <WarningIcon size={12} className="text-yellow-400" />;
            default: return <InfoIcon size={12} className="text-blue-400" />;
        }
    };

    return (
        <div className="flex flex-col h-full bg-black text-green-400 font-mono text-xs rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                <CodeIcon size={12} />
                <span className="font-semibold">Agent Logs</span>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                    {logs.length === 0 && (
                        <div className="text-zinc-500 italic">Waiting for input...</div>
                    )}

                    {logs.map((log) => (
                        <div key={log.id} className="flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                            <span className="text-zinc-500 shrink-0">
                                [{log.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                            </span>
                            <div className="mt-0.5 shrink-0">
                                {getLogIcon(log.type)}
                            </div>
                            <div className={cn(
                                "break-all",
                                log.type === 'thought' && "text-purple-300 italic",
                                log.type === 'error' && "text-red-400 font-bold",
                                log.type === 'success' && "text-green-400 font-bold"
                            )}>
                                <span className="font-bold mr-2 text-zinc-400">
                                    [{log.agentType.toUpperCase()}]:
                                </span>
                                {log.message}
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </div>
            </ScrollArea>
        </div>
    );
}
