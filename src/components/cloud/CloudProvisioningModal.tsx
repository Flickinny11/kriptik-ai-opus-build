/**
 * Cloud Provisioning Modal
 *
 * Unified interface for deploying to RunPod, AWS, or GCP
 * with pricing confirmation before deployment
 */

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import {
    Cloud,
    Cpu,
    Zap,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Server,
    Box,
    Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type CloudProvider = 'runpod' | 'aws' | 'gcp';
type ResourceType = 'serverless' | 'container' | 'gpu';

interface GPUOption {
    id: string;
    name: string;
    memoryGB: number;
    hourlyRate: number;
    provider: CloudProvider;
}

interface CostEstimate {
    hourly: number;
    daily: number;
    monthly: number;
    breakdown: Array<{ item: string; cost: number }>;
}

interface CloudProvisioningModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeploy: (config: DeploymentConfig) => Promise<void>;
    defaultConfig?: Partial<DeploymentConfig>;
}

interface DeploymentConfig {
    provider: CloudProvider;
    resourceType: ResourceType;
    name: string;
    region: string;
    gpu?: {
        type: string;
        count: number;
    };
    scaling?: {
        minReplicas: number;
        maxReplicas: number;
    };
    containerImage?: string;
}

const PROVIDERS = [
    {
        id: 'runpod' as CloudProvider,
        name: 'RunPod',
        description: 'Best for GPU workloads',
        icon: Zap,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        features: ['Cheapest GPUs', 'Serverless', 'Quick start'],
    },
    {
        id: 'aws' as CloudProvider,
        name: 'AWS',
        description: 'Enterprise scalability',
        icon: Cloud,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        features: ['Lambda', 'ECS', 'EC2 GPU'],
    },
    {
        id: 'gcp' as CloudProvider,
        name: 'Google Cloud',
        description: 'Cloud Run excellence',
        icon: Server,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        features: ['Cloud Run', 'GKE', 'GPU VMs'],
    },
];

const GPU_OPTIONS: GPUOption[] = [
    { id: 'nvidia-rtx-4090', name: 'RTX 4090', memoryGB: 24, hourlyRate: 0.74, provider: 'runpod' },
    { id: 'nvidia-a40', name: 'A40', memoryGB: 48, hourlyRate: 0.79, provider: 'runpod' },
    { id: 'nvidia-a100-40gb', name: 'A100 40GB', memoryGB: 40, hourlyRate: 1.19, provider: 'runpod' },
    { id: 'nvidia-a100-80gb', name: 'A100 80GB', memoryGB: 80, hourlyRate: 1.89, provider: 'runpod' },
    { id: 'nvidia-h100', name: 'H100', memoryGB: 80, hourlyRate: 3.89, provider: 'runpod' },
    { id: 'nvidia-t4', name: 'T4', memoryGB: 16, hourlyRate: 0.35, provider: 'gcp' },
];

const REGIONS: Record<CloudProvider, Array<{ id: string; name: string }>> = {
    runpod: [
        { id: 'US', name: 'United States' },
        { id: 'EU', name: 'Europe' },
    ],
    aws: [
        { id: 'us-east-1', name: 'US East (Virginia)' },
        { id: 'us-west-2', name: 'US West (Oregon)' },
        { id: 'eu-west-1', name: 'EU (Ireland)' },
    ],
    gcp: [
        { id: 'us-central1', name: 'Iowa' },
        { id: 'us-east1', name: 'South Carolina' },
        { id: 'europe-west1', name: 'Belgium' },
    ],
};

