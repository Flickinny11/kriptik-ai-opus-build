/**
 * Streaming Plan Mode Component
 *
 * Phase 5: Plan Mode UI Overhaul
 *
 * A Cursor-style streaming plan mode that displays:
 * - Animated KripTik logo during thinking
 * - Streaming thinking tokens appearing in real-time
 * - Premium liquid glass UI with depth
 * - Plan phases with expandable details
 *
 * Consolidates duplicate plan UIs into one premium component.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { KriptikLogo } from '../ui/KriptikLogo';
import { cn } from '@/lib/utils';
import './StreamingPlanMode.css';

// =============================================================================
// TYPES
// =============================================================================

export interface PlanStep {
    id: string;
    title: string;
    description: string;
    estimatedTokens: number;
    type: 'frontend' | 'backend' | 'database' | 'api' | 'testing' | 'deployment';
    status: 'pending' | 'thinking' | 'complete';
}

export interface PlanPhase {
    id: string;
    title: string;
    description: string;
    type: 'setup' | 'frontend' | 'backend' | 'integration' | 'polish';
    steps: PlanStep[];
    order: number;
    status: 'pending' | 'planning' | 'complete';
    estimatedCost: number;
}

export interface StreamingToken {
    id: string;
    content: string;
    type: 'thinking' | 'plan' | 'code' | 'explanation';
    timestamp: number;
}

export interface StreamingPlanModeProps {
    prompt: string;
    projectId?: string;
    onPlanApprove: (phases: PlanPhase[]) => void;
    onCancel: () => void;
}

// =============================================================================
// ANIMATED LOGO COMPONENT
// =============================================================================

function AnimatedThinkingLogo({ isThinking }: { isThinking: boolean }) {
    const rotation = useSpring(0, { stiffness: 50, damping: 20 });
    const scale = useSpring(1, { stiffness: 300, damping: 30 });
    // Glow intensity available for future animation enhancement
    const _glow = useTransform(rotation, [0, 360], [0.3, 0.8]);
    void _glow;

    useEffect(() => {
        if (isThinking) {
            const interval = setInterval(() => {
                rotation.set(rotation.get() + 360);
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isThinking, rotation]);

    useEffect(() => {
        if (isThinking) {
            const pulseInterval = setInterval(() => {
                scale.set(1.05);
                setTimeout(() => scale.set(1), 150);
            }, 1500);
            return () => clearInterval(pulseInterval);
        }
    }, [isThinking, scale]);

    return (
        <motion.div
            className="streaming-logo-container"
            style={{
                scale,
                filter: `drop-shadow(0 0 ${isThinking ? 20 : 10}px rgba(245, 168, 108, ${isThinking ? 0.6 : 0.3}))`,
            }}
        >
            <motion.div
                className="streaming-logo-glow"
                animate={{
                    opacity: isThinking ? [0.3, 0.6, 0.3] : 0.2,
                }}
                transition={{
                    duration: 2,
                    repeat: isThinking ? Infinity : 0,
                    ease: 'easeInOut',
                }}
            />
            <KriptikLogo size="lg" animated={isThinking} />
        </motion.div>
    );
}

// =============================================================================
// STREAMING TOKEN DISPLAY
// =============================================================================

function StreamingTokenDisplay({
    tokens,
    isStreaming,
}: {
    tokens: StreamingToken[];
    isStreaming: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom as new tokens arrive
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [tokens]);

    return (
        <div className="streaming-tokens-container" ref={containerRef}>
            <AnimatePresence>
                {tokens.map((token, index) => (
                    <motion.span
                        key={token.id}
                        className={cn(
                            'streaming-token',
                            `streaming-token--${token.type}`
                        )}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.1,
                            delay: index * 0.01,
                        }}
                    >
                        {token.content}
                    </motion.span>
                ))}
            </AnimatePresence>

            {/* Cursor indicator */}
            {isStreaming && (
                <motion.span
                    className="streaming-cursor"
                    animate={{ opacity: [1, 0] }}
                    transition={{
                        duration: 0.5,
                        repeat: Infinity,
                        repeatType: 'reverse',
                    }}
                >
                    |
                </motion.span>
            )}
        </div>
    );
}

