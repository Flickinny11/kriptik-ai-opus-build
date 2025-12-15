
import { useCostStore } from '../../store/useCostStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { LightbulbIcon, CheckCircle2Icon } from '../ui/icons';

interface CostBreakdownModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function CostBreakdownModal({ open, onOpenChange }: CostBreakdownModalProps) {
    const { lastBreakdown, balance } = useCostStore();

    if (!lastBreakdown) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle2Icon size={20} className="text-green-500" />
                        Generation Complete
                    </DialogTitle>
                    <DialogDescription>
                        Here is the cost breakdown for this session.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Total Cost */}
                    <div className="text-center space-y-1">
                        <div className="text-4xl font-bold text-primary">{lastBreakdown.totalUsed}</div>
                        <div className="text-sm text-muted-foreground">Total Credits Used</div>
                    </div>

                    {/* Agent Breakdown */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium border-b border-border pb-1">Agent Breakdown</h4>
                        <div className="space-y-2">
                            {Object.entries(lastBreakdown.agentBreakdown).map(([agent, cost]) => (
                                <div key={agent} className="flex justify-between text-sm">
                                    <span className="capitalize text-muted-foreground">{agent} Agent</span>
                                    <span className="font-medium">{cost} credits</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cost Drivers */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium border-b border-border pb-1">Cost Drivers</h4>
                        <div className="space-y-2">
                            {lastBreakdown.drivers.map((driver, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{driver.name}</span>
                                    <span className="font-medium">{driver.cost} credits</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Optimization Tips */}
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-500">
                            <LightbulbIcon size={16} />
                            Optimization Tips
                        </div>
                        <ul className="space-y-2">
                            {lastBreakdown.optimizationTips.map((tip, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                                    <span className="mt-1 h-1 w-1 rounded-full bg-blue-500 shrink-0" />
                                    {tip}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-muted-foreground">
                            New Balance: <span className="font-bold text-primary">{balance.available}</span>
                        </div>
                        <Button onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
