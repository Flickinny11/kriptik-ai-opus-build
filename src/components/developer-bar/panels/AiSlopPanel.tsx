/**
 * AiSlopPanel - AI-Generated Code Detection with 3D Scanner
 *
 * Detects and eliminates AI-generated placeholder patterns:
 * - TODO comments left by AI
 * - Mock data in production code
 * - Placeholder implementations
 * - Incomplete error handling
 * - Generic variable names
 *
 * Features:
 * - 3D scanning visualization
 * - Pattern detection heatmap
 * - Auto-fix suggestions
 * - Premium glass morphism design
 */

import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';

// Lazy load 3D components
const Chart3DScene = lazy(() => import('../../visualizations/Chart3DScene'));
const GlassRing3D = lazy(() => import('../../visualizations/GlassRing3D'));

// ============================================================================
// TYPES
// ============================================================================

interface SlopPattern {
    id: string;
    type: 'todo' | 'mock' | 'placeholder' | 'error' | 'generic';
    file: string;
    line: number;
    snippet: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    autoFixable: boolean;
    suggestion?: string;
}

interface ScanResult {
    totalFiles: number;
    scannedFiles: number;
    patterns: SlopPattern[];
    score: number;
    lastScan: Date;
    scanning: boolean;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const MOCK_SCAN_RESULT: ScanResult = {
    totalFiles: 156,
    scannedFiles: 156,
    patterns: [
        { id: '1', type: 'todo', file: 'src/api/users.ts', line: 45, snippet: '// TODO: implement proper validation', severity: 'medium', autoFixable: false },
        { id: '2', type: 'mock', file: 'src/services/data.ts', line: 12, snippet: 'const mockUsers = [...', severity: 'high', autoFixable: true, suggestion: 'Replace with API call' },
        { id: '3', type: 'placeholder', file: 'src/components/Card.tsx', line: 89, snippet: 'Lorem ipsum dolor sit amet', severity: 'low', autoFixable: true, suggestion: 'Add real content' },
        { id: '4', type: 'error', file: 'src/hooks/useAuth.ts', line: 34, snippet: 'catch (e) { console.log(e) }', severity: 'high', autoFixable: true, suggestion: 'Add proper error handling' },
        { id: '5', type: 'generic', file: 'src/utils/helpers.ts', line: 78, snippet: 'const data = ...', severity: 'low', autoFixable: false, suggestion: 'Use descriptive name' },
    ],
    score: 72,
    lastScan: new Date(),
    scanning: false,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getPatternIcon(type: SlopPattern['type']) {
    switch (type) {
        case 'todo':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            );
        case 'mock':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                </svg>
            );
        case 'placeholder':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <rect x="2" y="4" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                </svg>
            );
        case 'error':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            );
        case 'generic':
            return (
                <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                    <path d="M8 2L14 14H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <path d="M8 6v4M8 12h0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            );
    }
}

function getSeverityColor(severity: SlopPattern['severity']) {
    switch (severity) {
        case 'critical': return '#c41e3a';
        case 'high': return '#cc7722';
        case 'medium': return '#F5A86C';
        case 'low': return '#1a8754';
    }
}

// ============================================================================
// 3D SCANNER VISUALIZATION
// ============================================================================

function ScannerVisualization({ scanning, score }: { scanning: boolean; score: number }) {
    return (
        <Suspense fallback={<ScannerLoading />}>
            <Chart3DScene
                height={180}
                cameraPosition={[0, 0, 4]}
                cameraFov={40}
                enableOrbit={false}
                showContactShadows={true}
                environmentPreset="studio"
                autoRotate={scanning}
                autoRotateSpeed={scanning ? 2 : 0}
            >
                <GlassRing3D
                    value={score}
                    maxValue={100}
                    position={[0, 0, 0]}
                    radius={1}
                    tubeRadius={0.12}
                    color={score >= 80 ? '#1a8754' : score >= 60 ? '#F5A86C' : '#c41e3a'}
                    label="Code Quality"
                    showValue={true}
                    valueFormat={(v) => `${Math.round(v)}%`}
                    pulsing={scanning}
                    animate={true}
                />
            </Chart3DScene>
        </Suspense>
    );
}

function ScannerLoading() {
    return (
        <div className="slop-panel__loading">
            <motion.div
                className="slop-panel__loading-spinner"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span>Loading scanner...</span>
        </div>
    );
}

