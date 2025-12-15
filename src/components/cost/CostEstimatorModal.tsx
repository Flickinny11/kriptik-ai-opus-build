
import { useCostStore } from '../../store/useCostStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { CoinsIcon, AlertTriangleIcon, ArrowRightIcon } from '../ui/icons';
import { cn } from '../../lib/utils';

interface CostEstimatorModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export default function CostEstimatorModal({ open, onOpenChange, onConfirm }: CostEstimatorModalProps) {
    const { currentEstimate, balance } = useCostStore();

    if (!currentEstimate) return null;

    const projectedBalance = balance.available - currentEstimate.totalCredits;
    const isLowBalance = projectedBalance < 10;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CoinsIcon size={20} className="text-yellow-500" />
                        Estimated Cost
                    </DialogTitle>
                    <DialogDescription>
                        Review the estimated credit usage for this generation.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Main Estimate Card */}
                    <div className="bg-muted/50 p-4 rounded-lg border border-border space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-muted-foreground">Complexity</span>
                            <span className={cn(
                                "text-sm font-bold px-2 py-0.5 rounded-full",
                                currentEstimate.complexity === 'High' ? "bg-red-500/10 text-red-500" :
                                    currentEstimate.complexity === 'Medium' ? "bg-yellow-500/10 text-yellow-500" :
                                        "bg-green-500/10 text-green-500"
                            )}>
                                {currentEstimate.complexity}
                            </span>
                        </div>

                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <span className="text-sm text-muted-foreground">Estimated Credits</span>
                                <div className="text-3xl font-bold text-primary">{currentEstimate.totalCredits}</div>
                            </div>
                            <div className="text-right space-y-1">
                                <span className="text-xs text-muted-foreground">Confidence</span>
                                <div className="text-sm font-medium">{currentEstimate.confidence}%</div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground">Cost Drivers</div>
                            <div className="flex flex-wrap gap-2">
                                {currentEstimate.costDrivers.map((driver, i) => (
                                    <div key={i} className="text-xs bg-background border border-border px-2 py-1 rounded">
                                        {driver}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Balance Impact */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span>Current Balance</span>
                            <span className="font-medium">{balance.available} credits</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>After Generation</span>
                            <span className={cn("font-bold", isLowBalance ? "text-red-500" : "text-primary")}>
                                ~{projectedBalance} credits
                            </span>
                        </div>
                        <Progress value={(projectedBalance / balance.limit) * 100} className="h-2" />
                        {isLowBalance && (
                            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-500/10 p-2 rounded">
                                <AlertTriangleIcon size={12} />
                                Low balance warning. Consider upgrading or simplifying scope.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Adjust Scope
                    </Button>
                    <Button onClick={onConfirm} className="gap-2">
                        Proceed <ArrowRightIcon size={16} />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
