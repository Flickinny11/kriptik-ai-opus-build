import { useDeploymentStore, DeploymentProvider } from '../../store/useDeploymentStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { CloudIcon, ZapIcon, GlobeIcon } from '../ui/icons';
import { Card } from '../ui/card';

// Custom icon components
interface IconProps {
    size?: number;
    className?: string;
}

const PlusIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const TrashIcon = ({ size = 24, className = '' }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

export default function DeploymentConfig() {
    const { config, setConfig, startDeployment } = useDeploymentStore();

    const handleProviderSelect = (provider: DeploymentProvider) => {
        setConfig({ provider });
    };

    const addEnvVar = () => {
        setConfig({
            envVars: [...config.envVars, { key: '', value: '' }]
        });
    };

    const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
        const newEnvVars = [...config.envVars];
        newEnvVars[index][field] = value;
        setConfig({ envVars: newEnvVars });
    };

    const removeEnvVar = (index: number) => {
        const newEnvVars = config.envVars.filter((_, i) => i !== index);
        setConfig({ envVars: newEnvVars });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <Label>Deployment Platform</Label>
                <div className="grid grid-cols-3 gap-4">
                    <Card
                        className={`p-4 cursor-pointer transition-all hover:border-primary ${config.provider === 'cloud-run' ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => handleProviderSelect('cloud-run')}
                    >
                        <div className="flex flex-col items-center gap-2 text-center">
                            <CloudIcon size={32} className="text-blue-500" />
                            <div className="font-semibold">Cloud Run</div>
                            <div className="text-xs text-muted-foreground">Recommended</div>
                        </div>
                    </Card>

                    <Card
                        className={`p-4 cursor-pointer transition-all hover:border-primary ${config.provider === 'vercel' ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => handleProviderSelect('vercel')}
                    >
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="h-8 w-8 flex items-center justify-center">
                                <svg viewBox="0 0 1155 1000" className="h-6 w-6 fill-current"><path d="M577.344 0L1154.69 1000H0L577.344 0Z" /></svg>
                            </div>
                            <div className="font-semibold">Vercel</div>
                            <div className="text-xs text-muted-foreground">Static Sites</div>
                        </div>
                    </Card>

                    <Card
                        className={`p-4 cursor-pointer transition-all hover:border-primary ${config.provider === 'netlify' ? 'border-primary bg-primary/5' : ''}`}
                        onClick={() => handleProviderSelect('netlify')}
                    >
                        <div className="flex flex-col items-center gap-2 text-center">
                            <GlobeIcon size={32} className="text-teal-500" />
                            <div className="font-semibold">Netlify</div>
                            <div className="text-xs text-muted-foreground">Jamstack</div>
                        </div>
                    </Card>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Project Name</Label>
                    <Input
                        value={config.projectName}
                        onChange={(e) => setConfig({ projectName: e.target.value })}
                        placeholder="my-awesome-app"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Region</Label>
                    <Input
                        value={config.region}
                        onChange={(e) => setConfig({ region: e.target.value })}
                        placeholder="us-central1"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Environment Variables</Label>
                    <Button variant="ghost" size="sm" onClick={addEnvVar} className="h-8">
                        <PlusIcon size={16} className="mr-1" /> Add
                    </Button>
                </div>
                <div className="space-y-2">
                    {config.envVars.map((env, index) => (
                        <div key={index} className="flex gap-2">
                            <Input
                                placeholder="KEY"
                                value={env.key}
                                onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                                className="flex-1"
                            />
                            <Input
                                placeholder="VALUE"
                                type="password"
                                value={env.value}
                                onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEnvVar(index)}
                                className="text-destructive hover:text-destructive"
                            >
                                <TrashIcon size={16} />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                    Estimated Cost: <span className="font-medium text-foreground">$5-10/month</span>
                </div>
                <Button onClick={startDeployment} className="gap-2">
                    <ZapIcon size={16} />
                    Deploy Now (2 credits)
                </Button>
            </div>
        </div>
    );
}