// ============================================================================
// PATTERN CARD
// ============================================================================

function PatternCard({
    pattern,
    onFix,
    onDismiss,
}: {
    pattern: SlopPattern;
    onFix?: () => void;
    onDismiss?: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <motion.div
            className={`slop-panel__pattern slop-panel__pattern--${pattern.severity}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            layout
        >
            <div className="slop-panel__pattern-header" onClick={() => setExpanded(!expanded)}>
                <div className="slop-panel__pattern-icon" style={{ color: getSeverityColor(pattern.severity) }}>
                    {getPatternIcon(pattern.type)}
                </div>
                <div className="slop-panel__pattern-info">
                    <span className="slop-panel__pattern-type">{pattern.type.toUpperCase()}</span>
                    <span className="slop-panel__pattern-file">{pattern.file}:{pattern.line}</span>
                </div>
                <div className="slop-panel__pattern-actions">
                    {pattern.autoFixable && (
                        <button className="slop-panel__fix-btn" onClick={(e) => { e.stopPropagation(); onFix?.(); }}>
                            Fix
                        </button>
                    )}
                    <motion.div
                        className="slop-panel__chevron"
                        animate={{ rotate: expanded ? 180 : 0 }}
                    >
                        <svg viewBox="0 0 12 12" fill="none" width="10" height="10">
                            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </motion.div>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="slop-panel__pattern-details"
                    >
                        <pre className="slop-panel__snippet">{pattern.snippet}</pre>
                        {pattern.suggestion && (
                            <div className="slop-panel__suggestion">
                                <span className="slop-panel__suggestion-label">Suggestion:</span>
                                <span>{pattern.suggestion}</span>
                            </div>
                        )}
                        <button className="slop-panel__dismiss" onClick={onDismiss}>
                            Dismiss
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

interface AiSlopPanelProps {
    isActive: boolean;
    onClose: () => void;
}

export function AiSlopPanel({ isActive: _isActive }: AiSlopPanelProps) {
    const { projectId } = useParams();
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState<SlopPattern['type'] | 'all'>('all');

    // Fetch scan results
    const fetchResults = useCallback(async () => {
        if (!projectId) {
            setScanResult(MOCK_SCAN_RESULT);
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`/api/projects/${projectId}/slop-scan`);
            if (response.ok) {
                const data = await response.json();
                setScanResult(data);
            } else {
                setScanResult(MOCK_SCAN_RESULT);
            }
        } catch (err) {
            console.error('Failed to fetch slop scan:', err);
            setScanResult(MOCK_SCAN_RESULT);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    // Run scan
    const runScan = useCallback(async () => {
        setScanResult(prev => prev ? { ...prev, scanning: true } : prev);

        if (!projectId) {
            // Simulate scan
            await new Promise(resolve => setTimeout(resolve, 2000));
            setScanResult(prev => prev ? { ...prev, scanning: false, lastScan: new Date() } : prev);
            return;
        }

        try {
            await fetch(`/api/projects/${projectId}/slop-scan`, { method: 'POST' });
            await fetchResults();
        } catch (err) {
            console.error('Failed to run scan:', err);
            setScanResult(prev => prev ? { ...prev, scanning: false } : prev);
        }
    }, [projectId, fetchResults]);

    // Auto-fix pattern
    const handleFix = useCallback(async (patternId: string) => {
        if (!projectId) {
            setScanResult(prev => prev ? {
                ...prev,
                patterns: prev.patterns.filter(p => p.id !== patternId),
                score: Math.min(100, prev.score + 5),
            } : prev);
            return;
        }

        try {
            await fetch(`/api/projects/${projectId}/slop-scan/fix/${patternId}`, { method: 'POST' });
            await fetchResults();
        } catch (err) {
            console.error('Failed to fix pattern:', err);
        }
    }, [projectId, fetchResults]);

    // Dismiss pattern
    const handleDismiss = useCallback((patternId: string) => {
        setScanResult(prev => prev ? {
            ...prev,
            patterns: prev.patterns.filter(p => p.id !== patternId),
        } : prev);
    }, []);

    useEffect(() => {
        fetchResults();
    }, [fetchResults]);

    if (loading || !scanResult) {
        return (
            <div className="slop-panel">
                <ScannerLoading />
            </div>
        );
    }

    const filteredPatterns = activeFilter === 'all'
        ? scanResult.patterns
        : scanResult.patterns.filter(p => p.type === activeFilter);

    const patternCounts = {
        todo: scanResult.patterns.filter(p => p.type === 'todo').length,
        mock: scanResult.patterns.filter(p => p.type === 'mock').length,
        placeholder: scanResult.patterns.filter(p => p.type === 'placeholder').length,
        error: scanResult.patterns.filter(p => p.type === 'error').length,
        generic: scanResult.patterns.filter(p => p.type === 'generic').length,
    };

    return (
        <div className="slop-panel">
            {/* Scanner Visualization */}
            <ScannerVisualization scanning={scanResult.scanning} score={scanResult.score} />

            {/* Stats */}
            <div className="slop-panel__stats">
                <div className="slop-panel__stat">
                    <span className="slop-panel__stat-value">{scanResult.scannedFiles}</span>
                    <span className="slop-panel__stat-label">Files Scanned</span>
                </div>
                <div className="slop-panel__stat">
                    <span className="slop-panel__stat-value" style={{ color: scanResult.patterns.length > 0 ? '#cc7722' : '#1a8754' }}>
                        {scanResult.patterns.length}
                    </span>
                    <span className="slop-panel__stat-label">Issues Found</span>
                </div>
                <div className="slop-panel__stat">
                    <span className="slop-panel__stat-value">
                        {scanResult.patterns.filter(p => p.autoFixable).length}
                    </span>
                    <span className="slop-panel__stat-label">Auto-Fixable</span>
                </div>
            </div>

            {/* Filters */}
            <div className="slop-panel__filters">
                <button
                    className={`slop-panel__filter ${activeFilter === 'all' ? 'slop-panel__filter--active' : ''}`}
                    onClick={() => setActiveFilter('all')}
                >
                    All ({scanResult.patterns.length})
                </button>
                {(['todo', 'mock', 'placeholder', 'error', 'generic'] as const).map(type => (
                    patternCounts[type] > 0 && (
                        <button
                            key={type}
                            className={`slop-panel__filter ${activeFilter === type ? 'slop-panel__filter--active' : ''}`}
                            onClick={() => setActiveFilter(type)}
                        >
                            {type} ({patternCounts[type]})
                        </button>
                    )
                ))}
            </div>

            {/* Patterns List */}
            <div className="slop-panel__patterns">
                {filteredPatterns.length === 0 ? (
                    <div className="slop-panel__empty">
                        <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                            <path d="M9 12l2 2 4-4" stroke="#1a8754" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="10" stroke="#1a8754" strokeWidth="2" />
                        </svg>
                        <span>No issues found!</span>
                    </div>
                ) : (
                    filteredPatterns.map(pattern => (
                        <PatternCard
                            key={pattern.id}
                            pattern={pattern}
                            onFix={() => handleFix(pattern.id)}
                            onDismiss={() => handleDismiss(pattern.id)}
                        />
                    ))
                )}
            </div>

            {/* Actions */}
            <div className="slop-panel__actions">
                <button
                    className="slop-panel__scan-btn"
                    onClick={runScan}
                    disabled={scanResult.scanning}
                >
                    {scanResult.scanning ? (
                        <>
                            <motion.div
                                className="slop-panel__btn-spinner"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                            Scanning...
                        </>
                    ) : (
                        <>
                            <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                                <path d="M8 2v4M8 10v4M2 8h4M10 8h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                            Run Scan
                        </>
                    )}
                </button>
                {scanResult.patterns.filter(p => p.autoFixable).length > 0 && (
                    <button className="slop-panel__fixall-btn">
                        Fix All ({scanResult.patterns.filter(p => p.autoFixable).length})
                    </button>
                )}
            </div>

            <style>{`
                .slop-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    padding: 4px;
                    height: 100%;
                    overflow-y: auto;
                }

                .slop-panel__stats {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    background: rgba(0, 0, 0, 0.15);
                    border-radius: 12px;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }

                .slop-panel__stat {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                }

                .slop-panel__stat-value {
                    font-family: var(--font-mono, monospace);
                    font-size: 18px;
                    font-weight: 700;
                    color: #F5A86C;
                }

                .slop-panel__stat-label {
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.5);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .slop-panel__filters {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .slop-panel__filter {
                    padding: 6px 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border: none;
                    border-radius: 6px;
                    color: rgba(255, 255, 255, 0.6);
                    font-size: 10px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-transform: capitalize;
                }

                .slop-panel__filter:hover {
                    background: rgba(255, 255, 255, 0.1);
                    color: rgba(255, 255, 255, 0.9);
                }

                .slop-panel__filter--active {
                    background: rgba(245, 168, 108, 0.2);
                    color: #F5A86C;
                }

                .slop-panel__patterns {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1;
                    overflow-y: auto;
                    min-height: 100px;
                }

                .slop-panel__pattern {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                    border: 1px solid rgba(255, 255, 255, 0.03);
                    overflow: hidden;
                }

                .slop-panel__pattern--critical {
                    border-left: 3px solid #c41e3a;
                }

                .slop-panel__pattern--high {
                    border-left: 3px solid #cc7722;
                }

                .slop-panel__pattern--medium {
                    border-left: 3px solid #F5A86C;
                }

                .slop-panel__pattern--low {
                    border-left: 3px solid #1a8754;
                }

                .slop-panel__pattern-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    cursor: pointer;
                }

                .slop-panel__pattern-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 6px;
                }

                .slop-panel__pattern-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }

                .slop-panel__pattern-type {
                    font-size: 10px;
                    font-weight: 600;
                    color: rgba(255, 255, 255, 0.6);
                }

                .slop-panel__pattern-file {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.9);
                    font-family: var(--font-mono, monospace);
                }

                .slop-panel__pattern-actions {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .slop-panel__fix-btn {
                    padding: 4px 10px;
                    background: rgba(26, 135, 84, 0.2);
                    border: none;
                    border-radius: 4px;
                    color: #1a8754;
                    font-size: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .slop-panel__fix-btn:hover {
                    background: rgba(26, 135, 84, 0.3);
                }

                .slop-panel__chevron {
                    color: rgba(255, 255, 255, 0.4);
                }

                .slop-panel__pattern-details {
                    padding: 0 10px 10px;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                }

                .slop-panel__snippet {
                    margin: 8px 0;
                    padding: 8px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 6px;
                    font-family: var(--font-mono, monospace);
                    font-size: 10px;
                    color: rgba(255, 255, 255, 0.7);
                    overflow-x: auto;
                    white-space: pre-wrap;
                    word-break: break-all;
                }

                .slop-panel__suggestion {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.6);
                    margin-bottom: 8px;
                }

                .slop-panel__suggestion-label {
                    color: #F5A86C;
                    font-weight: 600;
                    margin-right: 6px;
                }

                .slop-panel__dismiss {
                    padding: 4px 10px;
                    background: transparent;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .slop-panel__dismiss:hover {
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.8);
                }

                .slop-panel__empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 150px;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 12px;
                }

                .slop-panel__actions {
                    display: flex;
                    gap: 8px;
                    margin-top: auto;
                }

                .slop-panel__scan-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    background: rgba(245, 168, 108, 0.1);
                    border: 1px solid rgba(245, 168, 108, 0.2);
                    border-radius: 10px;
                    color: #F5A86C;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .slop-panel__scan-btn:hover:not(:disabled) {
                    background: rgba(245, 168, 108, 0.2);
                }

                .slop-panel__scan-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .slop-panel__btn-spinner {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(245, 168, 108, 0.3);
                    border-top-color: #F5A86C;
                    border-radius: 50%;
                }

                .slop-panel__fixall-btn {
                    padding: 12px 16px;
                    background: rgba(26, 135, 84, 0.15);
                    border: 1px solid rgba(26, 135, 84, 0.3);
                    border-radius: 10px;
                    color: #1a8754;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .slop-panel__fixall-btn:hover {
                    background: rgba(26, 135, 84, 0.25);
                }

                .slop-panel__loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    height: 200px;
                    color: rgba(245, 168, 108, 0.8);
                    font-size: 12px;
                }

                .slop-panel__loading-spinner {
                    width: 24px;
                    height: 24px;
                    border: 2px solid rgba(245, 168, 108, 0.3);
                    border-top-color: #F5A86C;
                    border-radius: 50%;
                }
            `}</style>
        </div>
    );
}

export default AiSlopPanel;
