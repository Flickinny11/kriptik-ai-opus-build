/**
 * EnergyCore3D - Premium pulsing energy sphere visualization
 *
 * Features:
 * - Pulsing energy sphere core
 * - Orbiting energy streams
 * - Particle absorption effect
 * - Glow intensity based on activity level
 * - Sci-fi reactor aesthetic
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

export interface EnergyCore3DProps {
    activityLevel?: number; // 0-1 scale
    color?: string;
    size?: number;
    pulseSpeed?: number;
    particleCount?: number;
    showOrbitRings?: boolean;
    ringCount?: number;
    position?: [number, number, number];
}

// ============================================================================
// PARTICLE SYSTEM
// ============================================================================

function EnergyParticles({
    count,
    color,
    coreRadius,
    activityLevel,
}: {
    count: number;
    color: string;
    coreRadius: number;
    activityLevel: number;
}) {
    const pointsRef = useRef<THREE.Points>(null);
    const particleData = useRef<{
        positions: Float32Array;
        velocities: Float32Array;
        phases: Float32Array;
    }>();

    // Initialize particles
    useMemo(() => {
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count * 3);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // Start particles at random positions around core
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = coreRadius * 2 + Math.random() * 2;

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Random inward velocity
            velocities[i * 3] = -positions[i * 3] * 0.02;
            velocities[i * 3 + 1] = -positions[i * 3 + 1] * 0.02;
            velocities[i * 3 + 2] = -positions[i * 3 + 2] * 0.02;

            phases[i] = Math.random() * Math.PI * 2;
        }

        particleData.current = { positions, velocities, phases };
    }, [count, coreRadius]);

    useFrame((state, delta) => {
        if (!pointsRef.current || !particleData.current) return;

        const positions = pointsRef.current.geometry.attributes.position
            .array as Float32Array;
        const { velocities, phases } = particleData.current;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Update position
            positions[i3] += velocities[i3] * activityLevel * 60 * delta;
            positions[i3 + 1] += velocities[i3 + 1] * activityLevel * 60 * delta;
            positions[i3 + 2] += velocities[i3 + 2] * activityLevel * 60 * delta;

            // Calculate distance from center
            const dist = Math.sqrt(
                positions[i3] ** 2 + positions[i3 + 1] ** 2 + positions[i3 + 2] ** 2
            );

            // Reset particle when it reaches core
            if (dist < coreRadius * 0.5) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const r = coreRadius * 2 + Math.random() * 2;

                positions[i3] = r * Math.sin(phi) * Math.cos(theta);
                positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                positions[i3 + 2] = r * Math.cos(phi);

                velocities[i3] = -positions[i3] * 0.015;
                velocities[i3 + 1] = -positions[i3 + 1] * 0.015;
                velocities[i3 + 2] = -positions[i3 + 2] * 0.015;
            }

            // Add spiral motion
            const angle = state.clock.elapsedTime * 0.5 + phases[i];
            positions[i3] += Math.sin(angle) * 0.01;
            positions[i3 + 2] += Math.cos(angle) * 0.01;
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    const positions = particleData.current?.positions || new Float32Array(count * 3);

    return (
        <points ref={pointsRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    args={[positions, 3]}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.04}
                color={color}
                transparent
                opacity={0.8 * activityLevel}
                sizeAttenuation
                blending={THREE.AdditiveBlending}
            />
        </points>
    );
}

// ============================================================================
// ORBITAL RINGS
// ============================================================================

function OrbitalRing({
    radius,
    thickness,
    color,
    rotationAxis,
    speed,
    activityLevel,
}: {
    radius: number;
    thickness: number;
    color: string;
    rotationAxis: [number, number, number];
    speed: number;
    activityLevel: number;
}) {
    const ringRef = useRef<THREE.Mesh>(null);

    useFrame(() => {
        if (!ringRef.current) return;
        ringRef.current.rotation.x += speed * activityLevel * 0.01;
        ringRef.current.rotation.y += speed * activityLevel * 0.008;
    });

    return (
        <mesh ref={ringRef} rotation={rotationAxis}>
            <torusGeometry args={[radius, thickness, 16, 64]} />
            <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.5 * activityLevel}
                transparent
                opacity={0.6 * activityLevel}
                side={THREE.DoubleSide}
            />
        </mesh>
    );
}

// ============================================================================
// ENERGY STREAMS
// ============================================================================

function EnergyStream({
    startRadius,
    endRadius,
    color,
    angle,
    activityLevel,
}: {
    startRadius: number;
    endRadius: number;
    color: string;
    angle: number;
    activityLevel: number;
}) {
    const streamRef = useRef<THREE.Group>(null);
    const particles = useRef<{ position: number; speed: number }[]>([]);

    // Initialize stream particles
    useMemo(() => {
        particles.current = Array.from({ length: 8 }, () => ({
            position: Math.random(),
            speed: 0.5 + Math.random() * 0.5,
        }));
    }, []);

    useFrame((state, delta) => {
        if (!streamRef.current) return;

        // Update particle positions
        particles.current.forEach((p) => {
            p.position += p.speed * activityLevel * delta;
            if (p.position > 1) p.position = 0;
        });

        // Rotate stream
        streamRef.current.rotation.y = angle + state.clock.elapsedTime * 0.3;
    });

    return (
        <group ref={streamRef}>
            {particles.current.map((p, i) => {
                const t = p.position;
                const r = startRadius + (endRadius - startRadius) * (1 - t);
                const y = t * 0.5;

                return (
                    <mesh key={i} position={[r, y, 0]}>
                        <sphereGeometry args={[0.03 * (1 - t * 0.5), 8, 8]} />
                        <meshStandardMaterial
                            color={color}
                            emissive={color}
                            emissiveIntensity={activityLevel}
                            transparent
                            opacity={activityLevel * (1 - t * 0.5)}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function EnergyCore3D({
    activityLevel = 0.7,
    color = '#F5A86C',
    size = 1,
    pulseSpeed = 1,
    particleCount = 100,
    showOrbitRings = true,
    ringCount = 3,
    position = [0, 0, 0],
}: EnergyCore3DProps) {
    const coreRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);
    const innerGlowRef = useRef<THREE.Mesh>(null);

    const coreRadius = size * 0.3;

    // Core pulsing animation
    useFrame((state) => {
        const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed * 2) * 0.1 * activityLevel;

        if (coreRef.current) {
            coreRef.current.scale.setScalar(1 + pulse);
        }

        if (glowRef.current) {
            const material = glowRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = 0.15 + pulse * 0.5;
            glowRef.current.scale.setScalar(1.5 + pulse * 2);
        }

        if (innerGlowRef.current) {
            innerGlowRef.current.rotation.y += 0.01 * activityLevel;
            innerGlowRef.current.rotation.z += 0.005 * activityLevel;
        }
    });

    // Generate orbital ring configurations
    const rings = useMemo(
        () =>
            Array.from({ length: ringCount }, (_, i) => ({
                radius: coreRadius * (1.5 + i * 0.5),
                thickness: 0.02,
                rotationAxis: [
                    Math.PI * (0.2 + i * 0.3),
                    Math.PI * (0.1 + i * 0.2),
                    0,
                ] as [number, number, number],
                speed: 1 - i * 0.2,
            })),
        [ringCount, coreRadius]
    );

    // Generate energy stream configurations
    const streams = useMemo(
        () =>
            Array.from({ length: 6 }, (_, i) => ({
                angle: (i / 6) * Math.PI * 2,
            })),
        []
    );

    return (
        <group position={position}>
            {/* Outer glow */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[coreRadius * 2, 32, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.15}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Core sphere with glass material */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[coreRadius, 64, 64]} />
                <MeshTransmissionMaterial
                    backside
                    samples={8}
                    resolution={512}
                    transmission={0.9}
                    roughness={0.05}
                    thickness={0.5}
                    ior={1.5}
                    chromaticAberration={0.03}
                    distortion={0.2}
                    distortionScale={0.3}
                    temporalDistortion={0.2}
                    color={color}
                    attenuationDistance={0.3}
                    attenuationColor={color}
                />
            </mesh>

            {/* Inner energy glow */}
            <mesh ref={innerGlowRef}>
                <sphereGeometry args={[coreRadius * 0.6, 32, 32]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive={color}
                    emissiveIntensity={activityLevel * 2}
                    transparent
                    opacity={0.8}
                />
            </mesh>

            {/* Orbiting rings */}
            {showOrbitRings &&
                rings.map((ring, i) => (
                    <OrbitalRing
                        key={`ring-${i}`}
                        radius={ring.radius}
                        thickness={ring.thickness}
                        color={color}
                        rotationAxis={ring.rotationAxis}
                        speed={ring.speed}
                        activityLevel={activityLevel}
                    />
                ))}

            {/* Energy streams */}
            {streams.map((stream, i) => (
                <EnergyStream
                    key={`stream-${i}`}
                    startRadius={coreRadius * 2}
                    endRadius={coreRadius * 0.5}
                    color={color}
                    angle={stream.angle}
                    activityLevel={activityLevel}
                />
            ))}

            {/* Particle absorption effect */}
            <EnergyParticles
                count={particleCount}
                color={color}
                coreRadius={coreRadius}
                activityLevel={activityLevel}
            />

            {/* Point light for core illumination */}
            <pointLight
                color={color}
                intensity={activityLevel * 2}
                distance={3}
                decay={2}
            />
        </group>
    );
}

export default EnergyCore3D;
