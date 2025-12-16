/**
 * OrbitalLoader3D - Premium 3D loading animation
 *
 * Features:
 * - Multiple rotating orbital rings
 * - Different rotation speeds/axes
 * - Glowing particles on rings
 * - Pulsing center core
 * - 3D depth perspective
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

export interface OrbitalLoader3DProps {
    size?: number;
    color?: string;
    speed?: number;
    ringCount?: number;
    particlesPerRing?: number;
    showCore?: boolean;
    position?: [number, number, number];
}

// ============================================================================
// ORBITAL RING WITH PARTICLES
// ============================================================================

function OrbitalRingWithParticles({
    radius,
    thickness,
    color,
    rotationSpeed,
    tiltX,
    tiltY,
    particleCount,
}: {
    radius: number;
    thickness: number;
    color: string;
    rotationSpeed: number;
    tiltX: number;
    tiltY: number;
    particleCount: number;
}) {
    const groupRef = useRef<THREE.Group>(null);

    // Generate particle positions around the ring
    const particles = useMemo(() => {
        return Array.from({ length: particleCount }, (_, i) => ({
            angle: (i / particleCount) * Math.PI * 2,
            size: 0.03 + Math.random() * 0.02,
            offset: Math.random() * Math.PI * 2,
        }));
    }, [particleCount]);

    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.z += rotationSpeed * 0.01;
        }
    });

    return (
        <group ref={groupRef} rotation={[tiltX, tiltY, 0]}>
            {/* Ring */}
            <mesh>
                <torusGeometry args={[radius, thickness, 16, 64]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.4}
                    roughness={0.3}
                    metalness={0.7}
                />
            </mesh>

            {/* Particles on ring */}
            {particles.map((particle, i) => {
                const x = Math.cos(particle.angle) * radius;
                const y = Math.sin(particle.angle) * radius;

                return (
                    <mesh key={i} position={[x, y, 0]}>
                        <sphereGeometry args={[particle.size, 12, 12]} />
                        <meshStandardMaterial
                            color="#ffffff"
                            emissive={color}
                            emissiveIntensity={0.8}
                            transparent
                            opacity={0.9}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

// ============================================================================
// PULSING CORE
// ============================================================================

function PulsingCore({
    size,
    color,
    pulseSpeed,
}: {
    size: number;
    color: string;
    pulseSpeed: number;
}) {
    const coreRef = useRef<THREE.Mesh>(null);
    const glowRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        const pulse = Math.sin(state.clock.elapsedTime * pulseSpeed) * 0.15;

        if (coreRef.current) {
            coreRef.current.scale.setScalar(1 + pulse);
        }

        if (glowRef.current) {
            const material = glowRef.current.material as THREE.MeshBasicMaterial;
            material.opacity = 0.2 + pulse * 0.3;
            glowRef.current.scale.setScalar(1.5 + pulse);
        }
    });

    return (
        <group>
            {/* Outer glow */}
            <mesh ref={glowRef}>
                <sphereGeometry args={[size * 1.5, 32, 32]} />
                <meshBasicMaterial
                    color={color}
                    transparent
                    opacity={0.2}
                    side={THREE.BackSide}
                />
            </mesh>

            {/* Glass core */}
            <mesh ref={coreRef}>
                <sphereGeometry args={[size, 32, 32]} />
                <MeshTransmissionMaterial
                    backside
                    samples={4}
                    resolution={256}
                    transmission={0.95}
                    roughness={0.1}
                    thickness={0.3}
                    ior={1.5}
                    chromaticAberration={0.02}
                    color={color}
                    attenuationDistance={0.3}
                    attenuationColor={color}
                />
            </mesh>

            {/* Inner glow */}
            <mesh>
                <sphereGeometry args={[size * 0.5, 16, 16]} />
                <meshStandardMaterial
                    color="#ffffff"
                    emissive={color}
                    emissiveIntensity={1.5}
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Point light */}
            <pointLight color={color} intensity={1} distance={3} decay={2} />
        </group>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OrbitalLoader3D({
    size = 1,
    color = '#F5A86C',
    speed = 1,
    ringCount = 3,
    particlesPerRing = 6,
    showCore = true,
    position = [0, 0, 0],
}: OrbitalLoader3DProps) {
    const groupRef = useRef<THREE.Group>(null);

    // Generate ring configurations
    const rings = useMemo(() => {
        return Array.from({ length: ringCount }, (_, i) => ({
            radius: size * (0.5 + i * 0.3),
            thickness: 0.015,
            rotationSpeed: speed * (1.5 - i * 0.3) * (i % 2 === 0 ? 1 : -1),
            tiltX: Math.PI * (0.1 + i * 0.2),
            tiltY: Math.PI * (0.05 + i * 0.15),
            particleCount: particlesPerRing,
        }));
    }, [size, speed, ringCount, particlesPerRing]);

    // Slow rotation of entire assembly
    useFrame(() => {
        if (groupRef.current) {
            groupRef.current.rotation.y += 0.002 * speed;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            {/* Core */}
            {showCore && (
                <PulsingCore size={size * 0.15} color={color} pulseSpeed={speed * 3} />
            )}

            {/* Orbital rings */}
            {rings.map((ring, i) => (
                <OrbitalRingWithParticles
                    key={i}
                    radius={ring.radius}
                    thickness={ring.thickness}
                    color={color}
                    rotationSpeed={ring.rotationSpeed}
                    tiltX={ring.tiltX}
                    tiltY={ring.tiltY}
                    particleCount={ring.particleCount}
                />
            ))}
        </group>
    );
}

export default OrbitalLoader3D;
