/**
 * TileExplosion Component
 *
 * Premium 3D particle explosion animation for when dependency tiles
 * are connected/saved. Uses Canvas for high-performance particle rendering.
 *
 * Features:
 * - 3D particle system with depth perception
 * - Warm photorealistic glow colors
 * - High frame rate (60fps) smooth animation
 * - Physics-based particle movement with gravity
 * - Auto cleanup after animation completes
 */

import React, { useEffect, useRef, useCallback } from 'react';

// =============================================================================
// Types
// =============================================================================

interface Particle {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    size: number;
    color: string;
    alpha: number;
    decay: number;
    rotation: number;
    rotationSpeed: number;
}

export interface TileExplosionProps {
    /** Whether the explosion is active */
    active: boolean;
    /** Center X position of the explosion */
    centerX: number;
    /** Center Y position of the explosion */
    centerY: number;
    /** Width of the tile (for particle bounds) */
    tileWidth: number;
    /** Height of the tile (for particle bounds) */
    tileHeight: number;
    /** Callback when animation completes */
    onComplete: () => void;
    /** Optional custom colors */
    colors?: string[];
}

// =============================================================================
// Configuration
// =============================================================================

const CONFIG = {
    /** Number of particles to spawn */
    particleCount: 60,
    /** Duration of explosion in ms */
    duration: 1200,
    /** Gravity strength */
    gravity: 0.15,
    /** Initial velocity range */
    velocityRange: { min: 3, max: 12 },
    /** Particle size range */
    sizeRange: { min: 4, max: 16 },
    /** Decay rate (alpha reduction per frame) */
    decayRate: { min: 0.008, max: 0.025 },
    /** Z velocity range for 3D depth */
    zVelocityRange: { min: -2, max: 2 },
    /** Rotation speed range */
    rotationSpeedRange: { min: -0.15, max: 0.15 },
};

// Default warm glow colors (gradient from gold to orange to soft red)
const DEFAULT_COLORS = [
    'rgba(255, 215, 150, 1)',   // Warm gold
    'rgba(255, 180, 120, 1)',   // Soft orange
    'rgba(255, 150, 100, 1)',   // Peachy
    'rgba(255, 200, 160, 1)',   // Cream
    'rgba(255, 230, 200, 1)',   // Light warm
    'rgba(255, 160, 130, 1)',   // Coral
];

// =============================================================================
// Helper Functions
// =============================================================================

function randomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
}

function randomFromArray<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function parseRgba(color: string): { r: number; g: number; b: number; a: number } {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
        return {
            r: parseInt(match[1], 10),
            g: parseInt(match[2], 10),
            b: parseInt(match[3], 10),
            a: match[4] ? parseFloat(match[4]) : 1,
        };
    }
    return { r: 255, g: 200, b: 150, a: 1 };
}

// =============================================================================
// Component
// =============================================================================

