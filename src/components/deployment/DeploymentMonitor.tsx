/**
 * Deployment Monitor Component
 *
 * Real-time deployment status, cost tracking, and monitoring dashboard.
 * Shows live progress for AI model deployments to GPU cloud platforms.
 */

import { useState, useEffect } from 'react';
import {
    Activity,
    Cloud,
    DollarSign,
    ExternalLink,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    Zap,
    Server,
    RefreshCw,
    Pause,
    Play,
    Trash2,
    Copy,
    Terminal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrandIcon } from '@/components/icons';
import { useToast } from '@/components/ui/use-toast';

// ============================================================================
// TYPES
// ============================================================================

export interface Deployment {
    id: string;
    name: string;
    provider: string;
    modelId?: string;
    status: 'pending' | 'building' | 'deploying' | 'running' | 'stopped' | 'failed';
    endpoint?: string;
    createdAt: Date;
    updatedAt: Date;
    costPerHour?: number;
    totalCost?: number;
    gpuType?: string;
    region?: string;
    logs?: string[];
    metrics?: {
        requests: number;
        avgLatency: number;
        errorRate: number;
        uptime: number;
    };
}

export interface DeploymentStep {
    id: string;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    message?: string;
    duration?: number;
}

interface DeploymentMonitorProps {
    deployments: Deployment[];
    activeDeployment?: Deployment;
    steps?: DeploymentStep[];
    onRefresh?: () => void;
    onStop?: (id: string) => void;
    onStart?: (id: string) => void;
    onDelete?: (id: string) => void;
}

// ============================================================================
// STATUS HELPERS
// ============================================================================

const STATUS_CONFIG = {
    pending: {
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        icon: Clock,
        label: 'Pending',
    },
    building: {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: Loader2,
        label: 'Building',
    },
    deploying: {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: Loader2,
        label: 'Deploying',
    },
    running: {
        color: 'text-green-400',
        bg: 'bg-green-500/10',
        border: 'border-green-500/20',
        icon: CheckCircle2,
        label: 'Running',
    },
    stopped: {
        color: 'text-gray-400',
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        icon: Pause,
        label: 'Stopped',
    },
    failed: {
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: XCircle,
        label: 'Failed',
    },
};

