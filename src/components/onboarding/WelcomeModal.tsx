import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { Sparkles, Rocket, Code, Zap } from 'lucide-react';

export default function WelcomeModal() {
    const { isWelcomeModalOpen, setWelcomeModalOpen, setTutorialActive, completeOnboarding } = useOnboardingStore();

    const handleStartTutorial = () => {
        setWelcomeModalOpen(false);
        setTutorialActive(true);
    };

    const handleSkip = () => {
        setWelcomeModalOpen(false);
        completeOnboarding();
    };

    return (
        <Dialog open={isWelcomeModalOpen} onOpenChange={setWelcomeModalOpen}>
            <DialogContent className="sm:max-w-[550px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl text-center">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                            Welcome to KripTik AI! ✨
                        </span>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <p className="text-center text-muted-foreground">
                        Build production-ready apps in minutes, not weeks. No coding experience needed.
                    </p>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-sm">AI-Powered Generation</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Describe your app in plain English and let our AI build it for you.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Code className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-sm">Full Code Control</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Edit code directly with our Monaco editor or let AI make changes.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Rocket className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-sm">One-Click Deploy</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Deploy to Cloud Run, Vercel, or Netlify with a single click.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                            <Zap className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-semibold text-sm">15+ Free Templates</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Start with professional templates and customize them to your needs.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-center">
                        <p className="text-sm font-medium">
                            We'll guide you through creating your first app in 3 simple steps.
                        </p>
                    </div>
                </div>

                <DialogFooter className="sm:justify-between">
                    <Button variant="ghost" onClick={handleSkip}>
                        Skip to Dashboard
                    </Button>
                    <Button onClick={handleStartTutorial} className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        Start Tutorial
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
