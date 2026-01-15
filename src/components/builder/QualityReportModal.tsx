
import { useQualityStore } from '../../store/useQualityStore';
import { qualityScanner } from '../../lib/QualityScanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { ShieldIcon, CheckCircleIcon, ZapIcon, Code2Icon, LoadingIcon } from '../ui/icons';
import { cn } from '../../lib/utils';
import { ScanCategory } from '../../lib/quality-types';

interface QualityReportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function QualityReportModal({ open, onOpenChange }: QualityReportModalProps) {
    const { report, isScanning, isFixing, setIsFixing, resolveIssue } = useQualityStore();

    const handleFix = async (issueId: string) => {
        setIsFixing(issueId);
        await qualityScanner.fixIssue(issueId);
        resolveIssue(issueId);
        setIsFixing(null);
    };

    const getCategoryIcon = (category: ScanCategory) => {
        switch (category) {
            case 'security': return <ShieldIcon size={16} />;
            case 'quality': return <Code2Icon size={16} />;
            case 'testing': return <span>🐛</span>;
            case 'accessibility': return <span>♿</span>;
            case 'performance': return <ZapIcon size={16} />;
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-500';
        if (score >= 70) return 'text-yellow-500';
        return 'text-red-500';
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {isScanning ? (
                            <>
                                <LoadingIcon size={24} className="animate-spin" />
                                Scanning Project...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon size={24} />
                                Production Readiness Report
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {isScanning
                            ? "Analyzing your codebase for security, quality, and performance issues."
                            : "Review the health of your application before deploying to production."
                        }
                    </DialogDescription>
                </DialogHeader>

                {!isScanning && report && (
                    <div className="flex-1 overflow-hidden flex flex-col gap-6">
                        {/* Overall Score */}
                        <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg border border-border">
                            <div className="space-y-1">
                                <div className="text-sm font-medium text-muted-foreground">Overall Score</div>
                                <div className={cn("text-3xl font-bold", getScoreColor(report.overallScore))}>
                                    {report.overallScore}/100
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <div className="text-sm font-medium">Status</div>
                                    <Badge variant={report.status === 'ready' ? 'default' : 'destructive'}>
                                        {report.status === 'ready' ? 'READY FOR PRODUCTION' : 'NEEDS REVIEW'}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        {/* Categories Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {(Object.keys(report.categories) as ScanCategory[]).map((category) => {
                                const data = report.categories[category];
                                return (
                                    <div key={category} className="bg-card border border-border p-3 rounded-lg space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-sm font-medium capitalize">
                                                {getCategoryIcon(category)}
                                                {category}
                                            </div>
                                            <span className={cn("text-sm font-bold", getScoreColor(data.score))}>
                                                {data.score}%
                                            </span>
                                        </div>
                                        <Progress value={data.score} className="h-1.5" />
                                        <div className="text-xs text-muted-foreground">
                                            {data.issues.length} issues found
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Detailed Issues */}
                        <div className="flex-1 min-h-0 flex flex-col">
                            <h3 className="font-semibold mb-2">Critical Issues</h3>
                            <ScrollArea className="flex-1 border border-border rounded-lg bg-card">
                                <div className="divide-y divide-border">
                                    {Object.values(report.categories).flatMap(c => c.issues).map((issue) => (
                                        <div key={issue.id} className="p-4 hover:bg-muted/50 transition-colors">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant={issue.severity === 'critical' ? 'destructive' : 'secondary'} className="capitalize">
                                                            {issue.severity}
                                                        </Badge>
                                                        <span className="font-medium text-sm">{issue.message}</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{issue.description}</p>
                                                    {issue.file && (
                                                        <div className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded w-fit mt-2">
                                                            {issue.file}:{issue.line}
                                                        </div>
                                                    )}
                                                </div>

                                                {issue.fixAvailable && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleFix(issue.id)}
                                                        disabled={isFixing === issue.id}
                                                    >
                                                        {isFixing === issue.id ? (
                                                            <LoadingIcon size={12} className="animate-spin mr-2" />
                                                        ) : (
                                                            <ZapIcon size={12} className="mr-2" />
                                                        )}
                                                        {isFixing === issue.id ? 'Fixing...' : 'Auto-Fix'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {Object.values(report.categories).every(c => c.issues.length === 0) && (
                                        <div className="p-8 text-center text-muted-foreground">
                                            <CheckCircleIcon size={32} className="mx-auto mb-2" />
                                            <p>No issues found! Great job.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
