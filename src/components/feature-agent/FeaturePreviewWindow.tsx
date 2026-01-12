/**
 * Feature Preview Window
 *
 * Large modal/popout window for viewing feature agent output in browser.
 * Supports AI demonstration mode with cursor overlay and user takeover.
 * Integrates voice narration for guided demonstrations.
 *
 * Uses custom SVG icons - NO lucide-react, NO emojis.
 * Glass styling matching existing panels.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiClient } from '@/lib/api-client';
import { AgentDemoOverlay, type NarrationPlaybackSegment } from '../builder/AgentDemoOverlay';
import './feature-preview-window.css';

export interface PreviewEvent {
    type: 'cursor_move' | 'click' | 'type' | 'scroll' | 'screenshot' | 'ai_action' | 'status_change' | 'narration';
    x?: number;
    y?: number;
    text?: string;
    description?: string;
    screenshot?: string;
    status?: string;
    timestamp: number;
}

interface FeaturePreviewWindowProps {
    agentId: string;
    featureName: string;
    sandboxUrl: string;
    onAccept: () => void;
    onClose: () => void;
}

// Custom SVG Icons
function IconClose() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconTakeover() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v5l4 2-4 2v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
        </svg>
    );
}

function IconMerge() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="5" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="13" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 7v4M7 5h4c1.1 0 2 .9 2 2v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconCursor() {
    return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 4l10 5-4 1.5-1.5 4L4 4z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </svg>
    );
}

function IconVoice() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v14M5 5v8M13 5v8M2 7v4M16 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

export function FeaturePreviewWindow({
    agentId,
    featureName,
    sandboxUrl,
    onAccept,
    onClose,
}: FeaturePreviewWindowProps) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [status, setStatus] = useState<'loading' | 'ai_demo' | 'user_control' | 'ended'>('loading');
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
    const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);
    const [narration, setNarration] = useState<string>('');
    const [showAcceptConfirm, setShowAcceptConfirm] = useState(false);
    const [isAccepting, setIsAccepting] = useState(false);
    const [voiceNarrationEnabled, setVoiceNarrationEnabled] = useState(true);
    const [narrationSegments, setNarrationSegments] = useState<NarrationPlaybackSegment[]>([]);
    const [isVoiceNarrating, setIsVoiceNarrating] = useState(false);

    const eventSourceRef = useRef<EventSource | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);

    // Start preview session
    useEffect(() => {
        const startPreview = async () => {
            try {
                interface StartPreviewResponse {
                    success: boolean;
                    session?: {
                        id: string;
                        featureAgentId: string;
                        sandboxUrl: string;
                        status: string;
                        createdAt: string;
                    };
                }

                const response = await apiClient.get<StartPreviewResponse>(
                    `/api/preview/${encodeURIComponent(agentId)}/start?sandboxUrl=${encodeURIComponent(sandboxUrl)}`
                );
                const data = response.data;

                if (data.success && data.session) {
                    setSessionId(data.session.id);
                    setStatus('ai_demo');

                    // Connect to SSE stream - use API_URL for proper server connection
                    const apiBase = import.meta.env.VITE_API_URL || '';
                    const eventSource = new EventSource(
                        `${apiBase}/api/preview/${encodeURIComponent(data.session.id)}/stream`,
                        { withCredentials: true }
                    );

                    eventSource.onmessage = (event) => {
                        try {
                            const previewEvent: PreviewEvent = JSON.parse(event.data);
                            handlePreviewEvent(previewEvent);
                        } catch (error) {
                            console.error('Failed to parse preview event:', error);
                        }
                    };

                    eventSource.onerror = () => {
                        console.error('Preview SSE connection error');
                    };

                    eventSourceRef.current = eventSource;

                    // Start AI demo
                    await apiClient.post(`/api/preview/${encodeURIComponent(data.session.id)}/ai-demo`, {});

                    // Fetch voice narration if enabled
                    if (voiceNarrationEnabled) {
                        try {
                            interface NarrationResponse {
                                success: boolean;
                                segments?: NarrationPlaybackSegment[];
                            }
                            const narrationResponse = await apiClient.get<NarrationResponse>(
                                `/api/preview/${encodeURIComponent(data.session.id)}/narration`
                            );
                            if (narrationResponse.data.success && narrationResponse.data.segments) {
                                setNarrationSegments(narrationResponse.data.segments);
                                setIsVoiceNarrating(true);
                            }
                        } catch (narrationError) {
                            console.warn('Voice narration unavailable:', narrationError);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to start preview:', error);
                setNarration('Failed to start preview. The sandbox may not be available.');
            }
        };

        startPreview();

        // Cleanup
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            if (sessionId) {
                apiClient.post(`/api/preview/${encodeURIComponent(sessionId)}/end`, {}).catch(() => { });
            }
        };
    }, [agentId, sandboxUrl]);

    // Handle incoming preview events
    const handlePreviewEvent = useCallback((event: PreviewEvent) => {
        switch (event.type) {
            case 'cursor_move':
                if (event.x !== undefined && event.y !== undefined) {
                    setCursorPosition({ x: event.x, y: event.y });
                }
                break;

            case 'screenshot':
                if (event.screenshot) {
                    setCurrentScreenshot(event.screenshot);
                }
                break;

            case 'narration':
                if (event.description) {
                    setNarration(event.description);
                }
                break;

            case 'status_change':
                if (event.status === 'ai_demo') setStatus('ai_demo');
                else if (event.status === 'user_control') setStatus('user_control');
                else if (event.status === 'ended') setStatus('ended');
                break;

            case 'click':
            case 'type':
                if (event.description) {
                    setNarration(event.description);
                }
                break;
        }
    }, []);

    // Handle user takeover
    const handleTakeover = async () => {
        if (!sessionId) return;
        try {
            await apiClient.post(`/api/preview/${encodeURIComponent(sessionId)}/takeover`, {});
            setStatus('user_control');
            setIsVoiceNarrating(false);
            setNarration('You now have control. Interact with the preview to verify the feature.');
        } catch (error) {
            console.error('Failed to takeover:', error);
        }
    };

    // Handle voice narration complete
    const handleNarrationComplete = () => {
        setIsVoiceNarrating(false);
        setNarration('Demo complete! You can now take control or accept the feature.');
    };

    // Toggle voice narration
    const toggleVoiceNarration = () => {
        setVoiceNarrationEnabled(!voiceNarrationEnabled);
        if (voiceNarrationEnabled) {
            setIsVoiceNarrating(false);
        }
    };

    // Handle feature acceptance and merge
    const handleAccept = async () => {
        if (!sessionId) return;
        setIsAccepting(true);
        setNarration('Merging feature into target branch...');

        try {
            interface AcceptResponse {
                success: boolean;
                accepted: boolean;
                featureAgentId: string;
                mergeId?: string;
                mergeStatus?: 'approved' | 'merged';
                message: string;
                merged: boolean;
                error?: string;
                details?: string;
                needsManualResolution?: boolean;
            }

            const response = await apiClient.post<AcceptResponse>(
                `/api/preview/${encodeURIComponent(sessionId)}/accept`,
                { targetBranch: 'main' }
            );

            if (response.data.success) {
                // Show success message based on merge result
                if (response.data.merged) {
                    setNarration(`Merge successful. ${response.data.message}`);
                } else {
                    setNarration(response.data.message);
                }

                // Brief delay to show success message before closing
                await new Promise(resolve => setTimeout(resolve, 1500));
                onAccept();
                onClose();
            } else {
                throw new Error(response.data.error || 'Merge failed');
            }
        } catch (error: any) {
            console.error('Failed to accept feature:', error);

            // Check for merge conflicts
            if (error.response?.status === 409) {
                setNarration('Merge conflicts detected. Manual resolution required.');
            } else {
                const errorMessage = error.response?.data?.details || error.message || 'Unknown error';
                setNarration(`Merge failed: ${errorMessage}`);
            }
        } finally {
            setIsAccepting(false);
            setShowAcceptConfirm(false);
        }
    };

    // Handle close
    const handleClose = async () => {
        if (sessionId) {
            try {
                await apiClient.post(`/api/preview/${encodeURIComponent(sessionId)}/end`, {});
            } catch {
                // Ignore errors on close
            }
        }
        onClose();
    };

    return (
        <motion.div
            className="fpw"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        >
            {/* Overlay */}
            <div className="fpw__overlay" onClick={handleClose} />

            {/* Window */}
            <motion.div
                className="fpw__window"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                {/* Header */}
                <div className="fpw__header">
                    <div className="fpw__header-left">
                        <span className="fpw__title">Feature Preview: "{featureName}"</span>
                        <span className={`fpw__status fpw__status--${status}`}>
                            {status === 'loading' && 'Starting...'}
                            {status === 'ai_demo' && (isVoiceNarrating ? 'Voice Demo Active' : 'AI Demonstrating')}
                            {status === 'user_control' && 'You\'re in Control'}
                            {status === 'ended' && 'Preview Ended'}
                        </span>
                    </div>
                    <div className="fpw__header-right">
                        <button
                            className={`fpw__btn-icon ${voiceNarrationEnabled ? 'fpw__btn-icon--active' : ''}`}
                            onClick={toggleVoiceNarration}
                            title={voiceNarrationEnabled ? 'Disable Voice Narration' : 'Enable Voice Narration'}
                        >
                            <IconVoice />
                        </button>
                        <button className="fpw__close" onClick={handleClose}>
                            <IconClose />
                        </button>
                    </div>
                </div>

                {/* Preview Area */}
                <div className="fpw__preview" ref={previewRef}>
                    {status === 'loading' ? (
                        <div className="fpw__loading">
                            <motion.div
                                className="fpw__spinner"
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            />
                            <span>Starting preview...</span>
                        </div>
                    ) : status === 'user_control' ? (
                        <iframe
                            src={sandboxUrl}
                            className="fpw__iframe"
                            title="Feature Preview"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                        />
                    ) : currentScreenshot ? (
                        <div className="fpw__screenshot-container">
                            <img
                                src={`data:image/png;base64,${currentScreenshot}`}
                                alt="Preview"
                                className="fpw__screenshot"
                            />
                            {/* AI Cursor Overlay */}
                            {status === 'ai_demo' && !isVoiceNarrating && (
                                <motion.div
                                    className="fpw__cursor"
                                    animate={{ x: cursorPosition.x, y: cursorPosition.y }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                >
                                    <IconCursor />
                                    <div className="fpw__cursor-trail" />
                                </motion.div>
                            )}
                            {/* Voice Narration Overlay */}
                            {isVoiceNarrating && narrationSegments.length > 0 && (
                                <AgentDemoOverlay
                                    isActive={isVoiceNarrating}
                                    segments={narrationSegments}
                                    onTakeControl={handleTakeover}
                                    onComplete={handleNarrationComplete}
                                    containerRef={previewRef as React.RefObject<HTMLElement>}
                                    showTranscript={true}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="fpw__placeholder">
                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                                <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" opacity="0.3" />
                                <circle cx="32" cy="32" r="8" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                            </svg>
                            <span>Waiting for preview...</span>
                        </div>
                    )}
                </div>

                {/* Narration Bar */}
                <AnimatePresence>
                    {narration && (
                        <motion.div
                            className="fpw__narration"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="fpw__narration-icon">
                                {status === 'ai_demo' && <IconCursor />}
                            </div>
                            <span>{narration}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Control Bar */}
                <div className="fpw__controls">
                    <button
                        className="fpw__btn fpw__btn--takeover"
                        onClick={handleTakeover}
                        disabled={status !== 'ai_demo'}
                    >
                        <IconTakeover />
                        <span>Takeover Control</span>
                    </button>

                    <div className="fpw__controls-right">
                        {showAcceptConfirm ? (
                            <div className="fpw__confirm">
                                <span>Merge feature into your branch?</span>
                                <button
                                    className="fpw__btn fpw__btn--confirm-yes"
                                    onClick={handleAccept}
                                    disabled={isAccepting}
                                >
                                    {isAccepting ? 'Merging...' : 'Confirm'}
                                </button>
                                <button
                                    className="fpw__btn fpw__btn--confirm-no"
                                    onClick={() => setShowAcceptConfirm(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    className="fpw__btn fpw__btn--accept"
                                    onClick={() => setShowAcceptConfirm(true)}
                                    disabled={status === 'loading'}
                                >
                                    <IconMerge />
                                    <span>Accept Feature & Merge</span>
                                </button>
                                <button className="fpw__btn fpw__btn--close" onClick={handleClose}>
                                    Close
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default FeaturePreviewWindow;
