/**
 * Implementation Plan Component
 *
 * Displays the AI-generated implementation plan with phase options
 * for the user to customize before building begins.
 */

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    CheckIcon,
    ChevronDownIcon,
    CodeIcon,
    DatabaseIcon,
    ShieldIcon,
    ServerIcon,
    ZapIcon,
    LoadingIcon,
    ArrowRightIcon,
    AlertCircleIcon
} from '@/components/ui/icons';
import { apiClient } from '@/lib/api-client';

// Types
interface PlanOption {
    id: string;
    label: string;
    description: string;
    recommended?: boolean;
}

interface PlanPhase {
    id: string;
    title: string;
    description: string;
    icon: any;
    type: 'frontend' | 'backend';
    options: PlanOption[];
    selectedOption?: string;
    customValue?: string;
}

// Pre-generated plan from backend (when available)
interface PreGeneratedPlan {
    intentSummary: string;
    phases: Array<{
        id: string;
        title: string;
        description: string;
        icon: string;
        type: 'frontend' | 'backend';
        steps: Array<{
            id: string;
            description: string;
            type: string;
            estimatedTokens: number;
        }>;
        order: number;
        approved: boolean;
    }>;
    estimatedTokenUsage: number;
    estimatedCostUSD: number;
    parallelAgentsNeeded: number;
}

interface ImplementationPlanProps {
    prompt?: string;
    plan?: PreGeneratedPlan;
    onApprove: (plan: PlanPhase[] | unknown[]) => void;
    onCancel: () => void;
}

// Animated thinking indicator
function ThinkingAnimation({ stage }: { stage: string }) {
    const [dots, setDots] = useState('');

    useEffect(() => {
        const interval = setInterval(() => {
            setDots(prev => prev.length >= 3 ? '' : prev + '.');
        }, 400);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-3 text-amber-400">
            <div className="relative">
                <div className="absolute inset-0 bg-amber-400/20 rounded-full animate-ping" />
                <span className="text-xl">✨</span>
            </div>
            <span className="font-medium">
                {stage}{dots}
            </span>
        </div>
    );
}

// Phase option selector
function PhaseOption({
    option,
    isSelected,
    onSelect
}: {
    option: PlanOption;
    isSelected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            className={cn(
                "flex items-start gap-3 p-4 rounded-xl text-left w-full",
                "border-2 transition-all duration-200",
                isSelected
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
            )}
        >
            <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                isSelected ? "border-amber-500 bg-amber-500" : "border-slate-600"
            )}>
                {isSelected && <CheckIcon size={12} />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "font-medium",
                        isSelected ? "text-amber-400" : "text-white"
                    )}>
                        {option.label}
                    </span>
                    {option.recommended && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                            Recommended
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">{option.description}</p>
            </div>
        </button>
    );
}

