/**
 * WaveformMesh - Premium 3D mesh that responds to data
 *
 * Features:
 * - Wave animation based on values
 * - Gradient coloring by height
 * - Used for: audio viz, activity streams, CPU/memory waves
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

export interface WaveformMesh3DProps {
    data: number[];
    width?: number;
    depth?: number;
    maxHeight?: number;
    resolution?: number;
    colorStart?: string;
    colorEnd?: string;
    wireframe?: boolean;
    animate?: boolean;
    waveSpeed?: number;
    position?: [number, number, number];
    smoothing?: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function interpolateColor(color1: THREE.Color, color2: THREE.Color, factor: number): THREE.Color {
    const result = color1.clone();
    result.lerp(color2, factor);
    return result;
}

function smoothData(data: number[], smoothing: number): number[] {
    if (smoothing <= 1) return data;

    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;
        for (let j = Math.max(0, i - smoothing); j <= Math.min(data.length - 1, i + smoothing); j++) {
            sum += data[j];
            count++;
        }
        result.push(sum / count);
    }
    return result;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function WaveformMesh3D({
    data,
    width = 4,
    depth = 2,
    maxHeight = 1,
    resolution = 64,
    colorStart = '#1a8754',
    colorEnd = '#c41e3a',
    wireframe = false,
    animate = true,
    waveSpeed = 1,
    position = [0, 0, 0],
    smoothing = 2,
}: WaveformMesh3DProps) {
    const meshRef = useRef<THREE.Mesh>(null);
    const geometryRef = useRef<THREE.PlaneGeometry>(null);

    // Smooth the data
    const smoothedData = useMemo(() => smoothData(data, smoothing), [data, smoothing]);

    // Update geometry based on data
    useEffect(() => {
        if (!geometryRef.current) return;

        const positions = geometryRef.current.attributes.position;
        const colorsArray = new Float32Array(positions.count * 3);
        const colorStart3 = new THREE.Color(colorStart);
        const colorEnd3 = new THREE.Color(colorEnd);

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);

            // Map x position to data index
            const normalizedX = (x + width / 2) / width;
            const dataIndex = Math.floor(normalizedX * (smoothedData.length - 1));
            const dataValue = smoothedData[dataIndex] || 0;

            // Create wave effect along z
            const zFactor = Math.abs(z) / (depth / 2);
            const height = dataValue * maxHeight * (1 - zFactor * 0.5);

            positions.setY(i, height);

            // Color based on height
            const colorFactor = height / maxHeight;
            const vertexColor = interpolateColor(colorStart3, colorEnd3, colorFactor);
            colorsArray[i * 3] = vertexColor.r;
            colorsArray[i * 3 + 1] = vertexColor.g;
            colorsArray[i * 3 + 2] = vertexColor.b;
        }

        geometryRef.current.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
        positions.needsUpdate = true;
        geometryRef.current.computeVertexNormals();
    }, [smoothedData, width, depth, maxHeight, resolution, colorStart, colorEnd]);

    // Animation
    useFrame((state) => {
        if (!animate || !geometryRef.current) return;

        const positions = geometryRef.current.attributes.position;
        const time = state.clock.elapsedTime * waveSpeed;

        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);

            // Map x position to data index
            const normalizedX = (x + width / 2) / width;
            const dataIndex = Math.floor(normalizedX * (smoothedData.length - 1));
            const baseValue = smoothedData[dataIndex] || 0;

            // Add animated wave
            const wave = Math.sin(time * 2 + normalizedX * 10) * 0.05;
            const zFactor = Math.abs(z) / (depth / 2);
            const height = baseValue * maxHeight * (1 - zFactor * 0.5) + wave;

            positions.setY(i, Math.max(0, height));
        }

        positions.needsUpdate = true;
    });

    return (
        <group position={position}>
            <mesh ref={meshRef} castShadow receiveShadow>
                <planeGeometry
                    ref={geometryRef}
                    args={[width, depth, resolution, Math.floor(resolution / 2)]}
                />
                <meshStandardMaterial
                    vertexColors
                    wireframe={wireframe}
                    side={THREE.DoubleSide}
                    roughness={0.4}
                    metalness={0.6}
                    transparent
                    opacity={0.9}
                />
            </mesh>

            {/* Base reflection plane */}
            <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[width * 1.2, depth * 1.2]} />
                <meshStandardMaterial
                    color="#1a1a1a"
                    transparent
                    opacity={0.3}
                    roughness={0.9}
                />
            </mesh>

            {/* Grid lines for depth */}
            <gridHelper
                args={[width, 10, '#333333', '#222222']}
                position={[0, -0.005, 0]}
            />
        </group>
    );
}

// ============================================================================
// AUDIO WAVEFORM VARIANT
// ============================================================================

export interface AudioWaveform3DProps {
    frequencies: number[];
    width?: number;
    depth?: number;
    maxHeight?: number;
    color?: string;
    position?: [number, number, number];
}

export function AudioWaveform3D({
    frequencies,
    width = 4,
    depth = 0.5,
    maxHeight = 1,
    color = '#F5A86C',
    position = [0, 0, 0],
}: AudioWaveform3DProps) {
    const groupRef = useRef<THREE.Group>(null);
    const barsRef = useRef<THREE.Mesh[]>([]);

    const barWidth = width / frequencies.length;

    useFrame(() => {
        frequencies.forEach((freq, i) => {
            if (barsRef.current[i]) {
                const targetHeight = Math.max(0.02, freq * maxHeight);
                const mesh = barsRef.current[i];
                mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetHeight, 0.3);
                mesh.position.y = mesh.scale.y / 2;
            }
        });
    });

    return (
        <group ref={groupRef} position={position}>
            {frequencies.map((_, i) => {
                const x = (i - frequencies.length / 2) * barWidth + barWidth / 2;

                return (
                    <mesh
                        key={i}
                        ref={(el) => {
                            if (el) barsRef.current[i] = el;
                        }}
                        position={[x, 0, 0]}
                    >
                        <boxGeometry args={[barWidth * 0.8, 1, depth]} />
                        <meshStandardMaterial
                            color={color}
                            emissive={color}
                            emissiveIntensity={0.3}
                            transparent
                            opacity={0.8}
                            roughness={0.3}
                            metalness={0.7}
                        />
                    </mesh>
                );
            })}
        </group>
    );
}

export default WaveformMesh3D;
