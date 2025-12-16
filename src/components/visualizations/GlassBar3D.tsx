/**
 * GlassBar3D - Premium glass bar for 3D bar charts
 *
 * Features:
 * - MeshTransmissionMaterial for realistic glass
 * - Animated height with spring physics
 * - Hover state with glow effect
 * - Click interaction
 * - Value label floating above
 * - Color based on value/threshold
 */

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// ============================================================================
// TYPES
// ============================================================================

export interface GlassBar3DProps {
    value: number;
    maxValue: number;
    position?: [number, number, number];
    width?: number;
    depth?: number;
    maxHeight?: number;
    color?: string;
    label?: string;
    showValue?: boolean;
    valueFormat?: (value: number) => string;
    threshold?: number;
    thresholdColor?: string;
    warningColor?: string;
    onClick?: () => void;
    onHover?: (hovered: boolean) => void;
    animate?: boolean;
    glowIntensity?: number;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function getBarColor(
    value: number,
    maxValue: number,
    threshold: number | undefined,
    baseColor: string,
    thresholdColor: string,
    warningColor: string
): string {
    const percentage = (value / maxValue) * 100;

    if (threshold !== undefined) {
        if (percentage >= threshold) return thresholdColor;
        if (percentage >= threshold * 0.8) return warningColor;
    }

    return baseColor;
}

// ============================================================================
// GLOW MESH
// ============================================================================

function GlowMesh({
    width,
    height,
    depth,
    color,
    intensity,
}: {
    width: number;
    height: number;
    depth: number;
    color: string;
    intensity: number;
}) {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            const material = meshRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = 0.15 + Math.sin(state.clock.elapsedTime * 2) * 0.05 * intensity;
        }
    });

    return (
        <mesh ref={meshRef} scale={[1.1, 1.02, 1.1]}>
            <boxGeometry args={[width, height, depth]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={0.2}
                side={THREE.BackSide}
            />
        </mesh>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function GlassBar3D({
    value,
    maxValue,
    position = [0, 0, 0],
    width = 0.4,
    depth = 0.4,
    maxHeight = 2,
    color = '#F5A86C',
    label,
    showValue = true,
    valueFormat = (v) => v.toFixed(0),
    threshold,
    thresholdColor = '#c41e3a',
    warningColor = '#cc7722',
    onClick,
    onHover,
    animate = true,
    glowIntensity = 1,
}: GlassBar3DProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const [hovered, setHovered] = useState(false);

    // Calculate height based on value
    const targetHeight = useMemo(() => {
        const normalized = Math.max(0, Math.min(1, value / maxValue));
        return Math.max(0.05, normalized * maxHeight);
    }, [value, maxValue, maxHeight]);

    // Spring animation for height
    const { height, yPosition } = useSpring({
        height: targetHeight,
        yPosition: targetHeight / 2,
        config: {
            mass: 1,
            tension: 180,
            friction: 20,
        },
        immediate: !animate,
    });

    // Get dynamic color
    const barColor = useMemo(
        () => getBarColor(value, maxValue, threshold, color, thresholdColor, warningColor),
        [value, maxValue, threshold, color, thresholdColor, warningColor]
    );

    // Hover animation
    const { scale } = useSpring({
        scale: hovered ? 1.05 : 1,
        config: { tension: 300, friction: 20 },
    });

    // Handle hover
    const handlePointerOver = () => {
        setHovered(true);
        onHover?.(true);
        document.body.style.cursor = onClick ? 'pointer' : 'default';
    };

    const handlePointerOut = () => {
        setHovered(false);
        onHover?.(false);
        document.body.style.cursor = 'default';
    };

    // Handle click
    const handleClick = () => {
        onClick?.();
    };

    return (
        <group position={position}>
            {/* Main bar */}
            <animated.group scale-x={scale} scale-z={scale}>
                <animated.mesh
                    ref={meshRef}
                    position-y={yPosition}
                    scale-y={height.to((h: number) => h / targetHeight || 1)}
                    onPointerOver={handlePointerOver}
                    onPointerOut={handlePointerOut}
                    onClick={handleClick}
                    castShadow
                    receiveShadow
                >
                    <boxGeometry args={[width, targetHeight, depth]} />
                    <MeshTransmissionMaterial
                        backside
                        samples={4}
                        resolution={256}
                        transmission={0.95}
                        roughness={0.1}
                        thickness={0.5}
                        ior={1.45}
                        chromaticAberration={0.02}
                        distortion={0.1}
                        distortionScale={0.2}
                        temporalDistortion={0.1}
                        color={barColor}
                        attenuationDistance={0.5}
                        attenuationColor={barColor}
                    />
                </animated.mesh>

                {/* Glow effect when hovered */}
                {hovered && (
                    <animated.group position-y={yPosition}>
                        <GlowMesh
                            width={width}
                            height={targetHeight}
                            depth={depth}
                            color={barColor}
                            intensity={glowIntensity}
                        />
                    </animated.group>
                )}

                {/* Top edge highlight */}
                <animated.mesh position-y={height}>
                    <boxGeometry args={[width, 0.02, depth]} />
                    <meshStandardMaterial
                        color="#ffffff"
                        emissive="#ffffff"
                        emissiveIntensity={0.5}
                        transparent
                        opacity={0.6}
                    />
                </animated.mesh>
            </animated.group>

            {/* Value label */}
            {showValue && (
                <animated.group position-y={height.to((h) => h + 0.2)}>
                    <Html
                        center
                        distanceFactor={3}
                        style={{
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        <div
                            style={{
                                background: 'rgba(20, 20, 20, 0.9)',
                                backdropFilter: 'blur(8px)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: `1px solid ${barColor}`,
                                boxShadow: `0 0 10px ${barColor}40`,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <span
                                style={{
                                    color: barColor,
                                    fontFamily: 'var(--font-mono, monospace)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                }}
                            >
                                {valueFormat(value)}
                            </span>
                        </div>
                    </Html>
                </animated.group>
            )}

            {/* Label below bar */}
            {label && (
                <Html
                    position={[0, -0.2, 0]}
                    center
                    distanceFactor={3}
                    style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                    }}
                >
                    <div
                        style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontFamily: 'var(--font-sans, system-ui)',
                            fontSize: '11px',
                            fontWeight: 500,
                            textAlign: 'center',
                            maxWidth: '80px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {label}
                    </div>
                </Html>
            )}
        </group>
    );
}

export default GlassBar3D;
