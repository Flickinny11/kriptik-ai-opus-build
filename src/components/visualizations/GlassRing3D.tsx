/**
 * GlassRing3D - Premium 3D ring/torus for circular metrics
 *
 * Features:
 * - Progress animation around ring
 * - Glowing edge on filled portion
 * - Center value display
 * - Pulsing animation when active
 * - Segmented display option
 */

import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useSpring, animated } from '@react-spring/three';

// ============================================================================
// TYPES
// ============================================================================

export interface GlassRing3DProps {
    value: number;
    maxValue?: number;
    position?: [number, number, number];
    radius?: number;
    tubeRadius?: number;
    color?: string;
    backgroundColor?: string;
    label?: string;
    showValue?: boolean;
    valueFormat?: (value: number, max: number) => string;
    segments?: number;
    thickness?: number;
    onClick?: () => void;
    onHover?: (hovered: boolean) => void;
    animate?: boolean;
    pulsing?: boolean;
    glowColor?: string;
}

export interface RingSegment {
    value: number;
    color: string;
    label?: string;
}

export interface SegmentedRing3DProps {
    segments: RingSegment[];
    maxValue?: number;
    position?: [number, number, number];
    radius?: number;
    tubeRadius?: number;
    backgroundColor?: string;
    centerLabel?: string;
    onClick?: (segmentIndex: number) => void;
}

// ============================================================================
// PROGRESS RING GEOMETRY
// ============================================================================

function ProgressRingGeometry({
    radius,
    tubeRadius,
    progress,
    segments = 64,
}: {
    radius: number;
    tubeRadius: number;
    progress: number;
    segments?: number;
}) {
    const geometry = useMemo(() => {
        const arcLength = Math.PI * 2 * Math.max(0.001, Math.min(1, progress));
        const geo = new THREE.TorusGeometry(radius, tubeRadius, 16, segments, arcLength);
        geo.rotateZ(Math.PI / 2); // Start from top
        return geo;
    }, [radius, tubeRadius, progress, segments]);

    return <primitive object={geometry} attach="geometry" />;
}

// ============================================================================
// GLOW RING
// ============================================================================

function GlowRing({
    radius,
    progress,
    color,
    intensity,
}: {
    radius: number;
    progress: number;
    color: string;
    intensity: number;
}) {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (ringRef.current) {
            const material = ringRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.1 * intensity;
        }
    });

    if (progress <= 0) return null;

    return (
        <mesh ref={ringRef} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[radius, 0.08, 8, 64, Math.PI * 2 * progress]} />
            <meshBasicMaterial
                color={color}
                transparent
                opacity={0.4}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// ============================================================================
// MAIN RING COMPONENT
// ============================================================================

