import { Dialog, DialogContent } from '../ui/dialog';
import { Button } from '../ui/button';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { useTemplateStore } from '../../store/useTemplateStore';
import { useState } from 'react';
import { Sparkles, ArrowRight, LayoutTemplate, MessageSquare, Rocket } from 'lucide-react';

const TUTORIAL_STEPS = [
    {
        title: 'Welcome to KripTik AI!',
        description: 'Let me show you around. This will only take a minute.',
        highlight: null,
        action: 'Next'
    },
    {
        title: 'Browse Templates',
        description: 'Start fast with our 15+ professional templates. Click the "Browse Templates" button to see them!',
        highlight: 'browse-templates',
        action: 'Show me templates'
    },
    {
        title: 'Create a New Project',
        description: 'Or create a custom project from scratch. Just describe what you want to build and our AI will generate it for you!',
        highlight: 'new-project',
        action: 'Got it!'
    },
    {
        title: 'You\'re all set!',
        description: 'That\'s it! You\'re ready to start building. Choose a template or create a new project to get started.',
        highlight: null,
        action: 'Start Building'
    }
];

export default function InteractiveTutorial() {
    const { isTutorialActive, setTutorialActive, completeOnboarding } = useOnboardingStore();
    const { setGalleryOpen } = useTemplateStore();
    const [currentStep, setCurrentStep] = useState(0);

    const currentStepData = TUTORIAL_STEPS[currentStep];

    const handleNext = () => {
        if (currentStep === 1) {
            // Show templates
            setGalleryOpen(true);
            setTutorialActive(false);
            completeOnboarding();
        } else if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finish tutorial
            setTutorialActive(false);
            completeOnboarding();
        }
    };

    const handleSkip = () => {
        setTutorialActive(false);
        completeOnboarding();
    };

    if (!isTutorialActive) return null;

    return (
        <>
            {/* Overlay with highlight */}
            <div className="fixed inset-0 bg-black/60 z-50 pointer-events-none">
                {currentStepData.highlight && (
                    <div
                        className="absolute animate-pulse"
                        style={{
                            // Position based on highlighted element
                            ...(currentStepData.highlight === 'browse-templates' && {
                                top: '1rem',
                                right: '14rem',
                                width: '180px',
                                height: '40px'
                            }),
                            ...(currentStepData.highlight === 'new-project' && {
                                top: '1rem',
                                right: '1rem',
                                width: '160px',
                                height: '40px'
                            })
                        }}
                    >
                        <div className="w-full h-full rounded-lg border-4 border-primary shadow-lg shadow-primary/50" />
                        {/* Animated cursor pointer */}
                        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                            <ArrowRight className="h-8 w-8 text-primary rotate-90" />
                        </div>
                    </div>
                )}
            </div>

            {/* Tutorial Dialog */}
            <Dialog open={isTutorialActive} onOpenChange={setTutorialActive}>
                <DialogContent className="sm:max-w-[500px] z-[60] pointer-events-auto">
                    <div className="space-y-6 py-4">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                {currentStep === 0 && <Sparkles className="h-6 w-6 text-primary" />}
                                {currentStep === 1 && <LayoutTemplate className="h-6 w-6 text-primary" />}
                                {currentStep === 2 && <MessageSquare className="h-6 w-6 text-primary" />}
                                {currentStep === 3 && <Rocket className="h-6 w-6 text-primary" />}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-semibold mb-2">{currentStepData.title}</h3>
                                <p className="text-muted-foreground">{currentStepData.description}</p>
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="flex gap-2">
                            {TUTORIAL_STEPS.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 flex-1 rounded-full transition-colors ${idx <= currentStep ? 'bg-primary' : 'bg-muted'
                                        }`}
                                />
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-between">
                            <Button variant="ghost" onClick={handleSkip}>
                                Skip Tutorial
                            </Button>
                            <Button onClick={handleNext} className="gap-2">
                                {currentStepData.action}
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
