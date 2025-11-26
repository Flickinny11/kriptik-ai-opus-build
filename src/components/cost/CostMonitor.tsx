
import { useCostStore } from '../../store/useCostStore';
import { Progress } from '../ui/progress';
import { Coins, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function CostMonitor() {
    const { activeSessionCost, currentEstimate, balance } = useCostStore();

    if (!currentEstimate) return null;

    const percentUsed = (activeSessionCost / currentEstimate.totalCredits) * 100;
    const isOverBudget = activeSessionCost > currentEstimate.totalCredits;

    return (
        <div className="bg-card border border-border rounded-lg p-3 w-full max-w-[300px] shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Generation Cost
                </div>
                <div className="text-xs text-muted-foreground">
                    {activeSessionCost} / ~{currentEstimate.totalCredits} credits
                </div>
            </div>

            <Progress
                value={Math.min(percentUsed, 100)}
                className={cn("h-1.5 mb-2", isOverBudget && "bg-red-100 [&>div]:bg-red-500")}
            />

            <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Rate: 0.5/min</span>
                <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-muted-foreground" />
                    <span>{balance.available} remaining</span>
                </div>
            </div>
        </div>
    );
}
