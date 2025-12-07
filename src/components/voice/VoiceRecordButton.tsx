/**
 * Voice Record Button
 *
 * Press-to-talk or continuous recording button with audio visualization.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square } from 'lucide-react';

const accentColor = '#c8ff64';

interface VoiceRecordButtonProps {
    onRecordingComplete: (audioBlob: Blob, mimeType: string) => void;
    onRecordingStart?: () => void;
    onRecordingStop?: () => void;
    disabled?: boolean;
    mode?: 'push-to-talk' | 'toggle';
    className?: string;
}

export function VoiceRecordButton({
    onRecordingComplete,
    onRecordingStart,
    onRecordingStop,
    disabled = false,
    mode = 'toggle',
    className = '',
}: VoiceRecordButtonProps) {
    const [isRecording, setIsRecording] = useState(false);
    const [_isPressing, setIsPressing] = useState(false);
    const [audioLevel, setAudioLevel] = useState(0);
    const [duration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number>(0);
    const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (durationIntervalRef.current) {
                clearInterval(durationIntervalRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Start audio level monitoring
    const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevel = () => {
            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(average / 255);

            animationFrameRef.current = requestAnimationFrame(updateLevel);
        };

        updateLevel();
    }, []);

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Determine best supported format
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                onRecordingComplete(audioBlob, mimeType);

                // Cleanup
                stream.getTracks().forEach(track => track.stop());
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
                if (durationIntervalRef.current) {
                    clearInterval(durationIntervalRef.current);
                }
                setAudioLevel(0);
                setDuration(0);
            };

            mediaRecorder.start(100); // Collect data every 100ms
            setIsRecording(true);
            setDuration(0);

            // Start duration counter
            durationIntervalRef.current = setInterval(() => {
                setDuration(d => d + 1);
            }, 1000);

            // Start audio level monitoring
            startAudioLevelMonitoring(stream);

            onRecordingStart?.();
        } catch (error) {
            console.error('Failed to start recording:', error);
        }
    }, [onRecordingComplete, onRecordingStart, startAudioLevelMonitoring]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            onRecordingStop?.();
        }
    }, [isRecording, onRecordingStop]);

    // Handle toggle mode click
    const handleClick = useCallback(() => {
        if (disabled) return;

        if (mode === 'toggle') {
            if (isRecording) {
                stopRecording();
            } else {
                startRecording();
            }
        }
    }, [disabled, mode, isRecording, startRecording, stopRecording]);

    // Handle push-to-talk
    const handleMouseDown = useCallback(() => {
        if (disabled || mode !== 'push-to-talk') return;
        setIsPressing(true);
        startRecording();
    }, [disabled, mode, startRecording]);

    const handleMouseUp = useCallback(() => {
        if (mode !== 'push-to-talk') return;
        setIsPressing(false);
        if (isRecording) {
            stopRecording();
        }
    }, [mode, isRecording, stopRecording]);

    // Keyboard shortcut (Space to record)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
                e.preventDefault();
                if (mode === 'push-to-talk' && !isRecording && !disabled) {
                    setIsPressing(true);
                    startRecording();
                } else if (mode === 'toggle' && !disabled) {
                    handleClick();
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && mode === 'push-to-talk' && isRecording) {
                e.preventDefault();
                setIsPressing(false);
                stopRecording();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [mode, isRecording, disabled, startRecording, stopRecording, handleClick]);

    // Format duration
    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`flex flex-col items-center gap-3 ${className}`}>
            {/* Main Button */}
            <motion.button
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                disabled={disabled}
                whileTap={{ scale: 0.95 }}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                    disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                    background: isRecording
                        ? `linear-gradient(145deg, #ef4444 0%, #dc2626 100%)`
                        : `linear-gradient(145deg, ${accentColor} 0%, ${accentColor}cc 100%)`,
                    boxShadow: isRecording
                        ? `0 0 30px rgba(239, 68, 68, 0.5), 0 0 60px rgba(239, 68, 68, 0.3)`
                        : `0 10px 30px rgba(0,0,0,0.3)`,
                }}
            >
                {/* Pulsing ring when recording */}
                <AnimatePresence>
                    {isRecording && (
                        <>
                            <motion.div
                                initial={{ scale: 1, opacity: 0.5 }}
                                animate={{ scale: 1.5 + audioLevel * 0.5, opacity: 0 }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="absolute inset-0 rounded-full bg-red-500"
                            />
                            <motion.div
                                initial={{ scale: 1, opacity: 0.3 }}
                                animate={{ scale: 1.3 + audioLevel * 0.3, opacity: 0 }}
                                transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                                className="absolute inset-0 rounded-full bg-red-500"
                            />
                        </>
                    )}
                </AnimatePresence>

                {/* Audio level indicator */}
                {isRecording && (
                    <motion.div
                        className="absolute inset-2 rounded-full border-4 border-white/30"
                        style={{
                            transform: `scale(${1 + audioLevel * 0.2})`,
                        }}
                    />
                )}

                {/* Icon */}
                {isRecording ? (
                    <Square className="w-8 h-8 text-white fill-white" />
                ) : (
                    <Mic className="w-8 h-8 text-black" />
                )}
            </motion.button>

            {/* Duration display */}
            <AnimatePresence>
                {isRecording && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2 text-sm"
                    >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-white font-mono">{formatDuration(duration)}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hint */}
            <p className="text-xs text-white/40 text-center">
                {mode === 'push-to-talk'
                    ? 'Hold to record (or press Space)'
                    : isRecording
                        ? 'Click to stop (or press Space)'
                        : 'Click to start (or press Space)'}
            </p>
        </div>
    );
}

