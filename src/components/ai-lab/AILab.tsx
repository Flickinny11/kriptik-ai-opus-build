/**
 * AI Lab - Main Component (PROMPT 6)
 *
 * Multi-agent research orchestration interface for complex problem solving.
 * Features 5 parallel orchestrations, real-time progress, and results synthesis.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAILabStore, type AILabSession, type OrchestrationState } from '../../store/useAILabStore';
import { authenticatedFetch } from '../../lib/api-config';
import './AILab.css';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const ResearchPromptInput: React.FC<{
    prompt: string;
    onPromptChange: (prompt: string) => void;
    problemType: AILabSession['problemType'];
    onProblemTypeChange: (type: AILabSession['problemType']) => void;
    budgetLimit: number;
    onBudgetChange: (budget: number) => void;
    maxOrchestrations: number;
    onMaxOrchestrationsChange: (max: number) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
}> = ({
    prompt,
    onPromptChange,
    problemType,
    onProblemTypeChange,
    budgetLimit,
    onBudgetChange,
    maxOrchestrations,
    onMaxOrchestrationsChange,
    onSubmit,
    isSubmitting,
}) => {
    const problemTypes: Array<{ value: AILabSession['problemType']; label: string; icon: string }> = [
        { value: 'general', label: 'General Research', icon: '🔬' },
        { value: 'code_review', label: 'Code Review', icon: '💻' },
        { value: 'architecture', label: 'Architecture Analysis', icon: '🏗️' },
        { value: 'optimization', label: 'Optimization', icon: '⚡' },
        { value: 'research', label: 'Deep Research', icon: '📚' },
    ];

    return (
        <div className="research-prompt-container">
            <div className="prompt-header">
                <h3>Research Problem</h3>
                <p>Describe the problem you want multiple AI agents to research in parallel</p>
            </div>

            <textarea
                className="research-prompt-input glass-input"
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder="Enter your research problem, question, or challenge..."
                rows={4}
            />

            <div className="problem-type-selector">
                {problemTypes.map(({ value, label, icon }) => (
                    <button
                        key={value}
                        className={`problem-type-btn ${problemType === value ? 'active' : ''}`}
                        onClick={() => onProblemTypeChange(value)}
                    >
                        <span className="problem-type-icon">{icon}</span>
                        <span className="problem-type-label">{label}</span>
                    </button>
                ))}
            </div>

            <div className="config-row">
                <div className="config-item">
                    <label>Budget Limit</label>
                    <div className="budget-slider">
                        <input
                            type="range"
                            min={10}
                            max={500}
                            step={10}
                            value={budgetLimit}
                            onChange={(e) => onBudgetChange(Number(e.target.value))}
                        />
                        <span className="budget-value">${budgetLimit}</span>
                    </div>
                </div>
                <div className="config-item">
                    <label>Parallel Orchestrations</label>
                    <div className="orchestration-selector">
                        {[1, 2, 3, 4, 5].map(n => (
                            <button
                                key={n}
                                className={`orch-btn ${maxOrchestrations === n ? 'active' : ''}`}
                                onClick={() => onMaxOrchestrationsChange(n)}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                className="start-research-btn"
                onClick={onSubmit}
                disabled={isSubmitting || !prompt.trim()}
            >
                {isSubmitting ? (
                    <>
                        <span className="spinner" />
                        Creating Session...
                    </>
                ) : (
                    <>
                        <span className="btn-icon">🚀</span>
                        Start Multi-Agent Research
                    </>
                )}
            </button>
        </div>
    );
};

const OrchestrationTile: React.FC<{
    orchestration: OrchestrationState;
    index: number;
}> = ({ orchestration, index }) => {
    const phaseNames = [
        'Intent Lock',
        'Initialize',
        'Research',
        'Integrate',
        'Verify',
        'Satisfaction',
        'Complete',
    ];

    const statusColors: Record<string, string> = {
        queued: 'var(--status-queued)',
        initializing: 'var(--status-initializing)',
        running: 'var(--status-running)',
        completed: 'var(--status-completed)',
        failed: 'var(--status-failed)',
        stopped: 'var(--status-stopped)',
    };

    return (
        <motion.div
            className="orchestration-tile glass-card"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
        >
            <div className="tile-header">
                <span className="tile-index">#{index + 1}</span>
                <span
                    className="tile-status"
                    style={{ backgroundColor: statusColors[orchestration.status] }}
                >
                    {orchestration.status}
                </span>
            </div>

            <div className="tile-focus-area">
                {orchestration.focusArea}
            </div>

            <div className="tile-phase">
                <span className="phase-label">{phaseNames[orchestration.currentPhase]}</span>
                <div className="phase-progress-bar">
                    <div
                        className="phase-progress-fill"
                        style={{ width: `${orchestration.phaseProgress}%` }}
                    />
                </div>
                <span className="phase-percent">{orchestration.phaseProgress}%</span>
            </div>

            <div className="tile-findings">
                <span className="findings-count">{orchestration.findings.length}</span>
                <span className="findings-label">findings</span>
            </div>

            {orchestration.conclusion && (
                <div className="tile-conclusion">
                    {orchestration.conclusion.slice(0, 100)}...
                </div>
            )}

            <div className="tile-footer">
                <span className="tile-tokens">{orchestration.tokensUsed.toLocaleString()} tokens</span>
                <span className="tile-cost">${(orchestration.costCents / 100).toFixed(2)}</span>
            </div>
        </motion.div>
    );
};

const OrchestrationGrid: React.FC<{
    orchestrations: OrchestrationState[];
}> = ({ orchestrations }) => {
    return (
        <div className="orchestration-grid">
            {orchestrations.map((orch, index) => (
                <OrchestrationTile
                    key={orch.id}
                    orchestration={orch}
                    index={index}
                />
            ))}
        </div>
    );
};

const AgentCommunicationView: React.FC<{
    messages: AILabSession['messages'];
}> = ({ messages }) => {
    const messageTypeColors: Record<string, string> = {
        focus_announcement: 'var(--msg-focus)',
        finding: 'var(--msg-finding)',
        conflict: 'var(--msg-conflict)',
        request: 'var(--msg-request)',
        response: 'var(--msg-response)',
    };

    return (
        <div className="agent-communication">
            <h4>Agent Communication</h4>
            <div className="messages-container">
                <AnimatePresence>
                    {messages.slice(-20).map((msg) => (
                        <motion.div
                            key={msg.id}
                            className="agent-message"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            style={{ borderLeftColor: messageTypeColors[msg.messageType] }}
                        >
                            <span className="msg-type">{msg.messageType.replace('_', ' ')}</span>
                            <p className="msg-content">{msg.content}</p>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {messages.length === 0 && (
                    <p className="no-messages">No agent communication yet...</p>
                )}
            </div>
        </div>
    );
};

const ResultsSynthesis: React.FC<{
    result: AILabSession['synthesizedResult'];
}> = ({ result }) => {
    if (!result) {
        return (
            <div className="results-synthesis empty">
                <p>Results will appear here after research completes</p>
            </div>
        );
    }

    return (
        <div className="results-synthesis">
            <div className="synthesis-summary glass-card">
                <h4>Summary</h4>
                <p>{result.summary}</p>
                <div className="synthesis-metrics">
                    <div className="metric">
                        <span className="metric-value">{result.confidence}%</span>
                        <span className="metric-label">Confidence</span>
                    </div>
                    <div className="metric">
                        <span className="metric-value">{result.completeness}%</span>
                        <span className="metric-label">Completeness</span>
                    </div>
                </div>
            </div>

            <div className="key-insights glass-card">
                <h4>Key Insights</h4>
                <div className="insights-list">
                    {result.keyInsights.map(insight => (
                        <div key={insight.id} className={`insight-item priority-${insight.priority}`}>
                            <span className="insight-priority">{insight.priority}</span>
                            <h5>{insight.title}</h5>
                            <p>{insight.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="recommendations glass-card">
                <h4>Recommendations</h4>
                <div className="recommendations-list">
                    {result.recommendations.map(rec => (
                        <div key={rec.id} className="recommendation-item">
                            <h5>{rec.title}</h5>
                            <p>{rec.description}</p>
                            <div className="rec-meta">
                                <span className="effort">Effort: {rec.effort}</span>
                                <span className="impact">Impact: {rec.impact}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="next-steps glass-card">
                <h4>Next Steps</h4>
                <ol className="next-steps-list">
                    {result.nextSteps.map((step, i) => (
                        <li key={i}>{step}</li>
                    ))}
                </ol>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AILab: React.FC = () => {
    const {
        activeTab,
        setActiveTab,
        currentSession,
        setCurrentSession,
        sessionHistory,
        setSessionHistory,
        researchPrompt,
        setResearchPrompt,
        selectedProblemType,
        setSelectedProblemType,
        budgetLimitDollars,
        setBudgetLimitDollars,
        maxOrchestrations,
        setMaxOrchestrations,
        isCreating,
        setIsCreating,
        isStarting,
        setIsStarting,
        isStopping,
        setIsStopping,
        error,
        setError,
    } = useAILabStore();

    const [eventSource, setEventSource] = useState<EventSource | null>(null);

    // Load session history on mount
    useEffect(() => {
        loadHistory();
    }, []);

    // Clean up SSE connection on unmount
    useEffect(() => {
        return () => {
            if (eventSource) {
                eventSource.close();
            }
        };
    }, [eventSource]);

    const loadHistory = useCallback(async () => {
        try {
            const response = await authenticatedFetch('/api/ai-lab/sessions');
            if (response.ok) {
                const data = await response.json();
                setSessionHistory(data.sessions || []);
            }
        } catch (err) {
            console.error('Failed to load AI Lab history:', err);
        }
    }, [setSessionHistory]);

    const handleCreateSession = useCallback(async () => {
        if (!researchPrompt.trim()) return;

        setIsCreating(true);
        setError(null);

        try {
            const response = await authenticatedFetch('/api/ai-lab/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    researchPrompt,
                    problemType: selectedProblemType,
                    budgetLimitCents: budgetLimitDollars * 100,
                    maxOrchestrations,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create session');
            }

            const data = await response.json();
            
            // Start the session immediately
            await handleStartSession(data.sessionId);
            
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsCreating(false);
        }
    }, [researchPrompt, selectedProblemType, budgetLimitDollars, maxOrchestrations, setIsCreating, setError]);

    const handleStartSession = useCallback(async (sessionId: string) => {
        setIsStarting(true);
        setError(null);

        try {
            // Start the session
            const response = await authenticatedFetch(`/api/ai-lab/sessions/${sessionId}/start`, {
                method: 'POST',
            });

            if (!response.ok) {
                throw new Error('Failed to start session');
            }

            // Set up SSE for progress updates
            const es = new EventSource(`/api/ai-lab/sessions/${sessionId}/progress`);
            
            es.onmessage = (event) => {
                const progress = JSON.parse(event.data);
                setCurrentSession({
                    id: sessionId,
                    researchPrompt,
                    problemType: selectedProblemType,
                    status: progress.status,
                    budgetLimitCents: budgetLimitDollars * 100,
                    budgetUsedCents: progress.budgetUsedCents || 0,
                    orchestrations: progress.orchestrations || [],
                    messages: progress.messages || [],
                    synthesizedResult: progress.synthesizedResult,
                });

                // If completed, close the connection
                if (progress.status === 'completed' || progress.status === 'failed' || progress.status === 'cancelled') {
                    es.close();
                    setEventSource(null);
                    loadHistory();
                }
            };

            es.onerror = () => {
                es.close();
                setEventSource(null);
            };

            setEventSource(es);
            setActiveTab('results');

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsStarting(false);
        }
    }, [researchPrompt, selectedProblemType, budgetLimitDollars, setIsStarting, setError, setCurrentSession, loadHistory, setActiveTab]);

    const handleStopSession = useCallback(async () => {
        if (!currentSession) return;

        setIsStopping(true);

        try {
            await authenticatedFetch(`/api/ai-lab/sessions/${currentSession.id}/stop`, {
                method: 'POST',
            });

            if (eventSource) {
                eventSource.close();
                setEventSource(null);
            }

            setCurrentSession(null);
            loadHistory();

        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsStopping(false);
        }
    }, [currentSession, eventSource, setIsStopping, setCurrentSession, loadHistory, setError]);

    const totalProgress = currentSession?.orchestrations
        ? currentSession.orchestrations.reduce((sum, o) => sum + o.phaseProgress, 0) / (currentSession.orchestrations.length || 1)
        : 0;

    return (
        <motion.div
            className="ai-lab-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
        >
            <div className="ai-lab-header">
                <div className="header-title">
                    <span className="lab-icon">🧪</span>
                    <h2>AI Lab</h2>
                    <span className="subtitle">Multi-Agent Research Orchestration</span>
                </div>
                
                <div className="header-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'research' ? 'active' : ''}`}
                        onClick={() => setActiveTab('research')}
                    >
                        New Research
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'results' ? 'active' : ''}`}
                        onClick={() => setActiveTab('results')}
                        disabled={!currentSession}
                    >
                        Live Results
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        History ({sessionHistory.length})
                    </button>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            <div className="ai-lab-content">
                <AnimatePresence mode="wait">
                    {activeTab === 'research' && (
                        <motion.div
                            key="research"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <ResearchPromptInput
                                prompt={researchPrompt}
                                onPromptChange={setResearchPrompt}
                                problemType={selectedProblemType}
                                onProblemTypeChange={setSelectedProblemType}
                                budgetLimit={budgetLimitDollars}
                                onBudgetChange={setBudgetLimitDollars}
                                maxOrchestrations={maxOrchestrations}
                                onMaxOrchestrationsChange={setMaxOrchestrations}
                                onSubmit={handleCreateSession}
                                isSubmitting={isCreating || isStarting}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'results' && currentSession && (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="results-view"
                        >
                            <div className="session-status-bar">
                                <div className="status-info">
                                    <span className={`status-badge status-${currentSession.status}`}>
                                        {currentSession.status}
                                    </span>
                                    <span className="progress-text">{totalProgress.toFixed(0)}% complete</span>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${totalProgress}%` }}
                                    />
                                </div>
                                {currentSession.status === 'running' && (
                                    <button
                                        className="stop-btn"
                                        onClick={handleStopSession}
                                        disabled={isStopping}
                                    >
                                        {isStopping ? 'Stopping...' : 'Stop'}
                                    </button>
                                )}
                            </div>

                            <div className="results-grid">
                                <div className="orchestrations-section">
                                    <h3>Parallel Orchestrations</h3>
                                    <OrchestrationGrid orchestrations={currentSession.orchestrations} />
                                </div>

                                <div className="communication-section">
                                    <AgentCommunicationView messages={currentSession.messages} />
                                </div>
                            </div>

                            {currentSession.status === 'completed' && (
                                <ResultsSynthesis result={currentSession.synthesizedResult} />
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'history' && (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="history-view"
                        >
                            <div className="history-list">
                                {sessionHistory.length === 0 ? (
                                    <p className="empty-history">No previous research sessions</p>
                                ) : (
                                    sessionHistory.map(session => (
                                        <div key={session.id} className="history-item glass-card">
                                            <div className="history-prompt">
                                                {session.researchPrompt}
                                            </div>
                                            <div className="history-meta">
                                                <span className={`status status-${session.status}`}>
                                                    {session.status}
                                                </span>
                                                <span className="problem-type">{session.problemType}</span>
                                                <span className="cost">
                                                    ${((session.budgetUsedCents || 0) / 100).toFixed(2)}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
};

export default AILab;
