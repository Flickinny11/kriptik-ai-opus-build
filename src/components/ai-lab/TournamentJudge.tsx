/**
 * Tournament Judge Component
 *
 * Phase 4: AI Lab Judge Integration
 *
 * Enables tournament-style model comparison with an AI judge that:
 * - Runs multiple model responses in parallel
 * - Evaluates responses against criteria
 * - Provides detailed scorecards and rankings
 * - Shows judge reasoning and confidence
 *
 * Inspired by Cursor's Debug Mode hypothesis testing
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './TournamentJudge.css';

// Note: authenticatedFetch and API_URL available for production API calls
// import { authenticatedFetch, API_URL } from '../../lib/api-config';

// =============================================================================
// TYPES
// =============================================================================

export interface TournamentContestant {
    id: string;
    modelId: string;
    modelName: string;
    provider: string;
    response: string | null;
    status: 'pending' | 'generating' | 'complete' | 'error';
    generationTime: number | null;
    tokensUsed: number | null;
    costCents: number | null;
    error?: string;
}

export interface JudgeCriterion {
    id: string;
    name: string;
    description: string;
    weight: number;
    maxScore: number;
}

export interface JudgeScorecard {
    contestantId: string;
    criteriaScores: {
        criterionId: string;
        score: number;
        reasoning: string;
    }[];
    totalScore: number;
    normalizedScore: number;
    rank: number;
    strengths: string[];
    weaknesses: string[];
    overallAssessment: string;
}

export interface TournamentResult {
    id: string;
    prompt: string;
    contestants: TournamentContestant[];
    criteria: JudgeCriterion[];
    scorecards: JudgeScorecard[];
    winner: string | null;
    judgeModel: string;
    judgeReasoning: string;
    confidence: number;
    completedAt: Date | null;
    totalCostCents: number;
}

export interface TournamentJudgeProps {
    onClose?: () => void;
}

// =============================================================================
// DEFAULT CRITERIA
// =============================================================================

const DEFAULT_CRITERIA: JudgeCriterion[] = [
    {
        id: 'accuracy',
        name: 'Accuracy',
        description: 'Factual correctness and precision of the response',
        weight: 30,
        maxScore: 10,
    },
    {
        id: 'completeness',
        name: 'Completeness',
        description: 'Coverage of all aspects of the prompt',
        weight: 25,
        maxScore: 10,
    },
    {
        id: 'clarity',
        name: 'Clarity',
        description: 'Clear communication and logical structure',
        weight: 20,
        maxScore: 10,
    },
    {
        id: 'depth',
        name: 'Depth',
        description: 'Level of detail and insight provided',
        weight: 15,
        maxScore: 10,
    },
    {
        id: 'creativity',
        name: 'Creativity',
        description: 'Novel approaches or unique perspectives',
        weight: 10,
        maxScore: 10,
    },
];

// =============================================================================
// AVAILABLE MODELS
// =============================================================================

const AVAILABLE_MODELS = [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic' },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', provider: 'Anthropic' },
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google' },
    { id: 'gemini-ultra', name: 'Gemini Ultra', provider: 'Google' },
    { id: 'llama-3.2-70b', name: 'Llama 3.2 70B', provider: 'Meta' },
    { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral' },
];

// =============================================================================
// TOURNAMENT JUDGE COMPONENT
// =============================================================================

export const TournamentJudge: React.FC<TournamentJudgeProps> = ({ onClose }) => {
    // State
    const [prompt, setPrompt] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>([
        'claude-sonnet-4-20250514',
        'gpt-4o',
    ]);
    const [criteria, _setCriteria] = useState<JudgeCriterion[]>(DEFAULT_CRITERIA);
    // Note: _setCriteria available for future criteria customization feature
    void _setCriteria;
    const [judgeModel, setJudgeModel] = useState('claude-opus-4-5-20251101');
    const [tournament, setTournament] = useState<TournamentResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [activeTab, setActiveTab] = useState<'setup' | 'battle' | 'results'>('setup');
    const [error, setError] = useState<string | null>(null);

    // Toggle model selection
    const toggleModel = useCallback((modelId: string) => {
        setSelectedModels(prev => {
            if (prev.includes(modelId)) {
                return prev.filter(id => id !== modelId);
            }
            if (prev.length < 4) {
                return [...prev, modelId];
            }
            return prev;
        });
    }, []);

    // Start tournament
    const startTournament = useCallback(async () => {
        if (!prompt.trim() || selectedModels.length < 2) return;

        setIsRunning(true);
        setError(null);
        setActiveTab('battle');

        // Initialize tournament state
        const contestants: TournamentContestant[] = selectedModels.map(modelId => {
            const model = AVAILABLE_MODELS.find(m => m.id === modelId);
            return {
                id: `contestant-${modelId}`,
                modelId,
                modelName: model?.name || modelId,
                provider: model?.provider || 'Unknown',
                response: null,
                status: 'pending',
                generationTime: null,
                tokensUsed: null,
                costCents: null,
            };
        });

        const newTournament: TournamentResult = {
            id: `tournament-${Date.now()}`,
            prompt,
            contestants,
            criteria,
            scorecards: [],
            winner: null,
            judgeModel,
            judgeReasoning: '',
            confidence: 0,
            completedAt: null,
            totalCostCents: 0,
        };

        setTournament(newTournament);

        try {
            // Start all model generations in parallel
            const startTime = Date.now();

            // Simulate parallel generation (in production, this would call the API)
            const updatedContestants = await Promise.all(
                contestants.map(async (contestant) => {
                    // Mark as generating
                    setTournament(prev => {
                        if (!prev) return null;
                        const updated = { ...prev };
                        updated.contestants = updated.contestants.map(c =>
                            c.id === contestant.id ? { ...c, status: 'generating' as const } : c
                        );
                        return updated;
                    });

                    // Simulate generation delay (would be real API call)
                    await new Promise(r => setTimeout(r, 1500 + Math.random() * 2000));

                    const genTime = Date.now() - startTime;
                    const tokens = Math.floor(500 + Math.random() * 1500);

                    return {
                        ...contestant,
                        status: 'complete' as const,
                        response: `[Response from ${contestant.modelName}]\n\nThis is a simulated response for the prompt: "${prompt.slice(0, 100)}..."\n\nKey points:\n1. Analysis of the request\n2. Detailed explanation\n3. Practical recommendations`,
                        generationTime: genTime,
                        tokensUsed: tokens,
                        costCents: Math.floor(tokens * 0.01),
                    };
                })
            );

            // Update with all responses
            setTournament(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    contestants: updatedContestants,
                };
            });

            // Run judge evaluation
            await runJudgeEvaluation(newTournament.id, updatedContestants);

        } catch (err) {
            setError((err as Error).message);
            setIsRunning(false);
        }
    }, [prompt, selectedModels, criteria, judgeModel]);

    // Run judge evaluation
    const runJudgeEvaluation = async (_tournamentId: string, contestants: TournamentContestant[]) => {
        // Note: _tournamentId available for production API call tracking
        void _tournamentId;

        // Simulate judge evaluation (would be real API call)
        await new Promise(r => setTimeout(r, 2000));

        const scorecards: JudgeScorecard[] = contestants.map((contestant) => {
            const criteriaScores = criteria.map(criterion => ({
                criterionId: criterion.id,
                score: Math.floor(5 + Math.random() * 5),
                reasoning: `${contestant.modelName} demonstrates ${criterion.name.toLowerCase()} effectively.`,
            }));

            const totalScore = criteriaScores.reduce((sum, cs) => {
                const crit = criteria.find(c => c.id === cs.criterionId);
                return sum + (cs.score * (crit?.weight || 1) / 100);
            }, 0);

            return {
                contestantId: contestant.id,
                criteriaScores,
                totalScore: totalScore * 10,
                normalizedScore: 0, // Will be calculated after
                rank: 0, // Will be calculated after
                strengths: [
                    `Strong ${criteria[0]?.name || 'accuracy'}`,
                    `Good ${criteria[1]?.name || 'completeness'}`,
                ],
                weaknesses: [
                    `Could improve ${criteria[criteria.length - 1]?.name || 'creativity'}`,
                ],
                overallAssessment: `${contestant.modelName} provided a solid response with notable strengths in several areas.`,
            };
        });

        // Calculate ranks and normalized scores
        const maxScore = Math.max(...scorecards.map(s => s.totalScore));
        scorecards.forEach(sc => {
            sc.normalizedScore = (sc.totalScore / maxScore) * 100;
        });
        scorecards.sort((a, b) => b.totalScore - a.totalScore);
        scorecards.forEach((sc, i) => {
            sc.rank = i + 1;
        });

        const winner = scorecards[0]?.contestantId || null;
        const winnerContestant = contestants.find(c => c.id === winner);

        setTournament(prev => {
            if (!prev) return null;
            return {
                ...prev,
                scorecards,
                winner,
                judgeReasoning: `After careful evaluation across all criteria, ${winnerContestant?.modelName || 'the winner'} demonstrated the strongest overall performance, particularly excelling in accuracy and completeness.`,
                confidence: 75 + Math.random() * 20,
                completedAt: new Date(),
                totalCostCents: contestants.reduce((sum, c) => sum + (c.costCents || 0), 0) + 50,
            };
        });

        setIsRunning(false);
        setActiveTab('results');
    };

    // Get contestant by ID
    const getContestant = useCallback((id: string) => {
        return tournament?.contestants.find(c => c.id === id);
    }, [tournament]);

    // Sorted scorecards by rank
    const rankedScorecards = useMemo(() => {
        return [...(tournament?.scorecards || [])].sort((a, b) => a.rank - b.rank);
    }, [tournament?.scorecards]);

    return (
        <div className="tournament-judge">
            {/* Header */}
            <div className="tournament-header">
                <div className="header-left">
                    <span className="judge-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                            <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                        </svg>
                    </span>
                    <h2>Tournament Judge</h2>
                    <span className="subtitle">AI Model Battle Arena</span>
                </div>
                {onClose && (
                    <button className="close-btn" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="tournament-tabs">
                <button
                    className={`tab-btn ${activeTab === 'setup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('setup')}
                    disabled={isRunning}
                >
                    Setup
                </button>
                <button
                    className={`tab-btn ${activeTab === 'battle' ? 'active' : ''}`}
                    onClick={() => setActiveTab('battle')}
                    disabled={!tournament}
                >
                    Battle
                </button>
                <button
                    className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
                    onClick={() => setActiveTab('results')}
                    disabled={!tournament?.completedAt}
                >
                    Results
                </button>
            </div>

            {/* Error banner */}
            {error && (
                <div className="error-banner">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>Dismiss</button>
                </div>
            )}

            {/* Content */}
            <div className="tournament-content">
                <AnimatePresence mode="wait">
                    {/* Setup Tab */}
                    {activeTab === 'setup' && (
                        <motion.div
                            key="setup"
                            className="setup-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Prompt input */}
                            <div className="setup-section">
                                <h3>Battle Prompt</h3>
                                <textarea
                                    className="battle-prompt-input"
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    placeholder="Enter the prompt that all models will respond to..."
                                    rows={4}
                                />
                            </div>

                            {/* Model selection */}
                            <div className="setup-section">
                                <h3>Select Contestants (2-4 models)</h3>
                                <div className="model-grid">
                                    {AVAILABLE_MODELS.map(model => (
                                        <button
                                            key={model.id}
                                            className={`model-card ${selectedModels.includes(model.id) ? 'selected' : ''}`}
                                            onClick={() => toggleModel(model.id)}
                                        >
                                            <div className="model-name">{model.name}</div>
                                            <div className="model-provider">{model.provider}</div>
                                            {selectedModels.includes(model.id) && (
                                                <div className="model-check">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Judge model selection */}
                            <div className="setup-section">
                                <h3>Judge Model</h3>
                                <p className="section-desc">Select the AI model that will evaluate all responses</p>
                                <div className="judge-selector">
                                    {AVAILABLE_MODELS.slice(0, 4).map(model => (
                                        <button
                                            key={model.id}
                                            className={`judge-option ${judgeModel === model.id ? 'selected' : ''}`}
                                            onClick={() => setJudgeModel(model.id)}
                                        >
                                            {model.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Criteria customization */}
                            <div className="setup-section">
                                <h3>Evaluation Criteria</h3>
                                <div className="criteria-list">
                                    {criteria.map(criterion => (
                                        <div key={criterion.id} className="criterion-item">
                                            <div className="criterion-info">
                                                <span className="criterion-name">{criterion.name}</span>
                                                <span className="criterion-desc">{criterion.description}</span>
                                            </div>
                                            <div className="criterion-weight">
                                                <span>{criterion.weight}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Start button */}
                            <button
                                className="start-tournament-btn"
                                onClick={startTournament}
                                disabled={!prompt.trim() || selectedModels.length < 2 || isRunning}
                            >
                                {isRunning ? (
                                    <>
                                        <span className="spinner" />
                                        Starting Battle...
                                    </>
                                ) : (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                            <path d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" stroke="currentColor" strokeWidth="1.5"/>
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                                        </svg>
                                        Start Tournament
                                    </>
                                )}
                            </button>
                        </motion.div>
                    )}

                    {/* Battle Tab */}
                    {activeTab === 'battle' && tournament && (
                        <motion.div
                            key="battle"
                            className="battle-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="battle-prompt-display">
                                <span className="label">Prompt:</span>
                                <p>{tournament.prompt}</p>
                            </div>

                            <div className="contestants-grid">
                                {tournament.contestants.map((contestant, index) => (
                                    <motion.div
                                        key={contestant.id}
                                        className={`contestant-card status-${contestant.status}`}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                    >
                                        <div className="contestant-header">
                                            <span className="contestant-name">{contestant.modelName}</span>
                                            <span className="contestant-provider">{contestant.provider}</span>
                                        </div>

                                        <div className="contestant-status">
                                            {contestant.status === 'pending' && (
                                                <span className="status-text">Waiting...</span>
                                            )}
                                            {contestant.status === 'generating' && (
                                                <>
                                                    <span className="status-spinner" />
                                                    <span className="status-text">Generating...</span>
                                                </>
                                            )}
                                            {contestant.status === 'complete' && (
                                                <span className="status-text status-complete">Complete</span>
                                            )}
                                            {contestant.status === 'error' && (
                                                <span className="status-text status-error">Error</span>
                                            )}
                                        </div>

                                        {contestant.response && (
                                            <div className="contestant-response">
                                                {contestant.response.slice(0, 200)}...
                                            </div>
                                        )}

                                        {contestant.status === 'complete' && (
                                            <div className="contestant-metrics">
                                                <span>{(contestant.generationTime || 0) / 1000}s</span>
                                                <span>{contestant.tokensUsed} tokens</span>
                                                <span>${((contestant.costCents || 0) / 100).toFixed(3)}</span>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </div>

                            {isRunning && tournament.contestants.every(c => c.status === 'complete') && (
                                <div className="judge-evaluating">
                                    <span className="judge-spinner" />
                                    <span>Judge is evaluating responses...</span>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Results Tab */}
                    {activeTab === 'results' && tournament?.completedAt && (
                        <motion.div
                            key="results"
                            className="results-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            {/* Winner announcement */}
                            <div className="winner-announcement">
                                <div className="trophy-icon">
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                        <path d="M8 21h8M12 17v4M17 4H7a2 2 0 00-2 2v2a5 5 0 005 5h4a5 5 0 005-5V6a2 2 0 00-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M5 6H3a1 1 0 00-1 1v1a3 3 0 003 3M19 6h2a1 1 0 011 1v1a3 3 0 01-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                                <div className="winner-info">
                                    <span className="winner-label">Winner</span>
                                    <h3 className="winner-name">
                                        {getContestant(tournament.winner || '')?.modelName}
                                    </h3>
                                    <div className="winner-confidence">
                                        <span>Confidence: {tournament.confidence.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Rankings */}
                            <div className="rankings-section">
                                <h3>Final Rankings</h3>
                                <div className="rankings-list">
                                    {rankedScorecards.map((scorecard, index) => {
                                        const contestant = getContestant(scorecard.contestantId);
                                        return (
                                            <motion.div
                                                key={scorecard.contestantId}
                                                className={`ranking-item rank-${scorecard.rank}`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.1 }}
                                            >
                                                <div className="rank-badge">#{scorecard.rank}</div>
                                                <div className="ranking-info">
                                                    <span className="ranking-name">{contestant?.modelName}</span>
                                                    <span className="ranking-provider">{contestant?.provider}</span>
                                                </div>
                                                <div className="ranking-score">
                                                    <div className="score-bar">
                                                        <motion.div
                                                            className="score-fill"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${scorecard.normalizedScore}%` }}
                                                            transition={{ delay: 0.3 + index * 0.1 }}
                                                        />
                                                    </div>
                                                    <span className="score-value">
                                                        {scorecard.totalScore.toFixed(1)}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Judge reasoning */}
                            <div className="judge-reasoning-section">
                                <h3>Judge Assessment</h3>
                                <div className="judge-reasoning-card">
                                    <div className="judge-model-badge">
                                        Evaluated by {AVAILABLE_MODELS.find(m => m.id === tournament.judgeModel)?.name}
                                    </div>
                                    <p>{tournament.judgeReasoning}</p>
                                </div>
                            </div>

                            {/* Detailed scorecards */}
                            <div className="scorecards-section">
                                <h3>Detailed Scorecards</h3>
                                <div className="scorecards-grid">
                                    {rankedScorecards.map(scorecard => {
                                        const contestant = getContestant(scorecard.contestantId);
                                        return (
                                            <div key={scorecard.contestantId} className="scorecard">
                                                <div className="scorecard-header">
                                                    <span className="scorecard-name">{contestant?.modelName}</span>
                                                    <span className="scorecard-rank">Rank #{scorecard.rank}</span>
                                                </div>

                                                <div className="criteria-scores">
                                                    {scorecard.criteriaScores.map(cs => {
                                                        const criterion = criteria.find(c => c.id === cs.criterionId);
                                                        return (
                                                            <div key={cs.criterionId} className="criterion-score">
                                                                <div className="criterion-header">
                                                                    <span>{criterion?.name}</span>
                                                                    <span>{cs.score}/{criterion?.maxScore}</span>
                                                                </div>
                                                                <div className="criterion-bar">
                                                                    <div
                                                                        className="criterion-fill"
                                                                        style={{ width: `${(cs.score / (criterion?.maxScore || 10)) * 100}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="scorecard-assessment">
                                                    <div className="strengths">
                                                        <span className="assessment-label">Strengths</span>
                                                        <ul>
                                                            {scorecard.strengths.map((s, i) => (
                                                                <li key={i}>{s}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div className="weaknesses">
                                                        <span className="assessment-label">Weaknesses</span>
                                                        <ul>
                                                            {scorecard.weaknesses.map((w, i) => (
                                                                <li key={i}>{w}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cost summary */}
                            <div className="cost-summary">
                                <span>Total Tournament Cost:</span>
                                <span className="cost-value">${(tournament.totalCostCents / 100).toFixed(2)}</span>
                            </div>

                            {/* New tournament button */}
                            <button
                                className="new-tournament-btn"
                                onClick={() => {
                                    setTournament(null);
                                    setActiveTab('setup');
                                }}
                            >
                                Start New Tournament
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default TournamentJudge;