// Phase card component
function PhaseCard({
    phase,
    isExpanded,
    onToggle,
    onOptionSelect,
    onCustomInput
}: {
    phase: PlanPhase;
    isExpanded: boolean;
    onToggle: () => void;
    onOptionSelect: (optionId: string) => void;
    onCustomInput: (value: string) => void;
}) {
    const [showCustomInput, setShowCustomInput] = useState(false);
    const Icon = phase.icon;

    return (
        <div className={cn(
            "rounded-2xl border overflow-hidden transition-all duration-300",
            phase.type === 'frontend'
                ? "border-cyan-500/30 bg-cyan-500/5"
                : "border-purple-500/30 bg-purple-500/5"
        )}>
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        phase.type === 'frontend'
                            ? "bg-cyan-500/20 text-cyan-400"
                            : "bg-purple-500/20 text-purple-400"
                    )}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">{phase.title}</h3>
                        <p className="text-sm text-slate-400">{phase.description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {phase.selectedOption && (
                        <span className="text-sm text-emerald-400 flex items-center gap-1">
                            <CheckIcon size={16} />
                            Selected
                        </span>
                    )}
                    <ChevronDownIcon size={20} className={cn(
                        "text-slate-400 transition-transform",
                        isExpanded && "rotate-180"
                    )} />
                </div>
            </button>

            {/* Options */}
            {isExpanded && (
                <div className="p-4 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid gap-2">
                        {phase.options.map((option) => (
                            <PhaseOption
                                key={option.id}
                                option={option}
                                isSelected={phase.selectedOption === option.id}
                                onSelect={() => {
                                    onOptionSelect(option.id);
                                    setShowCustomInput(false);
                                }}
                            />
                        ))}
                    </div>

                    {/* Custom option */}
                    <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-xl w-full",
                            "border border-dashed border-slate-600 hover:border-slate-500",
                            "text-slate-400 hover:text-slate-300 transition-colors"
                        )}
                    >
                        <span>✏️</span>
                        <span className="text-sm">Modify with something else</span>
                    </button>

                    {showCustomInput && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                            <textarea
                                placeholder="Describe your custom requirement..."
                                value={phase.customValue || ''}
                                onChange={(e) => onCustomInput(e.target.value)}
                                className={cn(
                                    "w-full p-3 rounded-xl resize-none",
                                    "bg-slate-800/50 border border-slate-700",
                                    "text-white placeholder:text-slate-500",
                                    "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                                )}
                                rows={3}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Icon mapping for phases received from API
const ICON_MAP: Record<string, React.ElementType> = {
    'Code': CodeIcon,
    'Database': DatabaseIcon,
    'Shield': ShieldIcon,
    'Palette': CodeIcon,
    'Server': ServerIcon,
    'Package': CodeIcon,
    'Zap': ZapIcon,
};

// Main implementation plan component
export function ImplementationPlan({ prompt, plan: preGeneratedPlan, onApprove, onCancel }: ImplementationPlanProps) {
    const [isLoading, setIsLoading] = useState(!preGeneratedPlan);
    const [thinkingStage, setThinkingStage] = useState('Analyzing your prompt');
    const [phases, setPhases] = useState<PlanPhase[]>([]);
    const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
    const [_error, setError] = useState<string | null>(null);

    // Convert pre-generated plan to PlanPhase format if provided
    useEffect(() => {
        if (preGeneratedPlan) {
            const convertedPhases: PlanPhase[] = preGeneratedPlan.phases.map((phase) => ({
                id: phase.id,
                title: phase.title,
                description: phase.description,
                icon: ICON_MAP[phase.icon] || CodeIcon,
                type: phase.type,
                options: phase.steps.map((step) => ({
                    id: step.id,
                    label: step.description,
                    description: `~${step.estimatedTokens} tokens`,
                    recommended: true,
                })),
                selectedOption: phase.steps[0]?.id,
            }));
            setPhases(convertedPhases);
            setIsLoading(false);
            if (convertedPhases.length > 0) {
                setExpandedPhase(convertedPhases[0].id);
            }
        }
    }, [preGeneratedPlan]);

    // Fetch AI-generated implementation plan from API (only if no pre-generated plan)
    const fetchPlan = useCallback(async () => {
        if (preGeneratedPlan || !prompt) {
            return; // Don't fetch if we already have a plan
        }

        setIsLoading(true);
        setError(null);

        try {
            // Use SSE endpoint for streaming progress
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/plan/generate/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-user-id': apiClient.getUserId() || 'anonymous',
                },
                body: JSON.stringify({ prompt }),
            });

            if (!response.ok) {
                throw new Error(`Failed to generate plan: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process SSE events
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let currentEvent = '';
                let currentData = '';

                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        currentEvent = line.slice(7);
                    } else if (line.startsWith('data: ')) {
                        currentData = line.slice(6);
                    } else if (line === '' && currentEvent && currentData) {
                        try {
                            const parsedData = JSON.parse(currentData);

                            if (currentEvent === 'progress') {
                                setThinkingStage(parsedData.stage);
                            } else if (currentEvent === 'complete') {
                                // Transform API response to component format
                                const apiPlan = parsedData.plan;
                                const transformedPhases: PlanPhase[] = apiPlan.phases.map((phase: { id: string; title: string; description: string; icon: string; type: 'frontend' | 'backend'; options: PlanOption[]; selectedOption: string }) => ({
                                    ...phase,
                                    icon: ICON_MAP[phase.icon] || CodeIcon,
                                }));
                                setPhases(transformedPhases);
                                setIsLoading(false);
                            } else if (currentEvent === 'error') {
                                setError(parsedData.message || 'Failed to generate plan');
                                // Use fallback plan from error response
                                if (parsedData.plan?.phases) {
                                    const transformedPhases: PlanPhase[] = parsedData.plan.phases.map((phase: { id: string; title: string; description: string; icon: string; type: 'frontend' | 'backend'; options: PlanOption[]; selectedOption: string }) => ({
                                        ...phase,
                                        icon: ICON_MAP[phase.icon] || CodeIcon,
                                    }));
                                    setPhases(transformedPhases);
                                }
                                setIsLoading(false);
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data:', currentData);
                        }
                        currentEvent = '';
                        currentData = '';
                    }
                }
            }
        } catch (err) {
            console.error('Plan generation error:', err);
            setError(err instanceof Error ? err.message : 'Failed to generate plan');
            // Use fallback with common defaults
            setPhases(getFallbackPhases());
            setIsLoading(false);
        }
    }, [prompt]);

    // Fallback phases for when API fails
    function getFallbackPhases(): PlanPhase[] {
        return [
            {
                id: 'framework',
                title: 'Frontend Framework',
                description: 'Choose your UI framework',
                icon: CodeIcon,
                type: 'frontend',
                options: [
                    { id: 'react-vite', label: 'React + Vite', description: 'Modern React with fast builds', recommended: true },
                    { id: 'nextjs', label: 'Next.js', description: 'Full-stack React framework with SSR' },
                    { id: 'vue', label: 'Vue 3', description: 'Progressive JavaScript framework' },
                    { id: 'svelte', label: 'SvelteKit', description: 'Compiler-based framework' },
                ],
                selectedOption: 'react-vite'
            },
            {
                id: 'styling',
                title: 'Styling & UI',
                description: 'Design system and components',
                icon: CodeIcon,
                type: 'frontend',
                options: [
                    { id: 'tailwind-shadcn', label: 'Tailwind + shadcn/ui', description: 'Utility-first CSS with premium components', recommended: true },
                    { id: 'chakra', label: 'Chakra UI', description: 'Component library with accessibility' },
                    { id: 'mantine', label: 'Mantine', description: 'Feature-rich React components' },
                    { id: 'custom', label: 'Custom CSS', description: 'Build from scratch' },
                ],
                selectedOption: 'tailwind-shadcn'
            },
            {
                id: 'database',
                title: 'Database',
                description: 'Data persistence layer',
                icon: DatabaseIcon,
                type: 'backend',
                options: [
                    { id: 'turso', label: 'Turso (SQLite)', description: 'Edge database with libSQL', recommended: true },
                    { id: 'postgres', label: 'PostgreSQL', description: 'Powerful relational database' },
                    { id: 'supabase', label: 'Supabase', description: 'Postgres with realtime' },
                ],
                selectedOption: 'turso'
            },
            {
                id: 'deployment',
                title: 'Deployment',
                description: 'Hosting and deployment target',
                icon: CodeIcon,
                type: 'backend',
                options: [
                    { id: 'vercel', label: 'Vercel', description: 'Zero-config deployments', recommended: true },
                    { id: 'netlify', label: 'Netlify', description: 'JAMstack deployments' },
                    { id: 'railway', label: 'Railway', description: 'Infrastructure platform' },
                ],
                selectedOption: 'vercel'
            },
        ];
    }

    // Fetch plan on mount
    useEffect(() => {
        fetchPlan();
    }, [fetchPlan]);

    const handleOptionSelect = (phaseId: string, optionId: string) => {
        setPhases(prev => prev.map(phase =>
            phase.id === phaseId
                ? { ...phase, selectedOption: optionId, customValue: undefined }
                : phase
        ));
    };

    const handleCustomInput = (phaseId: string, value: string) => {
        setPhases(prev => prev.map(phase =>
            phase.id === phaseId
                ? { ...phase, customValue: value, selectedOption: undefined }
                : phase
        ));
    };

    const allPhasesSelected = phases.every(p => p.selectedOption || p.customValue);
    const frontendPhases = phases.filter(p => p.type === 'frontend');
    const backendPhases = phases.filter(p => p.type === 'backend');

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16">
                <div className="relative mb-8">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <LoadingIcon size={40} className="text-black animate-spin" />
                    </div>
                    <div className="absolute -inset-2 bg-gradient-to-br from-amber-400/30 to-orange-500/30 rounded-2xl blur-xl animate-pulse" />
                </div>
                <ThinkingAnimation stage={thinkingStage} />
                <p className="text-slate-500 mt-4 text-center max-w-md">
                    Our AI is analyzing your prompt and creating a customized implementation plan...
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <ZapIcon size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Implementation Plan</h2>
                    <p className="text-sm text-slate-400">Select your preferences for each phase</p>
                </div>
            </div>

            {/* Plan summary */}
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                <div className="flex items-start gap-3">
                    <AlertCircleIcon size={20} className="flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm text-slate-300">
                            Based on your prompt: <span className="text-white font-medium">"{prompt?.slice(0, 100) || preGeneratedPlan?.intentSummary || 'Your request'}..."</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                            We've pre-selected recommended options. Customize below or approve to start building.
                        </p>
                    </div>
                </div>
            </div>

            {/* Frontend phases */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">
                        Frontend UI
                    </h3>
                </div>
                <div className="space-y-3">
                    {frontendPhases.map((phase) => (
                        <PhaseCard
                            key={phase.id}
                            phase={phase}
                            isExpanded={expandedPhase === phase.id}
                            onToggle={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                            onOptionSelect={(optionId) => handleOptionSelect(phase.id, optionId)}
                            onCustomInput={(value) => handleCustomInput(phase.id, value)}
                        />
                    ))}
                </div>
            </div>

            {/* Backend phases */}
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-purple-400" />
                    <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">
                        Backend
                    </h3>
                </div>
                <div className="space-y-3">
                    {backendPhases.map((phase) => (
                        <PhaseCard
                            key={phase.id}
                            phase={phase}
                            isExpanded={expandedPhase === phase.id}
                            onToggle={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
                            onOptionSelect={(optionId) => handleOptionSelect(phase.id, optionId)}
                            onCustomInput={(value) => handleCustomInput(phase.id, value)}
                        />
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                <Button
                    variant="ghost"
                    onClick={onCancel}
                    className="text-slate-400 hover:text-white"
                >
                    Cancel
                </Button>
                <Button
                    onClick={() => onApprove(phases)}
                    disabled={!allPhasesSelected}
                    className={cn(
                        "px-6 rounded-xl font-semibold",
                        "bg-gradient-to-r from-amber-500 to-orange-500",
                        "hover:from-amber-400 hover:to-orange-400",
                        "text-black shadow-lg shadow-amber-500/25",
                        "disabled:opacity-50"
                    )}
                >
                    Approve & Continue
                    <ArrowRightIcon size={16} className="ml-2" />
                </Button>
            </div>
        </div>
    );
}

export default ImplementationPlan;