export const TileExplosion: React.FC<TileExplosionProps> = ({
    active,
    centerX,
    centerY,
    tileWidth,
    tileHeight,
    onComplete,
    colors = DEFAULT_COLORS,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationFrameRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);

    // Create particles
    const createParticles = useCallback(() => {
        const particles: Particle[] = [];

        for (let i = 0; i < CONFIG.particleCount; i++) {
            // Random angle for explosion direction
            const angle = Math.random() * Math.PI * 2;
            const velocity = randomRange(CONFIG.velocityRange.min, CONFIG.velocityRange.max);

            // Add some variation to starting position within tile bounds
            const startX = centerX + randomRange(-tileWidth * 0.3, tileWidth * 0.3);
            const startY = centerY + randomRange(-tileHeight * 0.3, tileHeight * 0.3);

            particles.push({
                x: startX,
                y: startY,
                z: randomRange(-50, 50), // 3D depth
                vx: Math.cos(angle) * velocity,
                vy: Math.sin(angle) * velocity - randomRange(2, 6), // Initial upward bias
                vz: randomRange(CONFIG.zVelocityRange.min, CONFIG.zVelocityRange.max),
                size: randomRange(CONFIG.sizeRange.min, CONFIG.sizeRange.max),
                color: randomFromArray(colors),
                alpha: 1,
                decay: randomRange(CONFIG.decayRate.min, CONFIG.decayRate.max),
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: randomRange(CONFIG.rotationSpeedRange.min, CONFIG.rotationSpeedRange.max),
            });
        }

        return particles;
    }, [centerX, centerY, tileWidth, tileHeight, colors]);

    // Render frame
    const renderFrame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
        const particles = particlesRef.current;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Sort by Z for proper depth rendering (back to front)
        particles.sort((a, b) => a.z - b.z);

        let allDead = true;

        for (const particle of particles) {
            if (particle.alpha <= 0) continue;
            allDead = false;

            // Update physics
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.z += particle.vz;
            particle.vy += CONFIG.gravity; // Gravity
            particle.vx *= 0.99; // Air resistance
            particle.vy *= 0.99;
            particle.vz *= 0.98;
            particle.alpha -= particle.decay;
            particle.rotation += particle.rotationSpeed;

            // 3D perspective scale (closer = bigger)
            const perspective = 1 + (particle.z / 200);
            const renderSize = Math.max(1, particle.size * perspective);

            // Parse color for alpha adjustment
            const { r, g, b } = parseRgba(particle.color);

            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);

            // Glow effect (outer)
            const glowSize = renderSize * 2;
            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
            glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${particle.alpha * 0.5})`);
            glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${particle.alpha * 0.2})`);
            glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            ctx.beginPath();
            ctx.fillStyle = glowGradient;
            ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
            ctx.fill();

            // Core particle (inner, brighter)
            const coreGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, renderSize);
            coreGradient.addColorStop(0, `rgba(255, 255, 255, ${particle.alpha * 0.9})`);
            coreGradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${particle.alpha})`);
            coreGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${particle.alpha * 0.3})`);

            ctx.beginPath();
            ctx.fillStyle = coreGradient;

            // Draw as slightly irregular shape for more organic look
            const irregularity = 0.15;
            const sides = 6;
            ctx.moveTo(renderSize * (1 + randomRange(-irregularity, irregularity)), 0);
            for (let i = 1; i <= sides; i++) {
                const angle = (i / sides) * Math.PI * 2;
                const r = renderSize * (1 + randomRange(-irregularity, irregularity));
                ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();

            ctx.restore();
        }

        return !allDead;
    }, []);

    // Animation loop
    const animate = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');

        if (!canvas || !ctx) return;

        const elapsed = Date.now() - startTimeRef.current;

        // Check if animation should end
        if (elapsed > CONFIG.duration) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onComplete();
            return;
        }

        const hasLiveParticles = renderFrame(ctx, canvas);

        if (hasLiveParticles) {
            animationFrameRef.current = requestAnimationFrame(animate);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onComplete();
        }
    }, [renderFrame, onComplete]);

    // Start/stop animation based on active prop
    useEffect(() => {
        if (active) {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Set canvas size to match parent/viewport
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width || window.innerWidth;
            canvas.height = rect.height || window.innerHeight;

            // Create fresh particles
            particlesRef.current = createParticles();
            startTimeRef.current = Date.now();

            // Start animation
            animationFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [active, createParticles, animate]);

    if (!active) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                pointerEvents: 'none',
                zIndex: 9999,
            }}
            aria-hidden="true"
        />
    );
};

// =============================================================================
// Styled Explosion Variants
// =============================================================================

/**
 * Success explosion with green tones
 */
export const SuccessExplosion: React.FC<Omit<TileExplosionProps, 'colors'>> = (props) => (
    <TileExplosion
        {...props}
        colors={[
            'rgba(120, 255, 150, 1)',
            'rgba(100, 220, 130, 1)',
            'rgba(150, 255, 180, 1)',
            'rgba(200, 255, 210, 1)',
            'rgba(80, 200, 120, 1)',
        ]}
    />
);

/**
 * Premium gold explosion for connected integrations
 */
export const GoldExplosion: React.FC<Omit<TileExplosionProps, 'colors'>> = (props) => (
    <TileExplosion
        {...props}
        colors={[
            'rgba(255, 215, 0, 1)',
            'rgba(255, 200, 80, 1)',
            'rgba(255, 230, 120, 1)',
            'rgba(255, 180, 50, 1)',
            'rgba(255, 245, 200, 1)',
        ]}
    />
);

export default TileExplosion;
