import { useDeploymentStore, DeploymentProvider } from '../../store/useDeploymentStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Cloud, Zap, Globe, Plus, Trash2 } from 'lucide-react';
import { Card } from '../ui/card';

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
                            <Cloud className="h-8 w-8 text-blue-500" />
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
                            <Globe className="h-8 w-8 text-teal-500" />
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
                        <Plus className="h-4 w-4 mr-1" /> Add
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
                                <Trash2 className="h-4 w-4" />
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
                    <Zap className="h-4 w-4" />
                    Deploy Now (2 credits)
                </Button>
            </div>
        </div>
    );
}