// =============================================================================
// PHASE CARD COMPONENT
// =============================================================================

function PhaseCard({
    phase,
    index,
    isExpanded,
    onToggle,
    onStepToggle,
}: {
    phase: PlanPhase;
    index: number;
    isExpanded: boolean;
    onToggle: () => void;
    onStepToggle: (stepId: string) => void;
}) {
    const phaseIcons: Record<PlanPhase['type'], JSX.Element> = {
        setup: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48l2.12 2.12M5.64 18.36l2.12-2.12m8.48-8.48l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
        ),
        frontend: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3 8h18" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="6" cy="6" r="1" fill="currentColor"/>
                <circle cx="9" cy="6" r="1" fill="currentColor"/>
            </svg>
        ),
        backend: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M6 9h4M6 12h6M6 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="16" cy="12" r="2" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
        ),
        integration: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M8 6h8M8 12h8M8 18h8M4 6h.01M4 12h.01M4 18h.01M20 6h.01M20 12h.01M20 18h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
        ),
        polish: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
        ),
    };

    const statusColors: Record<PlanPhase['status'], string> = {
        pending: 'var(--phase-pending)',
        planning: 'var(--phase-planning)',
        complete: 'var(--phase-complete)',
    };

    return (
        <motion.div
            className={cn(
                'phase-card',
                isExpanded && 'phase-card--expanded',
                `phase-card--${phase.status}`
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
        >
            <button className="phase-card__header" onClick={onToggle}>
                <div className="phase-card__icon" style={{ color: statusColors[phase.status] }}>
                    {phaseIcons[phase.type]}
                </div>
                <div className="phase-card__info">
                    <h4 className="phase-card__title">{phase.title}</h4>
                    <p className="phase-card__description">{phase.description}</p>
                </div>
                <div className="phase-card__meta">
                    <span className="phase-card__cost">
                        ~${phase.estimatedCost.toFixed(3)}
                    </span>
                    <span className="phase-card__steps">
                        {phase.steps.length} steps
                    </span>
                </div>
                <motion.div
                    className="phase-card__chevron"
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </motion.div>
            </button>

            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        className="phase-card__steps"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {phase.steps.map((step, stepIndex) => (
                            <motion.div
                                key={step.id}
                                className={cn(
                                    'phase-step',
                                    `phase-step--${step.status}`
                                )}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: stepIndex * 0.05 }}
                            >
                                <button
                                    className="phase-step__checkbox"
                                    onClick={() => onStepToggle(step.id)}
                                >
                                    {step.status === 'complete' && (
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </button>
                                <div className="phase-step__content">
                                    <span className="phase-step__title">{step.title}</span>
                                    <span className="phase-step__type">{step.type}</span>
                                </div>
                                <span className="phase-step__tokens">
                                    ~{step.estimatedTokens.toLocaleString()} tokens
                                </span>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function StreamingPlanMode({
    prompt,
    projectId: _projectId,
    onPlanApprove,
    onCancel,
}: StreamingPlanModeProps) {
    // ProjectId available for future SSE streaming integration
    void _projectId;

    // State
    const [stage, setStage] = useState<'analyzing' | 'planning' | 'ready'>('analyzing');
    const [tokens, setTokens] = useState<StreamingToken[]>([]);
    const [phases, setPhases] = useState<PlanPhase[]>([]);
    const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(true);
    const [totalCost, setTotalCost] = useState(0);
    const [totalTokens, setTotalTokens] = useState(0);

    // Simulate streaming tokens
    useEffect(() => {
        const thinkingTokens = [
            { content: 'Analyzing project requirements...', type: 'thinking' as const },
            { content: '\n\n', type: 'thinking' as const },
            { content: 'Identifying key features from prompt:\n', type: 'thinking' as const },
            { content: `"${prompt.slice(0, 100)}..."`, type: 'explanation' as const },
            { content: '\n\n', type: 'thinking' as const },
            { content: 'Breaking down into implementation phases...', type: 'thinking' as const },
            { content: '\n\n', type: 'thinking' as const },
            { content: 'Estimating token usage per phase...', type: 'thinking' as const },
            { content: '\n', type: 'thinking' as const },
            { content: 'Calculating optimal parallelization...', type: 'thinking' as const },
            { content: '\n\n', type: 'thinking' as const },
            { content: 'Generating implementation plan:', type: 'plan' as const },
        ];

        let tokenIndex = 0;
        const streamInterval = setInterval(() => {
            if (tokenIndex < thinkingTokens.length) {
                const token = thinkingTokens[tokenIndex];
                setTokens(prev => [...prev, {
                    id: `token-${Date.now()}-${tokenIndex}`,
                    content: token.content,
                    type: token.type,
                    timestamp: Date.now(),
                }]);
                tokenIndex++;
            } else {
                clearInterval(streamInterval);
                setIsStreaming(false);
                setStage('planning');

                // Generate mock phases after streaming
                setTimeout(() => {
                    generateMockPhases();
                }, 500);
            }
        }, 150);

        return () => clearInterval(streamInterval);
    }, [prompt]);

    // Generate mock phases for demonstration
    const generateMockPhases = useCallback(() => {
        const mockPhases: PlanPhase[] = [
            {
                id: 'phase-1',
                title: 'Project Setup',
                description: 'Initialize project structure and dependencies',
                type: 'setup',
                order: 1,
                status: 'complete',
                estimatedCost: 0.05,
                steps: [
                    { id: 'step-1-1', title: 'Create project scaffold', description: '', estimatedTokens: 500, type: 'frontend', status: 'complete' },
                    { id: 'step-1-2', title: 'Configure TypeScript', description: '', estimatedTokens: 300, type: 'frontend', status: 'complete' },
                    { id: 'step-1-3', title: 'Setup Tailwind CSS', description: '', estimatedTokens: 200, type: 'frontend', status: 'complete' },
                ],
            },
            {
                id: 'phase-2',
                title: 'Frontend Components',
                description: 'Build UI components and layouts',
                type: 'frontend',
                order: 2,
                status: 'pending',
                estimatedCost: 0.25,
                steps: [
                    { id: 'step-2-1', title: 'Create layout components', description: '', estimatedTokens: 1500, type: 'frontend', status: 'pending' },
                    { id: 'step-2-2', title: 'Build form components', description: '', estimatedTokens: 2000, type: 'frontend', status: 'pending' },
                    { id: 'step-2-3', title: 'Implement navigation', description: '', estimatedTokens: 800, type: 'frontend', status: 'pending' },
                    { id: 'step-2-4', title: 'Add animations', description: '', estimatedTokens: 600, type: 'frontend', status: 'pending' },
                ],
            },
            {
                id: 'phase-3',
                title: 'Backend Services',
                description: 'API endpoints and business logic',
                type: 'backend',
                order: 3,
                status: 'pending',
                estimatedCost: 0.35,
                steps: [
                    { id: 'step-3-1', title: 'Setup Express routes', description: '', estimatedTokens: 1200, type: 'api', status: 'pending' },
                    { id: 'step-3-2', title: 'Database schema', description: '', estimatedTokens: 1500, type: 'database', status: 'pending' },
                    { id: 'step-3-3', title: 'Authentication', description: '', estimatedTokens: 2500, type: 'backend', status: 'pending' },
                    { id: 'step-3-4', title: 'API validation', description: '', estimatedTokens: 800, type: 'api', status: 'pending' },
                ],
            },
            {
                id: 'phase-4',
                title: 'Integration',
                description: 'Connect frontend to backend',
                type: 'integration',
                order: 4,
                status: 'pending',
                estimatedCost: 0.20,
                steps: [
                    { id: 'step-4-1', title: 'API client setup', description: '', estimatedTokens: 600, type: 'frontend', status: 'pending' },
                    { id: 'step-4-2', title: 'State management', description: '', estimatedTokens: 1200, type: 'frontend', status: 'pending' },
                    { id: 'step-4-3', title: 'Error handling', description: '', estimatedTokens: 800, type: 'frontend', status: 'pending' },
                ],
            },
            {
                id: 'phase-5',
                title: 'Polish & Testing',
                description: 'Final touches and verification',
                type: 'polish',
                order: 5,
                status: 'pending',
                estimatedCost: 0.15,
                steps: [
                    { id: 'step-5-1', title: 'UI polish', description: '', estimatedTokens: 1000, type: 'frontend', status: 'pending' },
                    { id: 'step-5-2', title: 'Accessibility', description: '', estimatedTokens: 500, type: 'frontend', status: 'pending' },
                    { id: 'step-5-3', title: 'Testing', description: '', estimatedTokens: 1500, type: 'testing', status: 'pending' },
                ],
            },
        ];

        setPhases(mockPhases);

        // Calculate totals
        const cost = mockPhases.reduce((sum, p) => sum + p.estimatedCost, 0);
        const tokens = mockPhases.reduce((sum, p) =>
            sum + p.steps.reduce((s, step) => s + step.estimatedTokens, 0), 0);

        setTotalCost(cost);
        setTotalTokens(tokens);
        setStage('ready');
    }, []);

    // Toggle phase expansion
    const togglePhase = useCallback((phaseId: string) => {
        setExpandedPhase(prev => prev === phaseId ? null : phaseId);
    }, []);

    // Toggle step completion
    const toggleStep = useCallback((phaseId: string, stepId: string) => {
        setPhases(prev => prev.map(phase => {
            if (phase.id !== phaseId) return phase;
            return {
                ...phase,
                steps: phase.steps.map(step => {
                    if (step.id !== stepId) return step;
                    return {
                        ...step,
                        status: step.status === 'complete' ? 'pending' : 'complete',
                    };
                }),
            };
        }));
    }, []);

    // Handle approve
    const handleApprove = useCallback(() => {
        onPlanApprove(phases);
    }, [phases, onPlanApprove]);

    return (
        <div className="streaming-plan-mode">
            {/* Header */}
            <div className="streaming-plan-header">
                <AnimatedThinkingLogo isThinking={stage !== 'ready'} />
                <div className="streaming-plan-title">
                    <h2>Implementation Plan</h2>
                    <p className="streaming-plan-stage">
                        {stage === 'analyzing' && 'Analyzing requirements...'}
                        {stage === 'planning' && 'Generating plan...'}
                        {stage === 'ready' && 'Plan ready for approval'}
                    </p>
                </div>
            </div>

            {/* Streaming tokens display */}
            {(stage === 'analyzing' || tokens.length > 0) && (
                <div className="streaming-tokens-section">
                    <StreamingTokenDisplay tokens={tokens} isStreaming={isStreaming} />
                </div>
            )}

            {/* Plan phases */}
            {phases.length > 0 && (
                <div className="streaming-plan-phases">
                    <div className="phases-header">
                        <h3>Execution Plan</h3>
                        <div className="phases-stats">
                            <span className="stat">
                                <span className="stat-value">{phases.length}</span>
                                <span className="stat-label">phases</span>
                            </span>
                            <span className="stat">
                                <span className="stat-value">{totalTokens.toLocaleString()}</span>
                                <span className="stat-label">tokens</span>
                            </span>
                            <span className="stat">
                                <span className="stat-value">${totalCost.toFixed(2)}</span>
                                <span className="stat-label">est. cost</span>
                            </span>
                        </div>
                    </div>

                    <div className="phases-list">
                        {phases.map((phase, index) => (
                            <PhaseCard
                                key={phase.id}
                                phase={phase}
                                index={index}
                                isExpanded={expandedPhase === phase.id}
                                onToggle={() => togglePhase(phase.id)}
                                onStepToggle={(stepId) => toggleStep(phase.id, stepId)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            {stage === 'ready' && (
                <motion.div
                    className="streaming-plan-actions"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <button
                        className="action-btn action-btn--cancel"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button
                        className="action-btn action-btn--approve"
                        onClick={handleApprove}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke="currentColor" strokeWidth="1.5"/>
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        Approve & Build
                    </button>
                </motion.div>
            )}
        </div>
    );
}

export default StreamingPlanMode;
