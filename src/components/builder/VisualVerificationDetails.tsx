/**
 * Visual Verification Details Component
 *
 * Displays video playback, keyframe timeline, AI analysis results,
 * and console errors from the Visual Verifier's monitoring session.
 *
 * Design: Premium liquid glass matching KripTik AI aesthetic
 * Colors: Warm amber/copper glow, no purple
 * Typography: Cal Sans / Outfit
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './VisualVerificationDetails.css';

// ============================================================================
// TYPES
// ============================================================================

export interface UIElement {
    id: string;
    type: string;
    label?: string;
    bounds?: { x: number; y: number; width: number; height: number };
    isInteractive: boolean;
}

export interface VisualIssue {
    id: string;
    type: 'layout' | 'design' | 'accessibility' | 'performance' | 'broken';
    severity: 'critical' | 'major' | 'minor';
    title: string;
    description: string;
    suggestion?: string;
}

export interface ConsoleError {
    id: string;
    message: string;
    source?: string;
    lineNumber?: number;
    timestamp: Date | string;
    type: 'error' | 'warn' | 'exception';
}

export interface VisionAnalysisResult {
    description: string;
    uiElements: UIElement[];
    issues: VisualIssue[];
    designScore: number;
    antiSlopViolations: string[];
    accessibilityIssues: string[];
    overallAssessment: string;
}

export interface KeyframeAnalysis {
    keyframeId: string;
    timestamp: number;
    trigger: string;
    screenshotBase64: string;
    visionAnalysis: VisionAnalysisResult;
    consoleErrorsAtCapture: ConsoleError[];
    url: string;
}

export interface VisualVerificationDetailsProps {
    videoUrl?: string | null;
    keyframes: KeyframeAnalysis[];
    consoleErrors: ConsoleError[];
    overallScore?: number;
    onClose?: () => void;
}

// ============================================================================
// CUSTOM ICONS
// ============================================================================

const PlayIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" />
        <path d="M10 8l6 4-6 4V8z" fill="currentColor" />
    </svg>
);

const KeyframeIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 9h18" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
);

const AlertIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="1.5" fill="rgba(196, 30, 58, 0.1)" strokeLinejoin="round" />
        <path d="M12 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="rgba(26, 135, 84, 0.1)" />
        <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const ConsoleIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="rgba(255,255,255,0.1)" />
        <path d="M7 9l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const CloseIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

// ============================================================================
// SCORE BADGE COMPONENT
// ============================================================================

function ScoreBadge({ label, score }: { label: string; score: number }) {
    const getScoreClass = (s: number) => {
        if (s >= 85) return 'score-badge--excellent';
        if (s >= 70) return 'score-badge--good';
        if (s >= 50) return 'score-badge--fair';
        return 'score-badge--poor';
    };

    return (
        <div className={`score-badge ${getScoreClass(score)}`}>
            <span className="score-badge__label">{label}</span>
            <span className="score-badge__value">{score}</span>
        </div>
    );
}

// ============================================================================
// ISSUE CARD COMPONENT
// ============================================================================

function IssueCard({ issue }: { issue: VisualIssue }) {
    const [expanded, setExpanded] = useState(false);

    const getSeverityClass = (severity: string) => {
        switch (severity) {
            case 'critical': return 'issue-card--critical';
            case 'major': return 'issue-card--major';
            default: return 'issue-card--minor';
        }
    };

    return (
        <motion.div
            className={`issue-card ${getSeverityClass(issue.severity)}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            layout
        >
            <button
                className="issue-card__header"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="issue-card__severity">
                    {issue.severity === 'critical' ? (
                        <AlertIcon className="w-4 h-4" />
                    ) : (
                        <div className={`issue-card__dot issue-card__dot--${issue.severity}`} />
                    )}
                </div>
                <div className="issue-card__info">
                    <span className="issue-card__title">{issue.title}</span>
                    <span className="issue-card__type">{issue.type}</span>
                </div>
                <motion.div
                    animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDownIcon className="w-4 h-4 text-slate-400" />
                </motion.div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        className="issue-card__details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <p className="issue-card__description">{issue.description}</p>
                        {issue.suggestion && (
                            <div className="issue-card__suggestion">
                                <span className="issue-card__suggestion-label">Suggestion:</span>
                                <p>{issue.suggestion}</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function VisualVerificationDetails({
    videoUrl,
    keyframes,
    consoleErrors,
    overallScore = 70,
    onClose,
}: VisualVerificationDetailsProps) {
    const [selectedKeyframe, setSelectedKeyframe] = useState(0);
    const [activeTab, setActiveTab] = useState<'analysis' | 'issues' | 'console'>('analysis');
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Get current keyframe
    const currentKeyframe = keyframes[selectedKeyframe];

    // Aggregate all issues from keyframes
    const allIssues = keyframes.flatMap(kf => kf.visionAnalysis.issues);
    const criticalCount = allIssues.filter(i => i.severity === 'critical').length;
    const majorCount = allIssues.filter(i => i.severity === 'major').length;

    // Handle video play/pause
    const toggleVideo = () => {
        if (videoRef.current) {
            if (isVideoPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsVideoPlaying(!isVideoPlaying);
        }
    };

    // Format timestamp
    const formatTimestamp = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    // Format console error timestamp
    const formatErrorTime = (timestamp: Date | string) => {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        return date.toLocaleTimeString();
    };

    return (
        <div className="visual-details">
            {/* Header */}
            <div className="visual-details__header">
                <div className="visual-details__header-left">
                    <KeyframeIcon className="w-6 h-6" />
                    <div className="visual-details__title-area">
                        <h3 className="visual-details__title">Visual Verification</h3>
                        <p className="visual-details__subtitle">
                            {keyframes.length} keyframe{keyframes.length !== 1 ? 's' : ''} analyzed
                        </p>
                    </div>
                </div>

                <div className="visual-details__header-right">
                    <ScoreBadge label="Score" score={overallScore} />
                    {onClose && (
                        <button onClick={onClose} className="visual-details__close">
                            <CloseIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Video Player */}
            {videoUrl && (
                <div className="visual-details__video-section">
                    <div className="visual-details__video-container">
                        <video
                            ref={videoRef}
                            src={videoUrl}
                            className="visual-details__video"
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            onEnded={() => setIsVideoPlaying(false)}
                            controls
                        />
                        {!isVideoPlaying && (
                            <button
                                className="visual-details__video-play"
                                onClick={toggleVideo}
                            >
                                <PlayIcon className="w-12 h-12" />
                            </button>
                        )}
                    </div>
                    <p className="visual-details__video-caption">
                        AI agent&apos;s automated testing session
                    </p>
                </div>
            )}

            {/* Keyframe Timeline */}
            {keyframes.length > 0 && (
                <div className="visual-details__keyframes">
                    <div className="visual-details__keyframes-header">
                        <span className="visual-details__keyframes-title">Keyframe Timeline</span>
                        <span className="visual-details__keyframes-count">
                            {selectedKeyframe + 1} / {keyframes.length}
                        </span>
                    </div>

                    <div className="visual-details__keyframes-scroll">
                        <div className="visual-details__keyframes-track">
                            {keyframes.map((kf, i) => (
                                <motion.button
                                    key={kf.keyframeId}
                                    className={`keyframe-thumb ${selectedKeyframe === i ? 'keyframe-thumb--active' : ''}`}
                                    onClick={() => setSelectedKeyframe(i)}
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <img
                                        src={`data:image/png;base64,${kf.screenshotBase64}`}
                                        alt={`Keyframe ${i + 1}`}
                                        className="keyframe-thumb__image"
                                    />
                                    <div className="keyframe-thumb__overlay">
                                        <span className="keyframe-thumb__trigger">{kf.trigger}</span>
                                        <span className="keyframe-thumb__time">{formatTimestamp(kf.timestamp)}</span>
                                    </div>
                                    {kf.visionAnalysis.issues.some(iss => iss.severity === 'critical') && (
                                        <div className="keyframe-thumb__alert" />
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="visual-details__tabs">
                <button
                    className={`visual-details__tab ${activeTab === 'analysis' ? 'visual-details__tab--active' : ''}`}
                    onClick={() => setActiveTab('analysis')}
                >
                    Analysis
                </button>
                <button
                    className={`visual-details__tab ${activeTab === 'issues' ? 'visual-details__tab--active' : ''}`}
                    onClick={() => setActiveTab('issues')}
                >
                    Issues
                    {allIssues.length > 0 && (
                        <span className="visual-details__tab-badge">{allIssues.length}</span>
                    )}
                </button>
                <button
                    className={`visual-details__tab ${activeTab === 'console' ? 'visual-details__tab--active' : ''}`}
                    onClick={() => setActiveTab('console')}
                >
                    Console
                    {consoleErrors.length > 0 && (
                        <span className="visual-details__tab-badge visual-details__tab-badge--error">
                            {consoleErrors.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="visual-details__content">
                <AnimatePresence mode="wait">
                    {activeTab === 'analysis' && currentKeyframe && (
                        <motion.div
                            key="analysis"
                            className="visual-details__analysis"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {/* Selected Screenshot */}
                            <div className="visual-details__screenshot">
                                <img
                                    src={`data:image/png;base64,${currentKeyframe.screenshotBase64}`}
                                    alt="Selected keyframe"
                                    className="visual-details__screenshot-image"
                                />
                            </div>

                            {/* AI Analysis */}
                            <div className="visual-details__ai-analysis">
                                <h4 className="visual-details__section-title">AI Analysis</h4>
                                <p className="visual-details__description">
                                    {currentKeyframe.visionAnalysis.description}
                                </p>

                                <div className="visual-details__scores">
                                    <ScoreBadge
                                        label="Design"
                                        score={currentKeyframe.visionAnalysis.designScore}
                                    />
                                </div>

                                {currentKeyframe.visionAnalysis.antiSlopViolations.length > 0 && (
                                    <div className="visual-details__violations">
                                        <h5 className="visual-details__violations-title">Anti-Slop Violations</h5>
                                        <ul className="visual-details__violations-list">
                                            {currentKeyframe.visionAnalysis.antiSlopViolations.map((v, i) => (
                                                <li key={i} className="visual-details__violation-item">{v}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {currentKeyframe.visionAnalysis.accessibilityIssues.length > 0 && (
                                    <div className="visual-details__a11y">
                                        <h5 className="visual-details__a11y-title">Accessibility Issues</h5>
                                        <ul className="visual-details__a11y-list">
                                            {currentKeyframe.visionAnalysis.accessibilityIssues.map((a, i) => (
                                                <li key={i} className="visual-details__a11y-item">{a}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <p className="visual-details__assessment">
                                    {currentKeyframe.visionAnalysis.overallAssessment}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'issues' && (
                        <motion.div
                            key="issues"
                            className="visual-details__issues"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {/* Issue Summary */}
                            <div className="visual-details__issue-summary">
                                <div className="visual-details__issue-stat visual-details__issue-stat--critical">
                                    <AlertIcon className="w-4 h-4" />
                                    <span>{criticalCount} Critical</span>
                                </div>
                                <div className="visual-details__issue-stat visual-details__issue-stat--major">
                                    <span className="visual-details__issue-dot" />
                                    <span>{majorCount} Major</span>
                                </div>
                                <div className="visual-details__issue-stat">
                                    <CheckIcon className="w-4 h-4" />
                                    <span>{allIssues.length - criticalCount - majorCount} Minor</span>
                                </div>
                            </div>

                            {/* Issue List */}
                            {allIssues.length > 0 ? (
                                <div className="visual-details__issue-list">
                                    {allIssues.map((issue) => (
                                        <IssueCard key={issue.id} issue={issue} />
                                    ))}
                                </div>
                            ) : (
                                <div className="visual-details__empty">
                                    <CheckIcon className="w-8 h-8 text-green-500" />
                                    <p>No issues detected</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'console' && (
                        <motion.div
                            key="console"
                            className="visual-details__console"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="visual-details__console-header">
                                <ConsoleIcon className="w-5 h-5" />
                                <span>Console Errors</span>
                                {consoleErrors.length > 0 && (
                                    <span className="visual-details__console-count">
                                        {consoleErrors.length} error{consoleErrors.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {consoleErrors.length > 0 ? (
                                <div className="visual-details__console-list">
                                    {consoleErrors.map((error) => (
                                        <div
                                            key={error.id}
                                            className={`console-error-item console-error-item--${error.type}`}
                                        >
                                            <div className="console-error-item__header">
                                                <span className={`console-error-item__type console-error-item__type--${error.type}`}>
                                                    {error.type}
                                                </span>
                                                <span className="console-error-item__time">
                                                    {formatErrorTime(error.timestamp)}
                                                </span>
                                            </div>
                                            <code className="console-error-item__message">
                                                {error.message}
                                            </code>
                                            {error.source && (
                                                <span className="console-error-item__source">
                                                    {error.source}{error.lineNumber ? `:${error.lineNumber}` : ''}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="visual-details__empty">
                                    <CheckIcon className="w-8 h-8 text-green-500" />
                                    <p>No console errors detected</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export default VisualVerificationDetails;