const PROVIDER_ICONS: Record<string, string> = {
    runpod: 'runpod',
    replicate: 'replicate',
    modal: 'modal',
    fal: 'fal',
    huggingface: 'huggingface',
    vercel: 'vercel',
    netlify: 'netlify',
    aws: 'aws',
    gcp: 'gcp',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DeploymentMonitor({
    deployments,
    activeDeployment,
    steps,
    onRefresh,
    onStop,
    onStart,
    onDelete,
}: DeploymentMonitorProps) {
    const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(
        activeDeployment || deployments[0] || null
    );
    const [showLogs, setShowLogs] = useState(false);
    const { toast } = useToast();

    // Update selected deployment when activeDeployment changes
    useEffect(() => {
        if (activeDeployment) {
            setSelectedDeployment(activeDeployment);
        }
    }, [activeDeployment]);

    const copyEndpoint = (endpoint: string) => {
        navigator.clipboard.writeText(endpoint);
        toast({
            title: 'Copied!',
            description: 'Endpoint URL copied to clipboard',
        });
    };

    const totalCost = deployments.reduce((sum, d) => sum + (d.totalCost || 0), 0);
    const runningCount = deployments.filter(d => d.status === 'running').length;

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
            {/* Header Stats */}
            <div className="p-6 border-b border-gray-800/50">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Activity className="w-6 h-6 text-amber-400" />
                            Deployments
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Monitor and manage your AI model deployments
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        className="border-gray-700"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-4">
                    <StatCard
                        icon={Server}
                        label="Active Deployments"
                        value={runningCount.toString()}
                        color="green"
                    />
                    <StatCard
                        icon={Cloud}
                        label="Total Deployments"
                        value={deployments.length.toString()}
                        color="blue"
                    />
                    <StatCard
                        icon={DollarSign}
                        label="Total Cost"
                        value={`$${totalCost.toFixed(2)}`}
                        color="amber"
                    />
                    <StatCard
                        icon={Zap}
                        label="Avg. Latency"
                        value={selectedDeployment?.metrics?.avgLatency
                            ? `${selectedDeployment.metrics.avgLatency}ms`
                            : 'N/A'}
                        color="purple"
                    />
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Deployments List */}
                <div className="w-80 border-r border-gray-800/50 flex flex-col">
                    <div className="p-4 border-b border-gray-800/50">
                        <h3 className="text-sm font-medium text-gray-300">All Deployments</h3>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-2">
                            {deployments.map(deployment => (
                                <DeploymentListItem
                                    key={deployment.id}
                                    deployment={deployment}
                                    selected={selectedDeployment?.id === deployment.id}
                                    onClick={() => setSelectedDeployment(deployment)}
                                />
                            ))}

                            {deployments.length === 0 && (
                                <div className="text-center py-8">
                                    <Cloud className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-500 text-sm">No deployments yet</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* Deployment Details */}
                <div className="flex-1 overflow-hidden">
                    {selectedDeployment ? (
                        <DeploymentDetails
                            deployment={selectedDeployment}
                            steps={steps}
                            showLogs={showLogs}
                            onToggleLogs={() => setShowLogs(!showLogs)}
                            onCopyEndpoint={copyEndpoint}
                            onStop={onStop}
                            onStart={onStart}
                            onDelete={onDelete}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <Server className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                <p className="text-gray-400">Select a deployment to view details</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: React.ElementType;
    label: string;
    value: string;
    color: 'green' | 'blue' | 'amber' | 'purple';
}) {
    const colorClasses = {
        green: 'text-green-400 bg-green-500/10 border-green-500/20',
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    };

    return (
        <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
            <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${colorClasses[color].split(' ')[0]}`} />
                <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-lg font-bold text-white">{value}</p>
                </div>
            </div>
        </div>
    );
}

function DeploymentListItem({
    deployment,
    selected,
    onClick,
}: {
    deployment: Deployment;
    selected: boolean;
    onClick: () => void;
}) {
    const status = STATUS_CONFIG[deployment.status];
    const StatusIcon = status.icon;

    return (
        <button
            onClick={onClick}
            className={`w-full p-3 rounded-lg text-left transition-all ${
                selected
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : 'bg-gray-800/30 border border-gray-700/50 hover:border-gray-600'
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                    <BrandIcon
                        name={PROVIDER_ICONS[deployment.provider] || 'cloud'}
                        size={18}
                        className="text-white"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm truncate">
                            {deployment.name}
                        </span>
                        <Badge className={`${status.bg} ${status.color} ${status.border} text-[10px]`}>
                            <StatusIcon className={`w-3 h-3 mr-1 ${
                                deployment.status === 'building' || deployment.status === 'deploying'
                                    ? 'animate-spin'
                                    : ''
                            }`} />
                            {status.label}
                        </Badge>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-1">
                        {deployment.modelId || deployment.provider}
                    </p>
                    {deployment.costPerHour && (
                        <p className="text-xs text-amber-400 mt-1">
                            ${deployment.costPerHour.toFixed(2)}/hr
                        </p>
                    )}
                </div>
            </div>
        </button>
    );
}

function DeploymentDetails({
    deployment,
    steps,
    showLogs,
    onToggleLogs,
    onCopyEndpoint,
    onStop,
    onStart,
    onDelete,
}: {
    deployment: Deployment;
    steps?: DeploymentStep[];
    showLogs: boolean;
    onToggleLogs: () => void;
    onCopyEndpoint: (url: string) => void;
    onStop?: (id: string) => void;
    onStart?: (id: string) => void;
    onDelete?: (id: string) => void;
}) {
    const status = STATUS_CONFIG[deployment.status];
    const StatusIcon = status.icon;

    return (
        <ScrollArea className="h-full">
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-gray-800/50 border border-gray-700/50 flex items-center justify-center">
                            <BrandIcon
                                name={PROVIDER_ICONS[deployment.provider] || 'cloud'}
                                size={32}
                                className="text-white"
                            />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                {deployment.name}
                                <Badge className={`${status.bg} ${status.color} ${status.border}`}>
                                    <StatusIcon className={`w-3 h-3 mr-1 ${
                                        deployment.status === 'building' || deployment.status === 'deploying'
                                            ? 'animate-spin'
                                            : ''
                                    }`} />
                                    {status.label}
                                </Badge>
                            </h3>
                            <p className="text-gray-400 text-sm">
                                {deployment.provider} • {deployment.region || 'Global'}
                                {deployment.gpuType && ` • ${deployment.gpuType}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        {deployment.status === 'running' && onStop && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onStop(deployment.id)}
                                className="border-gray-700"
                            >
                                <Pause className="w-4 h-4 mr-1" />
                                Stop
                            </Button>
                        )}
                        {deployment.status === 'stopped' && onStart && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onStart(deployment.id)}
                                className="border-gray-700"
                            >
                                <Play className="w-4 h-4 mr-1" />
                                Start
                            </Button>
                        )}
                        {onDelete && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onDelete(deployment.id)}
                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Endpoint */}
                {deployment.endpoint && (
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                        <p className="text-xs text-gray-400 mb-2">Endpoint URL</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-gray-900 px-3 py-2 rounded-lg text-sm text-green-400 font-mono truncate">
                                {deployment.endpoint}
                            </code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onCopyEndpoint(deployment.endpoint!)}
                                className="border-gray-600"
                            >
                                <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(deployment.endpoint, '_blank')}
                                className="border-gray-600"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                )}

                {/* Deployment Steps */}
                {steps && steps.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-gray-300">Deployment Progress</h4>
                        <div className="space-y-2">
                            {steps.map((step, index) => (
                                <DeploymentStepItem
                                    key={step.id}
                                    step={step}
                                    isLast={index === steps.length - 1}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Metrics */}
                {deployment.status === 'running' && deployment.metrics && (
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-gray-800/30 border-gray-700/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-400">
                                    Requests
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-white">
                                    {deployment.metrics.requests.toLocaleString()}
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gray-800/30 border-gray-700/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-400">
                                    Avg Latency
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-white">
                                    {deployment.metrics.avgLatency}ms
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gray-800/30 border-gray-700/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-400">
                                    Error Rate
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className={`text-2xl font-bold ${
                                    deployment.metrics.errorRate > 5 ? 'text-red-400' : 'text-green-400'
                                }`}>
                                    {deployment.metrics.errorRate}%
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-gray-800/30 border-gray-700/50">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-gray-400">
                                    Uptime
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-2xl font-bold text-green-400">
                                    {deployment.metrics.uptime}%
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Cost Tracking */}
                {(deployment.costPerHour || deployment.totalCost) && (
                    <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-amber-400 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Cost Tracking
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-400">Cost per Hour</p>
                                <p className="text-xl font-bold text-white">
                                    ${deployment.costPerHour?.toFixed(3) || '0.00'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">Total Cost</p>
                                <p className="text-xl font-bold text-amber-400">
                                    ${deployment.totalCost?.toFixed(2) || '0.00'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Logs Toggle */}
                <Button
                    variant="outline"
                    onClick={onToggleLogs}
                    className="w-full border-gray-700"
                >
                    <Terminal className="w-4 h-4 mr-2" />
                    {showLogs ? 'Hide Logs' : 'Show Logs'}
                </Button>

                {/* Logs */}
                {showLogs && deployment.logs && (
                    <div className="bg-gray-900 rounded-xl p-4 font-mono text-xs">
                        <ScrollArea className="h-64">
                            {deployment.logs.map((log, i) => (
                                <div key={i} className="text-gray-300 py-0.5">
                                    {log}
                                </div>
                            ))}
                        </ScrollArea>
                    </div>
                )}
            </div>
        </ScrollArea>
    );
}

function DeploymentStepItem({
    step,
    isLast,
}: {
    step: DeploymentStep;
    isLast: boolean;
}) {
    const getStepIcon = () => {
        switch (step.status) {
            case 'completed':
                return <CheckCircle2 className="w-5 h-5 text-green-400" />;
            case 'in_progress':
                return <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />;
            case 'failed':
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return <div className="w-5 h-5 rounded-full border-2 border-gray-600" />;
        }
    };

    return (
        <div className="flex items-start gap-3">
            <div className="flex flex-col items-center">
                {getStepIcon()}
                {!isLast && (
                    <div className={`w-0.5 h-8 ${
                        step.status === 'completed' ? 'bg-green-500/50' : 'bg-gray-700'
                    }`} />
                )}
            </div>
            <div className="flex-1 pb-4">
                <p className={`font-medium ${
                    step.status === 'completed' ? 'text-green-400' :
                    step.status === 'in_progress' ? 'text-amber-400' :
                    step.status === 'failed' ? 'text-red-400' :
                    'text-gray-400'
                }`}>
                    {step.name}
                </p>
                {step.message && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.message}</p>
                )}
                {step.duration && step.status === 'completed' && (
                    <p className="text-xs text-gray-500 mt-0.5">{step.duration}s</p>
                )}
            </div>
        </div>
    );
}

