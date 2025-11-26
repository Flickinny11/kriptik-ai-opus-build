import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { useIntegrationStore } from '../../store/useIntegrationStore';
import { Loader2, CheckCircle } from 'lucide-react';

export default function IntegrationSetupModal() {
    const { activeIntegration, setActiveIntegration, integrations, installIntegration } = useIntegrationStore();
    const [step, setStep] = useState<'config' | 'installing' | 'success'>('config');
    const [config, setConfig] = useState<any>({});

    const integration = integrations.find(i => i.id === activeIntegration);

    if (!integration) return null;

    const handleInstall = async () => {
        setStep('installing');
        await installIntegration(integration.id, config);
        setStep('success');
        setTimeout(() => {
            setActiveIntegration(null);
            setStep('config');
            setConfig({});
        }, 1500);
    };

    return (
        <Dialog open={!!activeIntegration} onOpenChange={(open) => !open && setActiveIntegration(null)}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {step === 'installing' ? 'Installing' : step === 'success' ? 'Installed' : 'Configure'} {integration.name}
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4">
                    {step === 'config' && (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">{integration.description}</p>

                            {/* Dynamic Config Fields based on ID */}
                            {integration.id === 'stripe' && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Publishable Key</Label>
                                        <Input placeholder="pk_test_..." onChange={e => setConfig({ ...config, pubKey: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Secret Key</Label>
                                        <Input type="password" placeholder="sk_test_..." onChange={e => setConfig({ ...config, secretKey: e.target.value })} />
                                    </div>
                                </>
                            )}

                            {integration.id === 'supabase' && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Project URL</Label>
                                        <Input placeholder="https://..." onChange={e => setConfig({ ...config, url: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Anon Key</Label>
                                        <Input type="password" placeholder="eyJ..." onChange={e => setConfig({ ...config, key: e.target.value })} />
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <Label>Features</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {integration.features.map(feature => (
                                        <div key={feature} className="flex items-center space-x-2">
                                            <Checkbox id={feature} defaultChecked />
                                            <label htmlFor={feature} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                                {feature}
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'installing' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Generating code and configuring services...</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col items-center justify-center py-8 space-y-4">
                            <CheckCircle className="h-8 w-8 text-green-500" />
                            <p className="text-sm font-medium">Integration installed successfully!</p>
                        </div>
                    )}
                </div>

                {step === 'config' && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setActiveIntegration(null)}>Cancel</Button>
                        <Button onClick={handleInstall}>Install Integration</Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
