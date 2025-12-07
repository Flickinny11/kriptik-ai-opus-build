/**
 * Voice Visualizer
 *
 * Audio waveform visualization during recording.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const accentColor = '#c8ff64';

interface VoiceVisualizerProps {
    isActive: boolean;
    audioStream?: MediaStream;
    className?: string;
    variant?: 'bars' | 'wave' | 'circle';
    barCount?: number;
    color?: string;
}

export function VoiceVisualizer({
    isActive,
    audioStream,
    className = '',
    variant = 'bars',
    barCount = 32,
    color = accentColor,
}: VoiceVisualizerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const [audioLevels, setAudioLevels] = useState<number[]>(Array(barCount).fill(0));

    // Initialize audio analysis
    useEffect(() => {
        if (!audioStream || !isActive) {
            setAudioLevels(Array(barCount).fill(0));
            return;
        }

        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(audioStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateLevels = () => {
            if (!analyserRef.current) return;

            analyserRef.current.getByteFrequencyData(dataArray);

            // Sample from the frequency data
            const levels: number[] = [];
            const step = Math.floor(dataArray.length / barCount);
            for (let i = 0; i < barCount; i++) {
                const value = dataArray[i * step] / 255;
                levels.push(value);
            }
            setAudioLevels(levels);

            animationRef.current = requestAnimationFrame(updateLevels);
        };

        updateLevels();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            audioContext.close();
        };
    }, [audioStream, isActive, barCount]);

    // Canvas-based wave visualization
    useEffect(() => {
        if (variant !== 'wave' || !canvasRef.current || !isActive) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let phase = 0;
        const animate = () => {
            if (!ctx || !canvas) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const avgLevel = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;
            const amplitude = 20 + avgLevel * 40;

            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);

            for (let x = 0; x < canvas.width; x++) {
                const normalizedX = x / canvas.width;
                const y = canvas.height / 2 +
                    Math.sin(normalizedX * 6 + phase) * amplitude *
                    Math.sin(normalizedX * Math.PI);
                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Gradient fill under the wave
            const gradient = ctx.createLinearGradient(0, canvas.height / 2 - amplitude, 0, canvas.height / 2 + amplitude);
            gradient.addColorStop(0, `${color}00`);
            gradient.addColorStop(0.5, `${color}30`);
            gradient.addColorStop(1, `${color}00`);

            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fillStyle = gradient;
            ctx.fill();

            phase += 0.05 + avgLevel * 0.1;
            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [variant, isActive, audioLevels, color]);

    // Bars visualization
    if (variant === 'bars') {
        return (
            <div className={`flex items-end justify-center gap-1 h-16 ${className}`}>
                {audioLevels.map((level, index) => (
                    <motion.div
                        key={index}
                        className="w-1 rounded-full"
                        style={{
                            background: isActive ? color : 'rgba(255,255,255,0.2)',
                        }}
                        animate={{
                            height: isActive ? Math.max(4, level * 60) : 4,
                            opacity: isActive ? 0.5 + level * 0.5 : 0.3,
                        }}
                        transition={{
                            duration: 0.05,
                        }}
                    />
                ))}
            </div>
        );
    }

    // Wave visualization
    if (variant === 'wave') {
        return (
            <canvas
                ref={canvasRef}
                width={300}
                height={80}
                className={`${className}`}
                style={{ opacity: isActive ? 1 : 0.3 }}
            />
        );
    }

    // Circle visualization
    if (variant === 'circle') {
        const avgLevel = audioLevels.reduce((a, b) => a + b, 0) / audioLevels.length;

        return (
            <div className={`relative ${className}`}>
                {/* Outer rings */}
                {[0, 1, 2].map((ring) => (
                    <motion.div
                        key={ring}
                        className="absolute inset-0 rounded-full border-2"
                        style={{
                            borderColor: isActive ? `${color}${40 - ring * 10}` : 'rgba(255,255,255,0.1)',
                        }}
                        animate={{
                            scale: isActive ? 1 + avgLevel * (0.3 + ring * 0.2) : 1,
                            opacity: isActive ? 1 - ring * 0.3 : 0.3,
                        }}
                        transition={{ duration: 0.1 }}
                    />
                ))}

                {/* Inner circle with glow */}
                <motion.div
                    className="absolute inset-4 rounded-full"
                    style={{
                        background: isActive
                            ? `radial-gradient(circle, ${color}60 0%, ${color}20 100%)`
                            : 'rgba(255,255,255,0.1)',
                    }}
                    animate={{
                        scale: isActive ? 0.9 + avgLevel * 0.2 : 1,
                    }}
                    transition={{ duration: 0.1 }}
                />

                {/* Center dot */}
                <motion.div
                    className="absolute w-4 h-4 rounded-full"
                    style={{
                        background: isActive ? color : 'rgba(255,255,255,0.3)',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                    }}
                    animate={{
                        scale: isActive ? 1 + avgLevel * 0.5 : 1,
                    }}
                    transition={{ duration: 0.1 }}
                />
            </div>
        );
    }

    return null;
}

// Simpler, standalone pulsing visualizer (no audio input needed)
export function PulsingVisualizer({
    isActive,
    className = '',
    color = accentColor,
}: {
    isActive: boolean;
    className?: string;
    color?: string;
}) {
    return (
        <div className={`flex items-center justify-center gap-1 h-8 ${className}`}>
            {[0, 1, 2, 3, 4].map((index) => (
                <motion.div
                    key={index}
                    className="w-1 rounded-full"
                    style={{ background: color }}
                    animate={isActive ? {
                        height: [8, 24, 8],
                    } : {
                        height: 4,
                    }}
                    transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: index * 0.1,
                        ease: 'easeInOut',
                    }}
                />
            ))}
        </div>
    );
}