export function GlassRing3D({
    value,
    maxValue = 100,
    position = [0, 0, 0],
    radius = 1,
    tubeRadius = 0.08,
    color = '#F5A86C',
    backgroundColor: _backgroundColor = 'rgba(255, 255, 255, 0.1)',
    label,
    showValue = true,
    valueFormat = (v: number, max: number) => `${Math.round((v / max) * 100)}%`,
    onClick,
    onHover,
    animate = true,
    pulsing = false,
    glowColor,
}: GlassRing3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const [hovered, setHovered] = useState(false);

    // Calculate progress
    const targetProgress = useMemo(
        () => Math.max(0, Math.min(1, value / maxValue)),
        [value, maxValue]
    );

    // Spring animation for progress
    const { progress } = useSpring({
        progress: targetProgress,
        config: {
            mass: 1,
            tension: 120,
            friction: 20,
        },
        immediate: !animate,
    });

    // Pulse animation
    useFrame((state) => {
        if (groupRef.current && pulsing) {
            const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.02;
            groupRef.current.scale.setScalar(scale);
        }
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

    // Determine display color based on value
    const displayColor = useMemo(() => {
        const percentage = (value / maxValue) * 100;
        if (percentage >= 90) return '#1a8754'; // Green
        if (percentage >= 70) return color; // Default
        if (percentage >= 50) return '#cc7722'; // Warning
        return '#c41e3a'; // Danger
    }, [value, maxValue, color]);

    return (
        <group ref={groupRef} position={position}>
            {/* Background ring */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[radius, tubeRadius, 16, 64]} />
                <meshStandardMaterial
                    color="#333333"
                    transparent
                    opacity={0.3}
                    roughness={0.8}
                />
            </mesh>

            {/* Progress ring */}
            <animated.group
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onClick={onClick}
            >
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <ProgressRingGeometry
                        radius={radius}
                        tubeRadius={tubeRadius}
                        progress={progress.get()}
                    />
                    <MeshTransmissionMaterial
                        backside
                        samples={4}
                        resolution={256}
                        transmission={0.9}
                        roughness={0.1}
                        thickness={0.3}
                        ior={1.45}
                        chromaticAberration={0.015}
                        color={displayColor}
                        attenuationDistance={0.3}
                        attenuationColor={displayColor}
                    />
                </mesh>

                {/* Progress ring using static geometry */}
                <mesh rotation={[0, 0, Math.PI / 2]}>
                    <torusGeometry args={[radius, tubeRadius, 16, 64, Math.PI * 2 * targetProgress]} />
                    <MeshTransmissionMaterial
                        backside
                        samples={4}
                        resolution={256}
                        transmission={0.9}
                        roughness={0.1}
                        thickness={0.3}
                        ior={1.45}
                        chromaticAberration={0.015}
                        color={displayColor}
                        attenuationDistance={0.3}
                        attenuationColor={displayColor}
                    />
                </mesh>
            </animated.group>

            {/* Glow effect */}
            {(hovered || pulsing) && (
                <GlowRing
                    radius={radius}
                    progress={targetProgress}
                    color={glowColor || displayColor}
                    intensity={hovered ? 1.5 : 1}
                />
            )}

            {/* Leading edge glow */}
            <animated.group
                rotation-z={progress.to((p) => Math.PI / 2 + Math.PI * 2 * p)}
                position-x={progress.to((p) => Math.cos(Math.PI / 2 + Math.PI * 2 * p) * radius)}
                position-y={progress.to((p) => Math.sin(Math.PI / 2 + Math.PI * 2 * p) * radius)}
            >
                <mesh>
                    <sphereGeometry args={[tubeRadius * 1.5, 16, 16]} />
                    <meshStandardMaterial
                        color={displayColor}
                        emissive={displayColor}
                        emissiveIntensity={0.8}
                        transparent
                        opacity={0.8}
                    />
                </mesh>
            </animated.group>

            {/* Center content */}
            <Html center distanceFactor={3} style={{ pointerEvents: 'none' }}>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    {showValue && (
                        <span
                            style={{
                                color: displayColor,
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '24px',
                                fontWeight: 700,
                                textShadow: `0 0 10px ${displayColor}60`,
                            }}
                        >
                            {valueFormat(value, maxValue)}
                        </span>
                    )}
                    {label && (
                        <span
                            style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontFamily: 'var(--font-sans, system-ui)',
                                fontSize: '12px',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {label}
                        </span>
                    )}
                </div>
            </Html>
        </group>
    );
}

// ============================================================================
// SEGMENTED RING COMPONENT
// ============================================================================

export function SegmentedRing3D({
    segments,
    maxValue = 100,
    position = [0, 0, 0],
    radius = 1,
    tubeRadius = 0.08,
    backgroundColor: _backgroundColor = 'rgba(255, 255, 255, 0.1)',
    centerLabel,
    onClick,
}: SegmentedRing3DProps) {
    const totalValue = segments.reduce((acc, seg) => acc + seg.value, 0);
    let currentAngle = Math.PI / 2; // Start from top

    return (
        <group position={position}>
            {/* Background ring */}
            <mesh>
                <torusGeometry args={[radius, tubeRadius, 16, 64]} />
                <meshStandardMaterial
                    color="#333333"
                    transparent
                    opacity={0.3}
                    roughness={0.8}
                />
            </mesh>

            {/* Segments */}
            {segments.map((segment, index) => {
                const segmentAngle = (segment.value / maxValue) * Math.PI * 2;
                const startAngle = currentAngle;
                currentAngle += segmentAngle;

                return (
                    <mesh
                        key={index}
                        rotation={[0, 0, startAngle]}
                        onClick={() => onClick?.(index)}
                    >
                        <torusGeometry
                            args={[radius, tubeRadius, 16, 32, segmentAngle - 0.02]}
                        />
                        <MeshTransmissionMaterial
                            backside
                            samples={4}
                            resolution={256}
                            transmission={0.9}
                            roughness={0.1}
                            thickness={0.3}
                            ior={1.45}
                            chromaticAberration={0.015}
                            color={segment.color}
                            attenuationDistance={0.3}
                            attenuationColor={segment.color}
                        />
                    </mesh>
                );
            })}

            {/* Center label */}
            {centerLabel && (
                <Html center distanceFactor={3} style={{ pointerEvents: 'none' }}>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                    >
                        <span
                            style={{
                                color: '#F5A86C',
                                fontFamily: 'var(--font-mono, monospace)',
                                fontSize: '20px',
                                fontWeight: 700,
                            }}
                        >
                            {Math.round((totalValue / maxValue) * 100)}%
                        </span>
                        <span
                            style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontFamily: 'var(--font-sans, system-ui)',
                                fontSize: '11px',
                                fontWeight: 500,
                            }}
                        >
                            {centerLabel}
                        </span>
                    </div>
                </Html>
            )}
        </group>
    );
}

export default GlassRing3D;
