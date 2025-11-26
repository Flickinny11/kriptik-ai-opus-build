import { useEffect, useRef } from 'react';
import { useDeploymentStore } from '../../store/useDeploymentStore';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Progress } from '../ui/progress';

export default function DeploymentStatus() {
    const { logs, status } = useDeploymentStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const getProgress = () => {
        if (status === 'success') return 100;
        if (status === 'error') return 100;
        // Simple heuristic based on log count
        return Math.min((logs.length / 6) * 100, 95);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Deploying to Cloud Run...</span>
                    <span className="text-muted-foreground">{Math.round(getProgress())}%</span>
                </div>
                <Progress value={getProgress()} className="h-2" />
            </div>

            <div className="border border-border rounded-lg bg-black/90 text-green-400 font-mono text-sm p-4 h-[300px] overflow-hidden flex flex-col">
                <ScrollArea className="flex-1">
                    <div className="space-y-2">
                        {logs.map((log) => (
                            <div key={log.id} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2">
                                <span className="text-muted-foreground opacity-50 select-none">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                                <div className="flex items-center gap-2">
                                    {log.type === 'info' && <Loader2 className="h-3 w-3 animate-spin" />}
                                    {log.type === 'success' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                    {log.type === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
                                    <span className={log.type === 'error' ? 'text-red-400' : ''}>
                                        {log.message}
                                    </span>
                                </div>
                            </div>
                        ))}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
            </div>

            <div className="text-center text-sm text-muted-foreground">
                Estimated time remaining: 30s
            </div>
        </div>
    );
}
