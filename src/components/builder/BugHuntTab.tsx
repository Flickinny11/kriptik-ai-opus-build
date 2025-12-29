/**
 * Bug Hunt Tab Component
 *
 * Comprehensive bug analysis panel with intent lock verification.
 * Bug-themed styling (red/orange/yellow color scheme).
 * Shows bugs found, safe-to-fix, and needs-review sections.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.kriptik.app';

export interface BugReport {
    id: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'logic' | 'type' | 'security' | 'performance' | 'accessibility' | 'ux';
    description: string;
    file: string;
    line: number;
    code: string;
    suggestedFix: string;
    fixApplied: boolean;
    intentLockApproved: boolean;
    reasoning: string;
}

export interface BugHuntResult {
    id: string;
    projectId: string;
    startedAt: string;
    completedAt: string | null;
    bugsFound: BugReport[];
    bugsFixed: BugReport[];
    bugsNeedingHumanReview: BugReport[];
    summary: string;
    status: 'running' | 'completed' | 'failed';
    filesScanned: number;
    totalLinesAnalyzed: number;
}

interface BugHuntTabProps {
    projectId: string;
    intent?: object;
    onBugFixed?: (bugId: string) => void;
    onAllSafeFixed?: () => void;
}

export function BugHuntTab({
    projectId,
    intent,
    onBugFixed,
    onAllSafeFixed,
}: BugHuntTabProps) {
    const [huntResult, setHuntResult] = useState<BugHuntResult | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [isFixingAll, setIsFixingAll] = useState(false);
    const [fixingBugId, setFixingBugId] = useState<string | null>(null);
    const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
    const [activeTab, setActiveTab] = useState<'all' | 'safe' | 'review'>('all');

    const startBugHunt = useCallback(async () => {
        if (!intent) {
            console.error('Intent contract required for bug hunt');
            return;
        }

        setIsRunning(true);
        setHuntResult(null);

        try {
            const response = await fetch(`${API_URL}/api/verification/bug-hunt/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ projectId, intent }),
            });

            const data = await response.json();
            if (data.huntId) {
                pollStatus(data.huntId);
            }
        } catch (error) {
            console.error('Failed to start bug hunt:', error);
            setIsRunning(false);
        }
    }, [projectId, intent]);

    const pollStatus = async (huntId: string) => {
        const poll = async () => {
            try {
                const response = await fetch(`${API_URL}/api/verification/bug-hunt/status/${huntId}`, { credentials: 'include' });
                const data = await response.json();

                if (data.result) {
                    setHuntResult(data.result);

                    if (data.result.status !== 'running') {
                        setIsRunning(false);
                        return;
                    }
                }

                setTimeout(poll, 2000);
            } catch (error) {
                console.error('Failed to poll status:', error);
                setIsRunning(false);
            }
        };

        poll();
    };

    const fixSingleBug = async (bug: BugReport) => {
        if (!huntResult) return;

        setFixingBugId(bug.id);

        try {
            const response = await fetch(`${API_URL}/api/verification/bug-hunt/fix/${bug.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ huntId: huntResult.id, projectId }),
            });

            const data = await response.json();
            if (data.success) {
                setHuntResult((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        bugsFound: prev.bugsFound.map((b) =>
                            b.id === bug.id ? { ...b, fixApplied: true } : b
                        ),
                        bugsFixed: [...prev.bugsFixed, { ...bug, fixApplied: true }],
                    };
                });
                onBugFixed?.(bug.id);
            }
        } catch (error) {
            console.error('Failed to fix bug:', error);
        } finally {
            setFixingBugId(null);
        }
    };

    const fixAllSafe = async () => {
        if (!huntResult) return;

        setIsFixingAll(true);

        try {
            const response = await fetch(`${API_URL}/api/verification/bug-hunt/fix-all-safe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ huntId: huntResult.id, projectId }),
            });

            const data = await response.json();
            if (data.success) {
                setHuntResult((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        bugsFound: prev.bugsFound.map((b) =>
                            b.intentLockApproved ? { ...b, fixApplied: true } : b
                        ),
                        bugsFixed: prev.bugsFound.filter((b) => b.intentLockApproved),
                    };
                });
                onAllSafeFixed?.();
            }
        } catch (error) {
            console.error('Failed to fix all safe bugs:', error);
        } finally {
            setIsFixingAll(false);
        }
    };

    const getSeverityColor = (severity: BugReport['severity']): string => {
        switch (severity) {
            case 'critical': return '#ef4444';
            case 'high': return '#f97316';
            case 'medium': return '#f59e0b';
            case 'low': return '#6b7280';
        }
    };

    const getCategoryLabel = (category: BugReport['category']): string => {
        switch (category) {
            case 'logic': return 'Logic Error';
            case 'type': return 'Type Issue';
            case 'security': return 'Security';
            case 'performance': return 'Performance';
            case 'accessibility': return 'A11y';
            case 'ux': return 'UX Issue';
        }
    };

    const filteredBugs = huntResult?.bugsFound.filter((bug) => {
        if (activeTab === 'safe') return bug.intentLockApproved && !bug.fixApplied;
        if (activeTab === 'review') return !bug.intentLockApproved;
        return true;
    }) || [];

    const safeCount = huntResult?.bugsFound.filter(b => b.intentLockApproved && !b.fixApplied).length || 0;
    const reviewCount = huntResult?.bugsNeedingHumanReview.length || 0;

    return (
        <div className="bug-hunt-tab">
            <div className="bug-hunt-header">
                <div className="header-content">
                    <div className="bug-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path
                                d="M12 2C9 2 7 4 7 6C7 7 7.5 8 8.5 8.5L6 11L3 11V13L6 13L6 15L3 15V17L6 17L8.5 19.5C7.5 20 7 21 7 22V23H9V22C9 21 10 20 12 20C14 20 15 21 15 22V23H17V22C17 21 16.5 20 15.5 19.5L18 17L21 17V15L18 15L18 13L21 13V11L18 11L15.5 8.5C16.5 8 17 7 17 6C17 4 15 2 12 2ZM12 4C14 4 15 5 15 6C15 7 14 8 12 8C10 8 9 7 9 6C9 5 10 4 12 4Z"
                                fill="currentColor"
                            />
                        </svg>
                    </div>
                    <div className="header-text">
                        <h3>Bug Hunt</h3>
                        <p>Comprehensive AI-powered bug analysis</p>
                    </div>
                </div>

                <button
                    className={`start-hunt-btn ${isRunning ? 'running' : ''}`}
                    onClick={startBugHunt}
                    disabled={isRunning || !intent}
                >
                    {isRunning ? (
                        <>
                            <div className="spinner" />
                            Hunting...
                        </>
                    ) : (
                        'Start Bug Hunt'
                    )}
                </button>
            </div>

            {isRunning && !huntResult && (
                <div className="hunt-progress">
                    <div className="progress-animation">
                        <motion.div
                            className="scan-line"
                            animate={{ x: ['-100%', '100%'] }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        />
                    </div>
                    <p>Initializing bug hunt...</p>
                </div>
            )}

            {huntResult && (
                <>
                    <div className="hunt-stats">
                        <div className="stat-card">
                            <span className="stat-value">{huntResult.bugsFound.length}</span>
                            <span className="stat-label">Bugs Found</span>
                        </div>
                        <div className="stat-card critical">
                            <span className="stat-value">
                                {huntResult.bugsFound.filter(b => b.severity === 'critical').length}
                            </span>
                            <span className="stat-label">Critical</span>
                        </div>
                        <div className="stat-card safe">
                            <span className="stat-value">{safeCount}</span>
                            <span className="stat-label">Safe to Fix</span>
                        </div>
                        <div className="stat-card review">
                            <span className="stat-value">{reviewCount}</span>
                            <span className="stat-label">Needs Review</span>
                        </div>
                    </div>

                    <div className="hunt-info">
                        <span>{huntResult.filesScanned} files scanned</span>
                        <span>{huntResult.totalLinesAnalyzed.toLocaleString()} lines analyzed</span>
                        <span>{huntResult.bugsFixed.length} fixed</span>
                    </div>

                    {safeCount > 0 && (
                        <button
                            className="fix-all-btn"
                            onClick={fixAllSafe}
                            disabled={isFixingAll}
                        >
                            {isFixingAll ? (
                                <>
                                    <div className="spinner small" />
                                    Applying Fixes...
                                </>
                            ) : (
                                `Fix All Safe (${safeCount})`
                            )}
                        </button>
                    )}

                    <div className="bug-tabs">
                        <button
                            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => setActiveTab('all')}
                        >
                            All ({huntResult.bugsFound.length})
                        </button>
                        <button
                            className={`tab ${activeTab === 'safe' ? 'active' : ''}`}
                            onClick={() => setActiveTab('safe')}
                        >
                            Safe to Fix ({safeCount})
                        </button>
                        <button
                            className={`tab ${activeTab === 'review' ? 'active' : ''}`}
                            onClick={() => setActiveTab('review')}
                        >
                            Needs Review ({reviewCount})
                        </button>
                    </div>

                    <div className="bug-list">
                        <AnimatePresence>
                            {filteredBugs.map((bug) => (
                                <motion.div
                                    key={bug.id}
                                    className={`bug-item ${bug.fixApplied ? 'fixed' : ''}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    onClick={() => setSelectedBug(bug)}
                                >
                                    <div className="bug-main">
                                        <div
                                            className="severity-dot"
                                            style={{ backgroundColor: getSeverityColor(bug.severity) }}
                                        />
                                        <div className="bug-content">
                                            <div className="bug-header-row">
                                                <span className="bug-category">{getCategoryLabel(bug.category)}</span>
                                                <span className={`severity-badge ${bug.severity}`}>
                                                    {bug.severity}
                                                </span>
                                                {bug.intentLockApproved ? (
                                                    <span className="safe-badge">Safe</span>
                                                ) : (
                                                    <span className="review-badge">Review</span>
                                                )}
                                            </div>
                                            <p className="bug-description">{bug.description}</p>
                                            <div className="bug-location">
                                                <span className="file-name">{bug.file}</span>
                                                <span className="line-number">:{bug.line}</span>
                                            </div>
                                        </div>
                                        {bug.intentLockApproved && !bug.fixApplied && (
                                            <button
                                                className="fix-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    fixSingleBug(bug);
                                                }}
                                                disabled={fixingBugId === bug.id}
                                            >
                                                {fixingBugId === bug.id ? (
                                                    <div className="spinner tiny" />
                                                ) : (
                                                    'Fix'
                                                )}
                                            </button>
                                        )}
                                        {bug.fixApplied && (
                                            <span className="fixed-indicator">Fixed</span>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </>
            )}

            <AnimatePresence>
                {selectedBug && (
                    <motion.div
                        className="bug-detail-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedBug(null)}
                    >
                        <motion.div
                            className="bug-detail-panel"
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="detail-header">
                                <div className="detail-title">
                                    <div
                                        className="severity-dot large"
                                        style={{ backgroundColor: getSeverityColor(selectedBug.severity) }}
                                    />
                                    <div>
                                        <h4>{getCategoryLabel(selectedBug.category)}</h4>
                                        <span className={`severity-badge ${selectedBug.severity}`}>
                                            {selectedBug.severity}
                                        </span>
                                    </div>
                                </div>
                                <button className="close-btn" onClick={() => setSelectedBug(null)}>
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" />
                                    </svg>
                                </button>
                            </div>

                            <div className="detail-content">
                                <div className="detail-section">
                                    <h5>Description</h5>
                                    <p>{selectedBug.description}</p>
                                </div>

                                <div className="detail-section">
                                    <h5>Location</h5>
                                    <code>{selectedBug.file}:{selectedBug.line}</code>
                                </div>

                                <div className="detail-section">
                                    <h5>Problematic Code</h5>
                                    <pre className="code-block">{selectedBug.code}</pre>
                                </div>

                                <div className="detail-section">
                                    <h5>Suggested Fix</h5>
                                    <pre className="code-block fix">{selectedBug.suggestedFix}</pre>
                                </div>

                                <div className="detail-section">
                                    <h5>Reasoning</h5>
                                    <p>{selectedBug.reasoning}</p>
                                </div>

                                {!selectedBug.intentLockApproved && (
                                    <div className="intent-warning">
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                            <path
                                                d="M8 1L1 14H15L8 1ZM8 6V9M8 11V12"
                                                stroke="currentColor"
                                                strokeWidth="1.5"
                                            />
                                        </svg>
                                        <p>This fix may affect intended features. Manual review required.</p>
                                    </div>
                                )}

                                {selectedBug.intentLockApproved && !selectedBug.fixApplied && (
                                    <button
                                        className="apply-fix-btn"
                                        onClick={() => fixSingleBug(selectedBug)}
                                        disabled={fixingBugId === selectedBug.id}
                                    >
                                        {fixingBugId === selectedBug.id ? 'Applying...' : 'Apply Fix'}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .bug-hunt-tab {
                    --bug-hunt-primary: #ff6b35;
                    --bug-hunt-secondary: #f7931a;
                    --bug-hunt-critical: #ef4444;

                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    padding: 16px;
                }

                .bug-hunt-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .bug-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, var(--bug-hunt-primary), var(--bug-hunt-secondary));
                    border-radius: 12px;
                    color: #ffffff;
                }

                .header-text h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 700;
                    color: #ffffff;
                }

                .header-text p {
                    margin: 0;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.5);
                }

                .start-hunt-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    background: linear-gradient(135deg, var(--bug-hunt-primary), var(--bug-hunt-secondary));
                    border: none;
                    border-radius: 10px;
                    color: #ffffff;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease-out;
                }

                .start-hunt-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 24px rgba(255, 107, 53, 0.3);
                }

                .start-hunt-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .start-hunt-btn.running {
                    background: rgba(255, 107, 53, 0.2);
                }

                .hunt-progress {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    padding: 32px;
                }

                .progress-animation {
                    width: 100%;
                    height: 4px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                    overflow: hidden;
                }

                .scan-line {
                    width: 30%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, var(--bug-hunt-primary), transparent);
                }

                .hunt-progress p {
                    margin: 0;
                    font-size: 13px;
                    color: rgba(255, 255, 255, 0.6);
                }

                .hunt-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 8px;
                }

                .stat-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 12px 8px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 10px;
                }

                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #ffffff;
                }

                .stat-card.critical .stat-value {
                    color: var(--bug-hunt-critical);
                }

                .stat-card.safe .stat-value {
                    color: #10b981;
                }

                .stat-card.review .stat-value {
                    color: var(--bug-hunt-secondary);
                }

                .stat-label {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .hunt-info {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.4);
                }

                .fix-all-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    width: 100%;
                    padding: 12px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border: none;
                    border-radius: 10px;
                    color: #ffffff;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease-out;
                }

                .fix-all-btn:hover:not(:disabled) {
                    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
                }

                .fix-all-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .bug-tabs {
                    display: flex;
                    gap: 4px;
                    background: rgba(255, 255, 255, 0.05);
                    padding: 4px;
                    border-radius: 10px;
                }

                .tab {
                    flex: 1;
                    padding: 8px 12px;
                    background: transparent;
                    border: none;
                    border-radius: 8px;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease-out;
                }

                .tab:hover {
                    background: rgba(255, 255, 255, 0.05);
                }

                .tab.active {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                }

                .bug-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-height: 400px;
                    overflow-y: auto;
                }

                .bug-item {
                    padding: 12px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.15s ease-out;
                }

                .bug-item:hover {
                    background: rgba(255, 255, 255, 0.06);
                }

                .bug-item.fixed {
                    opacity: 0.5;
                }

                .bug-main {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                }

                .severity-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                    margin-top: 4px;
                }

                .severity-dot.large {
                    width: 12px;
                    height: 12px;
                }

                .bug-content {
                    flex: 1;
                    min-width: 0;
                }

                .bug-header-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                }

                .bug-category {
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.7);
                }

                .severity-badge {
                    padding: 1px 6px;
                    border-radius: 100px;
                    font-size: 9px;
                    font-weight: 600;
                    text-transform: uppercase;
                }

                .severity-badge.critical {
                    background: rgba(239, 68, 68, 0.2);
                    color: #ef4444;
                }

                .severity-badge.high {
                    background: rgba(249, 115, 22, 0.2);
                    color: #f97316;
                }

                .severity-badge.medium {
                    background: rgba(245, 158, 11, 0.2);
                    color: #f59e0b;
                }

                .severity-badge.low {
                    background: rgba(107, 114, 128, 0.2);
                    color: #6b7280;
                }

                .safe-badge {
                    padding: 1px 6px;
                    background: rgba(16, 185, 129, 0.2);
                    border-radius: 100px;
                    font-size: 9px;
                    font-weight: 600;
                    color: #10b981;
                }

                .review-badge {
                    padding: 1px 6px;
                    background: rgba(245, 158, 11, 0.2);
                    border-radius: 100px;
                    font-size: 9px;
                    font-weight: 600;
                    color: #f59e0b;
                }

                .bug-description {
                    margin: 0 0 4px 0;
                    font-size: 12px;
                    color: #ffffff;
                    line-height: 1.4;
                }

                .bug-location {
                    font-size: 10px;
                    font-family: 'SF Mono', 'Fira Code', monospace;
                }

                .file-name {
                    color: rgba(255, 255, 255, 0.5);
                }

                .line-number {
                    color: var(--bug-hunt-secondary);
                }

                .fix-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 12px;
                    background: rgba(16, 185, 129, 0.2);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 6px;
                    color: #10b981;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease-out;
                }

                .fix-btn:hover:not(:disabled) {
                    background: rgba(16, 185, 129, 0.3);
                }

                .fixed-indicator {
                    font-size: 11px;
                    font-weight: 600;
                    color: #10b981;
                }

                .spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255, 255, 255, 0.2);
                    border-top-color: #ffffff;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }

                .spinner.small {
                    width: 14px;
                    height: 14px;
                }

                .spinner.tiny {
                    width: 12px;
                    height: 12px;
                    border-width: 1.5px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .bug-detail-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    z-index: 1000;
                }

                .bug-detail-panel {
                    width: 100%;
                    max-width: 560px;
                    max-height: 80vh;
                    overflow-y: auto;
                    background: linear-gradient(
                        145deg,
                        rgba(30, 30, 40, 0.98),
                        rgba(20, 20, 30, 0.98)
                    );
                    backdrop-filter: blur(40px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 20px;
                    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
                }

                .detail-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 20px;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                }

                .detail-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .detail-title h4 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #ffffff;
                }

                .close-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: rgba(255, 255, 255, 0.05);
                    border: none;
                    border-radius: 8px;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    transition: all 0.15s ease-out;
                }

                .close-btn:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: #ffffff;
                }

                .detail-content {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .detail-section h5 {
                    margin: 0 0 8px 0;
                    font-size: 11px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .detail-section p {
                    margin: 0;
                    font-size: 14px;
                    color: #ffffff;
                    line-height: 1.5;
                }

                .detail-section code {
                    display: block;
                    padding: 8px 12px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    font-size: 12px;
                    color: var(--bug-hunt-secondary);
                }

                .code-block {
                    margin: 0;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 8px;
                    font-family: 'SF Mono', 'Fira Code', monospace;
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.8);
                    overflow-x: auto;
                    white-space: pre-wrap;
                }

                .code-block.fix {
                    border-left: 3px solid #10b981;
                }

                .intent-warning {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(245, 158, 11, 0.1);
                    border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 10px;
                }

                .intent-warning svg {
                    flex-shrink: 0;
                    color: #f59e0b;
                }

                .intent-warning p {
                    margin: 0;
                    font-size: 12px;
                    color: #f59e0b;
                }

                .apply-fix-btn {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    border: none;
                    border-radius: 10px;
                    color: #ffffff;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease-out;
                }

                .apply-fix-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
                }

                .apply-fix-btn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}

export default BugHuntTab;
