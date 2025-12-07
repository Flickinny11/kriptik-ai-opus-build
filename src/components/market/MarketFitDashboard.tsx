/**
 * Market Fit Dashboard
 *
 * Main dashboard for competitor analysis and market positioning.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp, Search, Plus, RefreshCw, X, Globe,
    Loader2, AlertCircle, Target, Lightbulb, BarChart3
} from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { CompetitorGrid } from './CompetitorGrid';
import { GapMatrix } from './GapMatrix';
import { OpportunityCard } from './OpportunityCard';
import { PositioningRadar } from './PositioningRadar';
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

interface Competitor {
    id: string;
    name: string;
    url: string;
    description?: string;
    features?: Array<{ name: string; category: string }>;
    pricing?: Array<{ name: string; price: number }>;
    marketPosition?: {
        segment: string;
        pricePoint: string;
        primaryDifferentiator: string;
    };
    strengths?: string[];
    weaknesses?: string[];
    screenshot?: string;
    lastAnalyzed?: string;
}

interface MarketGap {
    id: string;
    category: string;
    title: string;
    description: string;
    opportunityScore: number;
    implementationEffort: string;
    estimatedImpact: string;
}

interface Opportunity {
    id: string;
    type: string;
    title: string;
    description: string;
    potentialValue: string;
    effort: string;
    timeToImplement: string;
    competitiveAdvantage: string;
    actionItems: string[];
}

interface Positioning {
    currentPosition: string;
    recommendedPosition: string;
    valueProposition: string;
    targetAudience: string;
    keyMessages: string[];
    competitiveAdvantages: string[];
    pricingStrategy: string;
}

interface MarketAnalysis {
    id: string;
    projectId: string;
    targetMarket: string;
    competitors: Competitor[];
    gaps: MarketGap[];
    opportunities: Opportunity[];
    positioning: Positioning;
}

interface MarketFitDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    projectDescription?: string;
}

type TabType = 'competitors' | 'gaps' | 'opportunities' | 'positioning';

export function MarketFitDashboard({
    isOpen,
    onClose,
    projectId,
    projectDescription = ''
}: MarketFitDashboardProps) {
    // State
    const [activeTab, setActiveTab] = useState<TabType>('competitors');
    const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
    const [loading, setLoading] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // New analysis form
    const [showNewAnalysis, setShowNewAnalysis] = useState(false);
    const [targetMarket, setTargetMarket] = useState('');
    const [appDescription, setAppDescription] = useState(projectDescription);
    const [competitorUrls, setCompetitorUrls] = useState('');

    // Add competitor form
    const [showAddCompetitor, setShowAddCompetitor] = useState(false);
    const [newCompetitorUrl, setNewCompetitorUrl] = useState('');

    const [progress, setProgress] = useState<{
        phase: string;
        currentStep: string;
        progress: number;
    } | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);

    // Load existing analysis on mount
    useEffect(() => {
        if (isOpen && projectId) {
            loadAnalysis();
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
        };
    }, [isOpen, projectId]);

    // Load existing analysis
    const loadAnalysis = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await apiClient.get<{
                success: boolean;
                analysis?: MarketAnalysis;
                error?: string;
            }>(`/api/market-fit/analysis/${projectId}`);

            if (response.data.success && response.data.analysis) {
                setAnalysis(response.data.analysis);
            } else if (!response.data.success) {
                // No analysis yet - show new analysis form
                setShowNewAnalysis(true);
            }
        } catch (err: any) {
            if (err.response?.status === 404) {
                setShowNewAnalysis(true);
            } else {
                setError(err.message || 'Failed to load analysis');
            }
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    // Start new analysis
    const startAnalysis = useCallback(async () => {
        if (!targetMarket || !appDescription) {
            setError('Please provide target market and app description');
            return;
        }

        setAnalyzing(true);
        setError(null);
        setShowNewAnalysis(false);

        try {
            const urls = competitorUrls
                .split('\n')
                .map(u => u.trim())
                .filter(u => u.length > 0);

            const response = await apiClient.post<{
                success: boolean;
                analysisId: string;
                error?: string;
            }>('/api/market-fit/analyze', {
                projectId,
                targetMarket,
                appDescription,
                competitorUrls: urls.length > 0 ? urls : undefined,
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Failed to start analysis');
            }

            // Connect to SSE for progress
            connectToProgress(response.data.analysisId);

        } catch (err: any) {
            setError(err.message || 'Failed to start analysis');
            setAnalyzing(false);
        }
    }, [projectId, targetMarket, appDescription, competitorUrls]);

    // Connect to SSE progress stream
    const connectToProgress = useCallback((analysisId: string) => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const baseUrl = import.meta.env.VITE_API_URL || '';
        const eventSource = new EventSource(`${baseUrl}/api/market-fit/stream/${analysisId}`, {
            withCredentials: true
        });

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.phase === 'complete' && data.analysis) {
                    setAnalysis(data.analysis);
                    setAnalyzing(false);
                    setProgress(null);
                    eventSource.close();
                } else if (data.error) {
                    setError(data.error);
                    setAnalyzing(false);
                    setProgress(null);
                    eventSource.close();
                } else if (data.phase) {
                    setProgress({
                        phase: data.phase,
                        currentStep: data.currentStep,
                        progress: data.progress,
                    });
                }
            } catch {
                // Ignore parse errors
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
            loadAnalysis();
            setAnalyzing(false);
            setProgress(null);
        };

        eventSourceRef.current = eventSource;
    }, [loadAnalysis]);

    // Add competitor
    const addCompetitor = useCallback(async () => {
        if (!newCompetitorUrl) return;

        setLoading(true);
        try {
            const response = await apiClient.post<{
                success: boolean;
                competitor?: Competitor;
                error?: string;
            }>('/api/market-fit/add-competitor', {
                projectId,
                competitorUrl: newCompetitorUrl,
                targetMarket: analysis?.targetMarket || 'general',
            });

            if (response.data.success && response.data.competitor) {
                setAnalysis(prev => prev ? {
                    ...prev,
                    competitors: [...prev.competitors, response.data.competitor!]
                } : null);
                setNewCompetitorUrl('');
                setShowAddCompetitor(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add competitor');
        } finally {
            setLoading(false);
        }
    }, [projectId, newCompetitorUrl, analysis?.targetMarket]);

    // Refresh analysis
    const refreshAnalysis = useCallback(async () => {
        setAnalyzing(true);
        setError(null);

        try {
            const response = await apiClient.post<{
                success: boolean;
                analysisId?: string;
                analysis?: MarketAnalysis;
            }>('/api/market-fit/refresh', { projectId });

            if (response.data.analysisId) {
                connectToProgress(response.data.analysisId);
            } else if (response.data.analysis) {
                setAnalysis(response.data.analysis);
                setAnalyzing(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to refresh analysis');
            setAnalyzing(false);
        }
    }, [projectId, connectToProgress]);

    // Implement opportunity
    const implementOpportunity = useCallback((opportunity: Opportunity) => {
        // This would trigger the build system to implement the feature
        console.log('Implementing opportunity:', opportunity);
        // For now, just show a message
        alert(`Feature implementation request sent: ${opportunity.title}`);
    }, []);

    if (!isOpen) return null;

    const tabs: Array<{ id: TabType; label: string; icon: React.ElementType }> = [
        { id: 'competitors', label: 'Competitors', icon: Globe },
        { id: 'gaps', label: 'Gap Matrix', icon: BarChart3 },
        { id: 'opportunities', label: 'Opportunities', icon: Lightbulb },
        { id: 'positioning', label: 'Positioning', icon: Target },
    ];

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
                    className="w-full max-w-6xl h-[90vh] rounded-2xl overflow-hidden flex flex-col"
                    style={darkGlassPanel}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div
                                className="p-2 rounded-xl"
                                style={{ background: 'rgba(200,255,100,0.15)' }}
                            >
                                <TrendingUp className="w-5 h-5" style={{ color: accentColor }} />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">Market Fit Oracle</h2>
                                <p className="text-xs text-white/40">
                                    {analysis?.targetMarket
                                        ? `Analyzing ${analysis.targetMarket} market`
                                        : 'Competitor analysis & positioning'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {analysis && !analyzing && (
                                <>
                                    <button
                                        onClick={() => setShowAddCompetitor(true)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Competitor
                                    </button>
                                    <button
                                        onClick={refreshAnalysis}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Refresh
                                    </button>
                                </>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5 text-white/40" />
                            </button>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mx-6 mt-4 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <p className="text-sm text-red-400 flex-1">{error}</p>
                            <button onClick={() => setError(null)}>
                                <X className="w-4 h-4 text-red-400" />
                            </button>
                        </div>
                    )}

                    {/* Loading State */}
                    {loading && !analysis && !showNewAnalysis && (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-white/50" />
                        </div>
                    )}

                    {/* Analysis Progress */}
                    {analyzing && progress && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6">
                            <div className="w-full max-w-md space-y-4">
                                <div className="text-center">
                                    <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" style={{ color: accentColor }} />
                                    <h3 className="text-lg font-medium text-white mb-2">
                                        {progress.phase === 'discovering' && 'Discovering Competitors...'}
                                        {progress.phase === 'analyzing' && 'Analyzing Competitors...'}
                                        {progress.phase === 'comparing' && 'Finding Market Gaps...'}
                                        {progress.phase === 'generating' && 'Generating Recommendations...'}
                                    </h3>
                                    <p className="text-sm text-white/60">{progress.currentStep}</p>
                                </div>
                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress.progress}%` }}
                                        className="h-full rounded-full"
                                        style={{ background: accentColor }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* New Analysis Form */}
                    {showNewAnalysis && !analyzing && (
                        <div className="flex-1 flex flex-col items-center justify-center p-6">
                            <div className="w-full max-w-lg space-y-6">
                                <div className="text-center">
                                    <Search className="w-12 h-12 mx-auto mb-4" style={{ color: accentColor }} />
                                    <h3 className="text-xl font-semibold text-white mb-2">Start Market Analysis</h3>
                                    <p className="text-sm text-white/60">
                                        Discover competitors and find your market position
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 block">Target Market *</label>
                                        <input
                                            type="text"
                                            value={targetMarket}
                                            onChange={(e) => setTargetMarket(e.target.value)}
                                            placeholder="e.g., Project management SaaS, E-commerce platform"
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/20"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 block">Your App Description *</label>
                                        <textarea
                                            value={appDescription}
                                            onChange={(e) => setAppDescription(e.target.value)}
                                            placeholder="Describe what your app does and who it's for..."
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-white/60 mb-2 block">
                                            Competitor URLs (optional, one per line)
                                        </label>
                                        <textarea
                                            value={competitorUrls}
                                            onChange={(e) => setCompetitorUrls(e.target.value)}
                                            placeholder="https://competitor1.com&#10;https://competitor2.com"
                                            rows={3}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/20 resize-none font-mono text-sm"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={startAnalysis}
                                    disabled={!targetMarket || !appDescription}
                                    className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{
                                        background: `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}dd 100%)`,
                                        color: '#000'
                                    }}
                                >
                                    <Search className="w-5 h-5" />
                                    Analyze Market
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Add Competitor Modal */}
                    {showAddCompetitor && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-full max-w-md p-6 rounded-xl"
                                style={darkGlassPanel}
                            >
                                <h3 className="text-lg font-semibold text-white mb-4">Add Competitor</h3>
                                <input
                                    type="url"
                                    value={newCompetitorUrl}
                                    onChange={(e) => setNewCompetitorUrl(e.target.value)}
                                    placeholder="https://competitor.com"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/20 mb-4"
                                />
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowAddCompetitor(false)}
                                        className="flex-1 px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={addCompetitor}
                                        disabled={!newCompetitorUrl || loading}
                                        className="flex-1 px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                                        style={{ background: accentColor, color: '#000' }}
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* Main Content */}
                    {analysis && !analyzing && (
                        <>
                            {/* Tabs */}
                            <div className="px-6 pt-4 flex gap-2">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-white/10 text-white'
                                                : 'text-white/50 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                        {tab.id === 'competitors' && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/10">
                                                {analysis.competitors.length}
                                            </span>
                                        )}
                                        {tab.id === 'gaps' && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/10">
                                                {analysis.gaps.length}
                                            </span>
                                        )}
                                        {tab.id === 'opportunities' && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded text-xs bg-white/10">
                                                {analysis.opportunities.length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {activeTab === 'competitors' && (
                                    <CompetitorGrid competitors={analysis.competitors} />
                                )}
                                {activeTab === 'gaps' && (
                                    <GapMatrix
                                        gaps={analysis.gaps}
                                        competitors={analysis.competitors}
                                    />
                                )}
                                {activeTab === 'opportunities' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {analysis.opportunities.map(opp => (
                                            <OpportunityCard
                                                key={opp.id}
                                                opportunity={opp}
                                                onImplement={() => implementOpportunity(opp)}
                                            />
                                        ))}
                                    </div>
                                )}
                                {activeTab === 'positioning' && (
                                    <PositioningRadar
                                        positioning={analysis.positioning}
                                        competitors={analysis.competitors}
                                    />
                                )}
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