export default function CloudProvisioningModal({
    open,
    onOpenChange,
    onDeploy,
    defaultConfig,
}: CloudProvisioningModalProps) {
    const [step, setStep] = useState<'provider' | 'config' | 'confirm'>('provider');
    const [isDeploying, setIsDeploying] = useState(false);

    // Config state
    const [provider, setProvider] = useState<CloudProvider>(defaultConfig?.provider || 'runpod');
    const [resourceType, setResourceType] = useState<ResourceType>(defaultConfig?.resourceType || 'serverless');
    const [name, setName] = useState(defaultConfig?.name || '');
    const [region, setRegion] = useState(defaultConfig?.region || '');
    const [gpuType, setGpuType] = useState(defaultConfig?.gpu?.type || '');
    // GPU count - currently fixed to 1, setter unused but kept for future multi-GPU support
    const [gpuCount, _setGpuCount] = useState(defaultConfig?.gpu?.count || 1);
    const [minReplicas, setMinReplicas] = useState(defaultConfig?.scaling?.minReplicas || 0);
    const [maxReplicas, setMaxReplicas] = useState(defaultConfig?.scaling?.maxReplicas || 3);
    const [containerImage, setContainerImage] = useState(defaultConfig?.containerImage || '');

    // Cost estimate (simulated for now)
    const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);

    // Reset when modal opens
    useEffect(() => {
        if (open) {
            setStep('provider');
        }
    }, [open]);

    // Calculate cost estimate when config changes
    useEffect(() => {
        if (step === 'confirm') {
            calculateCost();
        }
    }, [step, provider, resourceType, gpuType, gpuCount, minReplicas]);

    const calculateCost = () => {
        let hourly = 0;
        const breakdown: CostEstimate['breakdown'] = [];

        if (resourceType === 'gpu' && gpuType) {
            const gpu = GPU_OPTIONS.find(g => g.id === gpuType);
            if (gpu) {
                const gpuCost = gpu.hourlyRate * gpuCount;
                hourly += gpuCost;
                breakdown.push({ item: `${gpu.name} x${gpuCount}`, cost: gpuCost });
            }
        }

        if (resourceType === 'serverless') {
            const baseCost = provider === 'runpod' ? 0.0002 : 0.00005;
            hourly += baseCost * 1000; // Per 1000 requests
            breakdown.push({ item: 'Serverless compute (est.)', cost: baseCost * 1000 });
        }

        if (resourceType === 'container') {
            const containerCost = 0.05 * (minReplicas || 1);
            hourly += containerCost;
            breakdown.push({ item: `Container (${minReplicas} replicas)`, cost: containerCost });
        }

        setCostEstimate({
            hourly,
            daily: hourly * 24,
            monthly: hourly * 24 * 30,
            breakdown,
        });
    };

    const handleDeploy = async () => {
        setIsDeploying(true);
        try {
            await onDeploy({
                provider,
                resourceType,
                name,
                region,
                gpu: gpuType ? { type: gpuType, count: gpuCount } : undefined,
                scaling: { minReplicas, maxReplicas },
                containerImage: containerImage || undefined,
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Deployment failed:', error);
        } finally {
            setIsDeploying(false);
        }
    };

    const renderProviderStep = () => (
        <div className="space-y-4">
            <DialogDescription>
                Choose your cloud provider for deployment
            </DialogDescription>

            <div className="grid grid-cols-3 gap-4">
                {PROVIDERS.map((p) => {
                    const Icon = p.icon;
                    const isSelected = provider === p.id;

                    return (
                        <Card
                            key={p.id}
                            className={cn(
                                "p-4 cursor-pointer transition-all hover:border-primary/50",
                                isSelected && "border-primary bg-primary/5 ring-1 ring-primary"
                            )}
                            onClick={() => setProvider(p.id)}
                        >
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className={cn("p-3 rounded-lg", p.bgColor)}>
                                    <Icon className={cn("h-6 w-6", p.color)} />
                                </div>
                                <div>
                                    <h3 className="font-semibold">{p.name}</h3>
                                    <p className="text-xs text-muted-foreground">{p.description}</p>
                                </div>
                                <div className="flex flex-wrap gap-1 justify-center">
                                    {p.features.map((f) => (
                                        <Badge key={f} variant="secondary" className="text-[10px]">
                                            {f}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={() => setStep('config')}>
                    Continue
                </Button>
            </div>
        </div>
    );

    const renderConfigStep = () => (
        <div className="space-y-6">
            <DialogDescription>
                Configure your deployment
            </DialogDescription>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Deployment Name</Label>
                    <Input
                        placeholder="my-deployment"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label>Region</Label>
                    <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                            {REGIONS[provider].map((r) => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Resource Type</Label>
                <div className="grid grid-cols-3 gap-2">
                    {[
                        { id: 'serverless', icon: Zap, label: 'Serverless' },
                        { id: 'container', icon: Box, label: 'Container' },
                        { id: 'gpu', icon: Cpu, label: 'GPU' },
                    ].map((rt) => {
                        const Icon = rt.icon;
                        return (
                            <Button
                                key={rt.id}
                                variant={resourceType === rt.id ? 'default' : 'outline'}
                                className="h-auto py-3 flex-col gap-1"
                                onClick={() => setResourceType(rt.id as ResourceType)}
                            >
                                <Icon className="h-4 w-4" />
                                <span className="text-xs">{rt.label}</span>
                            </Button>
                        );
                    })}
                </div>
            </div>

            {resourceType === 'gpu' && (
                <div className="space-y-2">
                    <Label>GPU Type</Label>
                    <Select value={gpuType} onValueChange={setGpuType}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select GPU" />
                        </SelectTrigger>
                        <SelectContent>
                            {GPU_OPTIONS.filter(g => g.provider === provider || provider === 'runpod').map((g) => (
                                <SelectItem key={g.id} value={g.id}>
                                    <div className="flex items-center justify-between w-full gap-4">
                                        <span>{g.name} ({g.memoryGB}GB)</span>
                                        <span className="text-muted-foreground">${g.hourlyRate}/hr</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {(resourceType === 'container' || resourceType === 'gpu') && (
                <div className="space-y-2">
                    <Label>Container Image (optional)</Label>
                    <Input
                        placeholder="docker.io/user/image:tag"
                        value={containerImage}
                        onChange={(e) => setContainerImage(e.target.value)}
                    />
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Min Replicas</Label>
                    <Input
                        type="number"
                        min={0}
                        max={10}
                        value={minReplicas}
                        onChange={(e) => setMinReplicas(parseInt(e.target.value) || 0)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Max Replicas</Label>
                    <Input
                        type="number"
                        min={1}
                        max={100}
                        value={maxReplicas}
                        onChange={(e) => setMaxReplicas(parseInt(e.target.value) || 1)}
                    />
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('provider')}>
                    Back
                </Button>
                <Button onClick={() => setStep('confirm')} disabled={!name || !region}>
                    Review & Deploy
                </Button>
            </div>
        </div>
    );

    const renderConfirmStep = () => (
        <div className="space-y-6">
            <DialogDescription>
                Review your deployment and confirm pricing
            </DialogDescription>

            <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Provider</span>
                    <Badge>{provider.toUpperCase()}</Badge>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="font-medium">{name}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Region</span>
                    <span>{region}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span className="capitalize">{resourceType}</span>
                </div>
                {gpuType && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">GPU</span>
                        <span>{GPU_OPTIONS.find(g => g.id === gpuType)?.name} x{gpuCount}</span>
                    </div>
                )}
            </Card>

            {costEstimate && (
                <Card className="p-4 border-primary/50 bg-primary/5">
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold">Cost Estimate</h4>
                    </div>

                    <div className="space-y-2 mb-4">
                        {costEstimate.breakdown.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                                <span className="text-muted-foreground">{item.item}</span>
                                <span>${item.cost.toFixed(4)}/hr</span>
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-border pt-4 space-y-2">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Hourly</span>
                            <span className="font-semibold">${costEstimate.hourly.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Daily (estimated)</span>
                            <span>${costEstimate.daily.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-lg">
                            <span className="font-medium">Monthly (estimated)</span>
                            <span className="font-bold text-primary">${costEstimate.monthly.toFixed(2)}</span>
                        </div>
                    </div>
                </Card>
            )}

            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    By deploying, you confirm that you understand and accept the estimated costs.
                    Actual costs may vary based on usage.
                </p>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep('config')}>
                    Back
                </Button>
                <Button
                    onClick={handleDeploy}
                    disabled={isDeploying}
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isDeploying ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deploying...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Confirm & Deploy
                        </>
                    )}
                </Button>
            </div>
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        Cloud Provisioning
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-4">
                    {/* Progress indicator */}
                    <div className="flex items-center justify-center gap-2 mb-6">
                        {['provider', 'config', 'confirm'].map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                                    step === s
                                        ? "bg-primary text-primary-foreground"
                                        : ['provider', 'config', 'confirm'].indexOf(step) > i
                                            ? "bg-green-500 text-white"
                                            : "bg-muted text-muted-foreground"
                                )}>
                                    {['provider', 'config', 'confirm'].indexOf(step) > i ? (
                                        <CheckCircle2 className="h-4 w-4" />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                {i < 2 && (
                                    <div className={cn(
                                        "w-12 h-0.5",
                                        ['provider', 'config', 'confirm'].indexOf(step) > i
                                            ? "bg-green-500"
                                            : "bg-muted"
                                    )} />
                                )}
                            </div>
                        ))}
                    </div>

                    {step === 'provider' && renderProviderStep()}
                    {step === 'config' && renderConfigStep()}
                    {step === 'confirm' && renderConfirmStep()}
                </div>
            </DialogContent>
        </Dialog>
    );
}

