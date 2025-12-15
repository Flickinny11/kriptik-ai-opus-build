import { useDeploymentStore } from '../../store/useDeploymentStore';
import { Button } from '../ui/button';
import { CopyIcon, RefreshIcon, SettingsIcon, CheckCircleIcon } from '../ui/icons';
import { Card } from '../ui/card';
import { useToast } from '../ui/use-toast';

// Custom icon component
interface IconProps {
    size?: number;
    className?: string;
}

const ExternalLinkIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function DeploymentSuccess() {
    const { currentUrl, reset } = useDeploymentStore();
    const { toast } = useToast();

    const copyUrl = () => {
        if (currentUrl) {
            navigator.clipboard.writeText(currentUrl);
            toast({
                title: "Copied!",
                description: "URL copied to clipboard",
            });
        }
    };

    return (
        <div className="space-y-6 text-center">
            <div className="flex flex-col items-center gap-4 py-6">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircleIcon size={32} className="text-green-600" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold">Deployment Successful!</h2>
                    <p className="text-muted-foreground">Your app is now live and ready to share.</p>
                </div>
            </div>

            <Card className="p-4 bg-muted/50 flex items-center justify-between gap-4">
                <code className="text-sm font-mono text-primary truncate flex-1 text-left">
                    {currentUrl}
                </code>
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={copyUrl}>
                        <CopyIcon size={16} />
                    </Button>
                    <Button size="icon" asChild>
                        <a href={currentUrl || '#'} target="_blank" rel="noopener noreferrer">
                            <ExternalLinkIcon size={16} />
                        </a>
                    </Button>
                </div>
            </Card>

            <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="text-muted-foreground mb-1">Build Time</div>
                    <div className="font-semibold">2m 34s</div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="text-muted-foreground mb-1">Load Time</div>
                    <div className="font-semibold">892ms</div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="text-muted-foreground mb-1">Score</div>
                    <div className="font-semibold text-green-600">98/100</div>
                </div>
            </div>

            <div className="flex gap-3 justify-center pt-4">
                <Button variant="outline" onClick={reset}>
                    <RefreshIcon size={16} className="mr-2" />
                    Redeploy
                </Button>
                <Button variant="outline">
                    <SettingsIcon size={16} className="mr-2" />
                    Settings
                </Button>
            </div>
        </div>
    );
}
