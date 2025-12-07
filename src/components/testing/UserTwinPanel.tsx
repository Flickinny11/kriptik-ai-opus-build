/**
 * User Twin Panel
 *
 * Main panel for AI-powered synthetic user testing.
 * Select personas, configure tests, and view live results.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Play, Square, RefreshCw, AlertTriangle,
    CheckCircle2, XCircle, Loader2, X, Settings,
    Target, Bug, Eye, TrendingUp
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { PersonaCard } from './PersonaCard';
import { TestProgressViewer } from './TestProgressViewer';
import { IssueReport } from './IssueReport';
import '../../styles/realistic-glass.css';

// Dark glass styling
const darkGlassPanel = {
    background: 'linear-gradient(145deg, rgba(20,20,25,0.98) 0%, rgba(12,12,16,0.99) 100%)',
    backdropFilter: 'blur(40px) saturate(180%)',
    boxShadow: `
        0 30px 80px rgba(0,0,0,0.5),
        0 15px 40px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.05),
        0 0 0 1px rgba(255,255,255,0.05)
    `,
};

const accentColor = '#c8ff64';

interface Persona {
    id: string;
    name: string;
    behavior: string;
    techLevel: string;
    accessibilityNeeds?: string[];
    goalPatterns?: string[];
    avatar?: string;
    isCustom?: boolean;
}

interface TestResult {
    personaId: string;
    personaName: string;
    status: 'running' | 'completed' | 'failed';
    actions: Array<{
        id: string;
        type: string;
        target?: string;
        result: string;
        timestamp: number;
    }>;
    issuesFound: Array<{
        id: string;
        type: string;
        severity: string;
        title: string;
        description: string;
    }>;
    journeyScore: number;
    actionCount?: number;
    summary?: string;
}

interface UserTwinPanelProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    sandboxUrl: string;
}

export function UserTwinPanel({
    isOpen,
    onClose,
    projectId,
    sandboxUrl
}: UserTwinPanelProps) {
    // State
    const [stage, setStage] = useState<'setup' | 'running' | 'results'>('setup');
    const [personas, setPersonas] = useState<Persona[]>([]);
    const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [results, setResults] = useState<TestResult[]>([]);
    const [aggregateScore, setAggregateScore] = useState<number | null>(null);
    const [totalIssues, setTotalIssues] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Test configuration
    const [testName, setTestName] = useState('Synthetic User Test');
    const [testGoals, setTestGoals] = useState<string[]>(['explore the application', 'find usability issues']);
    const [maxActions, setMaxActions] = useState(50);

    const eventSourceRef = useRef<EventSource | null>(null);

    // Load personas on mount
    useEffect(() => {
        if (isOpen) {
            loadPersonas();
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [isOpen]);

    // Load available personas
    const loadPersonas = useCallback(async () => {
        try {
            const response = await apiClient.get<{
                success: boolean;
                defaultPersonas: Persona[];
                customPersonas: Persona[];
            }>('/api/user-twin/personas');

            if (response.data.success) {
                const all = [...response.data.defaultPersonas, ...response.data.customPersonas];
                setPersonas(all);
                // Select first 3 by default
                setSelectedPersonaIds(all.slice(0, 3).map(p => p.id));
            }
        } catch (err) {
            console.error('Failed to load personas:', err);
        }
    }, []);

    // Toggle persona selection
    const togglePersona = useCallback((personaId: string) => {
        setSelectedPersonaIds(prev => {
            if (prev.includes(personaId)) {
                return prev.filter(id => id !== personaId);
            }
            if (prev.length >= 6) {
                return prev; // Max 6 personas
            }
            return [...prev, personaId];
        });
    }, []);

    // Start test session
    const startTest = useCallback(async () => {
        if (selectedPersonaIds.length === 0) {
            setError('Please select at least one persona');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.post<{
                success: boolean;
                sessionId: string;
                error?: string;
            }>('/api/user-twin/start', {
                projectId,
                sandboxUrl,
                personaIds: selectedPersonaIds,
                testPlan: {
                    name: testName,
                    goals: testGoals,
                    maxActionsPerPersona: maxActions,
                },
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to start test');
            }

            setSessionId(response.data.sessionId);
            setStage('running');

            // Initialize results for selected personas
            const selectedPersonas = personas.filter(p => selectedPersonaIds.includes(p.id));
            setResults(selectedPersonas.map(p => ({
                personaId: p.id,
                personaName: p.name,
                status: 'running',
                actions: [],
                issuesFound: [],
                journeyScore: 100,
                actionCount: 0,
            })));

            // Connect to SSE for live updates
            connectToProgressStream(response.data.sessionId);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start test');
        } finally {
            setLoading(false);
        }
    }, [projectId, sandboxUrl, selectedPersonaIds, personas, testName, testGoals, maxActions]);

    // Connect to SSE progress stream
    const connectToProgressStream = useCallback((sid: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const baseUrl = import.meta.env.VITE_API_URL || '';
        const eventSource = new EventSource(`${baseUrl}/api/user-twin/stream/${sid}`, {
            withCredentials: true
        });

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'initial' || data.type === 'session_completed') {
                    // Full update
                    if (data.results) {
                        setResults(data.results);
                    }
                    if (data.aggregateScore !== undefined) {
                        setAggregateScore(data.aggregateScore);
                    }
                    if (data.totalIssues !== undefined) {
                        setTotalIssues(data.totalIssues);
                    }
                    if (data.type === 'session_completed') {
                        setStage('results');
                        eventSource.close();
                    }
                } else if (data.personaId) {
                    // Persona progress update
                    setResults(prev => prev.map(r =>
                        r.personaId === data.personaId
                            ? {
                                ...r,
                                status: data.status || r.status,
                                actionCount: data.actionCount || r.actionCount,
                                issuesFound: data.issuesFound !== undefined
                                    ? Array(data.issuesFound).fill({ id: '', type: '', severity: '', title: '', description: '' })
                                    : r.issuesFound,
                                journeyScore: data.journeyScore || r.journeyScore,
                            }
                            : r
                    ));
                }
            } catch {
                // Ignore parse errors
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            // Load final results
            loadResults(sid);
        };

        eventSourceRef.current = eventSource;
    }, []);

    // Load results from API
    const loadResults = useCallback(async (sid: string) => {
        try {
            const response = await apiClient.get<{
                success: boolean;
                session: { status: string; aggregateScore?: number; totalIssues?: number };
                results: TestResult[];
            }>(`/api/user-twin/results/${sid}`);

            if (response.data.success) {
                setResults(response.data.results || []);
                if (response.data.session.aggregateScore !== undefined) {
                    setAggregateScore(response.data.session.aggregateScore);
                }
                if (response.data.session.totalIssues !== undefined) {
                    setTotalIssues(response.data.session.totalIssues);
                }
                if (response.data.session.status === 'completed') {
                    setStage('results');
                }
            }
        } catch {
            // Ignore
        }
    }, []);

    // Stop test session
    const stopTest = useCallback(async () => {
        if (!sessionId) return;

        try {
            await apiClient.post(`/api/user-twin/stop/${sessionId}`, {});
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            loadResults(sessionId);
            setStage('results');
        } catch (err) {
            console.error('Failed to stop test:', err);
        }
    }, [sessionId, loadResults]);

    // Reset to setup
    const resetTest = useCallback(() => {
        setStage('setup');
        setSessionId(null);
        setResults([]);
        setAggregateScore(null);
        setTotalIssues(0);
        setError(null);

        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }, []);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-5xl h-[90vh] rounded-2xl overflow-hidden flex flex-col"
                    style={darkGlassPanel}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: 'rgba(59,130,246,0.15)' }}
                            >
                                <Users className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">User Twin</h2>
                                <p className="text-xs text-white/40">AI-powered synthetic user testing</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {stage !== 'setup' && (
                                <button
                                    onClick={resetTest}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    New Test
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5 text-white/40" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-hidden flex">
                        {/* Setup Stage */}
                        {stage === 'setup' && (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Error Display */}
                                {error && (
                                    <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                        <AlertTriangle className="w-5 h-5 text-red-400" />
                                        <p className="text-sm text-red-400">{error}</p>
                                        <button onClick={() => setError(null)} className="ml-auto">
                                            <X className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                )}

                                {/* Test Configuration */}
                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                        <Settings className="w-4 h-4" style={{ color: accentColor }} />
                                        Test Configuration
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-white/50 mb-1 block">Test Name</label>
                                            <input
                                                type="text"
                                                value={testName}
                                                onChange={(e) => setTestName(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-white/50 mb-1 block">Max Actions per Persona</label>
                                            <input
                                                type="number"
                                                value={maxActions}
                                                onChange={(e) => setMaxActions(parseInt(e.target.value) || 50)}
                                                min={10}
                                                max={100}
                                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="text-xs text-white/50 mb-1 block">Test Goals (comma-separated)</label>
                                        <input
                                            type="text"
                                            value={testGoals.join(', ')}
                                            onChange={(e) => setTestGoals(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                                            placeholder="e.g., complete checkout, find contact page"
                                        />
                                    </div>
                                </div>

                                {/* Sandbox URL Display */}
                                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10">
                                    <h3 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
                                        <Eye className="w-4 h-4 text-cyan-400" />
                                        Test Target
                                    </h3>
                                    <div className="text-sm text-white/60 font-mono truncate">
                                        {sandboxUrl}
                                    </div>
                                </div>

                                {/* Persona Selection */}
                                <div>
                                    <h3 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        Select Personas ({selectedPersonaIds.length}/6)
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {personas.map(persona => (
                                            <PersonaCard
                                                key={persona.id}
                                                persona={persona}
                                                selected={selectedPersonaIds.includes(persona.id)}
                                                onClick={() => togglePersona(persona.id)}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Start Button */}
                                <button
                                    onClick={startTest}
                                    disabled={loading || selectedPersonaIds.length === 0}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{
                                        background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                        color: '#000'
                                    }}
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Play className="w-5 h-5" />
                                    )}
                                    Start Synthetic Testing
                                </button>
                            </div>
                        )}

                        {/* Running Stage */}
                        {stage === 'running' && (
                            <div className="flex-1 overflow-hidden flex flex-col">
                                <TestProgressViewer
                                    results={results}
                                    maxActions={maxActions}
                                />

                                {/* Stop Button */}
                                <div className="p-4 border-t border-white/5">
                                    <button
                                        onClick={stopTest}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                    >
                                        <Square className="w-4 h-4" />
                                        Stop Testing
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Results Stage */}
                        {stage === 'results' && (
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Score Summary */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                                        <div
                                            className="text-4xl font-bold mb-2"
                                            style={{
                                                color: aggregateScore !== null && aggregateScore >= 80
                                                    ? '#34d399'
                                                    : aggregateScore !== null && aggregateScore >= 60
                                                        ? '#fbbf24'
                                                        : '#f87171'
                                            }}
                                        >
                                            {aggregateScore !== null ? `${aggregateScore}` : '-'}
                                        </div>
                                        <div className="text-xs text-white/50 flex items-center justify-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            Journey Score
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                                        <div className="text-4xl font-bold text-white mb-2">
                                            {totalIssues}
                                        </div>
                                        <div className="text-xs text-white/50 flex items-center justify-center gap-1">
                                            <Bug className="w-3 h-3" />
                                            Issues Found
                                        </div>
                                    </div>
                                    <div className="p-6 rounded-xl bg-white/[0.03] border border-white/10 text-center">
                                        <div className="text-4xl font-bold text-white mb-2">
                                            {results.filter(r => r.status === 'completed').length}/{results.length}
                                        </div>
                                        <div className="text-xs text-white/50 flex items-center justify-center gap-1">
                                            <Target className="w-3 h-3" />
                                            Tests Completed
                                        </div>
                                    </div>
                                </div>

                                {/* Per-Persona Results */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-medium text-white">Results by Persona</h3>
                                    {results.map(result => (
                                        <div
                                            key={result.personaId}
                                            className="p-4 rounded-xl bg-white/[0.02] border border-white/10"
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    {result.status === 'completed' ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                                    ) : result.status === 'failed' ? (
                                                        <XCircle className="w-5 h-5 text-red-400" />
                                                    ) : (
                                                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                                                    )}
                                                    <span className="font-medium text-white">{result.personaName}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-sm">
                                                    <span className="text-white/50">
                                                        {result.actions?.length || result.actionCount || 0} actions
                                                    </span>
                                                    <span className={
                                                        result.journeyScore >= 80 ? 'text-emerald-400' :
                                                        result.journeyScore >= 60 ? 'text-amber-400' : 'text-red-400'
                                                    }>
                                                        Score: {result.journeyScore}
                                                    </span>
                                                </div>
                                            </div>
                                            {result.summary && (
                                                <p className="text-sm text-white/60 mb-3">{result.summary}</p>
                                            )}
                                            {result.issuesFound.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-white/5">
                                                    <span className="text-xs text-red-400">
                                                        {result.issuesFound.length} issues found
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Issues Report */}
                                {totalIssues > 0 && (
                                    <IssueReport
                                        issues={results.flatMap(r => r.issuesFound)}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

