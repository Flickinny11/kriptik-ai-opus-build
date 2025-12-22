/**
 * Agent Demo Overlay - Voice Narrated Demonstrations
 *
 * Provides voice narration overlay for AI agent demonstrations.
 * Features:
 * - Audio playback controls (mute, volume)
 * - Visual highlight overlay using canvas
 * - "Take Control" button to stop demo
 * - Transcript display (optional, collapsible)
 * - Smooth animations with Framer Motion
 *
 * Uses custom SVG icons - NO lucide-react, NO emojis.
 * Liquid glass styling matching existing panels.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// TYPES
// =============================================================================

export type NarrationAction = 'circle' | 'click' | 'type' | 'scroll' | 'wait' | 'highlight' | 'arrow';

export interface NarrationSegment {
    id: string;
    text: string;
    action: NarrationAction;
    target?: string;
    duration?: number;
    coordinates?: { x: number; y: number };
    typedText?: string;
    scrollDirection?: 'up' | 'down' | 'left' | 'right';
    arrowFrom?: { x: number; y: number };
    arrowTo?: { x: number; y: number };
}

export interface NarrationPlaybackSegment {
    segment: NarrationSegment;
    audioBase64: string;
}

export interface AgentDemoOverlayProps {
    isActive: boolean;
    segments: NarrationPlaybackSegment[];
    onTakeControl: () => void;
    onComplete: () => void;
    containerRef?: React.RefObject<HTMLElement>;
    initialVolume?: number;
    showTranscript?: boolean;
}

// =============================================================================
// CUSTOM SVG ICONS
// =============================================================================

function IconPlay({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M4 3v10l9-5-9-5z" fill="currentColor" />
        </svg>
    );
}

function IconPause({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" />
            <rect x="9" y="2" width="4" height="12" rx="1" fill="currentColor" />
        </svg>
    );
}

function IconVolume({ size = 16, muted = false }: { size?: number; muted?: boolean }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2 6v4h3l4 4V2L5 6H2z" fill="currentColor" />
            {muted ? (
                <path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
                <>
                    <path d="M11 5.5c.5.5.8 1.2.8 2s-.3 1.5-.8 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M13 4c1 1 1.5 2.3 1.5 3.5s-.5 2.5-1.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </>
            )}
        </svg>
    );
}

function IconHand({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M8 2v7M5 5v6M11 4v7M3 7v4c0 2 1.5 3 3.5 3h3c2 0 3.5-1 3.5-3V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function IconTranscript({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M4 5h8M4 8h6M4 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    );
}

function IconChevron({ size = 12, direction = 'down' }: { size?: number; direction?: 'up' | 'down' }) {
    const rotation = direction === 'up' ? 180 : 0;
    return (
        <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ transform: `rotate(${rotation}deg)` }}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// =============================================================================
// HIGHLIGHT OVERLAY COMPONENT
// =============================================================================

interface HighlightOverlayProps {
    coordinates?: { x: number; y: number };
    action: NarrationAction;
    isActive: boolean;
    containerBounds?: DOMRect;
}

function HighlightOverlay({ coordinates, action, isActive, containerBounds }: HighlightOverlayProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !coordinates || !isActive) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear previous drawings
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const x = coordinates.x;
        const y = coordinates.y;

        // Draw based on action type
        switch (action) {
            case 'circle':
            case 'highlight': {
                // Animated circle highlight
                ctx.strokeStyle = 'rgba(255, 160, 100, 0.8)';
                ctx.lineWidth = 3;
                ctx.setLineDash([]);

                // Outer glow
                ctx.shadowColor = 'rgba(255, 160, 100, 0.5)';
                ctx.shadowBlur = 20;

                ctx.beginPath();
                ctx.arc(x, y, 40, 0, Math.PI * 2);
                ctx.stroke();

                // Inner pulse
                ctx.strokeStyle = 'rgba(255, 200, 170, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 50, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }

            case 'click': {
                // Click indicator with ripple effect
                ctx.fillStyle = 'rgba(255, 140, 100, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, 20, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 140, 100, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, 25, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }

            case 'arrow': {
                // Attention arrow - would need arrowFrom/arrowTo
                ctx.strokeStyle = 'rgba(255, 160, 100, 0.9)';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);

                ctx.beginPath();
                ctx.moveTo(x - 50, y - 50);
                ctx.lineTo(x, y);
                ctx.stroke();

                // Arrowhead
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - 10, y - 5);
                ctx.lineTo(x - 5, y - 10);
                ctx.closePath();
                ctx.fill();
                break;
            }
        }
    }, [coordinates, action, isActive]);

    if (!isActive || !coordinates) return null;

    return (
        <canvas
            ref={canvasRef}
            width={containerBounds?.width || 800}
            height={containerBounds?.height || 600}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 50,
            }}
        />
    );
}

// =============================================================================
// AGENT DEMO OVERLAY COMPONENT
// =============================================================================

export function AgentDemoOverlay({
    isActive,
    segments,
    onTakeControl,
    onComplete,
    containerRef,
    initialVolume = 0.8,
    showTranscript: initialShowTranscript = false,
}: AgentDemoOverlayProps) {
    const [isPlaying, setIsPlaying] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [volume, setVolume] = useState(initialVolume);
    const [isMuted, setIsMuted] = useState(false);
    const [showTranscript, setShowTranscript] = useState(initialShowTranscript);
    const [currentCoordinates, setCurrentCoordinates] = useState<{ x: number; y: number } | undefined>();
    const [containerBounds, setContainerBounds] = useState<DOMRect | undefined>();
    const [transcriptHistory, setTranscriptHistory] = useState<string[]>([]);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const currentSegment = segments[currentIndex]?.segment;

    // Update container bounds
    useEffect(() => {
        if (containerRef?.current) {
            setContainerBounds(containerRef.current.getBoundingClientRect());
        }
    }, [containerRef]);

    // Play current segment
    const playSegment = useCallback(async (index: number) => {
        if (index >= segments.length) {
            onComplete();
            return;
        }

        const { segment, audioBase64 } = segments[index];
        setCurrentIndex(index);

        // Update coordinates for visual effects
        if (segment.coordinates) {
            setCurrentCoordinates(segment.coordinates);
        }

        // Add to transcript history
        if (segment.text) {
            setTranscriptHistory(prev => [...prev.slice(-4), segment.text]);
        }

        // Play audio if available
        if (audioBase64 && audioBase64.length > 0) {
            try {
                const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
                audio.volume = isMuted ? 0 : volume;
                audioRef.current = audio;

                audio.onended = () => {
                    // Wait a bit after audio ends, then move to next segment
                    const waitTime = Math.max(0, (segment.duration || 2) * 1000 - (audio.duration * 1000));
                    timeoutRef.current = setTimeout(() => {
                        if (isPlaying) {
                            playSegment(index + 1);
                        }
                    }, waitTime);
                };

                audio.onerror = () => {
                    // On error, wait for duration then move on
                    timeoutRef.current = setTimeout(() => {
                        if (isPlaying) {
                            playSegment(index + 1);
                        }
                    }, (segment.duration || 3) * 1000);
                };

                await audio.play();
            } catch (error) {
                console.error('[AgentDemoOverlay] Audio playback error:', error);
                // Continue to next segment after duration
                timeoutRef.current = setTimeout(() => {
                    if (isPlaying) {
                        playSegment(index + 1);
                    }
                }, (segment.duration || 3) * 1000);
            }
        } else {
            // No audio, wait for duration then move on
            timeoutRef.current = setTimeout(() => {
                if (isPlaying) {
                    playSegment(index + 1);
                }
            }, (segment.duration || 3) * 1000);
        }
    }, [segments, volume, isMuted, isPlaying, onComplete]);

    // Start playback when active
    useEffect(() => {
        if (isActive && isPlaying && segments.length > 0) {
            playSegment(currentIndex);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (audioRef.current) {
                audioRef.current.pause();
            }
        };
    }, [isActive]);

    // Update audio volume
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    // Toggle play/pause
    const togglePlayPause = () => {
        if (isPlaying) {
            // Pause
            if (audioRef.current) {
                audioRef.current.pause();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        } else {
            // Resume
            if (audioRef.current && audioRef.current.paused) {
                audioRef.current.play();
            } else {
                playSegment(currentIndex);
            }
        }
        setIsPlaying(!isPlaying);
    };

    // Handle take control
    const handleTakeControl = () => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsPlaying(false);
        onTakeControl();
    };

    if (!isActive) return null;

    const progress = segments.length > 0 ? ((currentIndex + 1) / segments.length) * 100 : 0;

    return (
        <AnimatePresence>
            <motion.div
                className="agent-demo-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    zIndex: 100,
                }}
            >
                {/* Highlight Overlay Canvas */}
                <HighlightOverlay
                    coordinates={currentCoordinates}
                    action={currentSegment?.action || 'wait'}
                    isActive={isPlaying}
                    containerBounds={containerBounds}
                />

                {/* Control Bar - Bottom */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    style={{
                        position: 'absolute',
                        bottom: 16,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 16px',
                        borderRadius: '16px',
                        background: 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.75) 100%)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: `
                            0 8px 32px rgba(0,0,0,0.12),
                            inset 0 1px 2px rgba(255,255,255,0.9),
                            0 0 0 1px rgba(255,255,255,0.5)
                        `,
                        pointerEvents: 'auto',
                    }}
                >
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlayPause}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            border: 'none',
                            background: 'linear-gradient(145deg, rgba(255,180,150,0.8) 0%, rgba(255,160,130,0.7) 100%)',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(255,140,100,0.3)',
                        }}
                    >
                        {isPlaying ? <IconPause size={14} /> : <IconPlay size={14} />}
                    </button>

                    {/* Progress Bar */}
                    <div style={{
                        width: 120,
                        height: 4,
                        borderRadius: 2,
                        background: 'rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                    }}>
                        <motion.div
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.3 }}
                            style={{
                                height: '100%',
                                background: 'linear-gradient(90deg, #ffc8aa 0%, #ff9c6a 100%)',
                                borderRadius: 2,
                            }}
                        />
                    </div>

                    {/* Segment Counter */}
                    <span style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: '#666',
                        minWidth: 40,
                    }}>
                        {currentIndex + 1}/{segments.length}
                    </span>

                    {/* Volume Control */}
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: 'none',
                            background: isMuted ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.5)',
                            color: isMuted ? '#dc2626' : '#666',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <IconVolume size={16} muted={isMuted} />
                    </button>

                    {/* Volume Slider */}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        style={{
                            width: 60,
                            accentColor: '#ffa07a',
                        }}
                    />

                    {/* Transcript Toggle */}
                    <button
                        onClick={() => setShowTranscript(!showTranscript)}
                        style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: 'none',
                            background: showTranscript ? 'rgba(255,180,150,0.3)' : 'rgba(255,255,255,0.5)',
                            color: showTranscript ? '#c25a00' : '#666',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <IconTranscript size={16} />
                    </button>

                    {/* Take Control Button */}
                    <button
                        onClick={handleTakeControl}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: 'none',
                            background: 'linear-gradient(145deg, #1a1a1a 0%, #2a2a2a 100%)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 500,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        }}
                    >
                        <IconHand size={14} />
                        <span>Take Control</span>
                    </button>
                </motion.div>

                {/* Current Narration Text */}
                {currentSegment?.text && (
                    <motion.div
                        key={currentSegment.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: 'absolute',
                            bottom: 80,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            maxWidth: '80%',
                            padding: '12px 20px',
                            borderRadius: 12,
                            background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
                            color: '#fff',
                            fontSize: 14,
                            lineHeight: 1.5,
                            textAlign: 'center',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                            backdropFilter: 'blur(10px)',
                            pointerEvents: 'none',
                        }}
                    >
                        {currentSegment.text}
                    </motion.div>
                )}

                {/* Transcript Panel */}
                <AnimatePresence>
                    {showTranscript && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            style={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                width: 280,
                                maxHeight: '60%',
                                borderRadius: 16,
                                background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 100%)',
                                backdropFilter: 'blur(20px)',
                                boxShadow: `
                                    0 8px 32px rgba(0,0,0,0.1),
                                    inset 0 1px 2px rgba(255,255,255,0.9),
                                    0 0 0 1px rgba(255,255,255,0.5)
                                `,
                                overflow: 'hidden',
                                pointerEvents: 'auto',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                borderBottom: '1px solid rgba(0,0,0,0.06)',
                            }}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                                    Transcript
                                </span>
                                <button
                                    onClick={() => setShowTranscript(false)}
                                    style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 6,
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#666',
                                    }}
                                >
                                    <IconChevron size={12} direction="up" />
                                </button>
                            </div>

                            {/* Transcript Content */}
                            <div style={{
                                padding: '12px 16px',
                                maxHeight: 300,
                                overflowY: 'auto',
                            }}>
                                {transcriptHistory.map((text, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: i === transcriptHistory.length - 1 ? 1 : 0.5 }}
                                        style={{
                                            fontSize: 13,
                                            lineHeight: 1.5,
                                            color: '#333',
                                            marginBottom: 8,
                                            paddingLeft: 12,
                                            borderLeft: i === transcriptHistory.length - 1
                                                ? '2px solid #ffa07a'
                                                : '2px solid transparent',
                                        }}
                                    >
                                        {text}
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
}

export default AgentDemoOverlay;
