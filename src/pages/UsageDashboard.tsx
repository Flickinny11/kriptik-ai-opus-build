
import { useCostStore } from '../store/useCostStore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { ScrollArea } from '../components/ui/scroll-area';
import { CoinsIcon, TrendingUpIcon, AlertTriangleIcon, ZapIcon } from '../components/ui/icons';
import { cn } from '../lib/utils';

export default function UsageDashboard() {
    const { balance, usageHistory } = useCostStore();
    const percentUsed = (balance.totalUsedThisMonth / balance.limit) * 100;

    return (
        <div className="p-8 space-y-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">Usage & Billing</h1>
                <div className="text-sm text-muted-foreground">
                    Billing Cycle Resets: {new Date(balance.resetDate).toLocaleDateString()}
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
                        <CoinsIcon size={16} className="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{balance.available} Credits</div>
                        <p className="text-xs text-muted-foreground">
                            {balance.limit - balance.available} used this month
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
                        <TrendingUpIcon size={16} className="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{Math.round(percentUsed)}%</div>
                        <Progress value={percentUsed} className={cn("h-2 mt-2", percentUsed > 80 && "bg-red-100 [&>div]:bg-red-500")} />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projected Cost</CardTitle>
                        <ZapIcon size={16} className="text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">~{Math.round(balance.totalUsedThisMonth * 1.2)} Credits</div>
                        <p className="text-xs text-muted-foreground">
                            Based on current usage trends
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Usage History */}
            <Card className="flex-1">
                <CardHeader>
                    <CardTitle>Usage History</CardTitle>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                            {usageHistory.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    No usage history available yet.
                                </div>
                            ) : (
                                usageHistory.map((log) => (
                                    <div key={log.id} className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0">
                                        <div className="space-y-1">
                                            <div className="font-medium flex items-center gap-2">
                                                <span className="capitalize">{log.actionType}</span>
                                                <span className="text-xs text-muted-foreground font-normal">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-sm text-muted-foreground">{log.details}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-red-500">-{log.creditsUsed} credits</div>
                                            <div className="text-xs text-muted-foreground">Balance: {log.balanceAfter}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Alerts Configuration (Mock) */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangleIcon size={20} className="text-yellow-500" />
                        Usage Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="font-medium">50% Usage Warning</div>
                                <div className="text-sm text-muted-foreground">Get notified when you use half your credits</div>
                            </div>
                            <div className="h-6 w-11 bg-primary rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="font-medium">Low Balance Alert (10 credits)</div>
                                <div className="text-sm text-muted-foreground">Get notified when running low</div>
                            </div>
                            <div className="h-6 w-11 bg-primary rounded-full relative cursor-pointer">
                                <div className="absolute right-1 top-1 h-4 w-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
