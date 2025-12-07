/**
 * Frame Timeline Component
 *
 * Scrubber showing keyframes and detected interactions from video analysis.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, Pause, Pointer, Navigation } from 'lucide-react';

const accentColor = '#c8ff64';

interface VideoFrame {
    id: string;
    timestamp: number;
    keyframe: boolean;
    image: string;
    uiElements: Array<{
        id: string;
        type: string;
        bounds: { x: number; y: number; width: number; height: number };
        label?: string;
    }>;
}

interface UserJourneyStep {
    id: string;
    frameId: string;
    action: string;
    description: string;
}

interface FrameTimelineProps {
    frames: VideoFrame[];
    selectedFrame: VideoFrame | null;
    onFrameSelect: (frame: VideoFrame) => void;
    userJourney?: UserJourneyStep[];
}

export function FrameTimeline({
    frames,
    selectedFrame,
    onFrameSelect,
    userJourney = []
}: FrameTimelineProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Get total duration
    const totalDuration = frames.length > 0 ? frames[frames.length - 1].timestamp : 0;

    // Find current frame index
    useEffect(() => {
        if (selectedFrame) {
            const index = frames.findIndex(f => f.id === selectedFrame.id);
            if (index !== -1) {
                setCurrentIndex(index);
            }
        }
    }, [selectedFrame, frames]);

    // Auto-play functionality
    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => {
                setCurrentIndex(prev => {
                    const next = prev + 1;
                    if (next >= frames.length) {
                        setIsPlaying(false);
                        return prev;
                    }
                    onFrameSelect(frames[next]);
                    return next;
                });
            }, 1000);
        }

        return () => {
            if (playIntervalRef.current) {
                clearInterval(playIntervalRef.current);
            }
        };
    }, [isPlaying, frames, onFrameSelect]);

    // Scroll to selected frame
    const scrollToFrame = useCallback((index: number) => {
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const frameWidth = 96; // w-24
            const containerWidth = container.clientWidth;
            const scrollPosition = (index * frameWidth) - (containerWidth / 2) + (frameWidth / 2);
            container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
        }
    }, []);

    // Navigate to previous/next frame
    const goToPrevious = useCallback(() => {
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            setCurrentIndex(newIndex);
            onFrameSelect(frames[newIndex]);
            scrollToFrame(newIndex);
        }
    }, [currentIndex, frames, onFrameSelect, scrollToFrame]);

    const goToNext = useCallback(() => {
        if (currentIndex < frames.length - 1) {
            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            onFrameSelect(frames[newIndex]);
            scrollToFrame(newIndex);
        }
    }, [currentIndex, frames, onFrameSelect, scrollToFrame]);

    // Get journey step for frame
    const getJourneyStep = (frameId: string) => {
        return userJourney.find(step => step.frameId === frameId);
    };

    // Format time
    const formatTime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    if (frames.length === 0) {
        return (
            <div className="p-8 text-center text-white/40">
                No frames extracted
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Timeline Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        {isPlaying ? (
                            <Pause className="w-4 h-4 text-white" />
                        ) : (
                            <Play className="w-4 h-4 text-white" />
                        )}
                    </button>
                    <span className="text-sm text-white/60">
                        {formatTime(frames[currentIndex]?.timestamp || 0)} / {formatTime(totalDuration)}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={goToPrevious}
                        disabled={currentIndex === 0}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <span className="text-xs text-white/40 min-w-[60px] text-center">
                        {currentIndex + 1} / {frames.length}
                    </span>
                    <button
                        onClick={goToNext}
                        disabled={currentIndex === frames.length - 1}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        <ChevronRight className="w-4 h-4 text-white" />
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                {/* Keyframe markers */}
                {frames.map((frame) => {
                    if (!frame.keyframe) return null;
                    const position = (frame.timestamp / totalDuration) * 100;
                    return (
                        <div
                            key={frame.id}
                            className="absolute w-1 h-4 -top-1 rounded-full"
                            style={{
                                left: `${position}%`,
                                background: selectedFrame?.id === frame.id ? accentColor : 'rgba(255,255,255,0.4)'
                            }}
                        />
                    );
                })}

                {/* Progress */}
                <motion.div
                    className="h-full rounded-full"
                    style={{ background: accentColor }}
                    animate={{ width: `${((currentIndex + 1) / frames.length) * 100}%` }}
                    transition={{ duration: 0.3 }}
                />
            </div>

            {/* Frame Thumbnails */}
            <div className="relative">
                <div
                    ref={scrollContainerRef}
                    className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/10"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    {frames.map((frame, idx) => {
                        const journeyStep = getJourneyStep(frame.id);
                        const isSelected = selectedFrame?.id === frame.id;

                        return (
                            <motion.div
                                key={frame.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.02 }}
                                onClick={() => {
                                    setCurrentIndex(idx);
                                    onFrameSelect(frame);
                                }}
                                className={`relative flex-shrink-0 w-24 cursor-pointer transition-all rounded-lg ${
                                    isSelected ? 'ring-2' : ''
                                }`}
                                style={isSelected ? {
                                    boxShadow: `0 0 0 2px ${accentColor}`
                                } : undefined}
                            >
                                {/* Thumbnail */}
                                <div className="relative rounded-lg overflow-hidden bg-black/30">
                                    <img
                                        src={`data:image/png;base64,${frame.image}`}
                                        alt={`Frame ${idx + 1}`}
                                        className="w-24 h-16 object-cover"
                                    />

                                    {/* Keyframe indicator */}
                                    {frame.keyframe && (
                                        <div
                                            className="absolute top-1 right-1 w-2 h-2 rounded-full"
                                            style={{ background: accentColor }}
                                        />
                                    )}

                                    {/* Journey step indicator */}
                                    {journeyStep && (
                                        <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/60 text-[8px] text-white/80 truncate">
                                            {journeyStep.action === 'click' && <Pointer className="w-2 h-2 inline mr-1" />}
                                            {journeyStep.action === 'navigate' && <Navigation className="w-2 h-2 inline mr-1" />}
                                            {journeyStep.description.substring(0, 15)}...
                                        </div>
                                    )}

                                    {/* Selection overlay */}
                                    {isSelected && (
                                        <div
                                            className="absolute inset-0"
                                            style={{ background: `${accentColor}20` }}
                                        />
                                    )}
                                </div>

                                {/* Time label */}
                                <div className="text-[10px] text-center text-white/40 mt-1">
                                    {formatTime(frame.timestamp)}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* User Journey Steps */}
            {userJourney.length > 0 && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-xs font-medium text-white/60 mb-3">User Journey</h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {userJourney.map((step, idx) => {
                            const frame = frames.find(f => f.id === step.frameId);
                            const isActive = selectedFrame?.id === step.frameId;

                            return (
                                <button
                                    key={step.id}
                                    onClick={() => frame && onFrameSelect(frame)}
                                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs transition-all ${
                                        isActive
                                            ? 'bg-white/10 text-white'
                                            : 'bg-white/[0.02] text-white/50 hover:bg-white/5 hover:text-white/70'
                                    }`}
                                    style={{
                                        borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent'
                                    }}
                                >
                                    <span className="text-white/30 mr-2">{idx + 1}.</span>
                                    {step.action}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

